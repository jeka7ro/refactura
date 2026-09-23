import { getDb } from "./db";
import { integrations, reInvoices } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

const ANAF_UPLOAD_URL =
  "https://api.anaf.ro/prod/FCTEL/rest/upload?standard=UBL&cif=";
// For testing you might use:
// const ANAF_UPLOAD_URL = "https://api.anaf.ro/test/FCTEL/rest/upload?standard=UBL&cif=";

export async function refreshSpvToken(intg: any): Promise<string | null> {
  if (!intg?.apiSecret) return null;
  const db = await getDb();
  if (!db) return null;

  const clientId = process.env.SPV_CLIENT_ID;
  const clientSecret = process.env.SPV_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch("https://logincert.anaf.ro/anaf-oauth2/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: intg.apiSecret,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    if (!res.ok) {
      console.error(`[SPV Auth] Token refresh failed HTTP ${res.status}:`, await res.text());
      return null;
    }

    const data = await res.json();
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (data.expires_in || 7776000));

    await db
      .update(integrations)
      .set({
        apiKey: data.access_token,
        apiSecret: data.refresh_token || intg.apiSecret,
        tokenExpiresAt: expiresAt,
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, intg.id));

    console.log(`[SPV Auth] Successfully refreshed token for integration ${intg.id}, valid until ${expiresAt.toISOString()}`);
    return data.access_token;
  } catch (err) {
    console.error(`[SPV Auth] Error during token refresh:`, err);
    return null;
  }
}

export async function getValidSpvToken(tenantId: number): Promise<{ token: string; integration: any } | null> {
  const db = await getDb();
  if (!db) return null;

  const [intg] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.tenantId, tenantId),
        eq(integrations.provider, "spv"),
        eq(integrations.status, "active")
      )
    )
    .limit(1);

  if (!intg?.apiKey) return null;

  const now = new Date();
  const isExpiring = intg.tokenExpiresAt
    ? intg.tokenExpiresAt.getTime() - now.getTime() < 10 * 60 * 1000 // 10 minutes buffer
    : false;

  if (isExpiring && intg.apiSecret) {
    console.log(`[SPV Auth] Token expired or expiring soon for tenant ${tenantId}. Refreshing...`);
    const refreshed = await refreshSpvToken(intg);
    if (refreshed) {
      return { token: refreshed, integration: { ...intg, apiKey: refreshed } };
    }
  }

  return { token: intg.apiKey, integration: intg };
}

export async function uploadInvoiceToSPV(
  tenantId: number,
  invoiceId: number,
  xmlContent: string,
  cif: string
): Promise<{ success: boolean; index_incarcare?: string; error?: string }> {
  try {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not connected" };

    const tokenData = await getValidSpvToken(tenantId);
    if (!tokenData || !tokenData.token) {
      return { success: false, error: "SPV Nu este integrat sau token lipsă." };
    }

    const cleanCif = (cif || "").replace(/\D/g, "");
    if (!cleanCif) {
      return { success: false, error: "CIF/CUI invalid sau lipsă pentru trimitere SPV." };
    }

    let token = tokenData.token;
    const url = `${ANAF_UPLOAD_URL}${cleanCif}`;

    console.log(
      `[SPV Upload] Trimitere factura ID ${invoiceId} pentru CIF ${cleanCif}`
    );

    let response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/xml",
      },
      body: xmlContent,
    });

    let responseText = await response.text();

    // Auto-retry on 401 with immediate refresh
    if (response.status === 401 && tokenData.integration?.apiSecret) {
      console.log(`[SPV Upload] Got 401 Unauthorized. Attempting immediate token refresh...`);
      const refreshedToken = await refreshSpvToken(tokenData.integration);
      if (refreshedToken) {
        token = refreshedToken;
        response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/xml",
          },
          body: xmlContent,
        });
        responseText = await response.text();
      }
    }

    console.log(
      `[SPV Upload] Status HTTP: ${response.status}. Răspuns: ${responseText}`
    );

    let errorMatch =
      responseText.match(/errorMessage=["'](.*?)["']/i) ||
      responseText.match(/<Errors[^>]*>([\s\S]*?)<\/Errors>/i) ||
      responseText.match(/<eroare>(.*?)<\/eroare>/i);

    if (!response.ok) {
      const errMsg = errorMatch ? errorMatch[1].trim() : responseText;
      return {
        success: false,
        error: `Eroare ${response.status}: ${errMsg}`,
      };
    }

    // Response structure:
    // <?xml version="1.0" encoding="UTF-8" standalone="yes"?><dateRsp><cui>42322117</cui><dateResponse><ExecutionStatus>0</ExecutionStatus><index_incarcare>66612345</index_incarcare></dateResponse></dateRsp>
    let indexMatch =
      responseText.match(/<index_incarcare>(\d+)<\/index_incarcare>/i) ||
      responseText.match(/index_incarcare=["'](\d+)["']/i);

    if (indexMatch && indexMatch[1]) {
      const spvIndex = indexMatch[1];

      // Update DB
      await db
        .update(reInvoices)
        .set({
          spvIndex,
          spvStatus: "in_procesare",
          spvSentAt: new Date(),
          rawXml: xmlContent,
        })
        .where(eq(reInvoices.id, invoiceId));

      return { success: true, index_incarcare: spvIndex };
    } else {
      // Failed to parse index, likely an ANAF error response
      const errMsg = errorMatch ? errorMatch[1].trim() : responseText;
      await db
        .update(reInvoices)
        .set({
          spvStatus: "eroare",
          spvError: errMsg,
          spvSentAt: new Date(),
          rawXml: xmlContent,
        })
        .where(eq(reInvoices.id, invoiceId));

      return { success: false, error: `Răspuns invalid ANAF: ${errMsg}` };
    }
  } catch (error: any) {
    console.error("[SPV Upload] Eroare critică:", error);
    return { success: false, error: error.message };
  }
}
