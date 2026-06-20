/**
 * Oblio API Sync — TRADE INVEST NETWORK S.R.L. (CIF 42322117)
 * Auth: email + API Secret → Bearer token → fetch invoices → save to invoiceArchive
 */
import { createInvoiceArchiveEntry, getDb } from "./db";
import { integrations, invoiceArchive, clients } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

const OBLIO_TOKEN_URL = "https://www.oblio.eu/api/authorize/token";
const OBLIO_INVOICE_LIST_URL = "https://www.oblio.eu/api/docs/invoice/list";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getOblioToken(): Promise<string> {
  const email = process.env.OBLIO_EMAIL;
  const secret = process.env.OBLIO_API_SECRET;

  if (!email || !secret) {
    throw new Error("OBLIO_EMAIL sau OBLIO_API_SECRET lipsesc din .env");
  }

  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const res = await fetch(OBLIO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: email,
      client_secret: secret,
      grant_type: "client_credentials",
    }).toString(),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Oblio auth failed: ${res.status} ${txt}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (parseInt(data.expires_in) || 3600) * 1000,
  };

  return cachedToken.token;
}

export async function syncOblioInvoices(tenantId: number): Promise<{ imported: number; skipped: number; clientsImported: number; errors: string[] }> {
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;
  let clientsImported = 0;

  const cif = process.env.OBLIO_CIF;
  if (!cif) {
    throw new Error("OBLIO_CIF lipsește din .env");
  }

  try {
    const token = await getOblioToken();
    console.log("[Oblio] Token obtained OK");

    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    // Fetch all pages of invoices
    let offset = 0;
    const limit = 50;
    let hasMore = true;

    while (hasMore) {
      const res = await fetch(`${OBLIO_INVOICE_LIST_URL}?cif=${cif}&limit=${limit}&offset=${offset}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Oblio list failed: ${res.status} ${txt}`);
      }

      const data = await res.json();
      const invoices = data.data || [];
      
      console.log(`[Oblio] Fetched ${invoices.length} invoices (offset=${offset})`);
      
      if (invoices.length < limit) {
        hasMore = false;
      }

      for (const inv of invoices) {
        try {
          // Build a unique identifier to avoid duplicates
          const invoiceNumber = `${inv.seriesName}-${inv.number}`;
          const oblioId = inv.id;

          // Check if already imported using oblio ID stored in notes
          const [existing] = await db
            .select({ id: invoiceArchive.id })
            .from(invoiceArchive)
            .where(and(
              eq(invoiceArchive.tenantId, tenantId),
              eq(invoiceArchive.source, "oblio"),
              eq(invoiceArchive.invoiceNumber, invoiceNumber)
            ));

          if (existing) {
            skipped++;
            continue;
          }

          // Skip draft invoices
          if (inv.draft === "1") {
            skipped++;
            continue;
          }

          // ── Auto-import client into clients table ──
          if (inv.client?.name && inv.client.name.trim()) {
            try {
              const clientCui = inv.client.cif || "";
              // Check if client already exists (by CUI or by name for this tenant)
              let clientExists = false;
              if (clientCui) {
                const [existingClient] = await db
                  .select({ id: clients.id })
                  .from(clients)
                  .where(and(eq(clients.tenantId, tenantId), eq(clients.cui, clientCui)));
                clientExists = !!existingClient;
              }
              
              if (!clientExists) {
                await db.insert(clients).values({
                  tenantId,
                  name: inv.client.name,
                  cui: clientCui || null,
                  address: inv.client.address || null,
                  city: inv.client.city || null,
                  country: "RO",
                  email: inv.client.email || null,
                  phone: inv.client.phone || null,
                  currency: inv.currency || "RON",
                  tva: inv.client.vatPayer === "1" ? 1 : 0,
                  isActive: 1,
                });
                clientsImported++;
                console.log(`[Oblio] New client added: ${inv.client.name}`);
              }
            } catch (e: any) {
              // Don't fail the invoice import if client upsert fails
              console.warn(`[Oblio] Could not upsert client ${inv.client.name}: ${e.message}`);
            }
          }

          const total = Math.abs(parseFloat(inv.total || "0"));
          // For storno invoices, total is negative — we keep abs value and note it
          const isStorno = inv.storno === "1";
          const isCanceled = inv.canceled === "1";

          await createInvoiceArchiveEntry({
            tenantId,
            source: "oblio",
            fileType: "other",
            fileName: `Oblio_${invoiceNumber}.pdf`,
            fileUrl: inv.link || undefined,
            invoiceNumber,
            supplierName: inv.client?.name || "",
            supplierCUI: inv.client?.cif || "",
            issueDate: inv.issueDate || "",
            dueDate: inv.dueDate || "",
            total: String(total),
            totalVAT: String(Math.round(total * 0.19 * 100) / 100),
            currency: inv.currency || "RON",
            status: isCanceled ? "archived" : "pending",
            notes: [
              `Oblio ID: ${oblioId}`,
              isStorno ? "STORNO" : "",
              isCanceled ? "ANULATĂ" : "",
              inv.collected === "1" ? "Încasată" : "",
            ].filter(Boolean).join(" | "),
          });

          imported++;
        } catch (e: any) {
          errors.push(`${inv.seriesName}-${inv.number}: ${e.message}`);
        }
      }

      offset += limit;
      if (invoices.length === 0) hasMore = false;
    }

    // Update integration status in DB
    const [existing] = await db.select().from(integrations)
      .where(and(eq(integrations.tenantId, tenantId), eq(integrations.provider, "oblio")));

    if (existing) {
      await db.update(integrations).set({
        status: "active",
        lastSyncAt: new Date(),
        syncCount: (existing.syncCount || 0) + imported,
      }).where(eq(integrations.id, existing.id));
    } else {
      await db.insert(integrations).values({
        tenantId,
        provider: "oblio",
        status: "active",
        lastSyncAt: new Date(),
        syncCount: imported,
      });
    }

    console.log(`[Oblio] Sync complete: imported=${imported}, skipped=${skipped}, clients=${clientsImported}, errors=${errors.length}`);

  } catch (e: any) {
    errors.push(e.message);
    console.error("[Oblio] Sync error:", e.message);
  }

  return { imported, skipped, clientsImported, errors };
}
