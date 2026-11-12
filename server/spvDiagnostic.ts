import { getDb } from "./db";
import { integrations, tenants } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getValidSpvToken } from "./anafApi";

export interface SpvTestResult {
  status: "connected" | "warning" | "error" | "not_configured";
  connected: boolean;
  latencyMs: number | null;
  cui: string;
  tokenExpiresAt: string | null;
  daysRemaining: number | null;
  isExpired: boolean;
  message: string;
  detail: string | null;
  messagesCountLastDay?: number;
}

/**
 * Testează conexiunea live la API-ul ANAF SPV pentru un tenant fără a altera
 * nicio factură, cron sau flux de import SAGA.
 */
export async function testSpvConnection(tenantId: number): Promise<SpvTestResult> {
  const db = await getDb();
  if (!db) {
    return {
      status: "error",
      connected: false,
      latencyMs: null,
      cui: "",
      tokenExpiresAt: null,
      daysRemaining: null,
      isExpired: false,
      message: "Baza de date locală nu este disponibilă.",
      detail: "Nu s-a putut inițializa conexiunea la DB.",
    };
  }

  // 1. Preluare tenant și CUI
  const [tenant] = await db
    .select({ cui: tenants.cui, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, tenantId));

  const cleanCif = (tenant?.cui || "").replace(/^RO/i, "").trim();

  // 2. Verificare integrare SPV în DB
  const [spvIntg] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.tenantId, tenantId),
        eq(integrations.provider, "spv")
      )
    )
    .limit(1);

  if (!spvIntg || !spvIntg.apiKey) {
    return {
      status: "not_configured",
      connected: false,
      latencyMs: null,
      cui: cleanCif,
      tokenExpiresAt: null,
      daysRemaining: null,
      isExpired: false,
      message: "Conexiunea SPV ANAF nu este configurată pentru această firmă.",
      detail: "Autentificați-vă prin butonul 'Conectează ANAF SPV' cu certificatul digital.",
    };
  }

  // 3. Verificare dată expirare token
  const now = new Date();
  const tokenExpiresAt = spvIntg.tokenExpiresAt ? new Date(spvIntg.tokenExpiresAt) : null;
  let daysRemaining: number | null = null;
  let isExpired = false;

  if (tokenExpiresAt) {
    const diffMs = tokenExpiresAt.getTime() - now.getTime();
    daysRemaining = Math.round(diffMs / (24 * 3600 * 1000));
    isExpired = diffMs <= 0;
  }

  // 4. Preluare / Reîmprospătare token valid prin buffer-ul securizat
  let tokenInfo: { token: string; integration: any } | null = null;
  try {
    tokenInfo = await getValidSpvToken(tenantId);
  } catch (err: any) {
    console.error("[SPV Test] Error getting valid token:", err?.message);
  }

  const effectiveToken = tokenInfo?.token || spvIntg.apiKey;

  if (!effectiveToken) {
    return {
      status: "error",
      connected: false,
      latencyMs: null,
      cui: cleanCif,
      tokenExpiresAt: tokenExpiresAt ? tokenExpiresAt.toISOString() : null,
      daysRemaining,
      isExpired: true,
      message: "Tokenul de acces SPV este expirat și nu a putut fi reîmprospătat automat.",
      detail: "Reautorizați conexiunea SPV prin pagina de Integrări.",
    };
  }

  if (!cleanCif) {
    return {
      status: "warning",
      connected: false,
      latencyMs: null,
      cui: "",
      tokenExpiresAt: tokenExpiresAt ? tokenExpiresAt.toISOString() : null,
      daysRemaining,
      isExpired,
      message: "Firma nu are configurat un CUI valid pentru interogarea SPV.",
      detail: "Verificați datele de identificare fiscală din Setări Firmă.",
    };
  }

  // 5. Test ping live către endpoint-ul ANAF listaMesajeFactura (zile=1, read-only)
  const startTime = Date.now();
  const testUrl = `https://api.anaf.ro/prod/FCTEL/rest/listaMesajeFactura?zile=1&cif=${cleanCif}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    const res = await fetch(testUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${effectiveToken}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const latencyMs = Date.now() - startTime;

    if (res.status === 200) {
      let count = 0;
      try {
        const data = await res.json();
        if (Array.isArray(data?.mesaje)) count = data.mesaje.length;
      } catch {}

      const warningDays = daysRemaining !== null && daysRemaining <= 10;
      return {
        status: warningDays ? "warning" : "connected",
        connected: true,
        latencyMs,
        cui: cleanCif,
        tokenExpiresAt: tokenExpiresAt ? tokenExpiresAt.toISOString() : null,
        daysRemaining,
        isExpired: false,
        message: warningDays
          ? `Conexiunea la ANAF SPV este activă (${latencyMs}ms), dar tokenul expiră în ${daysRemaining} zile.`
          : `Conexiune excelentă la ANAF SPV (${latencyMs}ms). Serviciul e-Factura funcționează normal.`,
        detail: `ANAF a răspuns cu succes (Cod 200). S-au identificat ${count} mesaje recente pentru CUI ${cleanCif}.`,
        messagesCountLastDay: count,
      };
    }

    if (res.status === 401 || res.status === 403) {
      return {
        status: "error",
        connected: false,
        latencyMs,
        cui: cleanCif,
        tokenExpiresAt: tokenExpiresAt ? tokenExpiresAt.toISOString() : null,
        daysRemaining,
        isExpired: true,
        message: "Eroare de autorizare la ANAF (Cod 401/403). Tokenul a fost revocat sau respins.",
        detail: "Trebuie să reautorizați accesul cu certificatul digital (semnătură electronică).",
      };
    }

    if (res.status === 500 || res.status === 502 || res.status === 503 || res.status === 504) {
      return {
        status: "warning",
        connected: false,
        latencyMs,
        cui: cleanCif,
        tokenExpiresAt: tokenExpiresAt ? tokenExpiresAt.toISOString() : null,
        daysRemaining,
        isExpired: false,
        message: `Serverele ANAF sunt temporar indisponibile sau în mentenanță (Cod HTTP ${res.status}).`,
        detail: "Tokenul local este valid, dar infrastructura ANAF nu răspunde în acest moment.",
      };
    }

    const text = await res.text().catch(() => "");
    return {
      status: "warning",
      connected: false,
      latencyMs,
      cui: cleanCif,
      tokenExpiresAt: tokenExpiresAt ? tokenExpiresAt.toISOString() : null,
      daysRemaining,
      isExpired: false,
      message: `ANAF a returnat codul ${res.status}.`,
      detail: text.slice(0, 200) || "Răspuns neașteptat de la serverul ANAF.",
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    if (err?.name === "AbortError" || err?.message?.includes("aborted")) {
      return {
        status: "error",
        connected: false,
        latencyMs: 9000,
        cui: cleanCif,
        tokenExpiresAt: tokenExpiresAt ? tokenExpiresAt.toISOString() : null,
        daysRemaining,
        isExpired: false,
        message: "Timpul de răspuns al serverului ANAF a expirat (Timeout > 9 secunde).",
        detail: "Serverele ANAF sunt supraîncărcate sau conexiunea este blocată de firewall-ul ANAF.",
      };
    }

    return {
      status: "error",
      connected: false,
      latencyMs,
      cui: cleanCif,
      tokenExpiresAt: tokenExpiresAt ? tokenExpiresAt.toISOString() : null,
      daysRemaining,
      isExpired: false,
      message: `Eroare de rețea la interogarea ANAF: ${err?.message || "Eșec la conectare"}`,
      detail: "Verificați conectivitatea la internet și starea portalului anaf.ro.",
    };
  }
}
