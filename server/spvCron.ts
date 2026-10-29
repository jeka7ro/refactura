import cron from "node-cron";
import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import { getDb, createInvoiceArchiveEntry } from "./db";
import { integrations, invoiceArchive } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { convertXmlToPdf } from "./anafPdf";

// ── Correct ANAF e-Factura API URLs ─────────────────────────────────────────
const ANAF_LIST_URL = "https://api.anaf.ro/prod/FCTEL/rest/listaMesajeFactura";
const ANAF_DOWNLOAD_URL = "https://api.anaf.ro/prod/FCTEL/rest/descarcare";

// Parserul folosește removeNSPrefix, deci cheile sunt fără prefix (cbc:/cac:). Acceptam ambele variante.
const xmlPick = (o: any, k: string) => o?.[k] ?? o?.["cbc:" + k] ?? o?.["cac:" + k];

function parseLineVatPercent(item: any, isZeroVatInvoice = false): number {
  if (isZeroVatInvoice) return 0;
  let cat = xmlPick(item, "ClassifiedTaxCategory");
  if (Array.isArray(cat)) cat = cat[0];
  const catId = String(xmlPick(cat, "ID") || "").trim().toUpperCase();
  if (["O", "E", "Z", "AE", "K", "G"].includes(catId)) return 0;
  const p = xmlPick(cat, "Percent");
  const raw = p !== null && typeof p === "object" ? p["#text"] : p;
  const n = parseFloat(String(raw));
  return isNaN(n) ? 0 : n;
}

/**
 * Descarcă arhiva de erori de la ANAF și extrage mesajele concrete de validare
 */
async function fetchAnafErrorDetails(
  downloadId: string,
  fetchFn: (url: string, init?: RequestInit) => Promise<Response>
): Promise<string | null> {
  try {
    const errResp = await fetchFn(
      `${ANAF_DOWNLOAD_URL}?id=${downloadId}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!errResp.ok) return null;
    const buf = Buffer.from(await errResp.arrayBuffer());
    let errXml = "";
    if (buf.slice(0, 4).toString("hex") === "504b0304") {
      const zip = new AdmZip(buf);
      const xmlEntry = zip.getEntries().find(
        (e) =>
          e.entryName.toLowerCase().endsWith(".xml") &&
          !e.entryName.toLowerCase().includes("semnatura")
      );
      if (xmlEntry) errXml = xmlEntry.getData().toString("utf8");
    } else {
      errXml = buf.toString("utf8");
    }
    if (!errXml) return null;
    const errors: string[] = [];
    const errMsgMatches = Array.from(errXml.matchAll(/errorMessage="([^"]+)"/gi));
    for (const m of errMsgMatches) errors.push(m[1]);
    const descMatches = Array.from(errXml.matchAll(/descriere="([^"]+)"/gi));
    for (const m of descMatches) errors.push(m[1]);
    if (!errors.length) {
      const tagMatches = Array.from(errXml.matchAll(/<eroare[^>]*>([^<]+)<\/eroare>/gi));
      for (const m of tagMatches) errors.push(m[1]);
    }
    return errors.length > 0 ? errors.join("; ") : null;
  } catch (e: any) {
    console.warn(`[SPV Cron] Failed to fetch error details for ${downloadId}:`, e.message);
    return null;
  }
}

export function startSpvCron() {
  // Run every 4 hours
  cron.schedule("0 */4 * * *", async () => {
    console.log("[SPV Cron] Starting SPV synchronization job...");
    const result = await syncAllSpv();
    console.log(`[SPV Cron] Auto-cron done: imported=${result?.imported}, limitHit=${result?.limitHit}`);
  });
}

export async function syncAllSpv(zile: number = 60, targetTenantId?: number) {
  const db = await getDb();
  if (!db) return { imported: 0, limitHit: 0, limitDetails: [] };

  const conditions = [
    eq(integrations.provider, "spv"),
    eq(integrations.status, "active"),
  ];

  if (targetTenantId) {
    conditions.push(eq(integrations.tenantId, targetTenantId));
  }

  const spvIntegrations = await db
    .select()
    .from(integrations)
    .where(and(...conditions));

  let totalImported = 0;
  let totalLimitHit = 0;
  const totalLimitDetails: string[] = [];

  const { tenants } = await import("../drizzle/schema");
  const { getValidSpvToken, refreshSpvToken } = await import("./anafApi");
  
  for (const intg of spvIntegrations) {
    const tokenData = await getValidSpvToken(intg.tenantId);
    if (!tokenData?.token) {
      console.warn(`[SPV Cron] No valid SPV token for tenant ${intg.tenantId}`);
      continue;
    }
    let currentApiKey = tokenData.token;

    // Resilient fetch wrapper with automatic token refresh on 401
    const safeFetchAnaf = async (url: string, init?: RequestInit): Promise<Response> => {
      let resp = await fetch(url, {
        ...init,
        headers: {
          ...(init?.headers || {}),
          Authorization: `Bearer ${currentApiKey}`,
        },
      });
      if (resp.status === 401 && tokenData.integration?.apiSecret) {
        console.log(`[SPV Cron] 401 Unauthorized for tenant ${intg.tenantId}, refreshing token immediately...`);
        const refreshed = await refreshSpvToken(tokenData.integration);
        if (refreshed) {
          currentApiKey = refreshed;
          resp = await fetch(url, {
            ...init,
            headers: {
              ...(init?.headers || {}),
              Authorization: `Bearer ${currentApiKey}`,
            },
          });
        }
      }
      return resp;
    };

    const [tenant] = await db.select({ cui: tenants.cui }).from(tenants).where(eq(tenants.id, intg.tenantId));
    const rawCif = (tenant?.cui || "").trim();
    if (!rawCif) {
      console.warn(`[SPV Cron] Tenant ${intg.tenantId} nu are CUI configurat în setări. Se ignoră sincronizarea SPV.`);
      continue;
    }
    // Remove RO prefix if present for ANAF API
    const cif = rawCif.toUpperCase().replace(/^RO/, "");
    
    console.log(
      `[SPV Cron] Syncing for tenant ${intg.tenantId}, CIF ${cif}, zile=${zile}`
    );

    // 0. Poll status for any invoices currently "in_procesare" using stareMesaj
    try {
      const { emittedInvoices, reInvoices } = await import("../drizzle/schema");
      const { isNotNull } = await import("drizzle-orm");

      const pendingEmitted = await db
        .select()
        .from(emittedInvoices)
        .where(
          and(
            eq(emittedInvoices.tenantId, intg.tenantId),
            eq(emittedInvoices.spvStatus, "in_procesare"),
            isNotNull(emittedInvoices.spvIndex)
          )
        );

      for (const inv of pendingEmitted) {
        if (!inv.spvIndex) continue;
        try {
          const statusUrl = `https://api.anaf.ro/prod/FCTEL/rest/stareMesaj?id_incarcare=${inv.spvIndex}`;
          const sResp = await safeFetchAnaf(statusUrl, { signal: AbortSignal.timeout(10000) });
          if (sResp.ok) {
            const sText = await sResp.text();
            const stareMatch = sText.match(/stare="([^"]+)"/i);
            const stare = (stareMatch ? stareMatch[1] : "").toLowerCase();
            const idDescMatch = sText.match(/id_descarcare="([^"]+)"/i);
            const idDesc = idDescMatch ? idDescMatch[1] : "";

            if (stare === "ok") {
              await db
                .update(emittedInvoices)
                .set({
                  spvStatus: "validat",
                  spvError: null,
                  status: inv.status === "draft" ? "sent" : inv.status,
                })
                .where(eq(emittedInvoices.id, inv.id));
              console.log(`[SPV Cron] Emitted invoice ${inv.id} (index ${inv.spvIndex}) validated via stareMesaj`);
            } else if (stare === "nok") {
              let errText: string | null = null;
              if (idDesc) {
                errText = await fetchAnafErrorDetails(idDesc, safeFetchAnaf);
              }
              await db
                .update(emittedInvoices)
                .set({
                  spvStatus: "eroare",
                  spvError: errText || "Factura a fost respinsă de ANAF.",
                })
                .where(eq(emittedInvoices.id, inv.id));
              console.log(`[SPV Cron] Emitted invoice ${inv.id} (index ${inv.spvIndex}) rejected via stareMesaj: ${errText}`);
            }
          }
        } catch (pollErr: any) {
          console.warn(`[SPV Cron] Failed polling stareMesaj for emitted invoice ${inv.id}:`, pollErr.message);
        }
      }

      const pendingRe = await db
        .select()
        .from(reInvoices)
        .where(
          and(
            eq(reInvoices.tenantId, intg.tenantId),
            eq(reInvoices.spvStatus, "in_procesare"),
            isNotNull(reInvoices.spvIndex)
          )
        );

      for (const inv of pendingRe) {
        if (!inv.spvIndex) continue;
        try {
          const statusUrl = `https://api.anaf.ro/prod/FCTEL/rest/stareMesaj?id_incarcare=${inv.spvIndex}`;
          const sResp = await safeFetchAnaf(statusUrl, { signal: AbortSignal.timeout(10000) });
          if (sResp.ok) {
            const sText = await sResp.text();
            const stareMatch = sText.match(/stare="([^"]+)"/i);
            const stare = (stareMatch ? stareMatch[1] : "").toLowerCase();
            const idDescMatch = sText.match(/id_descarcare="([^"]+)"/i);
            const idDesc = idDescMatch ? idDescMatch[1] : "";

            if (stare === "ok") {
              await db
                .update(reInvoices)
                .set({
                  spvStatus: "validat",
                  spvError: null,
                })
                .where(eq(reInvoices.id, inv.id));
              console.log(`[SPV Cron] Re-invoice ${inv.id} (index ${inv.spvIndex}) validated via stareMesaj`);
            } else if (stare === "nok") {
              let errText: string | null = null;
              if (idDesc) {
                errText = await fetchAnafErrorDetails(idDesc, safeFetchAnaf);
              }
              await db
                .update(reInvoices)
                .set({
                  spvStatus: "eroare",
                  spvError: errText || "Factura a fost respinsă de ANAF.",
                })
                .where(eq(reInvoices.id, inv.id));
              console.log(`[SPV Cron] Re-invoice ${inv.id} (index ${inv.spvIndex}) rejected via stareMesaj: ${errText}`);
            }
          }
        } catch (pollErr: any) {
          console.warn(`[SPV Cron] Failed polling stareMesaj for reinvoice ${inv.id}:`, pollErr.message);
        }
      }
    } catch (pendErr: any) {
      console.warn(`[SPV Cron] Error checking pending invoices:`, pendErr.message);
    }

    try {
      let messages: any[] = [];

      // 1. Try direct listaMesajeFactura first (reliable, all messages up to 60 days in one fast call)
      try {
        const directUrl = `${ANAF_LIST_URL}?zile=${zile}&cif=${cif}`;
        console.log(`[SPV Cron] Fetching direct messages: ${directUrl}`);
        const directRes = await safeFetchAnaf(directUrl);
        if (directRes.ok) {
          const directData = await directRes.json();
          if (directData.mesaje && Array.isArray(directData.mesaje)) {
            messages = directData.mesaje;
            console.log(`[SPV Cron] Direct fetch got ${messages.length} messages`);
          }
        } else {
          console.warn(`[SPV Cron] Direct fetch returned ${directRes.status}`);
        }
      } catch (directErr: any) {
        console.warn(`[SPV Cron] Direct fetch failed, fallback to chunked: ${directErr.message}`);
      }

      // 2. If direct fetch didn't return messages, fallback to chunked pagination
      if (messages.length === 0) {
        const CHUNK_DAYS = 3;
        let daysRemaining = zile;
        let currentEndTime = Date.now();

        while (daysRemaining > 0) {
          const daysToFetch = Math.min(daysRemaining, CHUNK_DAYS);
          const currentStartTime =
            currentEndTime - daysToFetch * 24 * 60 * 60 * 1000;

          let pagina = 1;
          let totalPagini = 1;

          while (pagina <= totalPagini) {
            const listUrl = `https://api.anaf.ro/prod/FCTEL/rest/listaMesajePaginatieFactura?startTime=${currentStartTime}&endTime=${currentEndTime}&cif=${cif}&pagina=${pagina}`;
            console.log(
              `[SPV Cron] Fetching: ${listUrl} (days chunk: ${daysToFetch}, page: ${pagina})`
            );

            const response = await safeFetchAnaf(listUrl);

            if (!response.ok) {
              const errText = await response.text();
              console.error(
                `[SPV Cron] Failed to fetch messages for chunk: ${response.status} ${errText}`
              );
              break;
            }

            const data = await response.json();
            if (data.mesaje && Array.isArray(data.mesaje)) {
              messages.push(...data.mesaje);
            }

            totalPagini = data.numar_total_pagini || 1;
            pagina++;
          }

          daysRemaining -= daysToFetch;
          currentEndTime = currentStartTime;
        }
      }

      console.log(
        `[SPV Cron] Found total ${messages.length} messages across all chunks`
      );

      let imported = 0;
      let skipped = 0;
      let limitHit = 0;
      const limitDetails: string[] = [];

      for (const msg of messages) {
        try {
        // Log every message so we can see exactly what ANAF sends
        console.log(`[SPV Cron] MSG tip=${msg.tip} cif=${msg.cif} id=${msg.id} id_descarcare=${msg.id_descarcare} id_solicitare=${msg.id_solicitare} detalii=${msg.detalii || ""}`);

        // Process FACTURA PRIMITA, FACTURA TRIMISA, and ERORI FACTURA
        if (
          !msg.tip ||
          (msg.tip !== "FACTURA PRIMITA" &&
            msg.tip !== "FACTURA TRIMISA" &&
            msg.tip !== "ERORI FACTURA" &&
            !msg.tip.startsWith("FACTURA"))
        ) {
          console.log(`[SPV Cron] SKIP (tip mismatch): ${msg.tip}`);
          continue;
        }

        const isError = msg.tip === "ERORI FACTURA";
        const downloadId = msg.id_descarcare || msg.id;
        if (!downloadId) { console.log(`[SPV Cron] SKIP (no downloadId)`); continue; }

        // 1. Check if this message corresponds to an outgoing ReInvoice or EmittedInvoice WE sent to SPV
        // CRITICAL: Only check for outgoing confirmation (NOT incoming FACTURA PRIMITA!)
        // AND MUST filter by tenantId so we don't accidentally match another tenant's invoice!
        if (msg.id_solicitare && msg.tip !== "FACTURA PRIMITA") {
          const { reInvoices } = await import("../drizzle/schema");
          const [matchReInvoice] = await db
            .select({ id: reInvoices.id })
            .from(reInvoices)
            .where(
              and(
                eq(reInvoices.tenantId, intg.tenantId),
                eq(reInvoices.spvIndex, String(msg.id_solicitare))
              )
            );

          if (matchReInvoice) {
            let errorText = msg.detalii || null;
            if (isError && downloadId) {
              const details = await fetchAnafErrorDetails(downloadId, safeFetchAnaf);
              if (details) errorText = details;
            }
            await db
              .update(reInvoices)
              .set({
                spvStatus: isError ? "eroare" : "validat",
                spvError: isError ? errorText : null,
              })
              .where(eq(reInvoices.id, matchReInvoice.id));
            console.log(
              `[SPV Cron] Re-Invoice ${matchReInvoice.id} ${isError ? "REJECTED" : "validated"} in SPV!`
            );
            skipped++;
            continue;
          }

          const { emittedInvoices } = await import("../drizzle/schema");
          const [matchEmitted] = await db
            .select({ id: emittedInvoices.id, status: emittedInvoices.status })
            .from(emittedInvoices)
            .where(
              and(
                eq(emittedInvoices.tenantId, intg.tenantId),
                eq(emittedInvoices.spvIndex, String(msg.id_solicitare))
              )
            );

          if (matchEmitted) {
            let errorText = msg.detalii || null;
            if (isError && downloadId) {
              const details = await fetchAnafErrorDetails(downloadId, safeFetchAnaf);
              if (details) errorText = details;
            }
            await db
              .update(emittedInvoices)
              .set({
                spvStatus: isError ? "eroare" : "validat",
                spvError: isError ? errorText : null,
                status: (!isError && matchEmitted.status === "draft") ? "sent" : matchEmitted.status,
              })
              .where(eq(emittedInvoices.id, matchEmitted.id));
            console.log(
              `[SPV Cron] Emitted Invoice ${matchEmitted.id} ${isError ? "REJECTED" : "validated"} in SPV!`
            );
            skipped++;
            continue;
          }
        }

        if (isError) {
          console.log(`[SPV Cron] Skipping ERORI FACTURA ${downloadId} (no invoice payload)`);
          skipped++;
          continue;
        }

        // Check if already imported (by SPV download ID)
        const [existing] = await db
          .select({ id: invoiceArchive.id })
          .from(invoiceArchive)
          .where(
            and(
              eq(invoiceArchive.tenantId, intg.tenantId),
              eq(invoiceArchive.fileName, `SPV_${downloadId}.zip`)
            )
          );

        if (existing) {
          skipped++;
          continue;
        }

        // 2. Download the ZIP
        const downloadUrl = `${ANAF_DOWNLOAD_URL}?id=${downloadId}`;
        console.log(`[SPV Cron] Downloading: ${downloadUrl}`);

        const zipResponse = await safeFetchAnaf(downloadUrl);

        if (!zipResponse.ok) {
          console.warn(
            `[SPV Cron] Failed to download ${downloadId}: ${zipResponse.status}`
          );
          continue;
        }

        const contentType = zipResponse.headers.get("content-type") || "";

        let xmlString: string | null = null;

        try {
          const buffer = await zipResponse.arrayBuffer();
          const buf = Buffer.from(buffer);
          console.log(`[SPV Cron] Downloaded ${buf.length} bytes for ${downloadId}, first bytes: ${buf.slice(0,120).toString("utf8").replace(/[\r\n]/g, " ")}`);

          // Detect JSON error response regardless of content-type (ANAF sends JSON with wrong content-type sometimes)
          const firstChar = buf.slice(0, 1).toString("utf8").trim();
          if (firstChar === "{" || contentType.includes("application/json")) {
            try {
              const errData = JSON.parse(buf.toString("utf8"));
              if (errData.eroare) {
                console.warn(`[SPV Cron] ANAF Error for ${downloadId}: ${errData.eroare}`);
                // If it's a download limit error, track it
                if (errData.eroare.includes("descarcari")) {
                  limitHit++;
                  limitDetails.push(`id=${downloadId}`);
                  console.warn(`[SPV Cron] Download limit hit for ${downloadId} — will retry tomorrow`);
                }
                continue;
              }
            } catch {
              // Not JSON, continue to ZIP/XML parsing
            }
          }

          const firstBytes = buf.slice(0, 4).toString("hex");
          // ZIP magic bytes: 504b0304
          if (firstBytes === "504b0304") {
            // It's a real ZIP
            const zip = new AdmZip(buf);
            const zipEntries = zip.getEntries();
            const xmlEntry = zipEntries.find(
              e =>
                e.entryName.toLowerCase().endsWith(".xml") &&
                !e.entryName.toLowerCase().includes("semnatura")
            );
            if (!xmlEntry) {
              console.warn(`[SPV Cron] No XML found in ZIP for ${downloadId}`);
              continue;
            }
            xmlString = xmlEntry.getData().toString("utf8");
          } else {
            // Not a ZIP — try treating as raw XML
            const rawText = buf.toString("utf8");
            if (rawText.includes("<Invoice") || rawText.includes("<CreditNote") || rawText.includes(":Invoice") || rawText.includes(":CreditNote")) {
              console.log(`[SPV Cron] Content for ${downloadId} is raw XML, not ZIP — using directly`);
              xmlString = rawText;
            } else {
              console.warn(`[SPV Cron] Unknown content format for ${downloadId}: ${rawText.slice(0, 200)}`);
              continue;
            }
          }
        } catch (err: any) {
          console.warn(
            `[SPV Cron] Failed to process download for ${downloadId}:`,
            err.message
          );
          continue;
        }

        if (!xmlString) continue;

        // Parse XML
        const parser = new XMLParser({ numberParseOptions: { leadingZeros: false, hex: false, eNotation: false },
          ignoreAttributes: false,
          attributeNamePrefix: "@_",
          removeNSPrefix: true,
        });
        const parsed = parser.parse(xmlString);
        const rootKey = Object.keys(parsed).find(
          k => k.includes("Invoice") || k.includes("CreditNote")
        );
        const invoiceObj = rootKey ? parsed[rootKey] : null;
        if (!invoiceObj) {
          console.warn(
            `[SPV Cron] No Invoice/CreditNote in XML for ${downloadId}`
          );
          continue;
        }

        const isCreditNote = !!(
          rootKey?.includes("CreditNote") ||
          invoiceObj["cbc:CreditNoteTypeCode"] ||
          invoiceObj["CreditNoteTypeCode"] ||
          String(invoiceObj["cbc:InvoiceTypeCode"] || invoiceObj["InvoiceTypeCode"] || "").trim() === "381"
        );

        // Extract invoice details
        const invoiceNumber = invoiceObj["ID"] || `SPV-${downloadId}`;
        const issueDate = invoiceObj["IssueDate"] || "";
        const dueDate = invoiceObj["DueDate"] || issueDate;

        let supplierName = "";
        let supplierCUI = "";

        // Determine direction first so we can map parties correctly
        const direction = msg.tip?.includes("PRIMITA") ? "in" : "out";

        // For incoming invoices (Primite), the supplier is the sender.
        // For outgoing invoices (Emise), the supplier is US, but the UI/DB expects the CLIENT's details in supplierName/CUI
        const targetParty =
          direction === "in"
            ? invoiceObj["AccountingSupplierParty"]
            : invoiceObj["AccountingCustomerParty"];

        if (targetParty?.["Party"]) {
          const party = targetParty["Party"];
          supplierName =
            party["PartyName"]?.["Name"] ||
            party["PartyLegalEntity"]?.["RegistrationName"] ||
            "Client necunoscut";
          supplierCUI =
            party["PartyTaxScheme"]?.["CompanyID"] ||
            party["PartyLegalEntity"]?.["CompanyID"] ||
            "";
        }

        const legalTotal = invoiceObj["LegalMonetaryTotal"];
        const rawTotal =
          legalTotal?.["TaxInclusiveAmount"]?.["#text"] ||
          legalTotal?.["TaxInclusiveAmount"] ||
          legalTotal?.["PayableAmount"]?.["#text"] ||
          legalTotal?.["PayableAmount"] ||
          "0";
        let parsedTotal = parseFloat(typeof rawTotal === "object" ? "0" : rawTotal);
        if (isNaN(parsedTotal)) parsedTotal = 0;
        if (isCreditNote && parsedTotal > 0) parsedTotal = -parsedTotal;
        const total = parsedTotal;

        const currency =
          invoiceObj["DocumentCurrencyCode"]?.["#text"] ||
          invoiceObj["DocumentCurrencyCode"] ||
          "RON";

        // Facturile în valută au 2 blocuri TaxTotal (valută + RON): îl alegem pe cel în moneda documentului
        const taxTotal = invoiceObj["TaxTotal"];
        const taxTotalObj = Array.isArray(taxTotal)
          ? taxTotal.find(
              (t: any) =>
                String(t?.["TaxAmount"]?.["@_currencyID"] || "").toUpperCase() ===
                String(currency).toUpperCase()
            ) || taxTotal[0]
          : taxTotal;
        const rawVAT =
          taxTotalObj?.["TaxAmount"]?.["#text"] ||
          taxTotalObj?.["TaxAmount"] ||
          "0";
        let parsedVAT = parseFloat(typeof rawVAT === "object" ? "0" : rawVAT);
        if (isNaN(parsedVAT)) parsedVAT = 0;
        if (isCreditNote && parsedVAT > 0) parsedVAT = -parsedVAT;
        const totalVAT = parsedVAT;

        // Check for duplicate by invoice number + supplier (normalize CUI - strip RO prefix)
        const normalizedCUI = String(supplierCUI).replace(/^RO/i, "");
        // Număr normalizat: fără separatori, majuscule, fără zerouri la început
        // (facturile importate înainte de fix pot fi salvate fără zerourile din față)
        const cleanInvoiceNumber = String(invoiceNumber)
          .replace(/[^a-zA-Z0-9]/g, "")
          .toUpperCase()
          .replace(/^0+/, "");

        const { sql } = await import("drizzle-orm");

        const [dup] = await db
          .select({ id: invoiceArchive.id, rawXml: invoiceArchive.rawXml })
          .from(invoiceArchive)
          .where(
            and(
              eq(invoiceArchive.tenantId, intg.tenantId),
              sql`TRIM(LEADING '0' FROM UPPER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${invoiceArchive.invoiceNumber}, '-', ''), ' ', ''), '/', ''), '.', ''), '_', ''), ',', ''))) = ${cleanInvoiceNumber}`,
              sql`REPLACE(UPPER(${invoiceArchive.supplierCUI}), 'RO', '') = ${normalizedCUI.toUpperCase()}`
            )
          );

        if (dup) {
          // If duplicate exists but has no XML stored, update it (+ fix fileName for future lookups)
          if (!dup.rawXml) {
            await db
              .update(invoiceArchive)
              .set({ rawXml: xmlString, fileName: `SPV_${downloadId}.zip` })
              .where(eq(invoiceArchive.id, dup.id));
            console.log(
              `[SPV Cron] Updated XML + fileName for existing invoice ${invoiceNumber}`
            );
          }

          // Backfill lines if missing
          try {
            const { invoiceArchiveLines } = await import("../drizzle/schema");
            const existingLines = await db
              .select({ id: invoiceArchiveLines.id })
              .from(invoiceArchiveLines)
              .where(eq(invoiceArchiveLines.invoiceArchiveId, dup.id));

            if (existingLines.length === 0) {
              let xmlLines =
                invoiceObj["InvoiceLine"] ||
                invoiceObj["CreditNoteLine"] ||
                [];
              if (!Array.isArray(xmlLines)) xmlLines = [xmlLines];
              if (xmlLines.length > 0) {
                const linesToInsert = xmlLines.map((line: any) => {
                  const item = line["Item"];
                  const price = line["Price"];
                  const description =
                    item?.["Name"] ||
                    item?.["Description"] ||
                    "Articol";
                  let qty = parseFloat(
                    line["InvoicedQuantity"]?.["#text"] ||
                      line["InvoicedQuantity"] ||
                      line["CreditedQuantity"]?.["#text"] ||
                      line["CreditedQuantity"] ||
                      "1"
                  );
                  if (isNaN(qty)) qty = 1;
                  if (isCreditNote && qty > 0) qty = -qty;

                  let unitPrice = parseFloat(
                    price?.["PriceAmount"]?.["#text"] ||
                      price?.["PriceAmount"] ||
                      "0"
                  );
                  if (isNaN(unitPrice)) unitPrice = 0;
                  const unit =
                    line["InvoicedQuantity"]?.["@_unitCode"] ||
                    line["CreditedQuantity"]?.["@_unitCode"] ||
                    "buc";
                  let lineTotal = parseFloat(
                    line["LineExtensionAmount"]?.["#text"] ||
                      line["LineExtensionAmount"] ||
                      String(Math.abs(qty) * unitPrice)
                  );
                  if (isNaN(lineTotal)) lineTotal = 0;
                  if (isCreditNote && lineTotal > 0) lineTotal = -lineTotal;
                  const vatRate = parseLineVatPercent(item);
                  return {
                    invoiceArchiveId: dup.id,
                    description: String(description),
                    quantity: String(qty),
                    unitPrice: String(unitPrice),
                    unit: String(unit),
                    vatRate: String(vatRate),
                    total: String(lineTotal),
                    currency,
                  };
                });
                await db.insert(invoiceArchiveLines).values(linesToInsert);
                console.log(
                  `[SPV Cron] Backfilled ${linesToInsert.length} lines for existing invoice ${invoiceNumber}`
                );
              }
            }
          } catch (lineErr: any) {
            console.warn(
              `[SPV Cron] Failed to backfill lines for ${invoiceNumber}: ${lineErr.message}`
            );
          }

          skipped++;
          continue;
        }

        // Generate PDF
        let fileUrl = "spv_import";
        try {
          const pdfRes = await convertXmlToPdf(
            xmlString,
            `Factura_${invoiceNumber}_${Date.now()}`
          );
          if (pdfRes) fileUrl = pdfRes.url;
        } catch (pdfErr: any) {
          console.warn(
            `[SPV Cron] PDF conversion failed for ${invoiceNumber}: ${pdfErr.message}`
          );
        }

        // Save to invoiceArchive (with raw XML for PDF conversion)
        const archiveResult = await createInvoiceArchiveEntry({
          tenantId: intg.tenantId,
          source: "spv_anaf",
          direction,
          fileName: `SPV_${downloadId}.zip`,
          fileType: "xml",
          fileUrl,
          invoiceNumber: String(invoiceNumber),
          supplierName,
          supplierCUI,
          issueDate,
          dueDate,
          total: String(total),
          totalVAT: String(totalVAT),
          currency,
          status: "pending",
          rawXml: xmlString,
          spvIndex: msg.id_solicitare ? String(msg.id_solicitare) : undefined,
          notes: msg.id_solicitare ? `Index încărcare SPV: ${msg.id_solicitare}` : undefined,
        });

        // --- ADD CLIENT IF NOT EXISTS ---
        if (
          supplierCUI &&
          supplierName &&
          supplierName !== "Client necunoscut"
        ) {
          try {
            const { clients } = await import("../drizzle/schema");
            const cleanCUI = String(supplierCUI).replace(/^RO/i, "").trim();

            const [existingClient] = await db
              .select({ id: clients.id })
              .from(clients)
              .where(
                and(
                  eq(clients.tenantId, intg.tenantId),
                  sql`REPLACE(UPPER(${clients.cui}), 'RO', '') = ${cleanCUI}`
                )
              );

            if (!existingClient) {
              const party = targetParty?.["cac:Party"];
              const address =
                party?.["cac:PostalAddress"]?.["cbc:StreetName"] || "";
              const city = party?.["cac:PostalAddress"]?.["cbc:CityName"] || "";
              const county =
                party?.["cac:PostalAddress"]?.["cbc:CountrySubentity"] || "";
              const email =
                party?.["cac:Contact"]?.["cbc:ElectronicMail"] || "";
              const phone = party?.["cac:Contact"]?.["cbc:Telephone"] || "";
              const tva = String(supplierCUI).toUpperCase().startsWith("RO");

              await db.insert(clients).values({
                tenantId: intg.tenantId,
                name: String(supplierName),
                cui: String(supplierCUI),
                regCom: "",
                address: String(address),
                city: String(city),
                country: "RO",
                email: String(email),
                phone: String(phone),
                tva: tva ? 1 : 0,
              });
              console.log(
                `[SPV Cron] Added new client: ${supplierName} (${supplierCUI})`
              );
            }
          } catch (err: any) {
            console.warn(
              `[SPV Cron] Failed to add client ${supplierName}:`,
              err.message
            );
          }
        }
        // --- END ADD CLIENT ---

        // Extract and save invoice lines from XML
        try {
          const { invoiceArchiveLines } = await import("../drizzle/schema");
          let xmlLines =
            invoiceObj["InvoiceLine"] ||
            invoiceObj["CreditNoteLine"] ||
            invoiceObj["cac:InvoiceLine"] ||
            invoiceObj["cac:CreditNoteLine"] ||
            [];
          if (!Array.isArray(xmlLines)) xmlLines = [xmlLines];

          const archiveId =
            (archiveResult as any)?.insertId || (archiveResult as any)?.id;
          if (archiveId && xmlLines.length > 0) {
            const linesToInsert = xmlLines.map((line: any) => {
              const item = xmlPick(line, "Item");
              const price = xmlPick(line, "Price");
              const description =
                xmlPick(item, "Name") || xmlPick(item, "Description") || "Articol";
              const qtyNode = xmlPick(line, "InvoicedQuantity") ?? xmlPick(line, "CreditedQuantity");
              let qty = parseFloat(
                String(qtyNode?.["#text"] ?? qtyNode ?? "1")
              );
              if (isNaN(qty)) qty = 1;
              if (isCreditNote && qty > 0) qty = -qty;

              const priceNode = xmlPick(price, "PriceAmount");
              let unitPrice = parseFloat(
                String(priceNode?.["#text"] ?? priceNode ?? "0")
              );
              if (isNaN(unitPrice)) unitPrice = 0;
              const unit = qtyNode?.["@_unitCode"] || "buc";
              const lineExt = xmlPick(line, "LineExtensionAmount");
              let lineTotal = parseFloat(
                String(lineExt?.["#text"] ?? lineExt ?? Math.abs(qty) * unitPrice)
              );
              if (isNaN(lineTotal)) lineTotal = 0;
              if (isCreditNote && lineTotal > 0) lineTotal = -lineTotal;

              // Extract VAT rate
              const vatRate = parseLineVatPercent(item, totalVAT === 0);

              return {
                invoiceArchiveId: archiveId,
                description: String(description),
                quantity: String(qty),
                unitPrice: String(unitPrice),
                unit: String(unit),
                vatRate: String(vatRate),
                total: String(lineTotal),
                currency,
              };
            });

            // Extragere deduceri și taxe suplimentare (cac:AllowanceCharge)
            let xmlAllowances =
              invoiceObj["AllowanceCharge"] ||
              invoiceObj["cac:AllowanceCharge"] ||
              [];
            if (!Array.isArray(xmlAllowances)) xmlAllowances = [xmlAllowances];

            for (const ac of xmlAllowances) {
              const indicator = String(xmlPick(ac, "ChargeIndicator") ?? "false").toLowerCase();
              const isCharge = indicator === "true";
              const reasonNode = xmlPick(ac, "AllowanceChargeReason");
              const rawReason = String(
                reasonNode?.["#text"] ?? reasonNode ?? (isCharge ? "Taxă suplimentară" : "Deducere / Rabat")
              ).trim();
              const codeNode = xmlPick(ac, "AllowanceChargeReasonCode");
              const reasonCode = String(codeNode?.["#text"] ?? codeNode ?? "").trim();
              const percentNode = xmlPick(ac, "MultiplierFactorNumeric");
              const percent = percentNode?.["#text"] ?? percentNode;
              const amtNode = xmlPick(ac, "Amount") ?? 0;
              let amount = parseFloat(String(amtNode?.["#text"] ?? amtNode));
              if (isNaN(amount)) amount = 0;

              let desc = rawReason;
              if (!isCharge) {
                desc = percent ? `Deducere / Rabat (${percent}%): ${rawReason}` : `Deducere / Rabat: ${rawReason}`;
              } else {
                desc = reasonCode ? `Taxă suplimentară: ${rawReason} (${reasonCode})` : `Taxă suplimentară: ${rawReason}`;
              }

              const signedAmount = isCharge ? Math.abs(amount) : -Math.abs(amount);

              linesToInsert.push({
                invoiceArchiveId: archiveId,
                description: String(desc),
                quantity: "1",
                unitPrice: String(signedAmount),
                unit: isCharge ? "serv" : "buc",
                vatRate: "0",
                total: String(signedAmount),
                currency,
              });
            }

            // Idempotent: createInvoiceArchiveEntry a inserat deja liniile din XML; înlocuim cu setul complet
            // (inclusiv rabaturi/taxe suplimentare) ca să nu rămână linii DUBLATE care ar dubla valoarea NIR/SAGA.
            await db!.delete(invoiceArchiveLines).where(eq(invoiceArchiveLines.invoiceArchiveId, archiveId));
            await db!.insert(invoiceArchiveLines).values(linesToInsert);
            console.log(
              `[SPV Cron] Saved ${linesToInsert.length} lines for invoice ${invoiceNumber}`
            );
          }
        } catch (lineErr: any) {
          console.warn(
            `[SPV Cron] Failed to extract lines for ${invoiceNumber}: ${lineErr.message}`
          );
        }

        imported++;
        console.log(
          `[SPV Cron] ✓ Imported ${direction === "in" ? "received" : "sent"} invoice ${invoiceNumber} from ${supplierName}`
        );
        } catch (msgErr: any) {
          console.error(
            `[SPV Cron] Error processing message ${msg?.id || msg?.id_descarcare}:`,
            msgErr.message
          );
          skipped++;
        }
      }

      // Update sync time
      await db
        .update(integrations)
        .set({
          lastSyncAt: new Date(),
          syncCount: (intg.syncCount || 0) + imported,
          lastCronAt: new Date(),
          lastCronImported: imported,
        })
        .where(eq(integrations.id, intg.id));

      console.log(
        `[SPV Cron] Done for tenant ${intg.tenantId}: imported=${imported}, skipped=${skipped}, limitHit=${limitHit}`
      );
      totalImported += imported;
      totalLimitHit += limitHit;
      totalLimitDetails.push(...limitDetails);
    } catch (e: any) {
      console.error(
        `[SPV Cron] Error syncing for tenant ${intg.tenantId}:`,
        e.message
      );
    }
  }
  return { imported: totalImported, limitHit: totalLimitHit, limitDetails: totalLimitDetails };
}
