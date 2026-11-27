import { Express, Request, Response } from "express";
import multer, { FileFilterCallback } from "multer";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import AdmZip from "adm-zip";
import { sql } from "drizzle-orm";
import { resolveRequestTenant } from "./fileAuth";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
  ) => {
    const extOk = /\.(pdf|xml|png|jpg|jpeg|webp)$/i.test(file.originalname);
    if (extOk) {
      cb(null, true);
    } else {
      cb(new Error("Sunt acceptate fișiere PDF, XML sau imagini (PNG, JPG, WEBP)"));
    }
  },
});

const bankStatementUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
  ) => {
    const extOk = /\.(pdf|csv|txt|sta|mt940|940|xml|xlsx|xls|zip)$/i.test(file.originalname);
    if (extOk) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Sunt acceptate extrase în format PDF, CSV, MT940 (.sta/.mt940/.txt), XML, Excel (.xlsx/.xls) sau ZIP"
        )
      );
    }
  },
});

const contractUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
  ) => {
    const extOk = /\.(pdf|docx|doc|xml)$/i.test(file.originalname);
    if (extOk) {
      cb(null, true);
    } else {
      cb(new Error("Sunt acceptate doar fișiere PDF sau Word (.docx / .doc)"));
    }
  },
});

const spvDocUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const extOk = /\.(pdf|zip)$/i.test(file.originalname);
    if (extOk) {
      cb(null, true);
    } else {
      cb(new Error("Sunt acceptate doar fișiere PDF sau arhive ZIP originale descărcate din SPV ANAF"));
    }
  },
});

function parsePdfToUnicodeCmap(s: string): Map<number, string> {
  const cmap = new Map<number, string>();
  const charBlocks = s.match(/beginbfchar([\s\S]*?)endbfchar/g) || [];
  for (const b of charBlocks) {
    const pairs = b.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g) || [];
    for (const p of pairs) {
      const m = p.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/);
      if (m) {
        const src = parseInt(m[1], 16);
        const dstHex = m[2];
        let str = "";
        for (let i = 0; i < dstHex.length; i += 4) {
          str += String.fromCharCode(parseInt(dstHex.slice(i, i + 4), 16));
        }
        cmap.set(src, str);
      }
    }
  }
  const rangeBlocks = s.match(/beginbfrange([\s\S]*?)endbfrange/g) || [];
  for (const b of rangeBlocks) {
    const lines = b.split(/[\r\n]+/);
    for (const line of lines) {
      const arrMatch = line.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([^\]]+)\]/);
      if (arrMatch) {
        const start = parseInt(arrMatch[1], 16);
        const end = parseInt(arrMatch[2], 16);
        const hexes = (arrMatch[3].match(/<([0-9A-Fa-f]+)>/g) || []).map((h) =>
          parseInt(h.slice(1, -1), 16)
        );
        for (let code = start, idx = 0; code <= end && idx < hexes.length; code++, idx++) {
          cmap.set(code, String.fromCharCode(hexes[idx]));
        }
        continue;
      }
      const m = line.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/);
      if (m) {
        const start = parseInt(m[1], 16);
        const end = parseInt(m[2], 16);
        let dst = parseInt(m[3], 16);
        for (let code = start; code <= end; code++) {
          cmap.set(code, String.fromCharCode(dst++));
        }
      }
    }
  }
  return cmap;
}

function escapeHtmlText(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extractContractTextAndHtml(buf: Buffer, originalName: string): { text: string; html: string } {
  const ext = path.extname(originalName).toLowerCase();
  if (ext === ".docx") {
    try {
      const zip = new AdmZip(buf);
      const entry = zip.getEntry("word/document.xml");
      if (entry) {
        if (entry.header.size < 0 || entry.header.size > 50 * 1024 * 1024) {
          throw new Error("DOCX entry exceeds maximum allowed uncompressed size (50MB)");
        }
        const entryData = entry.getData();
        if (entryData.length > 50 * 1024 * 1024) {
          throw new Error("DOCX entry exceeds maximum allowed uncompressed size (50MB)");
        }
        const xml = entryData.toString("utf8");
        const paragraphs = xml.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) || [];
        const lines: string[] = [];
        const htmlParts: string[] = [];
        for (const p of paragraphs) {
          const texts = (p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [])
            .map((t) => t.replace(/<[^>]+>/g, ""))
            .join("");
          const clean = texts
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .trim();
          if (clean) {
            lines.push(clean);
            const escapedClean = escapeHtmlText(clean);
            if (/^(?:CONTRACT|PĂRȚILE|PARTILE|[A-I]\.\s+[A-ZĂÂÎȘȚ])/i.test(clean)) {
              htmlParts.push(`<h3 style="font-size:13px;font-weight:bold;margin:12px 0 6px 0;">${escapedClean}</h3>`);
            } else {
              htmlParts.push(`<p style="font-size:12px;margin:4px 0;line-height:1.5;">${escapedClean}</p>`);
            }
          }
        }
        return { text: lines.join("\n"), html: htmlParts.join("\n") };
      }
    } catch (e) {
      console.warn("[Contract Upload] DOCX parse warning:", e);
    }
  }

  if (ext === ".pdf") {
    try {
      const raw = buf.toString("latin1");
      const globalCmap = new Map<number, string>();
      const contentStreams: string[] = [];
      const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
      let sm: RegExpExecArray | null;
      while ((sm = streamRegex.exec(raw)) !== null) {
        let dec: string | null = null;
        const bytes = Buffer.from(sm[1], "latin1");
        try {
          dec = zlib
            .inflateSync(bytes, { maxOutputLength: 32 * 1024 * 1024 })
            .toString("latin1");
        } catch (inflateErr: any) {
          if (inflateErr?.code === "ERR_BUFFER_TOO_LARGE") {
            dec = null;
          } else {
            try {
              dec = zlib
                .inflateRawSync(bytes, { maxOutputLength: 32 * 1024 * 1024 })
                .toString("latin1");
            } catch (rawErr: any) {
              dec = rawErr?.code === "ERR_BUFFER_TOO_LARGE" ? null : sm[1];
            }
          }
        }
        if (dec) {
          if (dec.includes("beginbfchar") || dec.includes("beginbfrange")) {
            const cm = parsePdfToUnicodeCmap(dec);
            cm.forEach((v, k) => {
              if (!globalCmap.has(k)) globalCmap.set(k, v);
            });
          } else if (dec.includes("BT") && dec.includes("ET")) {
            contentStreams.push(dec);
          }
        }
      }

      const decodeHex = (hex: string) => {
        let out = "";
        const step = hex.length % 4 === 0 ? 4 : 2;
        for (let i = 0; i < hex.length; i += step) {
          const code = parseInt(hex.slice(i, i + step), 16);
          if (globalCmap.has(code)) out += globalCmap.get(code);
          else if (code >= 32 && code <= 126) out += String.fromCharCode(code);
        }
        return out;
      };

      let fullText = "";
      for (const s of contentStreams) {
        const cleaned = s.replace(/\/Lang\s*\([^)]*\)/g, "");
        const btBlocks = cleaned.match(/BT[\s\S]*?ET/g) || [];
        for (const block of btBlocks) {
          const tokenRegex = /\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f]+>/g;
          let tok: RegExpExecArray | null;
          let blockText = "";
          while ((tok = tokenRegex.exec(block)) !== null) {
            const t = tok[0];
            if (t.startsWith("(")) {
              blockText += t.slice(1, -1).replace(/\\([()\\])/g, "$1");
            } else if (t.startsWith("<")) {
              blockText += decodeHex(t.slice(1, -1));
            }
          }
          fullText += blockText;
        }
      }

      const normalized = fullText.replace(/\s+/g, " ").trim();
      if (normalized) {
        // Structure extracted text into readable HTML paragraphs around section headers & numbered clauses
        const structured = normalized
          .replace(/\s+(PĂRȚILE CONTRACTANTE|[A-I]\.\s+[A-ZĂÂÎȘȚ][A-ZĂÂÎȘȚ\s.]+|FURNIZOR\s+S\.C\.)/g, "\n\n$1\n")
          .replace(/\s+(\d{1,2}\.\s+[A-ZĂÂÎȘȚ])/g, "\n$1");
        const html = structured
          .split(/\n+/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const escapedLine = escapeHtmlText(line);
            return /^(?:CONTRACT|PĂRȚILE|[A-I]\.\s+)/i.test(line)
              ? `<h3 style="font-size:13px;font-weight:bold;margin:12px 0 6px 0;">${escapedLine}</h3>`
              : `<p style="font-size:12px;margin:4px 0;line-height:1.5;">${escapedLine}</p>`;
          })
          .join("\n");
        return { text: normalized, html };
      }
    } catch (e) {
      console.warn("[Contract Upload] PDF parse warning:", e);
    }
  }

  return { text: "", html: "" };
}

function parseContractMetadata(
  text: string,
  fileName: string,
  tenantCui?: string | null
) {
  // 1. Contract Number
  let detectedNumber: string | null = null;
  const textNumMatch = text.match(
    /(?:CONTRACT|ACT\s+ADI[TȚ]IONAL)[^0-9]{0,25}?(?:Nr\.?|No\.?)\s*([0-9]+(?:[\/-][0-9A-Za-z]+)?)/i
  );
  if (textNumMatch) {
    detectedNumber = textNumMatch[1].trim();
  }
  if (!detectedNumber) {
    const fnNumMatch =
      fileName.match(/(?:nr|no)[\s._-]*([0-9]+[a-zA-Z0-9\/-]*)/i) ||
      fileName.match(/(?:ctr|contract)[\s._-]*(?:nr\.?|no\.?)?[\s._-]*([0-9]+[a-zA-Z0-9\/-]*)/i);
    if (fnNumMatch) detectedNumber = fnNumMatch[1].trim();
  }

  // 2. Contract Date (YYYY-MM-DD)
  let detectedDate: string | null = null;
  const dateMatch = text.match(
    /(?:din\s+data\s+de|data\s+de|dated|data\s+încheierii)[\s:]*([0-3]?\d)\s*[.\/-]\s*([01]?\d)\s*[.\/-]\s*(20\d{2})/i
  );
  if (dateMatch) {
    detectedDate = `${dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`;
  }

  // 3. Value & Currency
  let detectedValue: string | null = null;
  let detectedCurrency: string | null = null;
  const valMatch = text.match(
    /(?:valoarea[^0-9]{0,80}?este\s+de|pre[tț]ul[^0-9]{0,80}?este\s+de|valoare\s+total[aă][^0-9]{0,30}?)\s*([0-9]{1,3}(?:[.\s][0-9]{3})*(?:,[0-9]{1,2})?|[0-9]+(?:[.,][0-9]{1,2})?)\s*(EUR|EURO|RON|LEI|USD)/i
  );
  if (valMatch) {
    const rawVal = valMatch[1].replace(/\s+/g, "");
    detectedValue = rawVal.includes(",")
      ? rawVal.replace(/\./g, "").replace(",", ".")
      : rawVal;
    const rawCur = valMatch[2].toUpperCase();
    detectedCurrency = rawCur === "EURO" ? "EUR" : rawCur === "LEI" ? "RON" : rawCur;
  }

  // 4. Partner Name
  let detectedPartnerName: string | null = null;
  const party2Match = text.match(
    /2\.\s*([A-ZĂÂÎȘȚ0-9][A-ZĂÂÎȘȚa-zăâîșț0-9\s.&+–-]{2,65}?)\s*,\s*cu\s+(?:sediul|domiciliul)/i
  );
  if (party2Match) {
    detectedPartnerName = party2Match[1].replace(/\s+/g, " ").trim();
  } else {
    const fnPartner = fileName
      .replace(/\.(pdf|docx|doc|xml)$/i, "")
      .replace(/^(?:contract|ctr)[\s._-]*(?:nr\.?|no\.?)?[\s._-]*[0-9a-zA-Z\/-]+[\s._-]*/i, "")
      .replace(/^(?:externe[\s._-]*engleza|interne)[\s._-]*/i, "")
      .replace(/[_-]+/g, " ")
      .trim();
    if (fnPartner.length >= 3) detectedPartnerName = fnPartner;
  }

  // 5. Partner CUI / VAT (excluding uploading tenant's own CUI)
  const cleanOwnCui = String(tenantCui || "")
    .replace(/\s+/g, "")
    .replace(/^RO/i, "")
    .toUpperCase();
  const isOwnTenantCui = (rawCandidate: string): boolean => {
    if (!cleanOwnCui) return false;
    const normCand = rawCandidate.replace(/\s+/g, "").replace(/^RO/i, "").toUpperCase();
    return normCand === cleanOwnCui || rawCandidate.toUpperCase().includes(cleanOwnCui);
  };

  let detectedCui: string | null = null;
  const vatRegex = /(?:VAT\s*nr\.?|CUI\/CIF|CUI|CIF)[\s:]*([A-Z]{2}\s*[0-9A-Z]{6,12}|RO\s*[0-9]{6,10}|[0-9]{6,10})/gi;
  let vm: RegExpExecArray | null;
  while ((vm = vatRegex.exec(text)) !== null) {
    const candidate = vm[1].replace(/\s+/g, "").toUpperCase();
    if (!isOwnTenantCui(candidate)) {
      detectedCui = candidate;
      break;
    }
  }
  if (!detectedCui) {
    const fnCuiMatch = fileName.match(/(?:RO|ro)\s*([0-9]{6,10})/);
    if (fnCuiMatch && !isOwnTenantCui(fnCuiMatch[1])) {
      detectedCui = `RO${fnCuiMatch[1]}`;
    }
  }

  // 6. Wood Glass specific metadata (Offer number, Offer date, Wood essence)
  let detectedOfferNumber: string | null = null;
  let detectedOfferDate: string | null = null;
  const offerMatch = text.match(
    /Ofertei\s+de\s+pre[tț]\s*(?:nr\.?)?\s*([A-Za-z0-9\s-]+?)\s*\/\s*([0-3]?\d\.[01]?\d\.20\d{2})/i
  );
  if (offerMatch) {
    detectedOfferNumber = offerMatch[1].trim();
    detectedOfferDate = offerMatch[2].trim();
  }

  let detectedWoodEssence: string | null = null;
  const essenceMatch = text.match(/esen[tț][aă]\s+([A-Za-zĂÂÎȘȚăâîșț0-9\s]+?mm)/i);
  if (essenceMatch) {
    detectedWoodEssence = essenceMatch[1].replace(/\s+/g, " ").trim();
  }

  return {
    detectedNumber,
    detectedDate,
    detectedValue,
    detectedCurrency,
    detectedPartnerName,
    detectedCui,
    detectedOfferNumber,
    detectedOfferDate,
    detectedWoodEssence,
  };
}

// SAGA XLSX import — accepts .xlsx/.xls/.csv
const sagaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 32 * 1024 * 1024 }, // 32MB for large article lists
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
  ) => {
    const extOk = /\.(xlsx|xls|csv)$/i.test(file.originalname);
    if (extOk) {
      cb(null, true);
    } else {
      cb(new Error("Doar fișiere XLSX, XLS sau CSV sunt acceptate"));
    }
  },
});

// SAGA Invoice import — accepts .xml/.xlsx/.xls/.csv
const sagaInvoiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 32 * 1024 * 1024 },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
  ) => {
    const extOk = /\.(xml|xlsx|xls|csv)$/i.test(file.originalname);
    if (extOk) {
      cb(null, true);
    } else {
      cb(new Error("Doar fișiere XML, XLSX, XLS sau CSV sunt acceptate"));
    }
  },
});

// SAGA FACTURI EXTERNE Import Route
export function attachSagaInvoicesImportRoute(app: Express) {
  app.post(
    "/api/saga/import-invoices",
    sagaInvoiceUpload.single("file"),
    async (req: Request, res: Response) => {
      try {
        const file = req.file;
        const tenantIdStr = req.body.tenantId;
        if (!file) return res.status(400).json({ error: "Niciun fișier primit." });

        const tenantId = resolveRequestTenant(req, tenantIdStr);
        const ext = path.extname(file.originalname).toLowerCase();

        const {
          parseSagaXmlInvoices,
          parseSagaXlsxInvoices,
          saveSagaInvoicesToDb,
        } = await import("./sagaInvoiceImporter");

        let parsedInvoices = [];
        if (ext === ".xml") {
          parsedInvoices = parseSagaXmlInvoices(file.buffer);
        } else if ([".xlsx", ".xls", ".csv"].includes(ext)) {
          parsedInvoices = parseSagaXlsxInvoices(file.buffer);
        } else {
          return res.status(400).json({ error: "Format neacceptat. Încărcați XML sau Excel." });
        }

        if (parsedInvoices.length === 0) {
          return res.status(400).json({ error: "Nu a fost găsită nicio factură în fișier." });
        }

        const result = await saveSagaInvoicesToDb(tenantId, parsedInvoices);
        return res.json({
          success: true,
          ...result,
          message: `${result.imported} facturi externe importate cu succes (${result.skipped} omise/deja existente).`,
        });
      } catch (err: any) {
        console.error("[SAGA Import Invoices] Error:", err);
        return res.status(500).json({ error: err.message || "Eroare la importul facturilor SAGA." });
      }
    }
  );
}

// SAGA FURNIZORI (Suppliers) XLSX Import Route
export function attachSagaFurnizoriImportRoute(app: Express) {
  app.post(
    "/api/saga/import-furnizori",
    sagaUpload.single("file"),
    async (req: Request, res: Response) => {
      try {
        const file = req.file;
        const tenantIdStr = req.body.tenantId;
        const XLSX = await import("xlsx");
        const { getDb } = await import("./db");
        const { sagaFurnizori } = await import("../modules/saga/schema");
        const db = await getDb();

        if (!file) return res.status(400).json({ error: "Missing file" });
        if (!db) return res.status(500).json({ error: "DB unavailable" });

        // Fallback for missing tenantId in test environments
        const tenantId = resolveRequestTenant(req, tenantIdStr);

        console.log(`[SAGA Import Furnizori] Processing file for tenant ${tenantId}`);

        // Read XLSX
        const workbook = XLSX.read(file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames?.[0];
        const sheet = sheetName ? workbook.Sheets?.[sheetName] : undefined;
        if (!sheetName || !sheet) {
          return res.status(400).json({ error: "Fișierul Excel nu conține nicio foaie de calcul validă." });
        }
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        let imported = 0;
        let skipped = 0;
        const batchSize = 100;

        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const values = [];

          for (const row of batch) {
            const cod = String(row.COD || row.Cod || row.cod || "").trim();
            const denumire = String(row.DENUMIRE || row.Denumire || row.denumire || "").trim();
            if (!cod || !denumire) { skipped++; continue; }

            const cui = String(row.COD_FISCAL || row.Cui || row.cui || "").trim();
            const regCom = String(row.REG_COM || row.Reg_com || "").trim();
            const adresa = String(row.ADRESA || row.Adresa || "").trim();
            const judet = String(row.JUDET || row.Judet || "").trim();
            const localitate = String(row.LOCALITATE || row.Localitate || "").trim();
            const telefon = String(row.TELEFON || row.Telefon || "").trim();
            const email = String(row.EMAIL || row.Email || "").trim();
            const banca = String(row.BANCA || row.Banca || "").trim();
            const contBanca = String(row.CONT_BANCA || row.Cont_banca || "").trim();
            const contFurnizor = String(row.CONT_ANALITIC || row.Cont || "401").trim();

            values.push({
              tenantId,
              cod: cod,
              denumire: denumire,
              cui: cui || null,
              regCom: regCom || null,
              adresa: adresa || null,
              judet: judet || null,
              localitate: localitate || null,
              telefon: telefon || null,
              email: email || null,
              banca: banca || null,
              contBanca: contBanca || null,
              contFurnizor: contFurnizor || "401",
              isActive: 1,
            });
          }

          if (values.length > 0) {
            try {
              // Bulk insert ignore
              await db.insert(sagaFurnizori)
                .values(values)
                .onDuplicateKeyUpdate({
                   set: { denumire: sql`VALUES(denumire)` }
                });
              imported += values.length;
            } catch (e: any) {
              console.warn("[SAGA Import Furnizori] Batch insert error, skipping batch:", e.message);
              skipped += values.length;
            }
          }
        }

        console.log(`[SAGA Import Furnizori] Done: ${imported} imported, ${skipped} skipped, total rows: ${rows.length}`);
        return res.json({ success: true, imported, skipped, total: rows.length });
      } catch (err: any) {
        console.error("[SAGA Import Furnizori] Error:", err);
        return res.status(500).json({ error: err.message });
      }
    }
  );
}

// SAGA CLIENȚI (Clients) XLSX Import Route
export function attachSagaClientiImportRoute(app: Express) {
  app.post(
    "/api/saga/import-clienti",
    sagaUpload.single("file"),
    async (req: Request, res: Response) => {
      try {
        const file = req.file;
        const tenantIdStr = req.body.tenantId;
        const XLSX = await import("xlsx");
        const { getDb } = await import("./db");
        const { clients } = await import("../drizzle/schema");
        const { eq, and, sql } = await import("drizzle-orm");
        const db = await getDb();

        if (!file) return res.status(400).json({ error: "Missing file" });
        if (!db) return res.status(500).json({ error: "DB unavailable" });

        const tenantId = resolveRequestTenant(req, tenantIdStr);
        console.log(`[SAGA Import Clienti] Processing file for tenant ${tenantId}`);

        const workbook = XLSX.read(file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames?.[0];
        const sheet = sheetName ? workbook.Sheets?.[sheetName] : undefined;
        if (!sheetName || !sheet) {
          return res.status(400).json({ error: "Fișierul Excel nu conține nicio foaie de calcul validă." });
        }
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        let imported = 0;
        let updated = 0;
        let skipped = 0;

        for (const row of rows) {
          const cod = String(row.COD || row.Cod || row.cod || "").trim();
          const denumire = String(row.DENUMIRE || row.Denumire || row.denumire || "").trim();
          if (!cod || !denumire) { skipped++; continue; }

          const cui = String(row.COD_FISCAL || row.Cui || row.cui || "").trim();
          const regCom = String(row.REG_COM || row.Reg_com || "").trim();
          const adresa = String(row.ADRESA || row.Adresa || "").trim();
          const judet = String(row.JUDET || row.Judet || "").trim();
          const localitate = String(row.LOCALITATE || row.Localitate || "").trim();
          const telefon = String(row.TELEFON || row.Telefon || "").trim();
          const email = String(row.EMAIL || row.Email || "").trim();

          // Căutăm dacă clientul există deja după CUI sau nume
          const [existing] = await db
            .select()
            .from(clients)
            .where(
              and(
                eq(clients.tenantId, tenantId),
                cui
                  ? sql`REPLACE(${clients.cui}, "RO", "") = ${cui.replace(/^RO/i, "")}`
                  : eq(clients.name, denumire)
              )
            )
            .limit(1);

          if (existing) {
            await db
              .update(clients)
              .set({
                sagaCode: cod,
                regCom: regCom || existing.regCom,
                address: adresa || existing.address,
                city: localitate || existing.city,
                phone: telefon || existing.phone,
                email: email || existing.email,
              })
              .where(eq(clients.id, existing.id));
            updated++;
          } else {
            await db.insert(clients).values({
              tenantId,
              name: denumire,
              cui: cui || null,
              sagaCode: cod,
              regCom: regCom || null,
              address: adresa || null,
              city: localitate || null,
              country: "RO",
              phone: telefon || null,
              email: email || null,
              currency: "RON",
              isSupplier: 0,
              isActive: 1,
            });
            imported++;
          }
        }

        console.log(`[SAGA Import Clienti] Done: ${imported} imported, ${updated} updated, ${skipped} skipped`);
        return res.json({ success: true, imported, updated, skipped, total: rows.length });
      } catch (err: any) {
        console.error("[SAGA Import Clienti] Error:", err);
        return res.status(500).json({ error: err.message });
      }
    }
  );
}

const MONTH_NAME_MAP: Record<string, string> = {
  jan: "01", january: "01", ian: "01", ianuarie: "01",
  feb: "02", february: "02", februarie: "02",
  mar: "03", march: "03", martie: "03",
  apr: "04", april: "04", aprilie: "04",
  may: "05", mai: "05",
  jun: "06", june: "06", iun: "06", iunie: "06",
  jul: "07", july: "07", iul: "07", iulie: "07",
  aug: "08", august: "08",
  sep: "09", sept: "09", september: "09", septembrie: "09",
  oct: "10", october: "10", octombrie: "10",
  nov: "11", november: "11", noi: "11", noiembrie: "11",
  dec: "12", december: "12", decembrie: "12",
};

export function parseFlexibleDateToIso(raw?: string | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const iso = s.match(/\b(20\d{2})[-./](0[1-9]|1[0-2])[-./](0[1-9]|[12]\d|3[01])\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = s.match(/\b(0?[1-9]|[12]\d|3[01])[./-](0?[1-9]|1[0-2])[./-](20\d{2})\b/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;

  const engMdy = s.match(/\b([A-Za-zĂÂÎȘȚăâîșț]{3,12})\.?\s+(0?[1-9]|[12]\d|3[01]),?\s+(20\d{2})\b/);
  if (engMdy) {
    const mm = MONTH_NAME_MAP[engMdy[1].toLowerCase()];
    if (mm) return `${engMdy[3]}-${mm}-${engMdy[2].padStart(2, "0")}`;
  }

  const engDmy = s.match(/\b(0?[1-9]|[12]\d|3[01])\s+([A-Za-zĂÂÎȘȚăâîșț]{3,12})\.?,?\s+(20\d{2})\b/);
  if (engDmy) {
    const mm = MONTH_NAME_MAP[engDmy[2].toLowerCase()];
    if (mm) return `${engDmy[3]}-${mm}-${engDmy[1].padStart(2, "0")}`;
  }

  return null;
}

export function parseFlexibleAmount(raw?: string | null): string | null {
  if (!raw) return null;
  let s = String(raw).trim().replace(/\s+/g, "");
  if (!s) return null;
  const isNeg = s.startsWith("-") || (s.startsWith("(") && s.endsWith(")"));
  s = s.replace(/^[-(]+|[)]+$/g, "");
  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // European: 1.234,56
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // US/UK: 1,234.56
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(",")) {
    const parts = s.split(",");
    if (parts[parts.length - 1].length === 2) {
      s = parts.slice(0, -1).join("") + "." + parts[parts.length - 1];
    } else {
      s = s.replace(/,/g, "");
    }
  }
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return (isNeg ? -Math.abs(n) : n).toFixed(2);
}

const KNOWN_GLOBAL_VENDORS: Array<{ pattern: RegExp; name: string; cui?: string }> = [
  { pattern: /\bGoogle\s+Ireland\s+Limited\b/i, name: "Google Ireland Limited", cui: "IE6388047V" },
  { pattern: /\bGoogle\s+Cloud\s+EMEA\s+Limited\b/i, name: "Google Cloud EMEA Limited", cui: "IE3668997OH" },
  { pattern: /\bMeta\s+Platforms\s+Ireland\s+Limited\b/i, name: "Meta Platforms Ireland Limited", cui: "IE9692928F" },
  { pattern: /\bFacebook\s+Ireland\s+Limited\b/i, name: "Meta Platforms Ireland Limited", cui: "IE9692928F" },
  { pattern: /\bOpenAI\s+Ireland\s+L(?:imited|td)\b/i, name: "OpenAI Ireland Ltd", cui: "IE4193588BH" },
  { pattern: /\bOpenAI,?\s*L\.?L\.?C\.?\b/i, name: "OpenAI, L.L.C." },
  { pattern: /\bAnthropic\s+Ireland\b/i, name: "Anthropic Ireland, Ltd." },
  { pattern: /\bAnthropic,?\s*PBC\b/i, name: "Anthropic, PBC" },
  { pattern: /\bHetzner\s+Online\s+GmbH\b/i, name: "Hetzner Online GmbH", cui: "DE812871812" },
  { pattern: /\bAmazon\s+Web\s+Services\s+EMEA\s+SARL\b/i, name: "Amazon Web Services EMEA SARL", cui: "LU26888617" },
  { pattern: /\bAmazon\s+EU\s+S\.?[aà]\.?r\.?l\.?\b/i, name: "Amazon EU S.à r.l.", cui: "LU20260743" },
  { pattern: /\bCloudflare,?\s*Inc\.?\b/i, name: "Cloudflare, Inc." },
  { pattern: /\bDigitalOcean,?\s*LLC\b/i, name: "DigitalOcean, LLC" },
  { pattern: /\bMicrosoft\s+Ireland\s+Operations\s+Limited\b/i, name: "Microsoft Ireland Operations Limited", cui: "IE8256796U" },
  { pattern: /\bApple\s+Distribution\s+International\b/i, name: "Apple Distribution International Ltd.", cui: "IE9700053D" },
  { pattern: /\bAdobe\s+Systems\s+Software\s+Ireland\b/i, name: "Adobe Systems Software Ireland Ltd.", cui: "IE6364992H" },
  { pattern: /\bStripe\s+Payments\s+Europe\b/i, name: "Stripe Payments Europe, Limited", cui: "IE3206488LH" },
  { pattern: /\bGitHub,?\s*Inc\.?\b/i, name: "GitHub, Inc." },
  { pattern: /\bVercel\s+Inc\.?\b/i, name: "Vercel Inc." },
  { pattern: /\bAtlassian\s+Pty\s+Ltd\b/i, name: "Atlassian Pty Ltd" },
  { pattern: /\bZoom\s+Video\s+Communications\b/i, name: "Zoom Video Communications, Inc." },
  { pattern: /\bBolt\s+Operations\s+O[ÜU]\b/i, name: "Bolt Operations OÜ", cui: "EE102090374" },
  { pattern: /\bBooking\.com\s+B\.?V\.?\b/i, name: "Booking.com B.V.", cui: "NL805734958B01" },
  { pattern: /\bAirbnb\s+Ireland\s+UC\b/i, name: "Airbnb Ireland UC", cui: "IE9827384L" },
];

export async function extractExternalInvoiceMetadata(
  buf: Buffer,
  originalName: string,
  tenantCui?: string | null,
  tenantName?: string | null
): Promise<{
  invoiceNumber: string | null;
  supplierName: string | null;
  supplierCUI: string | null;
  issueDate: string | null;
  dueDate: string | null;
  total: string | null;
  totalVAT: string | null;
  currency: string;
  direction: "in" | "out";
  rawXml: string | null;
}> {
  const ext = path.extname(originalName).toLowerCase();
  const cleanTenantCui = String(tenantCui || "")
    .toUpperCase()
    .replace(/^RO/, "")
    .replace(/[^A-Z0-9]/g, "");
  const cleanTenantName = String(tenantName || "")
    .toLowerCase()
    .replace(/s\.?r\.?l\.?|s\.?a\.?/g, "")
    .trim();

  if (ext === ".xml") {
    try {
      const xmlStr = buf.toString("utf8");
      const { XMLParser } = await import("fast-xml-parser");
      const parser = new XMLParser({
        numberParseOptions: { leadingZeros: false, hex: false, eNotation: false },
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
      });
      const parsed = parser.parse(xmlStr);
      const inv =
        parsed.Invoice ||
        parsed.CreditNote ||
        parsed["ubl:Invoice"] ||
        parsed["ubl:CreditNote"] ||
        parsed.Factura;
      if (inv) {
        const getTxt = (v: any): string => {
          if (v === null || v === undefined) return "";
          if (typeof v === "object") return String(v["#text"] ?? "");
          return String(v);
        };
        const first = (v: any) => (Array.isArray(v) ? v[0] : v);
        const isCredit = !!(
          parsed.CreditNote ||
          parsed["ubl:CreditNote"] ||
          getTxt(inv["cbc:InvoiceTypeCode"] || inv["InvoiceTypeCode"]).trim() === "381"
        );
        const supParty =
          first(inv["cac:AccountingSupplierParty"])?.["cac:Party"] ||
          first(inv["AccountingSupplierParty"])?.["Party"];
        const custParty =
          first(inv["cac:AccountingCustomerParty"])?.["cac:Party"] ||
          first(inv["AccountingCustomerParty"])?.["Party"];

        const extractParty = (party: any) => {
          const legal = first(party?.["cac:PartyLegalEntity"] || party?.["PartyLegalEntity"]);
          const tax = first(party?.["cac:PartyTaxScheme"] || party?.["PartyTaxScheme"]);
          const pName = first(party?.["cac:PartyName"] || party?.["PartyName"]);
          const name =
            getTxt(legal?.["cbc:RegistrationName"] || legal?.["RegistrationName"]) ||
            getTxt(pName?.["cbc:Name"] || pName?.["Name"]);
          const cui =
            getTxt(tax?.["cbc:CompanyID"] || tax?.["CompanyID"]) ||
            getTxt(legal?.["cbc:CompanyID"] || legal?.["CompanyID"]);
          return { name: name.trim(), cui: cui.trim() };
        };

        const sup = extractParty(supParty);
        const cust = extractParty(custParty);
        const normSupCui = sup.cui.toUpperCase().replace(/^RO/, "").replace(/[^A-Z0-9]/g, "");
        const direction: "in" | "out" =
          cleanTenantCui && normSupCui && normSupCui === cleanTenantCui ? "out" : "in";
        const partner = direction === "out" ? cust : sup;

        const monetary =
          first(inv["cac:LegalMonetaryTotal"] || inv["LegalMonetaryTotal"]) || {};
        const totalRaw =
          getTxt(monetary["cbc:TaxInclusiveAmount"] || monetary["TaxInclusiveAmount"]) ||
          getTxt(monetary["cbc:PayableAmount"] || monetary["PayableAmount"]) ||
          "0";
        const taxTotal = first(inv["cac:TaxTotal"] || inv["TaxTotal"]);
        const vatRaw = getTxt(taxTotal?.["cbc:TaxAmount"] || taxTotal?.["TaxAmount"]) || "0";
        let totalNum = parseFloat(totalRaw) || 0;
        let vatNum = parseFloat(vatRaw) || 0;
        if (isCredit && totalNum > 0) {
          totalNum = -totalNum;
          vatNum = -Math.abs(vatNum);
        }
        const currency = (
          getTxt(inv["cbc:DocumentCurrencyCode"] || inv["DocumentCurrencyCode"]) || "RON"
        )
          .trim()
          .toUpperCase()
          .slice(0, 3);

        return {
          invoiceNumber: getTxt(inv["cbc:ID"] || inv["ID"]).trim() || null,
          supplierName: partner.name || null,
          supplierCUI: partner.cui || null,
          issueDate: parseFlexibleDateToIso(getTxt(inv["cbc:IssueDate"] || inv["IssueDate"])),
          dueDate: parseFlexibleDateToIso(getTxt(inv["cbc:DueDate"] || inv["DueDate"])),
          total: totalNum.toFixed(2),
          totalVAT: vatNum.toFixed(2),
          currency: currency || "RON",
          direction,
          rawXml: xmlStr,
        };
      }
    } catch (e) {
      console.warn("[External Invoice Upload] XML parse warning:", e);
    }
  }

  let text = "";
  if (ext === ".pdf") {
    text = extractContractTextAndHtml(buf, originalName).text;
    if (!text || text.length < 20) {
      // Fallback printable ASCII strings for PDFs with uncompressed text runs
      const rawPrintable = buf
        .toString("latin1")
        .replace(/[^\x20-\x7E\r\n]/g, " ")
        .replace(/\s+/g, " ");
      text = rawPrintable.slice(0, 40000);
    }
  }

  const combinedSource = `${text}\n${originalName}`;

  // 1. Currency
  let currency = "EUR";
  if (/\bRON\b|\bLEI\b/i.test(text)) currency = "RON";
  else if (/\bEUR\b|€/.test(text)) currency = "EUR";
  else if (/\bUSD\b|\bUS\$|\$(?=\s*\d)/.test(text)) currency = "USD";
  else if (/\bGBP\b|£/.test(text)) currency = "GBP";
  else if (/\bCHF\b/i.test(text)) currency = "CHF";
  else if (/\bRON\b/i.test(originalName)) currency = "RON";
  else if (/\bUSD\b/i.test(originalName)) currency = "USD";
  else if (!text) currency = "EUR";

  // 2. Supplier & CUI / EU VAT ID
  let supplierName: string | null = null;
  let supplierCUI: string | null = null;
  for (const v of KNOWN_GLOBAL_VENDORS) {
    if (v.pattern.test(combinedSource)) {
      supplierName = v.name;
      if (v.cui) supplierCUI = v.cui;
      break;
    }
  }

  if (!supplierCUI && text) {
    const vatMatches =
      text.match(
        /\b(?:IE[0-9A-Z]{7,9}|DE\d{9}|LU\d{8}|NL[0-9A-Z]{12}|FR[0-9A-Z]{11}|BE0?\d{9,10}|AT\s*U\d{8}|ES[0-9A-Z]{9}|IT\d{11}|PL\d{10}|CZ\d{8,10}|BG\d{9,10}|CY[0-9A-Z]{9}|EE\d{9}|HU\d{8}|RO\s*\d{2,10})\b/g
      ) || [];
    for (const candidate of vatMatches) {
      const cleaned = candidate.replace(/\s+/g, "").toUpperCase();
      const bare = cleaned.replace(/^RO/, "");
      if (cleanTenantCui && bare === cleanTenantCui) continue;
      supplierCUI = cleaned;
      break;
    }
  }

  if (!supplierName && text) {
    const supLabelMatch = text.match(
      /(?:Furnizor|Supplier|Issued\s+by|Seller|Vendor|From)\s*[:\-]\s*([A-Z0-9][A-Za-z0-9\s.,&()\-]{2,70}?)(?=\s+(?:CIF|CUI|VAT|Tax|Reg|Address|Adresa|Client|Customer|Bill\s+to|Invoice|\d{2}[./-]\d{2}))/i
    );
    if (supLabelMatch) {
      const cand = supLabelMatch[1].trim();
      if (!cleanTenantName || !cand.toLowerCase().includes(cleanTenantName)) {
        supplierName = cand;
      }
    }
  }

  if (!supplierName && text) {
    const companyMatches =
      text.match(
        /\b([A-Z][A-Za-z0-9&.,\- ]{2,55}\s+(?:Limited|Ltd\.?|GmbH|S\.?A\.?R\.?L\.?|B\.?V\.?|Inc\.?|L\.?L\.?C\.?|PBC|O[ÜU]|S\.?R\.?L\.?|S\.?A\.?))\b/g
      ) || [];
    for (const cand of companyMatches) {
      const trimmed = cand.trim();
      if (cleanTenantName && trimmed.toLowerCase().includes(cleanTenantName)) continue;
      supplierName = trimmed;
      break;
    }
  }

  // 3. Invoice number
  let invoiceNumber: string | null = null;
  if (text) {
    const invMatch = text.match(
      /(?:Invoice\s*(?:number|no\.?|#)|Factur[aă]\s*(?:seria\s*[A-Z0-9]+\s*)?(?:nr\.?|num[aă]r)?|Receipt\s*(?:number|no\.?|#)|Document\s*(?:no\.?|number))\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-\/_]{2,32})/i
    );
    if (invMatch && /\d/.test(invMatch[1])) {
      invoiceNumber = invMatch[1].trim();
    }
  }
  if (!invoiceNumber) {
    const baseName = path.basename(originalName, ext).replace(/^t\d+-\d+-/, "");
    const fnMatch = baseName.match(/\b([A-Z]{1,6}[-_]?\d{3,16}|\d{5,16})\b/i);
    if (fnMatch) invoiceNumber = fnMatch[1];
  }

  // 4. Issue Date & Due Date
  let issueDate: string | null = null;
  let dueDate: string | null = null;
  if (text) {
    const issueLabelMatch = text.match(
      /(?:Invoice\s+date|Date\s+of\s+issue|Issue\s+date|Data\s+emiterii|Data\s+facturii|Date)\s*[:\-]?\s*([A-Za-z0-9,./\-\s]{6,22})/i
    );
    if (issueLabelMatch) issueDate = parseFlexibleDateToIso(issueLabelMatch[1]);

    const dueLabelMatch = text.match(
      /(?:Due\s+date|Payment\s+due|Data\s+scaden[tț]ei|Scaden[tț][aă]|Termen\s+plat[aă])\s*[:\-]?\s*([A-Za-z0-9,./\-\s]{6,22})/i
    );
    if (dueLabelMatch) dueDate = parseFlexibleDateToIso(dueLabelMatch[1]);

    if (!issueDate) {
      issueDate = parseFlexibleDateToIso(text);
    }
  }
  if (!issueDate) {
    issueDate = parseFlexibleDateToIso(originalName);
  }

  // 5. Total & VAT
  let total: string | null = null;
  let totalVAT: string | null = null;
  if (text) {
    const totalMatch = text.match(
      /(?:Total\s*(?:de\s*plat[aă]|cu\s*TVA|general|amount|due|payable|in\s+[A-Z]{3})?|Amount\s*(?:due|paid|charged)|Grand\s*total|Balance\s*due)\s*[:\-]?\s*(?:EUR|USD|RON|LEI|GBP|CHF|€|\$|£)?\s*(-?[0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2}|-?[0-9]+[.,][0-9]{2})/i
    );
    if (totalMatch) {
      total = parseFlexibleAmount(totalMatch[1]);
    }
    const vatMatch = text.match(
      /(?:Total\s*TVA|Valoare\s*TVA|TVA|VAT(?:\s*amount)?|Tax(?:\s*amount)?)\s*(?:\(\d+(?:[.,]\d+)?%\))?\s*[:\-]?\s*(?:EUR|USD|RON|LEI|GBP|CHF|€|\$|£)?\s*(-?[0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2}|-?[0-9]+[.,][0-9]{2})/i
    );
    if (vatMatch) {
      totalVAT = parseFlexibleAmount(vatMatch[1]);
    }
  }

  return {
    invoiceNumber,
    supplierName,
    supplierCUI,
    issueDate,
    dueDate,
    total,
    totalVAT: totalVAT ?? (total ? "0.00" : null),
    currency,
    direction: "in",
    rawXml: null,
  };
}

export function extractBankStatementMetadata(buf: Buffer, originalName: string) {
  const ext = path.extname(originalName).toLowerCase();
  let iban: string | null = null;
  let bankName: string | null = null;
  let currency: string | null = null;
  let statementNumber: string | null = null;
  let statementMonth: string | null = null;
  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  let openingBalance: string | null = null;
  let closingBalance: string | null = null;
  let transactionsCount: number | null = null;

  let text = "";
  if (ext === ".pdf") {
    text = extractContractTextAndHtml(buf, originalName).text;
    if (!text || text.length < 15) {
      text = buf
        .toString("latin1")
        .replace(/[^\x20-\x7E\r\n]/g, " ")
        .replace(/\s+/g, " ")
        .slice(0, 50000);
    }
  } else if ([".csv", ".txt", ".sta", ".mt940", ".940", ".xml"].includes(ext)) {
    text = buf.toString("utf8").slice(0, 200000);
  }

  // MT940 tags (:25:, :28C:, :60F:, :62F:, :61:)
  if (text.includes(":20:") && (text.includes(":60F:") || text.includes(":60M:"))) {
    const m25 = text.match(/:25:([A-Z0-9/\-]+)/);
    if (m25) {
      const cand = m25[1].replace(/[^A-Z0-9]/gi, "").toUpperCase();
      if (cand.length >= 14) iban = cand;
    }
    const m28 = text.match(/:28C?:([^\r\n]+)/);
    if (m28) statementNumber = m28[1].trim();

    const m60 = text.match(/:60[FM]:([CD])(\d{2})(\d{2})(\d{2})([A-Z]{3})([0-9,]+)/);
    if (m60) {
      const sign = m60[1] === "D" ? -1 : 1;
      periodStart = `20${m60[2]}-${m60[3]}-${m60[4]}`;
      statementMonth = `20${m60[2]}-${m60[3]}`;
      currency = m60[5];
      const val = parseFloat(m60[6].replace(",", "."));
      if (!isNaN(val)) openingBalance = (sign * val).toFixed(2);
    }
    const m62 = text.match(/:62[FM]:([CD])(\d{2})(\d{2})(\d{2})([A-Z]{3})([0-9,]+)/);
    if (m62) {
      const sign = m62[1] === "D" ? -1 : 1;
      periodEnd = `20${m62[2]}-${m62[3]}-${m62[4]}`;
      if (!statementMonth) statementMonth = `20${m62[2]}-${m62[3]}`;
      if (!currency) currency = m62[5];
      const val = parseFloat(m62[6].replace(",", "."));
      if (!isNaN(val)) closingBalance = (sign * val).toFixed(2);
    }
    const txMatches = text.match(/:61:/g);
    if (txMatches) transactionsCount = txMatches.length;
  }

  // CAMT.053 XML
  if (ext === ".xml" && text.includes("<BkToCstmrStmt")) {
    const ibanXml = text.match(/<IBAN>\s*([A-Z0-9]+)\s*<\/IBAN>/i);
    if (ibanXml) iban = ibanXml[1].trim().toUpperCase();
    const ccyXml = text.match(/<Ccy>\s*([A-Z]{3})\s*<\/Ccy>/i);
    if (ccyXml) currency = ccyXml[1].trim().toUpperCase();
    const frXml = text.match(/<FrDtTm>\s*(\d{4}-\d{2}-\d{2})/i);
    if (frXml) {
      periodStart = frXml[1];
      statementMonth = frXml[1].slice(0, 7);
    }
    const toXml = text.match(/<ToDtTm>\s*(\d{4}-\d{2}-\d{2})/i);
    if (toXml) {
      periodEnd = toXml[1];
      if (!statementMonth) statementMonth = toXml[1].slice(0, 7);
    }
    const ntryMatches = text.match(/<Ntry>/g);
    if (ntryMatches) transactionsCount = ntryMatches.length;
  }

  const combined = `${text}\n${originalName}`;

  // IBAN from PDF / CSV / filename
  if (!iban) {
    const compactText = combined.replace(/([A-Z]{2}\d{2})\s+([A-Z0-9]{4})\s+([A-Z0-9]{4})\s+([A-Z0-9]{4})\s+([A-Z0-9]{4})\s+([A-Z0-9]{4})/g, "$1$2$3$4$5$6");
    const roIban = compactText.match(/\bRO\d{2}[A-Z]{4}[A-Z0-9]{16}\b/);
    if (roIban) {
      iban = roIban[0];
    } else {
      const euIban = compactText.match(/\b(?:LT\d{18}|IE\d{2}[A-Z]{4}\d{14}|DE\d{20}|BE\d{14}|NL\d{2}[A-Z]{4}\d{10}|GB\d{2}[A-Z]{4}\d{14})\b/);
      if (euIban) iban = euIban[0];
    }
  }

  // Bank name via BIC or keywords
  const bicMap: Record<string, string> = {
    BTRL: "Banca Transilvania",
    INGB: "ING Bank",
    RZBR: "Raiffeisen Bank",
    RNCB: "BCR (Banca Comercială Română)",
    BRDE: "BRD - Groupe Société Générale",
    BACX: "UniCredit Bank",
    CECE: "CEC Bank",
    REVO: "Revolut Bank",
    OTPV: "OTP Bank",
    UGBI: "Garanti BBVA",
    PIRB: "First Bank",
    LIBR: "Libra Internet Bank",
    TREZ: "Trezoreria Statului",
    BUCU: "Alpha Bank",
    EGNA: "Vista Bank",
    BREL: "Salt Bank",
  };
  if (iban) {
    const bic = iban.match(/^RO\d{2}([A-Z]{4})/)?.[1];
    if (bic && bicMap[bic]) bankName = bicMap[bic];
    else if (/^LT\d{2}32500|^IE\d{2}REVO/.test(iban)) bankName = "Revolut Bank";
  }
  if (!bankName) {
    if (/Banca\s+Transilvania|\bBT\s*24|\bNeoBT/i.test(combined)) bankName = "Banca Transilvania";
    else if (/UniCredit/i.test(combined)) bankName = "UniCredit Bank";
    else if (/\bING\s+Bank/i.test(combined)) bankName = "ING Bank";
    else if (/Raiffeisen/i.test(combined)) bankName = "Raiffeisen Bank";
    else if (/Banca\s+Comercial[aă]\s+Rom[aâ]n[aă]|\bBCR\b/i.test(combined)) bankName = "BCR (Banca Comercială Română)";
    else if (/\bBRD\b/i.test(combined)) bankName = "BRD - Groupe Société Générale";
    else if (/\bCEC\s+Bank/i.test(combined)) bankName = "CEC Bank";
    else if (/Revolut/i.test(combined)) bankName = "Revolut Bank";
    else if (/Libra\s+Internet/i.test(combined)) bankName = "Libra Internet Bank";
    else if (/Garanti/i.test(combined)) bankName = "Garanti BBVA";
    else if (/Salt\s+Bank/i.test(combined)) bankName = "Salt Bank";
    else if (/Wise\s+Europe|\bTransferWise/i.test(combined)) bankName = "Wise";
    else if (/PayPal/i.test(combined)) bankName = "PayPal";
    else if (/Stripe/i.test(combined)) bankName = "Stripe";
  }

  // Currency
  if (!currency) {
    if (iban && /EUR/i.test(iban)) currency = "EUR";
    else if (iban && /USD/i.test(iban)) currency = "USD";
    else if (/\b(?:Moned[aă]|Valut[aă]|Currency)\s*[:\-]?\s*(RON|EUR|USD|GBP|CHF)\b/i.test(combined)) {
      currency = combined.match(/\b(?:Moned[aă]|Valut[aă]|Currency)\s*[:\-]?\s*(RON|EUR|USD|GBP|CHF)\b/i)![1].toUpperCase();
    } else if (/\bEUR\b/.test(originalName)) currency = "EUR";
    else if (/\bUSD\b/.test(originalName)) currency = "USD";
    else if (/\bRON\b|\bLEI\b/i.test(combined)) currency = "RON";
    else if (/\bEUR\b/.test(combined)) currency = "EUR";
    else currency = "RON";
  }

  // Period start / end & month
  if (!periodStart || !periodEnd) {
    const rangeDmy = combined.match(
      /(\d{2}[./-]\d{2}[./-]20\d{2})\s*(?:[-–—]|p[aâ]n[aă]\s*la|to)\s*(\d{2}[./-]\d{2}[./-]20\d{2})/i
    );
    if (rangeDmy) {
      periodStart = parseFlexibleDateToIso(rangeDmy[1]);
      periodEnd = parseFlexibleDateToIso(rangeDmy[2]);
    } else {
      const rangeIso = combined.match(/(20\d{2}-\d{2}-\d{2})\s*(?:[-–—]|to)\s*(20\d{2}-\d{2}-\d{2})/i);
      if (rangeIso) {
        periodStart = rangeIso[1];
        periodEnd = rangeIso[2];
      }
    }
  }

  if (!statementMonth) {
    if (periodEnd) statementMonth = periodEnd.slice(0, 7);
    else if (periodStart) statementMonth = periodStart.slice(0, 7);
    else {
      const ymMatch = combined.match(/\b(20\d{2})[-_.](0[1-9]|1[0-2])\b/);
      if (ymMatch) {
        statementMonth = `${ymMatch[1]}-${ymMatch[2]}`;
      } else {
        const myMatch = combined.match(/\b(0[1-9]|1[0-2])[-_.](20\d{2})\b/);
        if (myMatch) statementMonth = `${myMatch[2]}-${myMatch[1]}`;
      }
    }
  }
  if (!statementMonth) {
    const now = new Date();
    statementMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  // Statement number
  if (!statementNumber && text) {
    const nrMatch = text.match(/(?:Extras(?:\s+de\s+cont)?\s*nr\.?|Statement\s*(?:no\.?|#))\s*[:\-]?\s*([A-Z0-9\/\-]{1,25})/i);
    if (nrMatch && /\d/.test(nrMatch[1])) statementNumber = nrMatch[1].trim();
  }

  // Opening / Closing balances from PDF/CSV text
  if (!openingBalance && text) {
    const obMatch = text.match(
      /(?:Sold\s+ini[tț]ial|Sold\s+precedent|Opening\s+balance)\s*[:\-]?\s*(-?[0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2}|-?[0-9]+[.,][0-9]{2})/i
    );
    if (obMatch) openingBalance = parseFlexibleAmount(obMatch[1]);
  }
  if (!closingBalance && text) {
    const cbMatch = text.match(
      /(?:Sold\s+final|Sold\s+curent|Closing\s+balance|Ending\s+balance)\s*[:\-]?\s*(-?[0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2}|-?[0-9]+[.,][0-9]{2})/i
    );
    if (cbMatch) closingBalance = parseFlexibleAmount(cbMatch[1]);
  }

  return {
    iban,
    bankName,
    currency: currency || "RON",
    statementNumber,
    statementMonth,
    periodStart,
    periodEnd,
    openingBalance,
    closingBalance,
    transactionsCount,
  };
}

export function registerUploadRoute(app: Express) {
  app.post(
    "/api/upload-invoice",
    (req: Request, res: Response, next) => {
      upload.array("file", 30)(req, res, (err: any) => {
        if (err) {
          res.status(400).json({ error: err.message || "Format de fișier neacceptat" });
          return;
        }
        next();
      });
    },
    async (req: Request, res: Response) => {
      try {
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
          res.status(400).json({ error: "Niciun fișier primit" });
          return;
        }

        const tenantId = resolveRequestTenant(req);
        let tenantCui: string | null = null;
        let tenantName: string | null = null;
        try {
          const { getDb } = await import("./db");
          const db = await getDb();
          if (db && tenantId) {
            const { tenants } = await import("../drizzle/schema");
            const { eq } = await import("drizzle-orm");
            const [t] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
            if (t) {
              tenantCui = t.cui;
              tenantName = t.name;
            }
          }
        } catch {}

        const uploadDirs = [
          path.join(process.cwd(), "dist", "public", "uploads", "invoices"),
          path.join(process.cwd(), "client", "public", "uploads", "invoices"),
        ];
        for (const d of uploadDirs) {
          await fs.promises.mkdir(d, { recursive: true }).catch(() => {});
        }

        const results = [];
        for (const file of files) {
          const ext = file.originalname.split(".").pop()?.toLowerCase() || "pdf";
          const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
          const key = `t${tenantId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${safeOriginal}`;

          for (const d of uploadDirs) {
            await fs.promises.writeFile(path.join(d, key), file.buffer);
          }

          const extracted = await extractExternalInvoiceMetadata(
            file.buffer,
            file.originalname,
            tenantCui,
            tenantName
          );
          const fileType: "pdf" | "xml" | "other" =
            ext === "xml" ? "xml" : ext === "pdf" ? "pdf" : "other";

          const fileUrl = `/uploads/invoices/${key}`;
          results.push({
            fileKey: key,
            fileUrl,
            fileName: file.originalname,
            fileSize: file.size,
            fileType,
            extracted,
          });
        }

        if (results.length === 1 && req.query.batch !== "1") {
          res.json(results[0]);
          return;
        }
        res.json(results);
      } catch (err: any) {
        console.error("Upload error:", err);
        res.status(500).json({ error: err.message || "Eroare la upload" });
      }
    }
  );

  // ── BANK STATEMENTS UPLOAD (/api/upload-bank-statement) ──────────────────
  app.post(
    "/api/upload-bank-statement",
    (req: Request, res: Response, next) => {
      bankStatementUpload.array("files", 30)(req, res, (err: any) => {
        if (err) {
          res.status(400).json({ error: err.message || "Format de fișier neacceptat" });
          return;
        }
        next();
      });
    },
    async (req: Request, res: Response) => {
      try {
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
          res.status(400).json({ error: "Niciun fișier primit" });
          return;
        }

        const tenantId = resolveRequestTenant(req);
        const uploadDirs = [
          path.join(process.cwd(), "dist", "public", "uploads", "bank_statements"),
          path.join(process.cwd(), "client", "public", "uploads", "bank_statements"),
        ];
        for (const d of uploadDirs) {
          await fs.promises.mkdir(d, { recursive: true }).catch(() => {});
        }

        const uploaded = [];
        for (const file of files) {
          const ext = file.originalname.split(".").pop()?.toLowerCase() || "pdf";
          const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
          const key = `t${tenantId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${safeOriginal}`;

          for (const d of uploadDirs) {
            await fs.promises.writeFile(path.join(d, key), file.buffer);
          }

          const extracted = extractBankStatementMetadata(file.buffer, file.originalname);
          uploaded.push({
            fileKey: key,
            fileUrl: `/uploads/bank_statements/${key}`,
            fileName: file.originalname,
            fileSize: file.size,
            fileType: ext,
            extracted,
          });
        }

        res.json({ files: uploaded });
      } catch (err: any) {
        console.error("[Bank Statement Upload] Error:", err);
        res.status(500).json({ error: err.message || "Eroare la încărcarea extrasului de cont" });
      }
    }
  );

  // ── CONTRACTS & DOCUMENTS BULK UPLOAD ────────────────────────────────────
  app.post(
    "/api/upload-contract",
    (req: Request, res: Response, next) => {
      contractUpload.array("files", 100)(req, res, (err: any) => {
        if (err) {
          res.status(400).json({ error: err.message || "Format de fișier neacceptat" });
          return;
        }
        next();
      });
    },
    async (req: Request, res: Response) => {
      try {
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
          res.status(400).json({ error: "Niciun fișier selectat" });
          return;
        }

        const uploadDirDist = path.join(process.cwd(), "dist", "public", "uploads", "contracts");
        const uploadDirClient = path.join(process.cwd(), "client", "public", "uploads", "contracts");
        await fs.promises.mkdir(uploadDirDist, { recursive: true }).catch(() => {});
        await fs.promises.mkdir(uploadDirClient, { recursive: true }).catch(() => {});

        const tenantId = resolveRequestTenant(req);
        let tenantCui = "";
        try {
          const { getDb } = await import("./db");
          const { tenants } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const db = await getDb();
          if (db) {
            const [tRow] = await db
              .select({ cui: tenants.cui, settings: tenants.settings })
              .from(tenants)
              .where(eq(tenants.id, tenantId))
              .limit(1);
            let settingsCui = "";
            if (tRow?.settings) {
              try {
                const parsedS = JSON.parse(tRow.settings);
                if (parsedS && typeof parsedS === "object" && !Array.isArray(parsedS)) {
                  settingsCui = String(parsedS.companyCui || parsedS.cui || "");
                }
              } catch {}
            }
            tenantCui = String(tRow?.cui || settingsCui || "").trim();
          }
        } catch {}

        const results = [];
        for (const file of files) {
          const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
          const key = `t${tenantId}-${Date.now()}-${Math.floor(Math.random() * 1000)}-${safeName}`;
          const filePathDist = path.join(uploadDirDist, key);
          const filePathClient = path.join(uploadDirClient, key);
          await fs.promises.writeFile(filePathDist, file.buffer);
          await fs.promises.writeFile(filePathClient, file.buffer).catch(() => {});

          const fileUrl = `/uploads/contracts/${key}`;

          const { text, html } = extractContractTextAndHtml(file.buffer, file.originalname);
          const meta = parseContractMetadata(text, file.originalname, tenantCui);

          results.push({
            fileKey: key,
            fileUrl,
            fileName: file.originalname,
            fileSize: file.size,
            detectedCui: meta.detectedCui,
            detectedNumber: meta.detectedNumber,
            detectedDate: meta.detectedDate,
            detectedValue: meta.detectedValue,
            detectedCurrency: meta.detectedCurrency,
            detectedPartnerName: meta.detectedPartnerName,
            detectedOfferNumber: meta.detectedOfferNumber,
            detectedOfferDate: meta.detectedOfferDate,
            detectedWoodEssence: meta.detectedWoodEssence,
            extractedHtml: html || null,
          });
        }

        res.json({ success: true, count: results.length, files: results });
      } catch (err: any) {
        console.error("Contract upload error:", err);
        res.status(500).json({ error: err.message || "Eroare la încărcare documente" });
      }
    }
  );

  // ── SAGA XLSX Import ─────────────────────────────────────────────────────
  app.post(
    "/api/saga/import-articles",
    sagaUpload.single("file"),
    async (req: Request, res: Response) => {
      try {
        const file = req.file;
        if (!file) {
          res.status(400).json({ error: "Niciun fișier primit" });
          return;
        }

        // tenantId from query or body
        const tenantId = resolveRequestTenant(req, req.body.tenantId || req.query.tenantId);
        if (!tenantId) {
          res.status(400).json({ error: "tenantId lipsă" });
          return;
        }

        // Parse XLSX
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames?.[0];
        const sheet = sheetName ? workbook.Sheets?.[sheetName] : undefined;
        if (!sheetName || !sheet) {
          return res.status(400).json({ error: "Fișierul Excel nu conține nicio foaie de calcul validă." });
        }
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        if (!rows.length) {
          res.status(400).json({ error: "Fișierul este gol" });
          return;
        }

        // Map SAGA Desktop columns to our schema
        // SAGA columns: COD, DENUMIRE, UM, TVA, DEN_TIP, STOC, GRUPA, TIP, COD_BARE
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) {
          res.status(500).json({ error: "DB unavailable" });
          return;
        }

        // Map DEN_TIP/TIP to accounting account
        const tipToAccount: Record<string, string> = {
          "02": "301",   // Materii prime
          "03": "3028",  // Materiale auxiliare
          "04": "345",   // Produse finite
          "05": "341",   // Semifabricate
          "06": "303",   // Obiecte de inventar
          "07": "371",   // Mărfuri
          "08": "381",   // Ambalaje
          "15": "302",   // Piese de schimb
          "16": "3028",  // Alte mat. consumabile
        };

        const { sagaArticles } = await import("../modules/saga/schema");
        const { eq, and } = await import("drizzle-orm");

        let imported = 0;
        let skipped = 0;
        const batchSize = 100;

        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const values = [];

          for (const row of batch) {
            const cod = String(row.COD || row.Cod || row.cod || "").trim();
            const denumire = String(row.DENUMIRE || row.Denumire || row.denumire || "").trim();
            if (!cod || !denumire) { skipped++; continue; }

            const um = String(row.UM || row.Um || row.um || "buc").trim();
            const tva = String(row.TVA || row.Tva || row.tva || "21").trim();
            const denTip = String(row.DEN_TIP || row.Den_tip || "Marfuri").trim();
            const tipCod = String(row.TIP || row.Tip || row.tip || "07").trim().padStart(2, "0");
            const codBare = String(row.COD_BARE || row.Cod_bare || "").trim();

            const account = tipToAccount[tipCod] || "371";

            values.push({
              tenantId,
              code: cod,
              name: denumire,
              unit: um || "buc",
              vatRate: tva,
              category: denTip || "Marfuri",
              accountingAccount: account,
              sagaCode: cod,
              barcode: codBare || null,
              isActive: 1,
            });
          }

          if (values.length > 0) {
            try {
              await db.insert(sagaArticles)
                .values(values)
                .onDuplicateKeyUpdate({
                   set: {
                     name: sql`VALUES(name)`,
                     unit: sql`VALUES(unit)`,
                     vatRate: sql`VALUES(vatRate)`,
                     category: sql`VALUES(category)`,
                     accountingAccount: sql`VALUES(accountingAccount)`,
                     barcode: sql`VALUES(barcode)`,
                     isActive: sql`VALUES(isActive)`,
                   }
                });
              imported += values.length;
            } catch (e: any) {
              console.warn("[SAGA Import] Batch insert error, skipping batch:", e.message);
              skipped += values.length;
            }
          }
        }

        console.log(`[SAGA Import] Done: ${imported} imported, ${skipped} skipped, total rows: ${rows.length}`);
        res.json({ ok: true, imported, skipped, total: rows.length });
      } catch (err: any) {
        console.error("[SAGA Import] Error:", err);
        res.status(500).json({ error: err.message || "Eroare la import" });
      }
    }
  );

  // ── SPV PORTAL DOCUMENTS UPLOAD (RECIPISĂ DECLARAȚIE, NOTIFICARE, DECIZIE) ───
  app.post(
    "/api/upload-spv-document",
    (req: Request, res: Response, next) => {
      spvDocUpload.array("files", 20)(req, res, (err: any) => {
        if (err) return res.status(400).json({ error: err.message || "Format neacceptat" });
        next();
      });
    },
    async (req: Request, res: Response) => {
      try {
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
          return res.status(400).json({ error: "Niciun fișier selectat" });
        }

        const tenantId = await resolveRequestTenant(req);
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) return res.status(500).json({ error: "Baza de date indisponibilă" });

        const [tenantRows]: any = await (db as any).execute(
          sql`SELECT cui, name, settings FROM tenants WHERE id = ${tenantId}`
        );
        let settingsCui = "";
        try {
          const parsedS = JSON.parse(tenantRows?.[0]?.settings || "{}");
          settingsCui = String(parsedS.companyCui || parsedS.cui || "");
        } catch {}
        const cleanCui = String(tenantRows?.[0]?.cui || settingsCui || "")
          .replace(/^RO/i, "")
          .trim();
        if (!cleanCui) {
          return res.status(400).json({
            error: "Profilul activ nu are CUI / CNP configurat în Setări.",
          });
        }

        const uploadDirDist = path.join(process.cwd(), "dist", "public", "uploads", "spv_documents");
        const uploadDirClient = path.join(process.cwd(), "client", "public", "uploads", "spv_documents");
        await fs.promises.mkdir(uploadDirDist, { recursive: true }).catch(() => {});
        await fs.promises.mkdir(uploadDirClient, { recursive: true }).catch(() => {});

        const results = [];
        let totalSavedCount = 0;
        for (const file of files) {
          let fileBuf = file.buffer;
          let actualOriginalName = file.originalname;
          if (path.extname(file.originalname).toLowerCase() === ".zip") {
            const zip = new AdmZip(file.buffer);
            const pdfEntry = zip
              .getEntries()
              .find((e) => !e.isDirectory && e.entryName.toLowerCase().endsWith(".pdf"));
            if (!pdfEntry) {
              return res.status(400).json({
                error: `Arhiva ${file.originalname} nu conține niciun fișier PDF original semnat din SPV ANAF.`,
              });
            }
            if (pdfEntry.header.size < 0 || pdfEntry.header.size > 50 * 1024 * 1024) {
              return res.status(400).json({
                error: `Fișierul din arhiva ${file.originalname} depășește limita maximă admisă (50MB).`,
              });
            }
            fileBuf = pdfEntry.getData();
            if (fileBuf.length > 50 * 1024 * 1024) {
              return res.status(400).json({
                error: `Fișierul din arhiva ${file.originalname} depășește limita maximă admisă (50MB).`,
              });
            }
            actualOriginalName =
              path.basename(pdfEntry.entryName) ||
              `${path.basename(file.originalname, ".zip")}.pdf`;
          }

          if (
            actualOriginalName.toLowerCase().endsWith(".pdf") &&
            (fileBuf.length < 5 || fileBuf.subarray(0, 5).toString("ascii") !== "%PDF-")
          ) {
            return res.status(400).json({
              error: `Fișierul ${actualOriginalName} nu este un document PDF valid (semnătura magică %PDF- lipsește).`,
            });
          }

          const lowerName = actualOriginalName.toLowerCase();
          const safeName = actualOriginalName.replace(/[^a-zA-Z0-9._-]/g, "_");
          const key = `t${tenantId}-${Date.now()}-${Math.floor(Math.random() * 1000)}-${safeName}`;
          const filePathDist = path.join(uploadDirDist, key);
          const filePathClient = path.join(uploadDirClient, key);
          await fs.promises.writeFile(filePathDist, fileBuf);
          await fs.promises.writeFile(filePathClient, fileBuf).catch(() => {});

          const fileUrl = `/uploads/spv_documents/${key}`;

          // Detectare si normalizare tip document SPV la valorile oficiale
          let tip = "RECIPISA";
          let titlu = `Document Oficial SPV — ${actualOriginalName}`;
          let categorie = "declaratie_fiscala";
          let formCode = "";

          if (/\bD?256\b/i.test(lowerName) || lowerName.includes("deciz")) {
            tip = "DECIZIE";
            categorie = "decizie_impunere";
            titlu = /\bD?256\b/i.test(lowerName)
              ? "Decizie de Impunere din Oficiu D256 — Persoane Fizice"
              : `Decizie de Impunere ANAF — ${actualOriginalName}`;
          } else if (/\bD?101\b/i.test(lowerName)) {
            formCode = "D101";
            titlu = "Recipisă Declarația 101 (Impozit pe Profit)";
          } else if (/\bD?112\b/i.test(lowerName)) {
            formCode = "D112";
            titlu = "Recipisă Declarația 112 (Salarii & Contribuții Sociale)";
          } else if (/\bD?300\b/i.test(lowerName)) {
            formCode = "D300";
            titlu = "Recipisă Declarația 300 (Decont Taxă pe Valoarea Adăugată)";
          } else if (/\bD?394\b/i.test(lowerName)) {
            formCode = "D394";
            titlu = "Recipisă Declarația 394 (Livrări & Achiziții Teritoriul Național)";
          } else if (/\bD?100\b/i.test(lowerName)) {
            formCode = "D100";
            titlu = "Recipisă Declarația 100 (Obligații de Plată la Bugetul de Stat)";
          } else if (/\bD?390\b/i.test(lowerName)) {
            formCode = "D390";
            titlu = "Recipisă Declarația 390 (Declarație Recapitulativă Intracomunitară)";
          } else if (/\bD?212\b/i.test(lowerName) || lowerName.includes("unica")) {
            formCode = "D212";
            titlu = "Recipisă Declarația Unică 212 — Persoane Fizice";
          } else if (lowerName.includes("adeverint")) {
            tip = "RASPUNS SOLICITARE";
            categorie = "raspuns_solicitare";
            titlu = "Adeverință de Venit ANAF";
          } else if (/\bD?205\b/i.test(lowerName)) {
            formCode = "D205";
            titlu = "Recipisă Declarația 205 (Impozit Reținut la Sursă & Dividende)";
          } else if (/\bD?700\b/i.test(lowerName)) {
            formCode = "D700";
            titlu = "Recipisă Declarația 700 (Mențiuni Electronice)";
          } else if (lowerName.includes("bilant")) {
            formCode = "BILANT";
            titlu = "Recipisă Situații Financiare Anuale (Bilanț Contabil)";
          } else if (lowerName.includes("certificat") || lowerName.includes("atestare")) {
            tip = "CERTIFICAT FISCAL";
            categorie = "certificat_fiscal";
            titlu = "Certificat de Atestare Fiscală";
          } else if (lowerName.includes("vector") || lowerName.includes("fisa") || lowerName.includes("situatie")) {
            tip = "RASPUNS SOLICITARE";
            categorie = "raspuns_solicitare";
            titlu = `Răspuns Solicitare SPV — ${actualOriginalName}`;
          } else if (lowerName.includes("notif") || lowerName.includes("somat")) {
            tip = "NOTIFICARE";
            categorie = "notificare_anaf";
            titlu = `Notificare Oficială ANAF — ${actualOriginalName}`;
          }

          const regNumMatch = actualOriginalName.match(/(\d{7,10})/);
          const numarInregistrare = regNumMatch ? regNumMatch[1] : `${Date.now().toString().slice(-8)}`;

          if (regNumMatch) {
            const [existingSpvDoc]: any = await (db as any).execute(
              sql`SELECT id, fileUrl FROM spv_portal_documents WHERE tenantId = ${tenantId} AND numarInregistrare = ${numarInregistrare} LIMIT 1`
            );
            if (existingSpvDoc?.[0]?.id) {
              results.push({
                fileName: actualOriginalName,
                tip,
                titlu,
                numarInregistrare,
                fileUrl: existingSpvDoc[0].fileUrl || fileUrl,
                skippedDuplicate: true,
              });
              continue;
            }
          }

          const pad2 = (n: number) => String(n).padStart(2, "0");
          const formatSpvDate = (d: Date) =>
            `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

          const now = new Date();
          const dataDepunere = formatSpvDate(now);
          const archiveDate = new Date(now);
          archiveDate.setDate(archiveDate.getDate() + 60);
          const dataArhivare = formatSpvDate(archiveDate);

          const detalii = formCode
            ? `recipisa pentru CIF ${cleanCui}, tip ${formCode}, numar_inregistrare ${numarInregistrare}, incarcat din ${actualOriginalName}`
            : `Document oficial ${actualOriginalName} pentru CIF ${cleanCui} (${titlu})`;

          await (db as any).execute(
            sql`INSERT INTO spv_portal_documents 
                (tenantId, cif, tip, categorie, titlu, numarInregistrare, dataDepunere, dataArhivare, perioadaFiscala, stare, isRead, detalii, fileUrl, fileName, sursa)
                VALUES 
                (${tenantId}, ${cleanCui}, ${tip}, ${categorie}, ${titlu}, ${numarInregistrare}, ${dataDepunere}, ${dataArhivare}, 'Curent', 'validat', 0, ${detalii}, ${fileUrl}, ${actualOriginalName}, 'incarcat_manual')`
          );

          totalSavedCount++;
          results.push({ fileName: actualOriginalName, tip, titlu, numarInregistrare, fileUrl });
        }

        res.json({ ok: true, count: totalSavedCount, documents: results });
      } catch (err: any) {
        console.error("[Upload SPV Document] Error:", err.message);
        res.status(500).json({ error: err.message || "Eroare la încărcare document SPV" });
      }
    }
  );

  // ── IMPORT REAL SPV DOCUMENT FROM CHROME CONNECTOR (mTLS webserviced.anaf.ro) ──
  app.post("/api/spv/import-real-document", async (req: Request, res: Response) => {
    try {
      const tenantId = await resolveRequestTenant(req);
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return res.status(500).json({ error: "Baza de date indisponibilă." });

      const { getTenantCleanCui, saveRealSpvDocument } = await import("./spvPortalSync");
      const cleanCui = await getTenantCleanCui(db, tenantId);
      if (!cleanCui) {
        return res.status(400).json({ error: "CUI-ul / CNP-ul profilului activ nu este configurat." });
      }

      const result = await saveRealSpvDocument(db, tenantId, cleanCui, req.body || {});
      if (!result.ok) {
        return res.status(result.statusCode).json({ error: result.error });
      }
      res.json(result);
    } catch (err: any) {
      console.error("[SPV Import Real Document] Error:", err?.message);
      res.status(500).json({ error: err?.message || "Eroare la salvarea documentului ANAF." });
    }
  });

  // ── BULK DOWNLOAD REAL SPV DOCUMENTS (PDF / ZIP) ────────────────────────────
  app.post("/api/spv/bulk-download-pdf", async (req: Request, res: Response) => {
    try {
      const tenantId = await resolveRequestTenant(req);
      const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const docIds = Array.from(
        new Set(
          rawIds
            .map((v: any) => Number(v))
            .filter((n: number) => Number.isInteger(n) && n > 0)
        )
      ).slice(0, 500);

      if (docIds.length === 0) {
        return res.status(400).json({ error: "Selectează cel puțin un document SPV." });
      }

      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return res.status(500).json({ error: "Baza de date indisponibilă." });

      const [rows]: any = await (db as any).execute(
        sql`SELECT * FROM spv_portal_documents
            WHERE tenantId = ${tenantId}
              AND id IN (${sql.join(docIds.map((id) => sql`${id}`), sql`, `)})
            ORDER BY id DESC`
      );

      const docs: any[] = rows || [];
      if (docs.length === 0) {
        return res.status(404).json({ error: "Documentele selectate nu au fost găsite." });
      }

      const allowedSpvDirs = [
        path.resolve(process.cwd(), "dist", "public", "uploads", "spv_documents"),
        path.resolve(process.cwd(), "client", "public", "uploads", "spv_documents"),
        path.resolve(process.cwd(), "public", "uploads", "spv_documents"),
        path.resolve(process.cwd(), "uploads", "spv_documents"),
      ];

      const isWithinAllowed = (targetPath: string) => {
        const resolved = path.resolve(targetPath);
        return allowedSpvDirs.some(
          (base) => resolved === base || resolved.startsWith(base + path.sep)
        );
      };

      const resolvedFiles: Array<{ diskPath: string; entryName: string; isZip: boolean }> = [];
      const usedNames = new Set<string>();

      for (const doc of docs) {
        const rawFileUrl = String(doc.fileUrl || "").trim();
        if (!rawFileUrl || rawFileUrl.includes("..") || rawFileUrl.includes("\0")) continue;
        const relativePath = rawFileUrl.replace(/^\//, "");
        const candidates = [
          path.resolve(process.cwd(), "dist", "public", relativePath),
          path.resolve(process.cwd(), "client", "public", relativePath),
          path.resolve(process.cwd(), relativePath),
          path.resolve(process.cwd(), "public", relativePath),
        ];

        let foundPath: string | null = null;
        for (const p of candidates) {
          if (isWithinAllowed(p) && fs.existsSync(p)) {
            foundPath = p;
            break;
          }
        }
        if (!foundPath) continue;

        const isZip = foundPath.toLowerCase().endsWith(".zip");
        const ext = isZip ? ".zip" : ".pdf";
        const baseRaw = String(
          doc.fileName ||
            `${doc.tip || "Document"}_${doc.numarInregistrare || doc.id}${ext}`
        ).replace(/[^a-zA-Z0-9._-]/g, "_");
        const withExt =
          baseRaw.toLowerCase().endsWith(".pdf") || baseRaw.toLowerCase().endsWith(".zip")
            ? baseRaw
            : `${baseRaw}${ext}`;

        let finalName = withExt;
        let suffix = 2;
        while (usedNames.has(finalName.toLowerCase())) {
          const dotIdx = withExt.lastIndexOf(".");
          finalName =
            dotIdx > 0
              ? `${withExt.slice(0, dotIdx)}_${suffix}${withExt.slice(dotIdx)}`
              : `${withExt}_${suffix}`;
          suffix++;
        }
        usedNames.add(finalName.toLowerCase());
        resolvedFiles.push({ diskPath: foundPath, entryName: finalName, isZip });
      }

      if (resolvedFiles.length === 0) {
        return res.status(404).json({ error: "Fișierele originale SPV nu există pe disc." });
      }

      // Dacă este selectat un singur PDF, îl livrăm direct ca PDF
      if (resolvedFiles.length === 1 && !resolvedFiles[0].isZip) {
        const single = resolvedFiles[0];
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${single.entryName}"`
        );
        return res.sendFile(single.diskPath);
      }

      const zip = new AdmZip();
      for (const item of resolvedFiles) {
        zip.addLocalFile(item.diskPath, "", item.entryName);
      }
      const zipBuf = zip.toBuffer();
      const cuiLabel = String(docs[0]?.cif || "SPV").replace(/[^a-zA-Z0-9]/g, "");
      const dateLabel = new Date().toISOString().slice(0, 10);
      const archiveName = `Documente_SPV_${cuiLabel}_${dateLabel}.zip`;

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${archiveName}"`);
      res.send(zipBuf);
    } catch (err: any) {
      console.error("[SPV Bulk Download] Error:", err?.message);
      res.status(500).json({ error: err?.message || "Eroare la descărcarea documentelor SPV." });
    }
  });

  // ── DOWNLOAD CHROME EXTENSION CONECTOR SPV AS ZIP ────────────────────────────
  app.get("/api/spv-connector.zip", async (_req: Request, res: Response) => {
    try {
      const extDir = path.resolve(process.cwd(), "chrome-spv-connector");
      const files = [
        "manifest.json",
        "background.js",
        "app-bridge.js",
        "auth.html",
        "anaf-popup.css",
        "anaf-popup.js",
        "anaf-logo.png",
      ];
      for (const f of files) {
        if (!fs.existsSync(path.join(extDir, f))) {
          return res.status(404).json({ error: `Lipsește fișierul ${f} din conector.` });
        }
      }

      const zip = new AdmZip();
      for (const f of files) {
        zip.addLocalFile(path.join(extDir, f));
      }
      const zipBuf = zip.toBuffer();

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", 'attachment; filename="Conector_SPV_ANAF.zip"');
      res.send(zipBuf);
    } catch (err: any) {
      console.error("[SPV Connector Zip] Error:", err?.message);
      res.status(500).json({ error: err?.message || "Eroare la generarea arhivei conectorului." });
    }
  });

  // ── LOG DIAGNOSTIC REZULTAT CONECTOR USB ─────────────────────────────────────
  app.post("/api/spv/connector-log", async (req: Request, res: Response) => {
    try {
      const tenantId = await resolveRequestTenant(req);
      const {
        ok,
        matchedTotal,
        downloaded,
        alreadySaved,
        failed,
        error,
        emptyNotice,
        diagnostics,
        extVersion,
      } = req.body || {};

      const zileUsed = Number(diagnostics?.zileUsed || 60);
      const rawTotal = Number(diagnostics?.rawTotal || 0);
      const allowed = Array.isArray(diagnostics?.allowedCifs)
        ? diagnostics.allowedCifs.join(",")
        : "-";
      const verLabel = extVersion ? String(extVersion) : "-";
      const incognitoFlag = Boolean(diagnostics?.incognitoPopup);

      console.log(
        `[SPV USB Connector] tenant=${tenantId} ver=${verLabel} incognito=${incognitoFlag} ok=${Boolean(ok)} raw=${rawTotal} matched=${Number(matchedTotal || 0)} downloaded=${Number(downloaded || 0)} alreadySaved=${Number(alreadySaved || 0)} failed=${Number(failed || 0)} zile=${zileUsed} allowed=${allowed}${emptyNotice ? ` notice=${String(emptyNotice).slice(0, 120)}` : ""}${error ? ` err=${String(error).slice(0, 180)}` : ""}`
      );
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Log failed" });
    }
  });
}

