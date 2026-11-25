/**
 * SmartBill API Sync — facturi EMISE + PRIMITE cu descărcare PDF
 * Auth: Basic (email:apiToken) → fetch invoices → download PDF → save to invoiceArchive
 */
import { createInvoiceArchiveEntry, getDb } from "./db";
import { integrations, invoiceArchive, clients, tenants } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { storagePut } from "./storage";

const SMARTBILL_API = "https://ws.smartbill.ro/SMBWS/api";

function getBasicAuth(email: string, token: string): string {
  return "Basic " + Buffer.from(`${email}:${token}`).toString("base64");
}

async function smartbillFetch(path: string, auth: string) {
  const res = await fetch(`${SMARTBILL_API}${path}`, {
    headers: {
      Authorization: auth,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`SmartBill API ${path} failed: ${res.status} ${txt}`);
  }
  return res.json();
}

async function downloadSmartBillPdf(
  auth: string,
  cif: string,
  seriesName: string,
  number: string
): Promise<{ key: string; url: string } | null> {
  try {
    const res = await fetch(
      `${SMARTBILL_API}/invoice/pdf?cif=${encodeURIComponent(cif)}&seriesname=${encodeURIComponent(seriesName)}&number=${encodeURIComponent(number)}`,
      {
        headers: {
          Authorization: auth,
          Accept: "application/octet-stream",
        },
      }
    );
    if (!res.ok) return null;

    const pdfBuffer = await res.arrayBuffer();
    const header = Buffer.from(pdfBuffer.slice(0, 5)).toString("utf8");
    if (!header.includes("%PDF")) return null;

    const result = await storagePut(
      `invoices/SB_${seriesName}-${number}.pdf`,
      Buffer.from(pdfBuffer),
      "application/pdf"
    );
    return result;
  } catch (e) {
    console.warn(
      `[SmartBill] PDF download failed for ${seriesName}-${number}:`,
      e
    );
    return null;
  }
}

export async function syncSmartBillInvoices(tenantId: number): Promise<{
  imported: number;
  skipped: number;
  clientsImported: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;
  let clientsImported = 0;

  try {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const [sbIntg] = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.tenantId, tenantId),
          eq(integrations.provider, "smartbill"),
          eq(integrations.status, "active")
        )
      );

    if (!sbIntg) {
      throw new Error(
        "Integrarea SmartBill nu este configurată sau este dezactivată pentru această firmă"
      );
    }

    let parsedCfg: any = {};
    for (const raw of [sbIntg.config, sbIntg.apiSecret, sbIntg.apiKey]) {
      if (!raw) continue;
      try {
        const obj = JSON.parse(raw);
        if (obj && typeof obj === "object") {
          parsedCfg = { ...parsedCfg, ...obj };
        }
      } catch {}
    }

    let email = String(parsedCfg.email || parsedCfg.username || "").trim();
    let token = String(
      parsedCfg.token || parsedCfg.apiToken || parsedCfg.apiKey || parsedCfg.secret || parsedCfg.apiSecret || ""
    ).trim();
    const cif = String(parsedCfg.cif || parsedCfg.cui || "").replace(/^RO/i, "").trim();

    if (!token && sbIntg.apiKey && !sbIntg.apiKey.trim().startsWith("{")) {
      const rawKey = sbIntg.apiKey.trim();
      if (rawKey.includes(":")) {
        const idx = rawKey.indexOf(":");
        if (!email) email = rawKey.slice(0, idx).trim();
        token = rawKey.slice(idx + 1).trim();
      } else {
        token = rawKey;
      }
    }
    if (!token && sbIntg.apiSecret && !sbIntg.apiSecret.trim().startsWith("{")) {
      token = sbIntg.apiSecret.trim();
    }

    if (!email || !token || !cif) {
      throw new Error(
        "Datele de conectare SmartBill (email, token API sau CIF) lipsesc din configurarea firmei"
      );
    }

    const [tenant] = await db
      .select({ cui: tenants.cui })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    const cleanTenantCif = String(tenant?.cui || "")
      .trim()
      .toUpperCase()
      .replace(/^RO/i, "")
      .replace(/[^A-Z0-9]/g, "");
    const cleanSbCif = String(cif)
      .trim()
      .toUpperCase()
      .replace(/^RO/i, "")
      .replace(/[^A-Z0-9]/g, "");
    if (!cleanTenantCif) {
      throw new Error("CUI-ul firmei nu este configurat în profilul companiei.");
    }
    if (cleanSbCif !== cleanTenantCif) {
      throw new Error(
        `CIF-ul din integrarea SmartBill (${cif}) nu corespunde cu CUI-ul firmei curente (${tenant?.cui}).`
      );
    }

    const auth = getBasicAuth(email, token);

    // ── 1. FACTURI EMISE ──────────────────────────────────────────
    console.log("[SmartBill] Fetching emitted invoices...");
    try {
      const emittedData = await smartbillFetch(
        `/invoice?cif=${encodeURIComponent(cif)}&startDate=2024-01-01&endDate=2030-12-31`,
        auth
      );
      const emittedInvoices = emittedData.invoices || emittedData.list || [];
      console.log(
        `[SmartBill] Found ${emittedInvoices.length} emitted invoices`
      );

      for (const inv of emittedInvoices) {
        try {
          const invoiceNumber =
            `${inv.seriesName || inv.series || ""}-${inv.number || ""}`.replace(
              /^-/,
              ""
            );

          // Check duplicate
          const [existing] = await db
            .select({ id: invoiceArchive.id })
            .from(invoiceArchive)
            .where(
              and(
                eq(invoiceArchive.tenantId, tenantId),
                eq(invoiceArchive.source, "smartbill"),
                eq(invoiceArchive.direction, "out"),
                eq(invoiceArchive.invoiceNumber, invoiceNumber)
              )
            );
          if (existing) {
            skipped++;
            continue;
          }

          // Download PDF
          let fileUrl = "";
          const pdfResult = await downloadSmartBillPdf(
            auth,
            cif,
            inv.seriesName || inv.series || "",
            String(inv.number || "")
          );
          if (pdfResult) fileUrl = pdfResult.url;

          // Auto-import client
          const clientName = inv.client?.name || inv.clientName || "";
          const clientCui =
            inv.client?.vatCode || inv.client?.cif || inv.clientVatCode || "";
          if (clientName) {
            try {
              let clientExists = false;
              if (clientCui) {
                const [ec] = await db
                  .select({ id: clients.id })
                  .from(clients)
                  .where(
                    and(
                      eq(clients.tenantId, tenantId),
                      eq(clients.cui, clientCui)
                    )
                  );
                clientExists = !!ec;
              }
              if (!clientExists) {
                await db.insert(clients).values({
                  tenantId,
                  name: clientName,
                  cui: clientCui || null,
                  address: inv.client?.address || null,
                  city: inv.client?.city || null,
                  country: "RO",
                  email: inv.client?.email || null,
                  phone: inv.client?.phone || null,
                  currency: inv.currency || "RON",
                  isActive: 1,
                });
                clientsImported++;
              }
            } catch (e: any) {
              console.warn(`[SmartBill] Client import error: ${e.message}`);
            }
          }

          await createInvoiceArchiveEntry({
            tenantId,
            source: "smartbill",
            direction: "out",
            fileType: "pdf",
            fileName: `SB_${invoiceNumber}.pdf`,
            fileUrl,
            invoiceNumber,
            supplierName: clientName,
            supplierCUI: clientCui,
            issueDate: inv.issueDate || inv.date || "",
            dueDate: inv.dueDate || "",
            total: String(parseFloat(inv.totalValue || inv.total || "0")),
            totalVAT: String(parseFloat(inv.taxValue || inv.totalVat || "0")),
            currency: inv.currency || "RON",
            status: inv.isCancelled ? "archived" : "pending",
          });
          imported++;
        } catch (e: any) {
          errors.push(`Emis ${inv.seriesName}-${inv.number}: ${e.message}`);
        }
      }
    } catch (e: any) {
      errors.push(`Emise: ${e.message}`);
      console.error("[SmartBill] Emitted fetch error:", e.message);
    }

    // ── 2. FACTURI PRIMITE ────────────────────────────────────────
    console.log("[SmartBill] Fetching received invoices...");
    try {
      const receivedData = await smartbillFetch(
        `/invoice/purchase?cif=${encodeURIComponent(cif)}&startDate=2024-01-01&endDate=2030-12-31`,
        auth
      );
      const receivedInvoices = receivedData.invoices || receivedData.list || [];
      console.log(
        `[SmartBill] Found ${receivedInvoices.length} received invoices`
      );

      for (const inv of receivedInvoices) {
        try {
          const invoiceNumber =
            `${inv.seriesName || inv.series || ""}-${inv.number || ""}`.replace(
              /^-/,
              ""
            );

          const supplierName =
            inv.supplier?.name || inv.supplierName || inv.client?.name || "";
          const supplierCui =
            inv.supplier?.vatCode ||
            inv.supplierVatCode ||
            inv.client?.vatCode ||
            "";
          const normalizedSupCui = String(supplierCui)
            .trim()
            .toUpperCase()
            .replace(/^RO/i, "")
            .replace(/[^A-Z0-9]/g, "");

          // Check duplicate by (invoiceNumber, normalized supplierCUI)
          const [existing] = await db
            .select({ id: invoiceArchive.id })
            .from(invoiceArchive)
            .where(
              and(
                eq(invoiceArchive.tenantId, tenantId),
                eq(invoiceArchive.direction, "in"),
                eq(invoiceArchive.invoiceNumber, invoiceNumber),
                sql`REPLACE(REPLACE(REPLACE(UPPER(TRIM(COALESCE(${invoiceArchive.supplierCUI}, ''))), 'RO', ''), ' ', ''), '-', '') = ${normalizedSupCui}`
              )
            );
          if (existing) {
            skipped++;
            continue;
          }

          await createInvoiceArchiveEntry({
            tenantId,
            source: "smartbill",
            direction: "in",
            fileType: "pdf",
            fileName: `SB_primita_${invoiceNumber}.pdf`,
            fileUrl: "",
            invoiceNumber,
            supplierName,
            supplierCUI: supplierCui,
            issueDate: inv.issueDate || inv.date || "",
            dueDate: inv.dueDate || "",
            total: String(parseFloat(inv.totalValue || inv.total || "0")),
            totalVAT: String(parseFloat(inv.taxValue || inv.totalVat || "0")),
            currency: inv.currency || "RON",
            status: "pending",
          });
          imported++;
        } catch (e: any) {
          errors.push(`Primită ${inv.seriesName}-${inv.number}: ${e.message}`);
        }
      }
    } catch (e: any) {
      errors.push(`Primite: ${e.message}`);
      console.error("[SmartBill] Received fetch error:", e.message);
    }

    // ── Update integration status ─────────────────────────────────
    const [existingIntg] = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.tenantId, tenantId),
          eq(integrations.provider, "smartbill")
        )
      );

    if (existingIntg) {
      await db
        .update(integrations)
        .set({
          status: "active",
          lastSyncAt: new Date(),
          syncCount: (existingIntg.syncCount || 0) + imported,
        })
        .where(eq(integrations.id, existingIntg.id));
    } else {
      await db.insert(integrations).values({
        tenantId,
        provider: "smartbill",
        status: "active",
        lastSyncAt: new Date(),
        syncCount: imported,
      });
    }

    console.log(
      `[SmartBill] Sync complete: imported=${imported}, skipped=${skipped}, clients=${clientsImported}, errors=${errors.length}`
    );
  } catch (e: any) {
    errors.push(e.message);
    console.error("[SmartBill] Sync error:", e.message);
  }

  return { imported, skipped, clientsImported, errors };
}
