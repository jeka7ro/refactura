/**
 * SmartBill API Sync — facturi EMISE + PRIMITE cu descărcare PDF
 * Auth: Basic (email:apiToken) → fetch invoices → download PDF → save to invoiceArchive
 */
import { createInvoiceArchiveEntry, getDb } from "./db";
import { integrations, invoiceArchive, clients } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
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

  const email = process.env.SMARTBILL_EMAIL;
  const token = process.env.SMARTBILL_TOKEN;
  const cif = process.env.SMARTBILL_CIF;

  if (!email || !token || !cif) {
    throw new Error(
      "SMARTBILL_EMAIL, SMARTBILL_TOKEN sau SMARTBILL_CIF lipsesc din .env"
    );
  }

  const auth = getBasicAuth(email, token);

  try {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

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

          // Check duplicate
          const [existing] = await db
            .select({ id: invoiceArchive.id })
            .from(invoiceArchive)
            .where(
              and(
                eq(invoiceArchive.tenantId, tenantId),
                eq(invoiceArchive.source, "smartbill"),
                eq(invoiceArchive.direction, "in"),
                eq(invoiceArchive.invoiceNumber, invoiceNumber)
              )
            );
          if (existing) {
            skipped++;
            continue;
          }

          const supplierName =
            inv.supplier?.name || inv.supplierName || inv.client?.name || "";
          const supplierCui =
            inv.supplier?.vatCode ||
            inv.supplierVatCode ||
            inv.client?.vatCode ||
            "";

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
