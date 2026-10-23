/**
 * PDF HTTP Route — /api/pdf/reinvoice/:id
 * Generează PDF-ul re-facturii direct și îl returnează ca stream HTTP.
 * Poate fi deschis în browser (previzualizare) sau descărcat.
 */
import { Router, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { generateReInvoicePDF } from "./pdf";
import { formatCurrency } from "../client/src/lib/utils";
import { translateProductDescription } from "./invoiceTranslator";
import { requirePdfAccess } from "./fileAuth";

const THEME_MAP: Record<string, string> = {
  blue: "#2563eb",
  teal: "#0d9488",
  green: "#16a34a",
  rose: "#e11d48",
  violet: "#7c3aed",
  navy: "#003366",
};
import { getDb } from "./db";
import { tenants } from "../drizzle/schema";
import { eq, sql, and } from "drizzle-orm";

function getXmlText(node: any, fallback = ""): string {
  if (node === null || node === undefined) return fallback;
  if (typeof node === "string") return node.trim() || fallback;
  if (typeof node === "number") return String(node);
  if (typeof node === "object") {
    if (node["#text"] !== undefined) return String(node["#text"]).trim() || fallback;
    if (node["_text"] !== undefined) return String(node["_text"]).trim() || fallback;
  }
  const str = String(node).trim();
  return str === "[object Object]" ? fallback : (str || fallback);
}

function parseXmlNumber(node: any, fallback = 0): number {
  if (node === null || node === undefined) return fallback;
  if (typeof node === "number") return isNaN(node) ? fallback : node;
  if (typeof node === "object") {
    if (node["#text"] !== undefined) return parseXmlNumber(node["#text"], fallback);
    if (node["_text"] !== undefined) return parseXmlNumber(node["_text"], fallback);
    if (node["text"] !== undefined) return parseXmlNumber(node["text"], fallback);
    return fallback;
  }
  const str = String(node).trim().replace(",", ".");
  const num = parseFloat(str);
  return isNaN(num) ? fallback : num;
}

export function registerPdfRoute(app: any) {
  const router = Router();
  // Securitate: toate PDF-urile cer autentificare și aparțin firmei utilizatorului
  router.use(requirePdfAccess);

  // GET /api/pdf/reinvoice/:id?download=1
  // Returnează PDF ca stream. download=1 → attachment, altfel inline (previzualizare)
  router.get("/reinvoice/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "ID invalid" });
        return;
      }

      // Obținem sesiunea din cookie (dacă există) — fără auth strict pt simplitate
      // Fetch re-invoice from DB direct
      const db = await getDb();
      if (!db) {
        res.status(500).json({ error: "DB unavailable" });
        return;
      }

      // Import schema
      const { reInvoices, reInvoiceLines } = await import("../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      const [ri] = await db
        .select()
        .from(reInvoices)
        .where(eq(reInvoices.id, id));
      if (!ri) {
        res.status(404).json({ error: "Re-factura nu a fost găsită" });
        return;
      }

      // Fetch lines
      const lines = await db
        .select()
        .from(reInvoiceLines)
        .where(eq(reInvoiceLines.reInvoiceId, id));

      // Fetch tenant settings
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, ri.tenantId));
      let settings: any = {};
      try {
        settings = JSON.parse(tenant?.settings || "{}");
      } catch {}

      const isDownload = req.query.download === "1";
      const filename = `${ri.number || `RF-${id}`}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `${isDownload ? "attachment" : "inline"}; filename="${filename}"`
      );

      let logoBase64 = settings.logoBase64 || undefined;
      let logoHasBackground = Boolean(settings.logoHasBackground);
      let logoBgColor = settings.logoBgColor || "#0f172a";
      let themeColor = settings.themeColor || (settings.theme && THEME_MAP[settings.theme]) || "#2563eb";

      const isForeign = Boolean(
        ((ri as any).clientCountry && (ri as any).clientCountry !== "RO") ||
        (ri.clientCUI && !ri.clientCUI.startsWith("RO") && /^[A-Z]{2}/.test(ri.clientCUI)) ||
        (ri.currency && ri.currency !== "RON" && ri.currency !== "LEI")
      );

      const translatedLines = await Promise.all(
        lines.map(async l => ({
          description: l.description || "",
          translatedDescription: isForeign
            ? await translateProductDescription(l.description || "")
            : undefined,
          quantity: parseFloat(l.quantity || "1"),
          unitPrice: parseFloat(l.unitPrice || "0"),
          unit: l.unit || "buc",
          vatRate:
            l.vatRate !== undefined &&
            l.vatRate !== null &&
            String(l.vatRate).trim() !== ""
              ? parseFloat(String(l.vatRate))
              : 21,
          total: parseFloat(l.total || "0"),
        }))
      );

      const pdfStream = generateReInvoicePDF({
        number: ri.number || `RF-${id}`,
        date: ri.issueDate || new Date().toISOString().split("T")[0],
        dueDate: ri.dueDate || "",
        clientName: ri.clientName || "",
        clientCUI: ri.clientCUI || "",
        clientAddress: ri.clientAddress || "",
        clientCity: ri.clientCity || "",
        clientCounty: "",
        clientCountry: (ri as any).clientCountry || "",
        clientEmail: ri.clientEmail || "",
        clientPhone: ri.clientPhone || "",
        companyName: tenant?.name || "",
        companyCUI: tenant?.cui || "",
        companyAddress: tenant?.address || "",
        companyCity: settings.city || "",
        companyCounty: settings.county || "",
        companyCountry: settings.country || "RO",
        companyEmail: tenant?.email || "",
        companyPhone: tenant?.phone || "",
        companyIBAN: settings.iban || "",
        companyBank: settings.bank || "",
        logoBase64: logoBase64 || undefined,
        logoHasBackground,
        logoBgColor,
        themeColor,
        template: settings.invoiceTemplate === "modern" ? "classic" : (settings.invoiceTemplate || "classic"),
        lines: translatedLines,
        subtotal: parseFloat(ri.subtotal || "0"),
        totalVAT: parseFloat(ri.totalVAT || "0"),
        total: parseFloat(ri.total || "0"),
        currency: ri.currency || "RON",
        notes: ri.notes || undefined,
        spvIndex: ri.spvIndex || undefined,
      });

      pdfStream.on("error", (err: any) => {
        if (!res.headersSent) res.status(500).json({ error: err.message });
      });
      res.on("close", () => {
        try {
          pdfStream.destroy?.();
        } catch {}
      });
      pdfStream.pipe(res);
    } catch (e: any) {
      console.error("[PDF Route] Error:", e.message);
      if (!res.headersSent) res.status(500).json({ error: e.message });
    }
  });

  // GET /api/pdf/archive/:id — Convert stored XML to PDF on-the-fly via ANAF
  router.get("/archive/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "ID invalid" });
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(500).json({ error: "DB unavailable" });
        return;
      }

      const { invoiceArchive, integrations } =
        await import("../drizzle/schema");
      const { and: andOp } = await import("drizzle-orm");
      const [inv] = await db
        .select()
        .from(invoiceArchive)
        .where(eq(invoiceArchive.id, id));
      if (!inv) {
        res.status(404).json({ error: "Factura nu a fost găsită" });
        return;
      }

      let xmlContent = inv.rawXml;

      // If rawXml missing, try to re-download from SPV
      if (!xmlContent && inv.source === "spv_anaf" && inv.fileName) {
        console.log(
          `[PDF Archive] rawXml missing for ${inv.invoiceNumber}, attempting re-download...`
        );

        // Extract download ID from fileName (format: SPV_<downloadId>.zip)
        const match = inv.fileName.match(/SPV_(\d+)\.zip/);
        if (match) {
          const downloadId = match[1];

          // Get SPV access token
          const { getValidSpvToken } = await import("./anafApi");
          const tokenData = await getValidSpvToken(inv.tenantId);

          if (tokenData?.token) {
            try {
              const AdmZip = (await import("adm-zip")).default;
              const zipRes = await fetch(
                `https://api.anaf.ro/prod/FCTEL/rest/descarcare?id=${downloadId}`,
                {
                  headers: { Authorization: `Bearer ${tokenData.token}` },
                  signal: AbortSignal.timeout(30000),
                }
              );

              if (zipRes.ok) {
                const buffer = await zipRes.arrayBuffer();
                const zip = new AdmZip(Buffer.from(buffer));
                const xmlEntry = zip
                  .getEntries()
                  .find(
                    e =>
                      e.entryName.toLowerCase().endsWith(".xml") &&
                      !e.entryName.toLowerCase().includes("semnatura")
                  );
                if (xmlEntry) {
                  xmlContent = xmlEntry.getData().toString("utf8");
                  // Store it for future use
                  await db
                    .update(invoiceArchive)
                    .set({ rawXml: xmlContent })
                    .where(eq(invoiceArchive.id, id));
                  console.log(
                    `[PDF Archive] Re-downloaded and stored XML for ${inv.invoiceNumber}`
                  );
                }
              }
            } catch (dlErr: any) {
              console.error(
                `[PDF Archive] Re-download failed: ${dlErr.message}`
              );
            }
          }
        }
      }

      if (!xmlContent) {
        res.status(404).json({
          error:
            "XML-ul original nu este disponibil. Mergi la Integrări → SPV → Sincronizează pentru a re-descărca facturile.",
        });
        return;
      }

      // Parse XML internally instead of calling ANAF
      const { XMLParser } = await import("fast-xml-parser");
      const parser = new XMLParser({ numberParseOptions: { leadingZeros: false, hex: false, eNotation: false },
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
      });
      const parsed = parser.parse(xmlContent);
      const invoiceObj = parsed.Invoice || parsed.CreditNote || parsed["ubl:Invoice"] || parsed["ubl:CreditNote"] || parsed[Object.keys(parsed)[0]];

      if (!invoiceObj) {
        res.status(500).json({
          error:
            "Invalid SPV XML format: neither Invoice nor CreditNote found.",
        });
        return;
      }

      const isCreditNote = !!(
        parsed.CreditNote ||
        parsed["ubl:CreditNote"] ||
        invoiceObj["cbc:CreditNoteTypeCode"] ||
        invoiceObj["CreditNoteTypeCode"] ||
        String(invoiceObj["cbc:InvoiceTypeCode"] || invoiceObj["InvoiceTypeCode"] || "").trim() === "381"
      );

      // Default logo string for the text-based layout
      let logoBase64 = "DEFAULT_TEXT_LOGO";
      let logoHasBackground = false;
      let logoBgColor = "#0f172a";
      let themeColor = "#2563eb";
      try {
        const { tenants } = await import("../drizzle/schema");
        const [tenant] = await db
          .select()
          .from(tenants)
          .where(eq(tenants.id, inv.tenantId));
        if (tenant?.settings) {
          const settings = JSON.parse(tenant.settings);
          if (settings.logoBase64) logoBase64 = settings.logoBase64;
          if (settings.logoHasBackground !== undefined) logoHasBackground = Boolean(settings.logoHasBackground);
          if (settings.logoBgColor) logoBgColor = settings.logoBgColor;
          if (settings.themeColor) themeColor = settings.themeColor;
          else if (settings.theme && THEME_MAP[settings.theme]) themeColor = THEME_MAP[settings.theme];
        }
      } catch (_) {}



      const direction = inv.direction; // 'in' or 'out'
      const supplierParty =
        invoiceObj["cac:AccountingSupplierParty"]?.["cac:Party"] ||
        invoiceObj["AccountingSupplierParty"]?.["Party"];
      const customerParty =
        invoiceObj["cac:AccountingCustomerParty"]?.["cac:Party"] ||
        invoiceObj["AccountingCustomerParty"]?.["Party"];

      const extractPartyDetails = (party: any) => ({
        name:
          getXmlText(party?.["cac:PartyName"]?.["cbc:Name"]) ||
          getXmlText(party?.["PartyName"]?.["Name"]) ||
          getXmlText(party?.["cac:PartyLegalEntity"]?.["cbc:RegistrationName"]) ||
          getXmlText(party?.["PartyLegalEntity"]?.["RegistrationName"]) ||
          "",
        cui:
          getXmlText(party?.["cac:PartyTaxScheme"]?.["cbc:CompanyID"]) ||
          getXmlText(party?.["PartyTaxScheme"]?.["CompanyID"]) ||
          getXmlText(party?.["cac:PartyLegalEntity"]?.["cbc:CompanyID"]) ||
          getXmlText(party?.["PartyLegalEntity"]?.["CompanyID"]) ||
          "",
        address:
          getXmlText(party?.["cac:PostalAddress"]?.["cbc:StreetName"]) ||
          getXmlText(party?.["PostalAddress"]?.["StreetName"]),
        city:
          getXmlText(party?.["cac:PostalAddress"]?.["cbc:CityName"]) ||
          getXmlText(party?.["PostalAddress"]?.["CityName"]),
        county:
          getXmlText(party?.["cac:PostalAddress"]?.["cbc:CountrySubentity"]) ||
          getXmlText(party?.["PostalAddress"]?.["CountrySubentity"]),
        country:
          getXmlText(party?.["cac:PostalAddress"]?.["cac:Country"]?.["cbc:IdentificationCode"]) ||
          getXmlText(party?.["PostalAddress"]?.["Country"]?.["IdentificationCode"]) ||
          getXmlText(party?.["cac:PostalAddress"]?.["cac:Country"]?.["cbc:Name"]) ||
          getXmlText(party?.["PostalAddress"]?.["Country"]?.["Name"]) ||
          "",
        email:
          getXmlText(party?.["cac:Contact"]?.["cbc:ElectronicMail"]) ||
          getXmlText(party?.["Contact"]?.["ElectronicMail"]),
        phone:
          getXmlText(party?.["cac:Contact"]?.["cbc:Telephone"]) ||
          getXmlText(party?.["Contact"]?.["Telephone"]),
        iban: "",
      });

      const supplierDetails = extractPartyDetails(supplierParty);
      const customerDetails = extractPartyDetails(customerParty);

      // Extract real IBAN and Bank from PaymentMeans
      let supplierIban = "";
      let supplierBank = "";
      const rawPm = invoiceObj["cac:PaymentMeans"] || invoiceObj["PaymentMeans"];
      const pmList = Array.isArray(rawPm) ? rawPm : (rawPm ? [rawPm] : []);
      for (const pm of pmList) {
        const acc = pm?.["cac:PayeeFinancialAccount"] || pm?.["PayeeFinancialAccount"];
        if (acc) {
          const accId = getXmlText(acc["cbc:ID"] || acc["ID"]);
          if (accId && accId.length > 5 && !accId.toUpperCase().includes("VAT")) {
            supplierIban = accId;
            supplierBank =
              getXmlText(acc["cbc:Name"] || acc["Name"]) ||
              getXmlText(
                acc["cac:FinancialInstitutionBranch"]?.["cac:FinancialInstitution"]?.[
                  "cbc:Name"
                ] ||
                acc["FinancialInstitutionBranch"]?.["FinancialInstitution"]?.[
                  "Name"
                ]
              ) ||
              "";
            break;
          }
        }
      }

      // If no IBAN in XML, check if supplier is a tenant on our platform
      if (!supplierIban && supplierDetails.cui) {
        const cleanSupCui = supplierDetails.cui.replace(/^RO/i, "").trim();
        const { tenants } = await import("../drizzle/schema");
        const [supTenant] = await db
          .select()
          .from(tenants)
          .where(sql`REPLACE(UPPER(${tenants.cui}), 'RO', '') = ${cleanSupCui}`);
        if (supTenant?.settings) {
          try {
            const parsedSettings = JSON.parse(supTenant.settings);
            if (parsedSettings.iban && String(parsedSettings.iban).length > 8) {
              supplierIban = String(parsedSettings.iban);
              supplierBank = String(parsedSettings.bank || "");
            }
          } catch {}
        }
      }

      const legalTotal = invoiceObj["cac:LegalMonetaryTotal"] || invoiceObj["LegalMonetaryTotal"];
      const taxTotal = invoiceObj["cac:TaxTotal"] || invoiceObj["TaxTotal"];
      const taxTotalObj = Array.isArray(taxTotal) ? taxTotal[0] : taxTotal;

      let subtotal = parseXmlNumber(
        legalTotal?.["cbc:TaxExclusiveAmount"] ??
          legalTotal?.["TaxExclusiveAmount"] ??
          legalTotal?.["cbc:LineExtensionAmount"] ??
          legalTotal?.["LineExtensionAmount"],
        0
      );
      let totalVAT = parseXmlNumber(
        taxTotalObj?.["cbc:TaxAmount"] ?? taxTotalObj?.["TaxAmount"],
        0
      );
      let total = parseXmlNumber(
        legalTotal?.["cbc:TaxInclusiveAmount"] ??
          legalTotal?.["TaxInclusiveAmount"] ??
          legalTotal?.["cbc:PayableAmount"] ??
          legalTotal?.["PayableAmount"],
        0
      );

      // If CreditNote, ensure negative totals
      if (isCreditNote) {
        if (subtotal > 0) subtotal = -subtotal;
        if (totalVAT > 0) totalVAT = -totalVAT;
        if (total > 0) total = -total;
      }

      // Reverse charge / Tax exemption detection
      const taxSubtotal = taxTotalObj?.["cac:TaxSubtotal"] || taxTotalObj?.["TaxSubtotal"];
      const taxSubtotalArr = Array.isArray(taxSubtotal) ? taxSubtotal : (taxSubtotal ? [taxSubtotal] : []);
      let isReverseCharge = false;
      let taxExemptionReason = "";
      for (const st of taxSubtotalArr) {
        const cat = st?.["cac:TaxCategory"] || st?.["TaxCategory"];
        const catId = String(cat?.["cbc:ID"] ?? cat?.["ID"] ?? "").trim().toUpperCase();
        const reason = String(cat?.["cbc:TaxExemptionReason"] ?? cat?.["TaxExemptionReason"] ?? "").trim();
        const reasonCode = String(cat?.["cbc:TaxExemptionReasonCode"] ?? cat?.["TaxExemptionReasonCode"] ?? "").trim().toUpperCase();
        if (catId === "AE" || reasonCode === "VATEX-EU-AE" || /taxare\s*invers/i.test(reason)) {
          isReverseCharge = true;
          taxExemptionReason = reason || "Taxare inversă conform art. 331 Codul Fiscal";
          break;
        }
      }

      let xmlLines =
        invoiceObj["cac:InvoiceLine"] ||
        invoiceObj["cac:CreditNoteLine"] ||
        invoiceObj["InvoiceLine"] ||
        invoiceObj["CreditNoteLine"] ||
        [];
      if (!Array.isArray(xmlLines)) xmlLines = [xmlLines];

      if (!isReverseCharge) {
        for (const line of xmlLines) {
          const item = line["cac:Item"] || line["Item"];
          const taxCat = item?.["cac:ClassifiedTaxCategory"] || item?.["ClassifiedTaxCategory"];
          const taxCatObj = Array.isArray(taxCat) ? taxCat[0] : taxCat;
          const catId = String(taxCatObj?.["cbc:ID"] ?? taxCatObj?.["ID"] ?? "").trim().toUpperCase();
          if (catId === "AE") {
            isReverseCharge = true;
            taxExemptionReason = "Taxare inversă conform art. 331 Codul Fiscal";
            break;
          }
        }
      }

      const isZeroVatInvoice =
        isReverseCharge ||
        totalVAT === 0 ||
        (subtotal !== 0 && Math.abs(subtotal - total) < 0.02);

      const lines = xmlLines.map((line: any) => {
        const item = line["cac:Item"] || line["Item"];
        const price = line["cac:Price"] || line["Price"];
        const taxCategory = item?.["cac:ClassifiedTaxCategory"] || item?.["ClassifiedTaxCategory"];
        const taxCategoryObj = Array.isArray(taxCategory) ? taxCategory[0] : taxCategory;

        const rawQty = parseXmlNumber(
          line["cbc:InvoicedQuantity"] ??
            line["InvoicedQuantity"] ??
            line["cbc:CreditedQuantity"] ??
            line["CreditedQuantity"],
          1
        );
        const rawUnitPrice = parseXmlNumber(
          price?.["cbc:PriceAmount"] ?? price?.["PriceAmount"],
          0
        );
        const rawTotal = parseXmlNumber(
          line["cbc:LineExtensionAmount"] ?? line["LineExtensionAmount"],
          rawQty * rawUnitPrice
        );

        const rawPercent =
          taxCategoryObj?.["cbc:Percent"] ?? taxCategoryObj?.["Percent"];
        const categoryId = String(
          taxCategoryObj?.["cbc:ID"] ?? taxCategoryObj?.["ID"] ?? ""
        ).trim().toUpperCase();
        const isZeroCategory = ["O", "E", "Z", "AE", "K", "G"].includes(categoryId);

        let vatRate = 0;
        if (isZeroVatInvoice || isZeroCategory) {
          vatRate = 0;
        } else if (rawPercent !== undefined && rawPercent !== null && rawPercent !== "") {
          vatRate = parseXmlNumber(rawPercent, 0);
        } else if (subtotal > 0 && totalVAT > 0) {
          vatRate = Math.round((totalVAT / subtotal) * 100);
        } else {
          vatRate = isZeroVatInvoice ? 0 : 21;
        }

        // If CreditNote, ensure negative values
        const quantity = isCreditNote && rawQty > 0 ? -rawQty : rawQty;
        const lineTotal = isCreditNote && rawTotal > 0 ? -rawTotal : rawTotal;

        const rawDesc = getXmlText(
          item?.["cbc:Name"] ||
            item?.["Name"] ||
            item?.["cbc:Description"] ||
            item?.["Description"],
          "Articol"
        );
        const cleanDesc = rawDesc
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");

        return {
          description: cleanDesc,
          quantity,
          unitPrice: rawUnitPrice,
          unit: String(
            line["cbc:InvoicedQuantity"]?.["@_unitCode"] ||
              line["InvoicedQuantity"]?.["@_unitCode"] ||
              line["cbc:CreditedQuantity"]?.["@_unitCode"] ||
              line["CreditedQuantity"]?.["@_unitCode"] ||
              "buc"
          ),
          vatRate,
          total: lineTotal,
        };
      });

      // Extragere deduceri și taxe suplimentare (cac:AllowanceCharge)
      let xmlAllowances =
        invoiceObj["cac:AllowanceCharge"] ||
        invoiceObj["AllowanceCharge"] ||
        [];
      if (!Array.isArray(xmlAllowances)) xmlAllowances = [xmlAllowances];

      const allowanceLines = xmlAllowances.map((ac: any) => {
        const isCharge = String(
          ac["cbc:ChargeIndicator"] ?? ac["ChargeIndicator"] ?? "false"
        ).toLowerCase() === "true";

        const rawReason = getXmlText(
          ac["cbc:AllowanceChargeReason"] || ac["AllowanceChargeReason"],
          isCharge ? "Taxă suplimentară" : "Deducere / Rabat"
        );
        const reasonCode = getXmlText(
          ac["cbc:AllowanceChargeReasonCode"] || ac["AllowanceChargeReasonCode"],
          ""
        );
        const percent = ac["cbc:MultiplierFactorNumeric"] ?? ac["MultiplierFactorNumeric"];
        const amount = parseXmlNumber(ac["cbc:Amount"] ?? ac["Amount"], 0);

        let desc = rawReason;
        if (!isCharge) {
          desc = percent ? `Deducere / Rabat (${percent}%): ${rawReason}` : `Deducere / Rabat: ${rawReason}`;
        } else {
          desc = reasonCode ? `Taxă suplimentară: ${rawReason} (${reasonCode})` : `Taxă suplimentară: ${rawReason}`;
        }

        const signedAmount = isCharge ? Math.abs(amount) : -Math.abs(amount);

        const acTaxCat = ac["cac:TaxCategory"] || ac["TaxCategory"];
        const acCatId = String(acTaxCat?.["cbc:ID"] ?? acTaxCat?.["ID"] ?? "").trim().toUpperCase();
        const acPercent = acTaxCat?.["cbc:Percent"] ?? acTaxCat?.["Percent"];
        const isAcZero = isZeroVatInvoice || ["O", "E", "Z", "AE", "K", "G"].includes(acCatId);
        const acVatRate = isAcZero ? 0 : (acPercent !== undefined ? parseXmlNumber(acPercent, 0) : 0);

        return {
          description: desc,
          quantity: 1,
          unitPrice: signedAmount,
          unit: isCharge ? "serv" : "buc",
          vatRate: acVatRate,
          total: signedAmount,
        };
      });

      const allLines = [...lines, ...allowanceLines];

      // Extragere număr index SPV
      let spvIndex: string | null = (inv as any).spvIndex || null;
      if (!spvIndex && inv.notes) {
        const m = inv.notes.match(/Index(?:\s*SPV|\s*încărcare)?\s*:?\s*(\d+)/i);
        if (m) spvIndex = m[1];
      }
      if (!spvIndex && inv.invoiceNumber) {
        const { emittedInvoices } = await import("../drizzle/schema");
        const cleanInvNum = String(inv.invoiceNumber).replace(/[^a-zA-Z0-9]/g, "");
        const [emitted] = await db
          .select({ spvIndex: emittedInvoices.spvIndex })
          .from(emittedInvoices)
          .where(
            and(
              sql`REPLACE(REPLACE(${emittedInvoices.number}, '-', ''), ' ', '') = ${cleanInvNum}`,
              sql`${emittedInvoices.spvIndex} IS NOT NULL`
            )
          );
        if (emitted?.spvIndex) spvIndex = emitted.spvIndex;
      }
      if (!spvIndex && inv.fileName && inv.direction !== "in") {
        const m = inv.fileName.match(/SPV_(\d+)/i);
        if (m) spvIndex = m[1];
      }

      const pdfData = {
        number: getXmlText(invoiceObj["cbc:ID"] || invoiceObj["ID"], inv.invoiceNumber || ""),
        date: getXmlText(invoiceObj["cbc:IssueDate"] || invoiceObj["IssueDate"], inv.issueDate || ""),
        dueDate: getXmlText(
          invoiceObj["cbc:DueDate"] || invoiceObj["DueDate"],
          getXmlText(invoiceObj["cbc:IssueDate"] || invoiceObj["IssueDate"], inv.dueDate || inv.issueDate || "")
        ),

        companyName: supplierDetails.name,
        companyCUI: supplierDetails.cui,
        companyAddress: supplierDetails.address,
        companyCity: supplierDetails.city,
        companyCounty: supplierDetails.county,
        companyCountry: supplierDetails.country || "RO",
        companyEmail: supplierDetails.email,
        companyPhone: supplierDetails.phone,
        companyIBAN: supplierIban,
        companyBank: supplierBank,
        spvIndex: spvIndex || undefined,

        clientName: customerDetails.name,
        clientCUI: customerDetails.cui,
        clientAddress: customerDetails.address,
        clientCity: customerDetails.city,
        clientCounty: customerDetails.county,
        clientCountry: customerDetails.country || "RO",
        clientEmail: customerDetails.email,
        clientPhone: customerDetails.phone,

        logoBase64,
        logoHasBackground,
        logoBgColor,
        themeColor,
        template: "classic" as any,
        isCreditNote,
        documentTitle: isCreditNote ? "FACTURĂ STORNO" : undefined,
        isReverseCharge,
        taxExemptionReason,
        notes: inv.notes || (taxExemptionReason ? `Taxare inversă: ${taxExemptionReason}` : undefined),
        lines: allLines,

        subtotal,
        totalVAT,
        total,
        currency: getXmlText(
          invoiceObj["cbc:DocumentCurrencyCode"] || invoiceObj["DocumentCurrencyCode"],
          "RON"
        ),
      };

      const isDownload = req.query.download === "1";
      const filename = `SPV_${pdfData.number}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `${isDownload ? "attachment" : "inline"}; filename="${filename}"`
      );

      const pdfStream = generateReInvoicePDF(pdfData);
      pdfStream.on("error", (err: any) => {
        if (!res.headersSent) res.status(500).json({ error: err.message });
      });
      res.on("close", () => {
        try {
          pdfStream.destroy?.();
        } catch {}
      });
      pdfStream.pipe(res);
    } catch (e: any) {
      console.error("[PDF Archive Route] Error:", e.message);
      if (!res.headersSent) res.status(500).json({ error: e.message });
    }
  });

  // GET /api/pdf/emitted/:id
  router.get("/emitted/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "ID invalid" });
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(500).json({ error: "DB unavailable" });
        return;
      }

      const { emittedInvoices, emittedInvoiceLines, tenants, clients } =
        await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const [inv] = await db
        .select()
        .from(emittedInvoices)
        .where(eq(emittedInvoices.id, id));
      if (!inv) {
        res.status(404).json({ error: "Factura nu a fost găsită" });
        return;
      }

      let clientRecord: any = null;
      if (inv.clientId) {
        const [c] = await db
          .select()
          .from(clients)
          .where(eq(clients.id, inv.clientId));
        clientRecord = c;
      }

      const lines = await db
        .select()
        .from(emittedInvoiceLines)
        .where(eq(emittedInvoiceLines.emittedInvoiceId, id));

      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, inv.tenantId));
      let settings: any = {};
      try {
        settings = JSON.parse(tenant?.settings || "{}");
      } catch {}

      const rawNum = (inv.number || `FACT-${id}`).trim();
      const rawSer = (inv.series || "").trim();
      const cleanDisplayNum = rawNum.toUpperCase().startsWith(rawSer.toUpperCase())
        ? rawNum
        : `${rawSer} ${rawNum}`.trim();
      const filename = `${rawNum.toUpperCase().startsWith(rawSer.toUpperCase()) ? rawNum : (rawSer ? `${rawSer}-${rawNum}` : rawNum)}.pdf`;
      const isDownload = req.query.download === "1";

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `${isDownload ? "attachment" : "inline"}; filename="${filename}"`
      );

      let logoBase64 = settings.logoBase64 || undefined;
      let logoHasBackground = Boolean(settings.logoHasBackground);
      let logoBgColor = settings.logoBgColor || "#0f172a";
      let themeColor = settings.themeColor || (settings.theme && THEME_MAP[settings.theme]) || "#2563eb";

      let targetIBAN = (inv as any).companyIBAN || "";
      let targetBank = (inv as any).companyBank || "";

      if (!targetIBAN) {
        if (settings.bankAccounts && Array.isArray(settings.bankAccounts)) {
          const matchingAcc = settings.bankAccounts.find(
            (a: any) => a.currency?.toUpperCase() === (inv.currency || "RON").toUpperCase()
          );
          if (matchingAcc && matchingAcc.iban) {
            targetIBAN = matchingAcc.iban;
            targetBank = matchingAcc.bank || "";
          }
        }
        if (!targetIBAN && (inv.currency || "").toUpperCase() === "EUR" && settings.ibanEur) {
          targetIBAN = settings.ibanEur;
          targetBank = settings.bankEur || "";
        }
        if (!targetIBAN) {
          targetIBAN = settings.iban || "";
          targetBank = settings.bank || "";
        }
      }

      const isForeign = Boolean(
        (inv.clientCountry && inv.clientCountry !== "RO") ||
        (inv.clientCUI && !inv.clientCUI.startsWith("RO") && /^[A-Z]{2}/.test(inv.clientCUI)) ||
        (inv.currency && inv.currency !== "RON" && inv.currency !== "LEI")
      );

      const translatedLines = await Promise.all(
        lines.map(async l => ({
          description: l.description || "",
          translatedDescription: isForeign
            ? await translateProductDescription(l.description || "")
            : undefined,
          quantity: parseFloat(l.quantity || "1"),
          unitPrice: parseFloat(l.unitPrice || "0"),
          unit: l.unit || "buc",
          vatRate:
            l.vatRate !== undefined &&
            l.vatRate !== null &&
            String(l.vatRate).trim() !== ""
              ? parseFloat(String(l.vatRate))
              : 21,
          total: parseFloat(l.total || "0"),
        }))
      );

      const pdfStream = generateReInvoicePDF({
        number: cleanDisplayNum,
        date: inv.issueDate || new Date().toISOString().split("T")[0],
        dueDate: inv.dueDate || "",
        clientName: inv.clientName || clientRecord?.name || "",
        clientCUI: inv.clientCUI || clientRecord?.cui || "",
        clientAddress: inv.clientAddress || clientRecord?.address || "",
        clientCity: inv.clientCity || clientRecord?.city || "",
        clientCounty: clientRecord?.county || "",
        clientCountry: inv.clientCountry || clientRecord?.country || "",
        clientEmail: inv.clientEmail || clientRecord?.email || "",
        clientPhone: inv.clientPhone || clientRecord?.phone || "",
        companyName: tenant?.name || "",
        companyCUI: tenant?.cui || "",
        companyAddress: tenant?.address || "",
        companyCity: settings.city || "",
        companyCounty: settings.county || "",
        companyCountry: settings.country || "RO",
        companyEmail: tenant?.email || "",
        companyPhone: tenant?.phone || "",
        companyIBAN: targetIBAN,
        companyBank: targetBank,
        logoBase64,
        logoHasBackground,
        logoBgColor,
        themeColor,
        template: settings.invoiceTemplate === "modern" ? "classic" : (settings.invoiceTemplate || "classic"),
        lines: translatedLines,
        subtotal: (() => {
          const linesSum = translatedLines.reduce(
            (s, l) => s + (Math.round(l.quantity * l.unitPrice * 100) / 100),
            0
          );
          const rawSub = parseFloat(inv.subtotal || "0");
          return (translatedLines.length > 0 && Math.abs(linesSum - rawSub) > 0.01) ? linesSum : (rawSub || linesSum);
        })(),
        totalVAT: (() => {
          const linesVat = translatedLines.reduce(
            (s, l) => s + (Math.round((Math.round(l.quantity * l.unitPrice * 100) / 100) * (l.vatRate / 100) * 100) / 100),
            0
          );
          const rawVat = parseFloat(inv.totalVAT || "0");
          return (translatedLines.length > 0 && Math.abs(linesVat - rawVat) > 0.01) ? linesVat : (rawVat || linesVat);
        })(),
        total: (() => {
          const linesSum = translatedLines.reduce(
            (s, l) => s + (Math.round(l.quantity * l.unitPrice * 100) / 100),
            0
          );
          const linesVat = translatedLines.reduce(
            (s, l) => s + (Math.round((Math.round(l.quantity * l.unitPrice * 100) / 100) * (l.vatRate / 100) * 100) / 100),
            0
          );
          const rawTot = parseFloat(inv.total || "0");
          const calcTot = Math.round((linesSum + linesVat) * 100) / 100;
          return (translatedLines.length > 0 && Math.abs(calcTot - rawTot) > 0.01) ? calcTot : (rawTot || calcTot);
        })(),
        currency: inv.currency || "RON",
        notes: inv.notes || undefined,
        spvIndex: inv.spvIndex || undefined,
      });

      pdfStream.on("error", (err: any) => {
        if (!res.headersSent) res.status(500).json({ error: err.message });
      });
      res.on("close", () => {
        try {
          pdfStream.destroy?.();
        } catch {}
      });
      pdfStream.pipe(res);
    } catch (e: any) {
      console.error("[PDF Emitted Route] Error:", e.message);
      if (!res.headersSent) res.status(500).json({ error: e.message });
    }
  });

  // ─── GET /api/pdf/nir/:id — PDF Nota de Intrare-Recepție ─────────────────────
  router.get("/nir/:id", async (req: Request, res: Response) => {
    let doc: any = null;
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "ID invalid" });
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(500).json({ error: "DB unavailable" });
        return;
      }

      const { nir, nirLines } = await import("../drizzle/schema");
      const { eq: eqOp } = await import("drizzle-orm");

      const [nirRow] = await db.select().from(nir).where(eqOp(nir.id, id));
      if (!nirRow) {
        res.status(404).json({ error: "NIR nu a fost găsit" });
        return;
      }

      const linesRaw = await db
        .select()
        .from(nirLines)
        .where(eqOp(nirLines.nirId, id))
        .orderBy(nirLines.lineOrder);

      const { sagaArticles } = await import("../modules/saga/schema");
      const articles = await db.select().from(sagaArticles).where(eqOp(sagaArticles.tenantId, nirRow.tenantId));
      
      const lines = linesRaw.map(l => {
        const article = l.sagaArticleId ? articles.find(a => a.id === l.sagaArticleId) : null;
        return {
          ...l,
          articleCode: article ? article.code : "",
        };
      });

      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, nirRow.tenantId));

      // ── Resolve SPV Index / ID Încărcare SPV ──
      const { invoiceArchive } = await import("../drizzle/schema");
      const { and: andOp } = await import("drizzle-orm");
      let spvIndex: string | null = null;
      let linkedInvoice: any = null;
      if (nirRow.invoiceArchiveId) {
        const [inv] = await db
          .select()
          .from(invoiceArchive)
          .where(eqOp(invoiceArchive.id, nirRow.invoiceArchiveId));
        if (inv) {
          linkedInvoice = inv;
          if (inv.spvIndex) spvIndex = inv.spvIndex;
          else if (inv.notes) {
            const m = inv.notes.match(/index\s*(?:incarcare|spv)?[:\s]+(\d+)/i);
            if (m) spvIndex = m[1];
          }
          if (!spvIndex && inv.fileName) {
            const m = inv.fileName.match(/(?:SPV_|_INDEX_|id_|index_)(\d{8,12})/i);
            if (m) spvIndex = m[1];
          }
        }
      }
      if (!spvIndex && nirRow.invoiceNumber) {
        const invs = await db
          .select()
          .from(invoiceArchive)
          .where(
            andOp(
              eqOp(invoiceArchive.tenantId, nirRow.tenantId),
              eqOp(invoiceArchive.invoiceNumber, nirRow.invoiceNumber)
            )
          );
        for (const inv of invs) {
          if (!linkedInvoice) linkedInvoice = inv;
          if (inv.spvIndex) { spvIndex = inv.spvIndex; break; }
          if (inv.notes) {
            const m = inv.notes.match(/index\s*(?:incarcare|spv)?[:\s]+(\d+)/i);
            if (m) { spvIndex = m[1]; break; }
          }
        }
      }
      if (!spvIndex) {
        const { sagaIntrari } = await import("../modules/saga/schema");
        const [si] = await db
          .select()
          .from(sagaIntrari)
          .where(
            andOp(
              eqOp(sagaIntrari.tenantId, nirRow.tenantId),
              nirRow.invoiceNumber ? eqOp(sagaIntrari.nrDoc, nirRow.invoiceNumber) : eqOp(sagaIntrari.nirId, nirRow.id)
            )
          );
        if (si?.idSPV) spvIndex = si.idSPV;
      }
      if (!spvIndex && nirRow.notes) {
        const m = nirRow.notes.match(/index\s*(?:incarcare|spv)?[:\s]+(\d+)/i);
        if (m) spvIndex = m[1];
      }

      const netLinesTotal = linesRaw.reduce((sum, l) => {
        const q = parseFloat(String(l.cantitateReceptionata || "0"));
        const p = parseFloat(String(l.unitPrice || "0"));
        const t = parseFloat(String(l.total || "0"));
        return sum + (!isNaN(t) && t !== 0 ? t : (!isNaN(q) && !isNaN(p) ? q * p : 0));
      }, 0);

      const invTotalNum = linkedInvoice?.total != null ? parseFloat(String(linkedInvoice.total)) : null;

      const isCreditNote = invTotalNum !== null && !isNaN(invTotalNum)
        ? (invTotalNum < 0 || !!(
            (linkedInvoice?.rawXml && (
              linkedInvoice.rawXml.includes("<CreditNote") ||
              linkedInvoice.rawXml.includes(":CreditNote") ||
              linkedInvoice.rawXml.includes("CreditNoteLine") ||
              linkedInvoice.rawXml.includes("<cbc:InvoiceTypeCode>381</cbc:InvoiceTypeCode>") ||
              linkedInvoice.rawXml.includes("<InvoiceTypeCode>381</InvoiceTypeCode>")
            )) ||
            (linkedInvoice?.notes && /storno|credit\s*note/i.test(linkedInvoice.notes)) ||
            (nirRow.notes && /storno|credit\s*note/i.test(nirRow.notes))
          )) && invTotalNum <= 0
        : !!(
            (linkedInvoice?.rawXml && (
              linkedInvoice.rawXml.includes("<CreditNote") ||
              linkedInvoice.rawXml.includes(":CreditNote") ||
              linkedInvoice.rawXml.includes("CreditNoteLine") ||
              linkedInvoice.rawXml.includes("<cbc:InvoiceTypeCode>381</cbc:InvoiceTypeCode>") ||
              linkedInvoice.rawXml.includes("<InvoiceTypeCode>381</InvoiceTypeCode>")
            )) ||
            (linkedInvoice?.notes && /storno|credit\s*note/i.test(linkedInvoice.notes)) ||
            (nirRow.notes && /storno|credit\s*note/i.test(nirRow.notes)) ||
            netLinesTotal < 0
          );
      let settings: any = {};
      try {
        settings = JSON.parse(tenant?.settings || "{}");
      } catch {}

      const logoBase64: string | undefined = settings.logoBase64 || undefined;
      const logoHasBackground: boolean = Boolean(settings.logoHasBackground);
      const logoBgColor: string = settings.logoBgColor || "#0f172a";
      const isDownload = req.query.download === "1";
      const showAccounting = req.query.showAccounting !== "false";
      const filename = `NIR-${nirRow.nirNumber || id}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `${isDownload ? "attachment" : "inline"}; filename="${filename}"`
      );

      // ── Generate NIR PDF with PDFKit ──
      const PDFDocument = (await import("pdfkit")).default;
      doc = new PDFDocument({
        size: "A4",
        margin: 40,
        bufferPages: true,
      });
      // Inregistrare fonturi cu diacritice (Roboto)
      const robotoReg = path.resolve(
        process.cwd(),
        "server/assets/fonts/Roboto-Regular.ttf"
      );
      const robotoBold = path.resolve(
        process.cwd(),
        "server/assets/fonts/Roboto-Bold.ttf"
      );
      if (fs.existsSync(robotoReg)) doc.registerFont("Roboto", robotoReg);
      if (fs.existsSync(robotoBold))
        doc.registerFont("Roboto-Bold", robotoBold);

      // Pipe to response
      doc.pipe(res);

      const W = doc.page.width - 80; // usable width
      const BLUE = "#1e6fbf";
      const TEAL = "#0d9488";
      const GRAY = "#64748b";
      const LIGHT = "#f8fafc";
      const BORDER = "#e2e8f0";
      const fmt2 = (n: number) => n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      // ── HEADER ──────────────────────────────────────────────────────────────
      // Logo stânga
      const activeLogo = (logoBase64 && logoBase64 !== "DEFAULT_TEXT_LOGO") ? logoBase64 : "DEFAULT_TEXT_LOGO";
      const cardX = 40;
      const cardY = 20;
      const cardW = 120;
      const cardH = 36;
      const cardR = 7;

      if (logoHasBackground) {
        doc.save();
        doc.fillColor(logoBgColor);
        doc.roundedRect(cardX, cardY, cardW, cardH, cardR).fill();
        doc.restore();
      }

      const padX = logoHasBackground ? 7 : 0;
      const padY = logoHasBackground ? 4 : 0;
      const imgW = cardW - padX * 2;
      const imgH = cardH - padY * 2;

      if (activeLogo === "DEFAULT_TEXT_LOGO") {
        let foundPath = null;
        try {
          const logoPaths = [
            path.resolve(process.cwd(), "client/public/logo_spv2.png"),
            path.resolve(process.cwd(), "../client/public/logo_spv2.png"),
            path.resolve(process.cwd(), "dist/public/logo_spv2.png"),
            path.resolve(process.cwd(), "server/assets/logo_spv2.png"),
          ];
          for (const p of logoPaths) {
            if (fs.existsSync(p)) {
              foundPath = p;
              break;
            }
          }

          if (foundPath) {
            const imgBuffer = fs.readFileSync(foundPath);
            doc.image(imgBuffer, cardX + padX, cardY + padY, {
              fit: [imgW, imgH],
              align: "center",
              valign: "center",
            });
            doc.link(cardX, cardY, cardW, cardH, "https://facturaspv.ro/");
          } else {
            doc
              .fontSize(14)
              .font("Roboto-Bold")
              .fillColor(BLUE)
              .text(tenant?.name || "Firma", 40, 40);
          }
        } catch {
          doc
            .fontSize(14)
            .font("Roboto-Bold")
            .fillColor(BLUE)
            .text(tenant?.name || "Firma", 40, 40);
        }
      } else {
        try {
          const imgBuf = Buffer.from(
            logoBase64!.replace(/^data:image\/\w+;base64,/, ""),
            "base64"
          );
          doc.image(imgBuf, cardX + padX, cardY + padY, {
            fit: [imgW, imgH],
            align: "center",
            valign: "center",
          });
        } catch {
          doc
            .fontSize(14)
            .font("Roboto-Bold")
            .fillColor(BLUE)
            .text(tenant?.name || "Firma", 40, 40);
        }
      }

      // Titlu NIR dreapta
      const nirTitle = isCreditNote ? "NOTĂ DE INTRARE-RECEPȚIE (STORNO)" : "NOTĂ DE INTRARE-RECEPȚIE";
      doc
        .fontSize(isCreditNote ? 14 : 16)
        .font("Roboto-Bold")
        .fillColor(TEAL)
        .text(nirTitle, 0, 30, { align: "right" });
      doc
        .fontSize(8)
        .font("Roboto")
        .fillColor(GRAY)
        .text("(Cod formular 14-3-1/aA — OMFP 2634/2015)", 0, 48, {
          align: "right",
        });
      if (spvIndex) {
        doc
          .fontSize(7.5)
          .font("Roboto-Bold")
          .fillColor(TEAL)
          .text(`ID Încărcare SPV: ${spvIndex}`, 0, 60, { align: "right" });
      }

      doc
        .moveTo(40, 75)
        .lineTo(doc.page.width - 40, 75)
        .strokeColor(TEAL)
        .lineWidth(1.5)
        .stroke();

      // ── DATE NIR ─────────────────────────────────────────────────────────────
      let y = 82;
      doc.rect(40, y, W, 54).fillColor(LIGHT).fill();
      doc.rect(40, y, W, 54).strokeColor(BORDER).lineWidth(0.5).stroke();

      doc
        .fontSize(6.5)
        .font("Roboto-Bold")
        .fillColor(GRAY)
        .text("DATE NIR", 50, y + 4);
      y += 14;

      const col = W / 4;
      const fields: [string, string][] = [
        ["Nr. NIR:", nirRow.nirNumber],
        ["Data recepție:", nirRow.receiptDate],
        ["Nr. factură:", nirRow.invoiceNumber || "—"],
        ["Nr. aviz:", nirRow.avizNumber || "—"],
      ];
      fields.forEach(([label, val], i) => {
        const x = 50 + i * col;
        doc.fontSize(6.5).font("Roboto").fillColor(GRAY).text(label, x, y);
        doc
          .fontSize(7.5)
          .font("Roboto-Bold")
          .fillColor("#1e293b")
          .text(val, x, y + 8);
      });

      y += 20;
      const fields2: [string, string][] = [
        ["Gestiunea:", nirRow.gestiune || "—"],
      ];
      if (showAccounting) {
        fields2.push(["Tip SAGA (Gen):", nirRow.accountingType || "Marfuri"]);
        fields2.push(["Cont (Gen):", nirRow.accountingAccount || "371"]);
      }
      fields2.push(["ID Încărcare SPV:", spvIndex || "—"]);
      fields2.forEach(([label, val], i) => {
        const x = 50 + i * col;
        doc.fontSize(6.5).font("Roboto").fillColor(GRAY).text(label, x, y);
        const isSpv = label.includes("SPV") && val !== "—";
        doc
          .fontSize(7.5)
          .font("Roboto-Bold")
          .fillColor(isSpv ? TEAL : "#1e293b")
          .text(val, x, y + 8);
      });

      // ── FURNIZOR + FIRMA ──────────────────────────────────────────────────────
      y = 142;
      const halfW = (W - 10) / 2;

      // Furnizor box
      doc.rect(40, y, halfW, 58).fillColor(LIGHT).fill();
      doc.rect(40, y, halfW, 58).strokeColor(BORDER).lineWidth(0.5).stroke();
      doc
        .fontSize(6.5)
        .font("Roboto-Bold")
        .fillColor(GRAY)
        .text("FURNIZOR", 50, y + 4);
      doc
        .fontSize(8)
        .font("Roboto-Bold")
        .fillColor("#1e293b")
        .text(nirRow.supplierName || "—", 50, y + 15, { width: halfW - 20 });
      doc
        .fontSize(6.5)
        .font("Roboto")
        .fillColor(GRAY)
        .text(`CUI: ${nirRow.supplierCUI || "—"}`, 50, y + 26)
        .text(nirRow.supplierAddress || "", 50, y + 36, { width: halfW - 20 });

      // Firma box
      const x2 = 40 + halfW + 10;
      doc.rect(x2, y, halfW, 58).fillColor(LIGHT).fill();
      doc.rect(x2, y, halfW, 58).strokeColor(BORDER).lineWidth(0.5).stroke();
      doc
        .fontSize(6.5)
        .font("Roboto-Bold")
        .fillColor(GRAY)
        .text("UNITATEA", x2 + 10, y + 4);
      doc
        .fontSize(8)
        .font("Roboto-Bold")
        .fillColor("#1e293b")
        .text(tenant?.name || "—", x2 + 10, y + 15, { width: halfW - 20 });
      doc
        .fontSize(6.5)
        .font("Roboto")
        .fillColor(GRAY)
        .text(`CUI: ${tenant?.cui || "—"}`, x2 + 10, y + 26)
        .text(tenant?.address || "", x2 + 10, y + 36, { width: halfW - 20 });

      // ── TABEL PRODUSE ─────────────────────────────────────────────────────────
      y = 208;
      doc
        .fontSize(6.5)
        .font("Roboto-Bold")
        .fillColor(GRAY)
        .text("PRODUSE / SERVICII RECEPȚIONATE", 40, y);
      y += 10;

      // Header tabel
      const cols = showAccounting 
        ? [20, 45, 75, 55, 40, 25, 45, 45, 60, 35, 70] 
        : [20, 45, 170, 25, 45, 45, 60, 35, 70];
      const headers = showAccounting
        ? [
            "Nr.",
            "Cod",
            "Denumire produs",
            "Tip",
            "Cont",
            "U/M",
            "Cant. doc",
            "Cant. rec",
            "Preț un.",
            "TVA%",
            "Valoare",
          ]
        : [
            "Nr.",
            "Cod",
            "Denumire produs",
            "U/M",
            "Cant. doc",
            "Cant. rec",
            "Preț un.",
            "TVA%",
            "Valoare",
          ];
      let xOff = 40;
      doc.rect(40, y, W, 14).fillColor(TEAL).fill();
      headers.forEach((h, i) => {
        doc
          .fontSize(6)
          .font("Roboto-Bold")
          .fillColor("white")
          .text(h, xOff + 2, y + 4, {
            width: cols[i] - 4,
            align: (showAccounting ? (i > 4) : (i > 2)) ? "right" : "left",
          });
        xOff += cols[i];
      });
      y += 14;

      // Rows
      lines.forEach((line, idx) => {
        const rowH = 14;
        let cantRec = parseXmlNumber(line.cantitateReceptionata, 0);
        let cantDoc = parseXmlNumber(line.cantitateComanda, 0);
        let lineUnitPrice = parseXmlNumber(line.unitPrice, 0);
        let lineTotalVal = parseXmlNumber(line.total, cantRec * lineUnitPrice);
        const lineVatRate = parseXmlNumber(line.vatRate, 21);

        // If the source document is a CreditNote (Storno), ensure quantities and values are displayed as negative
        if (isCreditNote) {
          if (cantRec > 0) cantRec = -cantRec;
          if (cantDoc > 0) cantDoc = -cantDoc;
          if (lineTotalVal > 0) lineTotalVal = -lineTotalVal;
        }

        const hasDiff = cantRec !== cantDoc;
        doc
          .rect(40, y, W, rowH)
          .fillColor(idx % 2 === 0 ? LIGHT : "white")
          .fill();
        if (hasDiff) {
          doc.rect(40, y, W, rowH).fillColor("#fef3c7").fill();
        }
        doc.rect(40, y, W, rowH).strokeColor(BORDER).lineWidth(0.3).stroke();

        let xc = 40;

        const cells = [
          { val: String(idx + 1), align: "left" as const },
          { val: (line as any).articleCode || "—", align: "left" as const },
          { val: line.description, align: "left" as const },
        ];
        
        if (showAccounting) {
          cells.push({ val: line.accountingType || nirRow.accountingType || "Marfuri", align: "left" as const });
          cells.push({ val: line.accountingAccount || nirRow.accountingAccount || "371", align: "center" as const });
        }

        cells.push(
          { val: line.unit || "buc", align: "left" as const },
          {
            val: cantDoc.toLocaleString("ro-RO"),
            align: "right" as const,
          },
          {
            val: cantRec.toLocaleString("ro-RO"),
            align: "right" as const,
          },
          {
            val: fmt2(lineUnitPrice),
            align: "right" as const,
          },
          {
            val: String(lineVatRate),
            align: "center" as const,
          },
          {
            val: fmt2(lineTotalVal),
            align: "right" as const,
          }
        );
        cells.forEach((cell, ci) => {
          const isQtyIdx = showAccounting ? 7 : 5;
          const color = ci === isQtyIdx && hasDiff ? "#b45309" : "#1e293b";
          doc
            .fontSize(6.5)
            .font(ci === isQtyIdx && hasDiff ? "Roboto-Bold" : "Roboto")
            .fillColor(color)
            .text(cell.val, xc + 2, y + 3.5, {
              width: cols[ci] - 4,
              align: cell.align,
              ellipsis: true,
            });
          xc += cols[ci];
        });
        y += rowH;

        // New page if needed
        if (y > doc.page.height - 140) {
          doc.addPage();
          y = 40;
        }
      });

      // Calculate totals
      let totalFaraTva = lines.reduce((s, l) => {
        let lineTot = parseXmlNumber(l.total) || (parseXmlNumber(l.cantitateReceptionata) * parseXmlNumber(l.unitPrice));
        if (isCreditNote && lineTot > 0) lineTot = -lineTot;
        return s + lineTot;
      }, 0);
      let totalTva = lines.reduce((s, l) => {
        let lineTot = parseXmlNumber(l.total) || (parseXmlNumber(l.cantitateReceptionata) * parseXmlNumber(l.unitPrice));
        if (isCreditNote && lineTot > 0) lineTot = -lineTot;
        const rate = parseXmlNumber(l.vatRate, 21);
        return s + Math.round(((lineTot * rate) / 100) * 100) / 100;
      }, 0);
      let totalCuTva = totalFaraTva + totalTva;

      // Diferente alert
      const hasDifferences = lines.some(
        l =>
          parseXmlNumber(l.cantitateReceptionata) !==
          parseXmlNumber(l.cantitateComanda)
      );

      // Daca NIR-ul provine dintr-o factura si nu sunt diferente cantitative,
      // aliniem totalurile cu valorile oficiale din factura (elimina diferentele de rotunjire de 1-3 bani)
      if (linkedInvoice && !hasDifferences) {
        const invTotal = parseXmlNumber(linkedInvoice.total, 0);
        const invVat = parseXmlNumber(linkedInvoice.totalVAT, 0);
        if (invTotal !== 0) {
          const calcAbs = Math.abs(totalCuTva);
          const invAbs = Math.abs(invTotal);
          if (Math.abs(calcAbs - invAbs) <= 0.15) {
            totalCuTva = isCreditNote && invTotal > 0 ? -invTotal : invTotal;
            totalTva = isCreditNote && invVat > 0 ? -invVat : invVat;
            totalFaraTva = totalCuTva - totalTva;
          }
        }
      }
      // Valută: moneda facturii + curs BNR (NIR-urile vechi pot avea RON în câmp, deși factura e în valută)
      const rawNirCur = String(nirRow.currency || "RON").trim().toUpperCase();
      const invCur = String(linkedInvoice?.currency || "").trim().toUpperCase();
      const nirCur = rawNirCur !== "RON" && rawNirCur !== "LEI" ? rawNirCur : (invCur || "RON");
      const isForeignNir = nirCur !== "RON" && nirCur !== "LEI";
      let nirRate = parseXmlNumber(nirRow.exchangeRate, 1);
      if (isForeignNir && nirRate <= 1) {
        try {
          const { getBnrRateForDate } = await import("./bnrService");
          const r = await getBnrRateForDate(String(linkedInvoice?.issueDate || nirRow.receiptDate || ""), nirCur);
          if (r?.rate > 0) nirRate = r.rate;
        } catch {}
      }
      const curSuffix = isForeignNir ? ` (${nirCur})` : "";

      // 1. TOTAL FARA TVA
      doc.rect(40, y, W, 14).fillColor(LIGHT).strokeColor(BORDER).lineWidth(0.5).fillAndStroke();
      doc.fontSize(6.5).font("Roboto-Bold").fillColor(GRAY).text(`TOTAL FĂRĂ TVA${curSuffix}:`, 40 + 3, y + 4, { width: W - 75, align: "right" });
      doc.fillColor("#334155").text(`${fmt2(totalFaraTva)}`, 40 + W - 70, y + 4, { width: 68, align: "right" });
      y += 14;
      
      // 2. TOTAL TVA
      doc.rect(40, y, W, 14).fillColor(LIGHT).strokeColor(BORDER).lineWidth(0.5).fillAndStroke();
      doc.fontSize(6.5).font("Roboto-Bold").fillColor(GRAY).text(`TOTAL TVA${curSuffix}:`, 40 + 3, y + 4, { width: W - 75, align: "right" });
      doc.fillColor("#334155").text(`${fmt2(totalTva)}`, 40 + W - 70, y + 4, { width: 68, align: "right" });
      y += 14;
      
      // 3. TOTAL CU TVA
      doc.rect(40, y, W, 16).fillColor(TEAL).fill();
      doc.fontSize(7.5).font("Roboto-Bold").fillColor("white").text(`${isCreditNote ? "TOTAL CU TVA (STORNO)" : "TOTAL CU TVA"}${curSuffix}:`, 40 + 3, y + 4.5, { width: W - 75, align: "right" });
      doc.fontSize(8.5).text(`${fmt2(totalCuTva)}`, 40 + W - 70, y + 4, { width: 68, align: "right" });
      y += 22;

      // 4. Echivalent RON la cursul BNR (doar facturi în valută)
      if (isForeignNir && nirRate > 0) {
        const ronTotal = Math.round(totalCuTva * nirRate * 100) / 100;
        doc.rect(40, y - 4, W, 14).fillColor("#f8fafc").strokeColor(BORDER).lineWidth(0.5).fillAndStroke();
        doc.fontSize(6.5).font("Roboto-Bold").fillColor("#334155").text(
          `Factură în valută: ${nirCur} · Curs BNR: ${nirRate.toLocaleString("ro-RO", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} · Echivalent total: ${fmt2(ronTotal)} RON`,
          40 + 3, y - 4 + 4, { width: W - 6, align: "right" }
        );
        y += 16;
      }

      if (hasDifferences) {
        doc.rect(40, y, W, 20).fillColor("#fef3c7").fill();
        doc.rect(40, y, W, 20).strokeColor("#f59e0b").lineWidth(0.5).stroke();
        doc
          .fontSize(7)
          .font("Roboto-Bold")
          .fillColor("#92400e")
          .text(
            "⚠ ATENȚIE: Există diferențe cantitative — NIR se întocmește în 3 exemplare (conf. OMFP 2634/2015)",
            50,
            y + 6
          );
        y += 24;
        if (nirRow.differenceNotes) {
          doc
            .fontSize(6.5)
            .font("Roboto")
            .fillColor(GRAY)
            .text(`Constatări: ${nirRow.differenceNotes}`, 50, y);
          y += 12;
        }
      }

      // ── COMISIA DE RECEPȚIE ───────────────────────────────────────────────────
      y += 6;
      if (y > doc.page.height - 90) {
        doc.addPage();
        y = 40;
      }

      doc
        .fontSize(7)
        .font("Roboto-Bold")
        .fillColor(GRAY)
        .text("COMISIA DE RECEPȚIE", 40, y);
      y += 10;

      const members = [
        { name: nirRow.member1Name, func: nirRow.member1Function },
        { name: nirRow.member2Name, func: nirRow.member2Function },
        { name: nirRow.member3Name, func: nirRow.member3Function },
      ].filter(m => m.name);

      const mW = W / 3;
      const signatureList = members.length > 0
        ? members
        : [
            { name: "", func: "Gestionar" },
            { name: "", func: "Contabil" },
            { name: "", func: "Șef depozit" },
          ];

      signatureList.forEach((m, i) => {
        const mx = 40 + i * mW;
        doc
          .rect(mx, y, mW - 8, 42)
          .strokeColor(BORDER)
          .lineWidth(0.5)
          .stroke();
        doc
          .fontSize(6.5)
          .font("Roboto-Bold")
          .fillColor(GRAY)
          .text(m.func || "Membru", mx + 5, y + 4);
        if (m.name) {
          doc
            .fontSize(7.5)
            .font("Roboto")
            .fillColor("#1e293b")
            .text(m.name, mx + 5, y + 14);
        }
        // Signature line
        doc
          .moveTo(mx + 5, y + 34)
          .lineTo(mx + mW - 15, y + 34)
          .strokeColor("#94a3b8")
          .lineWidth(0.5)
          .stroke();
        doc
          .fontSize(5.5)
          .font("Roboto")
          .fillColor(GRAY)
          .text("Semnătura", mx + 5, y + 35);
      });
      y += 50;

      // Observatii
      if (nirRow.notes) {
        doc
          .fontSize(6.5)
          .font("Roboto-Bold")
          .fillColor(GRAY)
          .text("OBSERVAȚII:", 40, y);
        doc
          .fontSize(6.5)
          .font("Roboto")
          .fillColor("#1e293b")
          .text(nirRow.notes, 100, y, { width: W - 60 });
        y += 12;
      }

      // Footer - Switch through all buffered pages and draw footer without creating extra page
      const footerY = doc.page.height - 25;
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const oldBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc
          .moveTo(40, footerY - 5)
          .lineTo(doc.page.width - 40, footerY - 5)
          .strokeColor(BORDER)
          .lineWidth(0.5)
          .stroke();
        doc
          .fontSize(6.5)
          .font("Roboto")
          .fillColor(GRAY)
          .text(
            `NIR ${nirRow.nirNumber} • Generat: ${new Date().toLocaleDateString("ro-RO")} • ${tenant?.name || ""} • Pagina ${i + 1} din ${range.count}`,
            40,
            footerY,
            { align: "center", width: W, lineBreak: false }
          );
        doc.page.margins.bottom = oldBottom;
      }

      doc.end();
    } catch (e: any) {
      console.error("[PDF NIR Route] Error:", e.message);
      try {
        if (doc) doc.end();
      } catch {}
      if (!res.headersSent) {
        res.status(500).json({ error: e.message });
      } else {
        res.end();
      }
    }
  });

  // ─── GET /api/pdf/deviz/:id — PDF Deviz ─────────────────────────────────────
  router.get("/deviz/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "ID invalid" });
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(500).json({ error: "DB unavailable" });
        return;
      }

      const { devize, devizeLines, emittedInvoices, reInvoices } = await import("../drizzle/schema");

      const [deviz] = await db.select().from(devize).where(eq(devize.id, id));
      if (!deviz) {
        res.status(404).json({ error: "Devizul nu a fost găsit" });
        return;
      }

      let invoice: any = null;
      if (deviz.invoiceId) {
        const [emitted] = await db
          .select()
          .from(emittedInvoices)
          .where(and(eq(emittedInvoices.id, deviz.invoiceId), eq(emittedInvoices.tenantId, deviz.tenantId)));
        if (emitted) {
          invoice = {
            id: emitted.id,
            number: emitted.number,
            series: emitted.series,
            clientName: emitted.clientName,
            clientCUI: emitted.clientCUI,
            clientAddress: emitted.clientAddress,
            clientCity: emitted.clientCity,
            clientRegCom: (emitted as any).clientRegCom || "",
            intocmitDe: emitted.intocmitDe,
            delegat: emitted.delegat,
            totalVAT: emitted.totalVAT,
            total: emitted.total,
            currency: emitted.currency,
          };
        } else {
          const [re] = await db
            .select()
            .from(reInvoices)
            .where(and(eq(reInvoices.id, deviz.invoiceId), eq(reInvoices.tenantId, deviz.tenantId)));
          if (re) {
            invoice = {
              id: re.id,
              number: re.number,
              clientName: re.clientName,
              clientCUI: re.clientCUI,
              clientAddress: re.clientAddress,
              clientCity: re.clientCity,
              intocmitDe: (re as any).intocmitDe || "",
              delegat: (re as any).delegat || "",
              totalVAT: re.totalVAT,
              total: re.total,
              currency: re.currency,
            };
          }
        }
      }

      const lines = await db
        .select()
        .from(devizeLines)
        .where(eq(devizeLines.devizId, id))
        .orderBy(devizeLines.lineOrder);

      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, deviz.tenantId));
      let settings: any = {};
      try {
        settings = JSON.parse(tenant?.settings || "{}");
      } catch {}

      const isDownload = req.query.download === "1";
      const showCodes = req.query.showCodes === "1";
      const filename = `Deviz-${deviz.number || id}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `${isDownload ? "attachment" : "inline"}; filename="${filename}"`
      );

      const PDFDocument = (await import("pdfkit")).default;
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
        bufferPages: true,
      });
      doc.pipe(res);

      // ESM-safe imports
      const { default: fsModule } = await import("fs");
      const { default: pathModule } = await import("path");
      const robotoReg = pathModule.resolve(
        process.cwd(),
        "server/assets/fonts/Roboto-Regular.ttf"
      );
      const robotoBold = pathModule.resolve(
        process.cwd(),
        "server/assets/fonts/Roboto-Bold.ttf"
      );
      if (fsModule.existsSync(robotoReg)) doc.registerFont("Roboto", robotoReg);
      if (fsModule.existsSync(robotoBold))
        doc.registerFont("Roboto-Bold", robotoBold);

      const W = doc.page.width - 80;
      const BLUE = "#1e6fbf";
      const TEAL = "#0ea5e9";
      const GRAY = "#64748b";
      const LIGHT = "#f8fafc";
      const BORDER = "#e2e8f0";

      // Logo
      const logoBase64: string | undefined = settings.logoBase64 || undefined;
      const logoHasBackground: boolean = Boolean(settings.logoHasBackground);
      const logoBgColor: string = settings.logoBgColor || "#0f172a";
      const activeLogo = (logoBase64 && logoBase64 !== "DEFAULT_TEXT_LOGO") ? logoBase64 : "DEFAULT_TEXT_LOGO";
      const cardX = 40;
      const cardY = 20;
      const cardW = 120;
      const cardH = 36;
      const cardR = 7;

      if (logoHasBackground) {
        doc.save();
        doc.fillColor(logoBgColor);
        doc.roundedRect(cardX, cardY, cardW, cardH, cardR).fill();
        doc.restore();
      }

      const padX = logoHasBackground ? 7 : 0;
      const padY = logoHasBackground ? 4 : 0;
      const imgW = cardW - padX * 2;
      const imgH = cardH - padY * 2;

      if (activeLogo === "DEFAULT_TEXT_LOGO") {
        let foundPath = null;
        try {
          const possiblePaths = [
            pathModule.resolve(process.cwd(), "client/public/logo_spv2.png"),
            pathModule.resolve(process.cwd(), "../client/public/logo_spv2.png"),
            pathModule.resolve(process.cwd(), "dist/public/logo_spv2.png"),
            pathModule.resolve(process.cwd(), "server/assets/logo_spv2.png"),
          ];
          for (const p of possiblePaths) {
            if (fsModule.existsSync(p)) {
              foundPath = p;
              break;
            }
          }
          if (foundPath) {
            const imgBuffer = fsModule.readFileSync(foundPath);
            doc.image(imgBuffer, cardX + padX, cardY + padY, {
              fit: [imgW, imgH],
              align: "center",
              valign: "center",
            });
            doc.link(cardX, cardY, cardW, cardH, "https://facturaspv.ro/");
          } else {
            doc
              .fontSize(14)
              .font("Roboto-Bold")
              .fillColor(BLUE)
              .text(tenant?.name || "Firma", 40, 40);
          }
        } catch {
          doc
            .fontSize(14)
            .font("Roboto-Bold")
            .fillColor(BLUE)
            .text(tenant?.name || "Firma", 40, 40);
        }
      } else {
        try {
          const imgBuf = Buffer.from(
            activeLogo.replace(/^data:image\/\w+;base64,/, ""),
            "base64"
          );
          doc.image(imgBuf, cardX + padX, cardY + padY, {
            fit: [imgW, imgH],
            align: "center",
            valign: "center",
          });
        } catch {
          doc
            .fontSize(14)
            .font("Roboto-Bold")
            .fillColor(BLUE)
            .text(tenant?.name || "Firma", 40, 40);
        }
      }

      // Titlu
      doc
        .fontSize(18)
        .font("Roboto-Bold")
        .fillColor(TEAL)
        .text("DEVIZ DE LUCRĂRI", 40, 32, { width: W, align: "right" });

      doc.moveDown(0.3);
      doc
        .moveTo(40, 80)
        .lineTo(doc.page.width - 40, 80)
        .strokeColor(TEAL)
        .lineWidth(2)
        .stroke();

      // Info 2 Cards: Prestator & Beneficiar
      let y = 88;
      const boxW = (W - 12) / 2;
      const boxH = 78;

      // Prestator Card
      doc.rect(40, y, boxW, boxH).fillColor(LIGHT).fill();
      doc.rect(40, y, boxW, boxH).strokeColor(BORDER).lineWidth(0.5).stroke();

      doc.fontSize(7.5).font("Roboto-Bold").fillColor(GRAY).text("PRESTATOR / EMITENT", 48, y + 6);
      doc.fontSize(8.5).font("Roboto-Bold").fillColor("#0f172a").text(tenant?.name || "Companie Emitentă", 48, y + 17, { width: boxW - 16 });
      doc.fontSize(7).font("Roboto").fillColor(GRAY);
      doc.text(`CUI/CIF: ${tenant?.cui || "—"}${tenant?.regCom ? ` | Reg. Com: ${tenant.regCom}` : ""}`, 48, y + 29, { width: boxW - 16 });
      if (tenant?.address) {
        doc.text(`Adresă: ${tenant.address}`, 48, y + 39, { width: boxW - 16, lineBreak: false });
      }
      if (tenant?.iban) {
        doc.text(`IBAN: ${tenant.iban}${tenant.bank ? ` (${tenant.bank})` : ""}`, 48, y + 49, { width: boxW - 16, lineBreak: false });
      }
      const intocmitNume = invoice?.intocmitDe || settings.representativeName || "Administrator";
      doc.text(`Întocmit de: ${intocmitNume}`, 48, y + 59, { width: boxW - 16, lineBreak: false });

      // Beneficiar Card
      const box2X = 40 + boxW + 12;
      doc.rect(box2X, y, boxW, boxH).fillColor(LIGHT).fill();
      doc.rect(box2X, y, boxW, boxH).strokeColor(BORDER).lineWidth(0.5).stroke();

      doc.fontSize(7.5).font("Roboto-Bold").fillColor(GRAY).text("BENEFICIAR / CLIENT", box2X + 8, y + 6);
      const clientNume = invoice?.clientName || deviz.clientName || "—";
      const clientCuiVal = invoice?.clientCUI || deviz.clientCUI || "—";
      doc.fontSize(8.5).font("Roboto-Bold").fillColor("#0f172a").text(clientNume, box2X + 8, y + 17, { width: boxW - 16 });
      doc.fontSize(7).font("Roboto").fillColor(GRAY);
      doc.text(`CUI/CIF: ${clientCuiVal}${invoice?.clientRegCom ? ` | Reg. Com: ${invoice.clientRegCom}` : ""}`, box2X + 8, y + 29, { width: boxW - 16 });
      const clientAddr = [invoice?.clientAddress, invoice?.clientCity].filter(Boolean).join(", ") || "—";
      doc.text(`Adresă: ${clientAddr}`, box2X + 8, y + 39, { width: boxW - 16, lineBreak: false });
      doc.text(`Nr. Deviz: ${deviz.number}  |  Data: ${new Date(deviz.date).toLocaleDateString("ro-RO")}`, box2X + 8, y + 49, { width: boxW - 16, lineBreak: false });
      const invNumDisplay = invoice?.number || (deviz.invoiceId ? `#${deviz.invoiceId}` : "—");
      doc.text(`Factură asociată: ${invNumDisplay}`, box2X + 8, y + 59, { width: boxW - 16, lineBreak: false });

      y += boxH + 12;

      // Tabel Header & Columns
      const colNr = 26;
      const colCode = showCodes ? 60 : 0;
      const colQty = 60;
      const colPrice = 80;
      const colVal = 90;
      const colDesc = W - colNr - colCode - colQty - colPrice - colVal;

      const xNr = 40;
      const xDesc = xNr + colNr;
      const xCode = xDesc + colDesc;
      const xQty = xCode + colCode;
      const xPrice = xQty + colQty;
      const xVal = xPrice + colPrice;

      const isServicesDeviz =
        Number(deviz.totalMaterials || 0) === 0 ||
        Boolean(deviz.notes && (deviz.notes.includes("Smart QR") || deviz.notes.includes("SaaS")));

      const headerH = 18;
      const drawHeader = (curY: number) => {
        doc.rect(40, curY, W, headerH).fillColor(TEAL).fill();
        doc.fontSize(7.5).font("Roboto-Bold").fillColor("white");
        doc.text("Nr.", xNr, curY + 5, { width: colNr, align: "center" });
        doc.text(isServicesDeviz ? "Denumire" : "Denumire / Tip", xDesc + 6, curY + 5, { width: colDesc - 12 });
        if (showCodes) {
          doc.text("Cod", xCode + 4, curY + 5, { width: colCode - 8 });
        }
        doc.text("Cantitate", xQty, curY + 5, { width: colQty - 6, align: "right" });
        doc.text("Preț unitar", xPrice, curY + 5, { width: colPrice - 6, align: "right" });
        doc.text("Valoare RON", xVal, curY + 5, { width: colVal - 6, align: "right" });
      };

      drawHeader(y);
      y += headerH;

      // Linii
      lines.forEach((l, i) => {
        doc.fontSize(8).font("Roboto");
        const cleanDesc = (l.description || "").replace(/^\[MANOPERA\]\s*/i, "").trim();
        const descText = (!isServicesDeviz && l.type !== "MANOPERA") ? `[${l.type}] ${cleanDesc}` : cleanDesc;
        const descH = doc.heightOfString(descText, { width: colDesc - 12 });
        const codeH = showCodes && l.code ? doc.heightOfString(l.code, { width: colCode - 8 }) : 0;
        const textH = Math.max(descH, codeH);
        const rowH = Math.max(20, Math.ceil(textH + 10));

        if (y + rowH > doc.page.height - 110) {
          doc.addPage();
          y = 40;
          drawHeader(y);
          y += headerH;
        }

        doc
          .rect(40, y, W, rowH)
          .fillColor(i % 2 === 0 ? "white" : "#f8fafc")
          .fill();
        doc.rect(40, y, W, rowH).strokeColor(BORDER).lineWidth(0.5).stroke();

        doc.fontSize(8).font("Roboto").fillColor("#1e293b");
        const cellY = y + 5;
        doc.text(`${i + 1}`, xNr, cellY, { width: colNr, align: "center" });
        doc.text(descText, xDesc + 6, cellY, { width: colDesc - 12 });
        if (showCodes) {
          doc.text(l.code || "—", xCode + 4, cellY, { width: colCode - 8 });
        }
        doc.text(Number(l.quantity).toFixed(2), xQty, cellY, {
          width: colQty - 6,
          align: "right",
        });
        doc.text(Number(l.unitPrice).toFixed(2), xPrice, cellY, {
          width: colPrice - 6,
          align: "right",
        });
        doc.text(Number(l.total).toFixed(2), xVal, cellY, {
          width: colVal - 6,
          align: "right",
        });
        y += rowH;
      });

      // ── Totaluri cu TVA ──────────────────────────────────────────
      const totalFaraTVA = Number(deviz.total);
      const vatRate = 21;
      const totalTVA = totalFaraTVA * (vatRate / 100);
      const totalCuTVA = totalFaraTVA + totalTVA;

      if (y + 110 > doc.page.height - 40) {
        doc.addPage();
        y = 40;
      }

      y += 6;
      const totalsLabelW = W - 140;
      const totalsValX = 40 + W - 130;
      const totalsValW = 124;

      if (!isServicesDeviz) {
        // Total Materiale
        doc.rect(40, y, W, 16).fillColor(LIGHT).fill();
        doc.rect(40, y, W, 16).strokeColor(BORDER).lineWidth(0.3).stroke();
        doc.fontSize(7.5).font("Roboto-Bold").fillColor(GRAY);
        doc.text("TOTAL MATERIALE:", 45, y + 4.5, { width: totalsLabelW, align: "right" });
        doc.text(Number(deviz.totalMaterials).toFixed(2) + " RON", totalsValX, y + 4.5, {
          width: totalsValW,
          align: "right",
        });
        y += 16;

        // Total Servicii
        doc.rect(40, y, W, 16).fillColor(LIGHT).fill();
        doc.rect(40, y, W, 16).strokeColor(BORDER).lineWidth(0.3).stroke();
        doc.fontSize(7.5).font("Roboto-Bold").fillColor(GRAY);
        doc.text("TOTAL SERVICII:", 45, y + 4.5, { width: totalsLabelW, align: "right" });
        doc.text(Number(deviz.totalLabor).toFixed(2) + " RON", totalsValX, y + 4.5, {
          width: totalsValW,
          align: "right",
        });
        y += 16;
      }

      // Total fara TVA
      doc.rect(40, y, W, 16).fillColor("#e0f2fe").fill();
      doc.rect(40, y, W, 16).strokeColor(BORDER).lineWidth(0.3).stroke();
      doc.fontSize(8).font("Roboto-Bold").fillColor("#0369a1");
      doc.text("TOTAL FĂRĂ TVA:", 45, y + 4.5, { width: totalsLabelW, align: "right" });
      doc.text(totalFaraTVA.toFixed(2) + " RON", totalsValX, y + 4.5, {
        width: totalsValW,
        align: "right",
      });
      y += 16;

      // TVA 21%
      doc.rect(40, y, W, 16).fillColor("#e0f2fe").fill();
      doc.rect(40, y, W, 16).strokeColor(BORDER).lineWidth(0.3).stroke();
      doc.fontSize(8).font("Roboto-Bold").fillColor("#0369a1");
      doc.text(`TVA ${vatRate}%:`, 45, y + 4.5, { width: totalsLabelW, align: "right" });
      doc.text(totalTVA.toFixed(2) + " RON", totalsValX, y + 4.5, {
        width: totalsValW,
        align: "right",
      });
      y += 16;

      // TOTAL CU TVA
      doc.rect(40, y, W, 22).fillColor("#0284c7").fill();
      doc.fontSize(9.5).font("Roboto-Bold").fillColor("white");
      doc.text("TOTAL DE PLATĂ (incl. TVA):", 45, y + 6, {
        width: totalsLabelW,
        align: "right",
      });
      doc.text(totalCuTVA.toFixed(2) + " RON", totalsValX, y + 6, {
        width: totalsValW,
        align: "right",
      });

      // Semnături
      y += 34;
      if (y + 40 > doc.page.height - 40) {
        doc.addPage();
        y = 40;
      }
      doc.fontSize(7.5).font("Roboto-Bold").fillColor(GRAY);
      doc.text("Semnătură Prestator / Întocmit:", 45, y);
      doc.text("Semnătură Beneficiar de primire:", 40 + W - 180, y);
      doc.fontSize(7).font("Roboto").fillColor("#334155");
      doc.text(intocmitNume, 45, y + 12);
      if (invoice?.delegat) {
        doc.text(`Delegat: ${invoice.delegat}`, 40 + W - 180, y + 12);
      }

      doc.end();
    } catch (e: any) {
      console.error("[PDF Deviz Route] Error:", e.message);
      if (!res.headersSent) res.status(500).json({ error: e.message });
    }
  });

  // ─── GET /api/pdf/bon-consum/:id — PDF Bon de Consum ─────────────────────
  router.get("/bon-consum/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "ID invalid" });
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(500).json({ error: "DB unavailable" });
        return;
      }

      const { bonuriConsum, bonuriConsumLines, tenants } =
        await import("../drizzle/schema");

      const [bon] = await db
        .select()
        .from(bonuriConsum)
        .where(eq(bonuriConsum.id, id));
      if (!bon) {
        res.status(404).json({ error: "Bonul nu a fost găsit" });
        return;
      }

      const lines = await db
        .select()
        .from(bonuriConsumLines)
        .where(eq(bonuriConsumLines.bonId, id))
        .orderBy(bonuriConsumLines.lineOrder);

      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, bon.tenantId));
      let settings: any = {};
      try {
        settings = JSON.parse(tenant?.settings || "{}");
      } catch {}

      const isDownload = req.query.download === "1";
      const filename = `BonConsum-${bon.number || id}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `${isDownload ? "attachment" : "inline"}; filename="${filename}"`
      );

      const PDFDocument = (await import("pdfkit")).default;
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
        bufferPages: true,
      });
      doc.pipe(res);

      const fs = require("fs");
      const path = require("path");
      const robotoReg = path.resolve(
        process.cwd(),
        "server/assets/fonts/Roboto-Regular.ttf"
      );
      const robotoBold = path.resolve(
        process.cwd(),
        "server/assets/fonts/Roboto-Bold.ttf"
      );
      if (fs.existsSync(robotoReg)) doc.registerFont("Roboto", robotoReg);
      if (fs.existsSync(robotoBold))
        doc.registerFont("Roboto-Bold", robotoBold);

      const W = doc.page.width - 80;
      const BLUE = "#1e6fbf";
      const TEAL = "#f59e0b"; // Orange/Amber pt Bon
      const GRAY = "#64748b";
      const LIGHT = "#f8fafc";
      const BORDER = "#e2e8f0";

      // Logo
      const logoBase64: string | undefined = settings.logoBase64 || undefined;
      const logoHasBackground: boolean = Boolean(settings.logoHasBackground);
      const logoBgColor: string = settings.logoBgColor || "#0f172a";
      const activeLogo = (logoBase64 && logoBase64 !== "DEFAULT_TEXT_LOGO") ? logoBase64 : "DEFAULT_TEXT_LOGO";
      const cardX = 40;
      const cardY = 20;
      const cardW = 120;
      const cardH = 36;
      const cardR = 7;

      if (logoHasBackground) {
        doc.save();
        doc.fillColor(logoBgColor);
        doc.roundedRect(cardX, cardY, cardW, cardH, cardR).fill();
        doc.restore();
      }

      const padX = logoHasBackground ? 7 : 0;
      const padY = logoHasBackground ? 4 : 0;
      const imgW = cardW - padX * 2;
      const imgH = cardH - padY * 2;

      if (activeLogo === "DEFAULT_TEXT_LOGO") {
        let foundPath = null;
        try {
          const possiblePaths = [
            path.resolve(process.cwd(), "client/public/logo_spv2.png"),
            path.resolve(process.cwd(), "../client/public/logo_spv2.png"),
            path.resolve(process.cwd(), "dist/public/logo_spv2.png"),
            path.resolve(process.cwd(), "server/assets/logo_spv2.png"),
          ];
          for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
              foundPath = p;
              break;
            }
          }
          if (foundPath) {
            const imgBuffer = fs.readFileSync(foundPath);
            doc.image(imgBuffer, cardX + padX, cardY + padY, {
              fit: [imgW, imgH],
              align: "center",
              valign: "center",
            });
            doc.link(cardX, cardY, cardW, cardH, "https://facturaspv.ro/");
          } else {
            doc
              .fontSize(14)
              .font("Roboto-Bold")
              .fillColor(BLUE)
              .text(tenant?.name || "Firma", 40, 40);
          }
        } catch {
          doc
            .fontSize(14)
            .font("Roboto-Bold")
            .fillColor(BLUE)
            .text(tenant?.name || "Firma", 40, 40);
        }
      } else {
        try {
          const imgBuf = Buffer.from(
            activeLogo.replace(/^data:image\/\w+;base64,/, ""),
            "base64"
          );
          doc.image(imgBuf, cardX + padX, cardY + padY, {
            fit: [imgW, imgH],
            align: "center",
            valign: "center",
          });
        } catch {
          doc
            .fontSize(14)
            .font("Roboto-Bold")
            .fillColor(BLUE)
            .text(tenant?.name || "Firma", 40, 40);
        }
      }

      // Titlu
      doc
        .fontSize(18)
        .font("Roboto-Bold")
        .fillColor(TEAL)
        .text("BON DE CONSUM", 40, 32, { width: W, align: "right" });
      doc
        .fontSize(9)
        .font("Roboto")
        .fillColor(GRAY)
        .text("(Cod formular 14-3-4A)", 40, 54, { width: W, align: "right" });

      doc.moveDown(0.3);
      doc
        .moveTo(40, 90)
        .lineTo(doc.page.width - 40, 90)
        .strokeColor(TEAL)
        .lineWidth(2)
        .stroke();

      // Info
      let y = 100;
      doc.rect(40, y, W, 50).fillColor(LIGHT).fill();
      doc.rect(40, y, W, 50).strokeColor(BORDER).lineWidth(0.5).stroke();

      doc
        .fontSize(7)
        .font("Roboto-Bold")
        .fillColor(GRAY)
        .text("DATE BON DE CONSUM", 50, y + 6);
      doc
        .fontSize(7)
        .font("Roboto")
        .fillColor(GRAY)
        .text("Nr. Bon:", 50, y + 20);
      doc
        .fontSize(8)
        .font("Roboto-Bold")
        .fillColor("#1e293b")
        .text(bon.number, 50, y + 30);

      doc
        .fontSize(7)
        .font("Roboto")
        .fillColor(GRAY)
        .text("Data eliberării:", 150, y + 20);
      doc
        .fontSize(8)
        .font("Roboto-Bold")
        .fillColor("#1e293b")
        .text(new Date(bon.date).toLocaleDateString("ro-RO"), 150, y + 30);

      doc
        .fontSize(7)
        .font("Roboto")
        .fillColor(GRAY)
        .text("Gestiunea:", 250, y + 20);
      doc
        .fontSize(8)
        .font("Roboto-Bold")
        .fillColor("#1e293b")
        .text(bon.gestiune || "—", 250, y + 30);

      doc
        .fontSize(7)
        .font("Roboto")
        .fillColor(GRAY)
        .text("Deviz:", 350, y + 20);
      doc
        .fontSize(8)
        .font("Roboto-Bold")
        .fillColor("#1e293b")
        .text(bon.devizId ? `#${bon.devizId}` : "—", 350, y + 30);

      y += 65;

      // Tabel Header & Columns
      const colNr = 26;
      const colQty = 60;
      const colPrice = 80;
      const colVal = 90;
      const colDesc = W - colNr - colQty - colPrice - colVal;

      const xNr = 40;
      const xDesc = xNr + colNr;
      const xQty = xDesc + colDesc;
      const xPrice = xQty + colQty;
      const xVal = xPrice + colPrice;

      const headerH = 18;
      const drawHeader = (curY: number) => {
        doc.rect(40, curY, W, headerH).fillColor(TEAL).fill();
        doc.fontSize(7.5).font("Roboto-Bold").fillColor("white");
        doc.text("Nr.", xNr, curY + 5, { width: colNr, align: "center" });
        doc.text("Denumire material", xDesc + 6, curY + 5, { width: colDesc - 12, align: "left" });
        doc.text("Cantitate", xQty, curY + 5, { width: colQty - 6, align: "right" });
        doc.text("Preț unitar", xPrice, curY + 5, { width: colPrice - 6, align: "right" });
        doc.text("Valoare RON", xVal, curY + 5, { width: colVal - 6, align: "right" });
      };

      drawHeader(y);
      y += headerH;

      // Linii
      let totalBon = 0;
      lines.forEach((l, i) => {
        doc.fontSize(8).font("Roboto");
        const descH = doc.heightOfString(l.description, { width: colDesc - 12 });
        const rowH = Math.max(20, Math.ceil(descH + 10));

        if (y + rowH > doc.page.height - 110) {
          doc.addPage();
          y = 40;
          drawHeader(y);
          y += headerH;
        }

        doc
          .rect(40, y, W, rowH)
          .fillColor(i % 2 === 0 ? "white" : "#f8fafc")
          .fill();
        doc.rect(40, y, W, rowH).strokeColor(BORDER).lineWidth(0.5).stroke();

        doc.fontSize(8).font("Roboto").fillColor("#1e293b");
        const cellY = y + 5;
        doc.text(`${i + 1}`, xNr, cellY, { width: colNr, align: "center" });
        doc.text(l.description, xDesc + 6, cellY, { width: colDesc - 12 });
        doc.text(Number(l.quantity).toFixed(2), xQty, cellY, {
          width: colQty - 6,
          align: "right",
        });
        doc.text(Number(l.unitPrice).toFixed(2), xPrice, cellY, {
          width: colPrice - 6,
          align: "right",
        });
        doc.text(Number(l.total).toFixed(2), xVal, cellY, {
          width: colVal - 6,
          align: "right",
        });
        totalBon += Number(l.total);
        y += rowH;
      });

      // Totals
      if (y + 50 > doc.page.height - 100) {
        doc.addPage();
        y = 40;
      }
      y += 6;
      const totalsLabelW = W - 140;
      const totalsValX = 40 + W - 130;
      const totalsValW = 124;

      doc.rect(40, y, W, 22).fillColor("#d97706").fill();
      doc.fontSize(9.5).font("Roboto-Bold").fillColor("white");
      doc.text("TOTAL BON:", 45, y + 6, { width: totalsLabelW, align: "right" });
      doc.text(totalBon.toFixed(2) + " RON", totalsValX, y + 6, {
        width: totalsValW,
        align: "right",
      });
      y += 30;

      // Semnaturi
      if (y > doc.page.height - 100) {
        doc.addPage();
        y = 40;
      }
      const mW = W / 3;
      ["Eliberator (Gestiune)", "Primit", "Aprobat"].forEach((label, i) => {
        const mx = 40 + i * mW;
        doc
          .rect(mx, y, mW - 8, 55)
          .strokeColor(BORDER)
          .lineWidth(0.5)
          .stroke();
        doc
          .fontSize(7)
          .font("Roboto-Bold")
          .fillColor(GRAY)
          .text(label, mx + 6, y + 5);
        doc
          .moveTo(mx + 6, y + 46)
          .lineTo(mx + mW - 20, y + 46)
          .strokeColor("#94a3b8")
          .lineWidth(0.5)
          .stroke();
        doc
          .fontSize(6)
          .font("Roboto")
          .fillColor(GRAY)
          .text("Semnătura", mx + 6, y + 48);
      });

      doc.end();
    } catch (e: any) {
      console.error("[PDF Bon Consum Route] Error:", e.message);
      if (!res.headersSent) res.status(500).json({ error: e.message });
    }
  });

  // GET /api/pdf/contract/:id?download=1
  router.get("/contract/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "ID invalid" });
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(500).json({ error: "DB unavailable" });
        return;
      }

      const { contracts, clients, tenants } = await import("../drizzle/schema");
      const [contract] = await db
        .select({
          id: contracts.id,
          tenantId: contracts.tenantId,
          partnerId: contracts.partnerId,
          parentContractId: contracts.parentContractId,
          type: contracts.type,
          title: contracts.title,
          number: contracts.number,
          date: contracts.date,
          validFrom: contracts.validFrom,
          validUntil: contracts.validUntil,
          value: contracts.value,
          currency: contracts.currency,
          status: contracts.status,
          contentHtml: contracts.contentHtml,
          fileUrl: contracts.fileUrl,
          fileName: contracts.fileName,
          notes: contracts.notes,
          supplierSignature: contracts.supplierSignature,
          clientSignature: contracts.clientSignature,
          signatureType: contracts.signatureType,
          digitalSignatureMetadata: contracts.digitalSignatureMetadata,
          signedAt: contracts.signedAt,
          partnerName: clients.name,
          partnerCui: clients.cui,
          partnerRegCom: clients.regCom,
          partnerAddress: clients.address,
          partnerCity: clients.city,
          partnerCountry: clients.country,
          partnerPhone: clients.phone,
          partnerEmail: clients.email,
        })
        .from(contracts)
        .leftJoin(clients, eq(contracts.partnerId, clients.id))
        .where(eq(contracts.id, id));

      if (!contract) {
        res.status(404).json({ error: "Contractul nu a fost găsit" });
        return;
      }

      const isDownload = req.query.download === "1";
      const isWord = req.query.format === "word" || req.query.docx === "1";
      const safeFilename = `${contract.type.toUpperCase()}_${contract.number.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;

      // 0. Daca s-a cerut format Word (.docx)
      if (isWord) {
        const safeDocxFilename = `${contract.type.toUpperCase()}_${contract.number.replace(/[^a-zA-Z0-9_-]/g, "_")}.docx`;
        const docxPath = contract.fileUrl?.replace(/\.pdf$/i, ".docx");
        const relativeDocx = docxPath ? (docxPath.startsWith("/") ? docxPath.slice(1) : docxPath) : null;

        const docxCandidates = [
          relativeDocx ? path.resolve(process.cwd(), relativeDocx) : null,
          relativeDocx ? path.resolve(process.cwd(), "dist", "public", relativeDocx) : null,
          relativeDocx ? path.resolve(process.cwd(), "public", relativeDocx) : null,
        ].filter(Boolean) as string[];

        let foundDocx: string | null = null;
        for (const c of docxCandidates) {
          if (fs.existsSync(c)) {
            foundDocx = c;
            break;
          }
        }
        if (!foundDocx) {
          const dir = path.resolve(process.cwd(), "contracte");
          if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir);
            const match = files.find(f => f.includes(String(contract.number)) && f.endsWith(".docx"));
            if (match) foundDocx = path.join(dir, match);
          }
        }

        if (foundDocx) {
          res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${safeDocxFilename}"`
          );
          fs.createReadStream(foundDocx).pipe(res);
          return;
        }
      }

      // 1. Daca exista fisier uploadat direct, il servim
      if (contract.fileUrl) {
        const cleanFileUrl = contract.fileUrl.trim();
        const relativePath = cleanFileUrl.startsWith("/") ? cleanFileUrl.slice(1) : cleanFileUrl;
        const baseName = path.basename(cleanFileUrl);
        const baseWithSpaces = baseName.replace(/_/g, " ");
        const baseWithUnderscores = baseName.replace(/\s+/g, "_");

        const candidates = [
          path.resolve(process.cwd(), "dist", "public", relativePath),
          path.resolve(process.cwd(), "client", "public", relativePath),
          path.resolve(process.cwd(), relativePath),
          path.resolve(process.cwd(), "public", relativePath),
          path.resolve(process.cwd(), "client", "public", "uploads", "contracts", baseName),
          path.resolve(process.cwd(), "client", "public", "uploads", "contracts", baseWithUnderscores),
          path.resolve(process.cwd(), "dist", "public", "uploads", "contracts", baseName),
          path.resolve(process.cwd(), "dist", "public", "uploads", "contracts", baseWithUnderscores),
          path.resolve(process.cwd(), "contracte", baseName),
          path.resolve(process.cwd(), "contracte", baseWithSpaces),
          path.resolve(process.cwd(), "contracte", baseWithUnderscores),
        ];

        let foundPath: string | null = null;
        for (const p of candidates) {
          if (fs.existsSync(p)) {
            foundPath = p;
            break;
          }
        }

        if (foundPath) {
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader(
            "Content-Disposition",
            `${isDownload ? "attachment" : "inline"}; filename="${safeFilename}"`
          );
          fs.createReadStream(foundPath).pipe(res);
          return;
        }
      }

      // 2. Daca este contract generat din aplicatie sau nu are fisier fizic, generam PDF-ul dinamic
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, contract.tenantId));

      let tenantSettings: any = {};
      if (tenant?.settings) {
        try {
          tenantSettings = JSON.parse(tenant.settings);
        } catch {}
      }

      const PDFDocument = (await import("pdfkit")).default;
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 40, bottom: 45, left: 40, right: 40 },
        autoFirstPage: true,
        bufferPages: true,
      });

      // Register fonts with safe fallback
      const robotoReg = path.resolve(process.cwd(), "server/assets/fonts/Roboto-Regular.ttf");
      const robotoBold = path.resolve(process.cwd(), "server/assets/fonts/Roboto-Bold.ttf");
      const hasCustomFont = fs.existsSync(robotoReg) && fs.existsSync(robotoBold);
      if (hasCustomFont) {
        doc.registerFont("Roboto", robotoReg);
        doc.registerFont("Roboto-Bold", robotoBold);
      }
      const fontRegular = hasCustomFont ? "Roboto" : "Helvetica";
      const fontBold = hasCustomFont ? "Roboto-Bold" : "Helvetica-Bold";

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `${isDownload ? "attachment" : "inline"}; filename="${safeFilename}"`
      );
      doc.pipe(res);

      const PRIMARY = "#1e3a8a";
      const TEXT_MAIN = "#0f172a";
      const TEXT_MUTED = "#475569";
      const BORDER_COLOR = "#cbd5e1";
      const BG_CARD = "#f8fafc";

      // Antet Companie (Prestator)
      doc.rect(40, 40, 515, 80).fillColor(BG_CARD).fill();
      doc.rect(40, 40, 515, 80).strokeColor(BORDER_COLOR).lineWidth(0.5).stroke();

      doc.fillColor(PRIMARY).fontSize(14).font(fontBold).text(tenant?.name || "Furnizor / Prestator", 55, 52);
      doc.fillColor(TEXT_MUTED).fontSize(8).font(fontRegular);
      doc.text(`CUI: ${tenant?.cui || tenantSettings.cui || tenantSettings.fiscalCode || "-"} | Reg. Com: ${tenantSettings.regCom || "-"}`, 55, 72);
      doc.text(`Sediu: ${tenant?.address || tenantSettings.address || "-"}, ${tenantSettings.city || ""}, România`, 55, 84);
      doc.text(`IBAN: ${tenantSettings.iban || "-"} | Bancă: ${tenantSettings.bank || "-"}`, 55, 96);

      // Titlu Document
      let docTitle = "CONTRACT CADRU";
      if (contract.type === "act_aditional") docTitle = "ACT ADIȚIONAL";
      else if (contract.type === "pv_receptie") docTitle = "PROCES VERBAL DE RECEPȚIE";

      doc.fillColor(PRIMARY).fontSize(16).font(fontBold).text(`${docTitle} Nr. ${contract.number}`, 40, 140, { align: "center" });
      doc.fillColor(TEXT_MUTED).fontSize(9).font(fontRegular).text(`Data încheierii: ${contract.date}`, 40, 162, { align: "center" });

      // Casetă Partener (Beneficiar / Furnizor)
      const partY = 185;
      doc.rect(40, partY, 515, 65).fillColor(BG_CARD).fill();
      doc.rect(40, partY, 515, 65).strokeColor(BORDER_COLOR).lineWidth(0.5).stroke();

      doc.fillColor(PRIMARY).fontSize(9).font(fontBold).text("BENEFICIAR / PARTENER CONTRACTUAL", 55, partY + 10);
      doc.fillColor(TEXT_MAIN).fontSize(10).font(fontBold).text(contract.partnerName || "Nespecificat", 55, partY + 24);
      doc.fillColor(TEXT_MUTED).fontSize(8).font(fontRegular);
      doc.text(`CUI: ${contract.partnerCui || "-"} | Reg. Com: ${contract.partnerRegCom || "-"}`, 55, partY + 38);
      doc.text(`Sediu: ${contract.partnerAddress || "-"}, ${contract.partnerCity || "-"} | Telefon: ${contract.partnerPhone || "-"}`, 55, partY + 50);

      // Continut Contract / Clauze
      let curY = 270;
      doc.fillColor(PRIMARY).fontSize(11).font(fontBold).text("CLAUZE CONTRACTUALE & DISPOZIȚII", 40, curY);
      curY += 20;

      // Daca exista text HTML sau note, le curatam si afisam
      let bodyText = contract.contentHtml || contract.notes || "";
      bodyText = bodyText
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<h2[^>]*>/gi, "\n\n")
        .replace(/<h3[^>]*>/gi, "\n\n")
        .replace(/<\/h[23]>/gi, "\n")
        .replace(/<p[^>]*>/gi, "\n")
        .replace(/<\/p>/gi, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<li[^>]*>/gi, "\n• ")
        .replace(/<\/?[^>]+(>|$)/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim();

      if (!bodyText) {
        bodyText = `Prezentul document atestă relațiile comerciale agreate între părți conform Comenzilor și Devizelor tehnice semnate.\nValabilitate: ${contract.validFrom || contract.date} - ${contract.validUntil || "nedeterminată"}.\nValoare: ${contract.value || "0.00"} ${contract.currency || "RON"}.`;
      }

      doc.fillColor(TEXT_MAIN).fontSize(9).font(fontRegular).text(bodyText, 40, curY, {
        width: 515,
        lineGap: 4,
      });

      // Casete Semnaturi la final
      const endY = 690;
      doc.rect(40, endY, 245, 95).strokeColor(BORDER_COLOR).lineWidth(0.5).stroke();
      doc.rect(310, endY, 245, 95).strokeColor(BORDER_COLOR).lineWidth(0.5).stroke();

      doc.fillColor(PRIMARY).fontSize(8).font(fontBold);
      doc.text("FURNIZOR / PRESTATOR", 50, endY + 8);
      doc.text("BENEFICIAR / CLIENT", 320, endY + 8);

      doc.fillColor(TEXT_MUTED).fontSize(7).font(fontRegular);
      doc.text(tenant?.name || "Furnizor / Prestator", 50, endY + 20);
      doc.text(contract.partnerName || "Reprezentant Legal", 320, endY + 20);

      // Helper pentru decodare imagine base64 semnatură
      const parseSignatureBuffer = (val?: string | null): Buffer | null => {
        if (!val) return null;
        try {
          const match = val.match(/^data:image\/\w+;base64,(.+)$/s);
          const raw = match ? match[1] : val;
          if (raw.length > 50) return Buffer.from(raw, "base64");
          return null;
        } catch {
          return null;
        }
      };

      // Semnătură Furnizor (Olografică sau Digitală)
      const suppBuf = parseSignatureBuffer(contract.supplierSignature);
      if (suppBuf) {
        try {
          doc.image(suppBuf, 50, endY + 34, { fit: [180, 42] });
          doc.fillColor("#059669").fontSize(6).font(fontBold).text("Semnat Olografic Digital", 50, endY + 80);
        } catch {
          doc.fillColor(TEXT_MUTED).fontSize(7).font(fontRegular).text("Semnătura & Ștampila", 50, endY + 75);
        }
      } else if (contract.signatureType === "digital" && contract.digitalSignatureMetadata) {
        doc.rect(50, endY + 34, 180, 42).fillColor("#f0fdf4").fill();
        doc.rect(50, endY + 34, 180, 42).strokeColor("#86efac").lineWidth(0.5).stroke();
        doc.fillColor("#15803d").fontSize(7).font(fontBold).text("CERTIFICAT DIGITAL eIDAS", 58, endY + 40);
        doc.fillColor("#166534").fontSize(6).font(fontRegular).text(`Semnat la: ${contract.signedAt || contract.date}`, 58, endY + 52);
        doc.text("Integritate garantată SHA-256", 58, endY + 62);
      } else {
        doc.fillColor(TEXT_MUTED).fontSize(7).font(fontRegular).text("Semnătura & Ștampila", 50, endY + 75);
      }

      // Semnătură Beneficiar (Olografică sau Digitală)
      const clientBuf = parseSignatureBuffer(contract.clientSignature);
      if (clientBuf) {
        try {
          doc.image(clientBuf, 320, endY + 34, { fit: [180, 42] });
          doc.fillColor("#059669").fontSize(6).font(fontBold).text("Semnat Olografic Digital", 320, endY + 80);
        } catch {
          doc.fillColor(TEXT_MUTED).fontSize(7).font(fontRegular).text("Semnătura & Ștampila", 320, endY + 75);
        }
      } else if (contract.signatureType === "digital" && contract.digitalSignatureMetadata) {
        doc.rect(320, endY + 34, 180, 42).fillColor("#f0fdf4").fill();
        doc.rect(320, endY + 34, 180, 42).strokeColor("#86efac").lineWidth(0.5).stroke();
        doc.fillColor("#15803d").fontSize(7).font(fontBold).text("CERTIFICAT DIGITAL eIDAS", 328, endY + 40);
        doc.fillColor("#166534").fontSize(6).font(fontRegular).text(`Semnat la: ${contract.signedAt || contract.date}`, 328, endY + 52);
        doc.text("Integritate garantată SHA-256", 328, endY + 62);
      } else {
        doc.fillColor(TEXT_MUTED).fontSize(7).font(fontRegular).text("Semnătura & Ștampila", 320, endY + 75);
      }

      // Numerotare pagini in footer
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fillColor(TEXT_MUTED).fontSize(7).font(fontRegular);
        doc.text(
          `Document emis prin Smart Invoice | ${contract.number} | Pagina ${i + 1} din ${range.count}`,
          40,
          800,
          { align: "center", width: 515 }
        );
      }

      doc.end();
    } catch (e: any) {
      console.error("[PDF Contract Route] Error:", e.message);
      if (!res.headersSent) res.status(500).json({ error: e.message });
    }
  });

  app.use("/api/pdf", router);
}

