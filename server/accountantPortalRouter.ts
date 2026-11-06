import { z } from "zod";
import * as crypto from "crypto";
import { publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { eq, and, desc, inArray } from "drizzle-orm";
import * as schema from "../drizzle/schema";

const HMAC_SECRET = process.env.JWT_SECRET || "smart_invoice_accountant_portal_secret_2026";
const PIN_SALT = "_accountant_portal_salt_smart_invoice";
const ACCESS_PIN_SALT = "_pin_salt_smart_invoice";

/**
 * Emite un session token semnat HMAC valabil 7 zile
 */
function createAccountantSessionToken(tenantId: number): string {
  const expiresAt = Date.now() + 7 * 24 * 3600 * 1000;
  const payload = `${tenantId}:${expiresAt}`;
  const signature = crypto.createHmac("sha256", HMAC_SECRET).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

/**
 * Validează un session token semnat HMAC și verifică apartenența la tenantId
 */
export function verifyAccountantSessionToken(tenantId: number, tokenStr: string): boolean {
  try {
    const [payload, signature] = tokenStr.split(".");
    if (!payload || !signature) return false;

    const expectedSig = crypto.createHmac("sha256", HMAC_SECRET).update(payload).digest("hex");
    if (signature !== expectedSig) return false;

    const [tIdStr, expStr] = payload.split(":");
    const tokenTenantId = parseInt(tIdStr, 10);
    const expiresAt = parseInt(expStr, 10);

    if (tokenTenantId !== tenantId) return false;
    if (Date.now() > expiresAt) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Validează un session token contabil și extrage tenantId-ul garantat
 */
export function verifyAndExtractAccountantSession(tokenStr: string): { tenantId: number } | null {
  try {
    if (!tokenStr) return null;
    const [payload, signature] = tokenStr.split(".");
    if (!payload || !signature) return null;

    const expectedSig = crypto.createHmac("sha256", HMAC_SECRET).update(payload).digest("hex");
    if (signature !== expectedSig) return null;

    const [tIdStr, expStr] = payload.split(":");
    const tokenTenantId = parseInt(tIdStr, 10);
    const expiresAt = parseInt(expStr, 10);

    if (isNaN(tokenTenantId) || tokenTenantId <= 0) return null;
    if (Date.now() > expiresAt) return null;

    return { tenantId: tokenTenantId };
  } catch {
    return null;
  }
}

/**
 * Găsește un tenant după token-ul sau slug-ul portalului
 */
async function findTenantByPortalToken(token: string) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Baza de date indisponibilă" });

  const allTenants = await db.select().from(schema.tenants);
  const cleanToken = token.trim().toLowerCase();

  for (const t of allTenants) {
    let s: any = {};
    try {
      s = JSON.parse(t.settings || "{}");
    } catch {}

    const portal = s.accountantPortal || {};
    const portalToken = (portal.token || "").trim().toLowerCase();
    const portalSlug = (portal.customSlug || "").trim().toLowerCase();

    // Verificăm potrivirea pe token dedicat, slug sau fallback pe CUI / ID
    if (portalToken && portalToken === cleanToken) {
      return { tenant: t, settings: s, portal };
    }
    if (portalSlug && portalSlug === cleanToken) {
      return { tenant: t, settings: s, portal };
    }
    // Suport și dacă a transmis CUI-ul sau ID-ul direct dacă portalul e activ
    const cleanCui = (t.cui || "").replace(/^RO/i, "").trim().toLowerCase();
    if (cleanCui && cleanCui === cleanToken) {
      return { tenant: t, settings: s, portal };
    }
  }

  return null;
}

export const accountantPortalRouter = router({
  /**
   * Returnează informațiile publice ale tenantului pentru afișarea ecranului de blocare / date firmă
   */
  getPublicInfo: publicProcedure
    .input(z.object({ token: z.string().trim().min(1) }))
    .query(async ({ input }) => {
      const match = await findTenantByPortalToken(input.token);
      if (!match) {
        return {
          found: false,
          isEnabled: false,
          message: "Portalul contabil nu a fost găsit sau link-ul este incorect.",
        };
      }

      const { tenant, settings, portal } = match;
      const isEnabled = portal.enabled !== false; // activ implicit dacă există token configurat

      const hasPin = Boolean(portal.pinHash);

      return {
        found: true,
        isEnabled,
        tenantId: tenant.id,
        companyName: tenant.name,
        cui: tenant.cui || "",
        address: tenant.address || "",
        logoUrl: settings.logoBase64 || "",
        logoBgColor: settings.logoBgColor || (settings.logoHasBackground ? "#0f172a" : ""),
        logoHasBackground: Boolean(settings.logoHasBackground),
        themeColor: settings.themeColor || "#16a34a",
        requiresPin: hasPin,
        autoSessionToken: !hasPin ? createAccountantSessionToken(tenant.id) : undefined,
      };
    }),

  /**
   * Verifică codul PIN și emite un session token pentru contabil
   */
  verifyPin: publicProcedure
    .input(
      z.object({
        token: z.string().trim().min(1),
        pin: z.string().trim().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const match = await findTenantByPortalToken(input.token);
      if (!match) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Portalul nu a fost găsit." });
      }

      const { tenant, settings, portal } = match;
      if (portal.enabled === false) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Portalul contabil este dezactivat de administrator." });
      }

      const candidatePin = input.pin.trim();

      // Verificăm PIN-ul: merg ambele PIN-uri (cel separat al contabilei și cel general al firmei)
      let pinOk = false;

      // 1. PIN-ul dedicat al contabilei (setat în Setări -> Portal Contabilitate)
      if (portal.pinHash) {
        const computed = crypto.createHash("sha256").update(candidatePin + PIN_SALT).digest("hex");
        if (computed === portal.pinHash) pinOk = true;
      }

      // 2. PIN-ul general al firmei (dacă e configurat pe firmă, merge și acesta)
      if (!pinOk && settings.accessPinHash) {
        const computedGeneral = crypto.createHash("sha256").update(candidatePin + ACCESS_PIN_SALT).digest("hex");
        if (computedGeneral === settings.accessPinHash) pinOk = true;
      }

      // 3. Dacă nu este setat niciun PIN pe portal și nici pe firmă, accesul este permis
      if (!portal.pinHash && !settings.accessPinHash) {
        pinOk = true;
      }

      if (!pinOk) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Codul PIN introdus este incorect.",
        });
      }

      const sessionToken = createAccountantSessionToken(tenant.id);
      return {
        success: true,
        sessionToken,
        tenantId: tenant.id,
        companyName: tenant.name,
      };
    }),

  /**
   * Verifică dacă un session token salvat local este încă valid
   */
  validateSession: publicProcedure
    .input(
      z.object({
        token: z.string().trim(),
        sessionToken: z.string().trim(),
      })
    )
    .query(async ({ input }) => {
      const match = await findTenantByPortalToken(input.token);
      if (!match) return { valid: false };

      const { tenant, portal } = match;
      if (portal.enabled === false) return { valid: false };

      const valid = verifyAccountantSessionToken(tenant.id, input.sessionToken);
      return {
        valid,
        tenantId: tenant.id,
        companyName: tenant.name,
      };
    }),

  /**
   * Returnează lista facturilor și NIR-urilor pentru portalul contabil
   */
  getData: publicProcedure
    .input(
      z.object({
        token: z.string().trim(),
        sessionToken: z.string().trim(),
        month: z.number().optional(), // 1 - 12 sau 0 pentru tot anul
        year: z.number().optional(),
        nirFilter: z.enum(["all", "cu_nir", "fara_nir"]).optional().default("all"),
      })
    )
    .query(async ({ input }) => {
      const match = await findTenantByPortalToken(input.token);
      if (!match) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Portalul nu a fost găsit." });
      }

      const { tenant, settings, portal } = match;
      if (portal.enabled === false) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Portalul contabil este dezactivat." });
      }

      const hasPin = Boolean(portal.pinHash);
      if (hasPin && !verifyAccountantSessionToken(tenant.id, input.sessionToken)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Sesiune expirată sau neautorizată." });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponibil" });

      // 1. Preluăm facturile primite (direction = 'in')
      const invoices = await db
        .select()
        .from(schema.invoiceArchive)
        .where(
          and(
            eq(schema.invoiceArchive.tenantId, tenant.id),
            eq(schema.invoiceArchive.direction, "in")
          )
        )
        .orderBy(desc(schema.invoiceArchive.createdAt));

      // 2. Preluăm NIR-urile tenantului
      const nirs = await db
        .select()
        .from(schema.nir)
        .where(eq(schema.nir.tenantId, tenant.id))
        .orderBy(desc(schema.nir.createdAt));

      // Creăm map-uri de asociere NIR la factură
      const nirByArchiveId = new Map<number, any>();
      const nirByInvoiceNumber = new Map<string, any>();
      for (const n of nirs) {
        if (n.invoiceArchiveId) {
          nirByArchiveId.set(Number(n.invoiceArchiveId), n);
        }
        if (n.invoiceNumber) {
          const clean = n.invoiceNumber.trim().toLowerCase();
          if (clean && !nirByInvoiceNumber.has(clean)) {
            nirByInvoiceNumber.set(clean, n);
          }
        }
      }

      // 3. Îmbinăm datele
      const enrichedInvoices = invoices.map((inv) => {
        const cleanInvNum = (inv.invoiceNumber || "").trim().toLowerCase();
        const matchedNir =
          nirByArchiveId.get(Number(inv.id)) ||
          (cleanInvNum ? nirByInvoiceNumber.get(cleanInvNum) : null);

        const totalNum = parseFloat(String(inv.total || 0));
        const vatNum = parseFloat(String(inv.totalVAT || 0));
        const baseNum = Math.round((totalNum - vatNum) * 100) / 100;

        const spvIdx =
          (inv.spvIndex || "").trim() ||
          (inv.fileName ? inv.fileName.match(/SPV_(\d+)/i)?.[1] : null) ||
          (inv.notes ? inv.notes.match(/index\s*(?:incarcare|spv)?[:\s]+(\d+)/i)?.[1] : null) ||
          "";

        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber || "Fără număr",
          supplierName: inv.supplierName || "Furnizor necunoscut",
          supplierCUI: inv.supplierCUI || "",
          issueDate: inv.issueDate || "",
          dueDate: inv.dueDate || "",
          total: totalNum,
          totalVAT: vatNum,
          totalBase: baseNum,
          currency: inv.currency || "RON",
          source: inv.source,
          pdfUrl: inv.source === "spv_anaf" || inv.fileUrl === "spv_import" ? `/api/pdf/archive/${inv.id}` : inv.fileUrl || `/api/pdf/archive/${inv.id}`,
          hasNir: Boolean(matchedNir),
          nirId: matchedNir ? matchedNir.id : null,
          nirNumber: matchedNir ? matchedNir.nirNumber : null,
          nirDate: matchedNir ? matchedNir.receiptDate : null,
          gestiune: matchedNir ? matchedNir.gestiune : null,
          spvIndex: spvIdx,
        };
      });

      // 3. Preluăm facturile emise (emittedInvoices + reInvoices + invoiceArchive direction='out')
      const emittedRows = await db
        .select()
        .from(schema.emittedInvoices)
        .where(eq(schema.emittedInvoices.tenantId, tenant.id))
        .orderBy(desc(schema.emittedInvoices.createdAt));

      const reInvoiceRows = await db
        .select()
        .from(schema.reInvoices)
        .where(eq(schema.reInvoices.tenantId, tenant.id))
        .orderBy(desc(schema.reInvoices.createdAt));

      const outArchiveRows = await db
        .select()
        .from(schema.invoiceArchive)
        .where(
          and(
            eq(schema.invoiceArchive.tenantId, tenant.id),
            eq(schema.invoiceArchive.direction, "out")
          )
        )
        .orderBy(desc(schema.invoiceArchive.createdAt));

      const seenEmittedNums = new Set<string>();

      const combinedEmitted: any[] = [];

      for (const inv of emittedRows) {
        const num = `${inv.series || ""}${inv.number || ""}`.trim() || `FACT-${inv.id}`;
        seenEmittedNums.add(num.toLowerCase());
        combinedEmitted.push({
          id: inv.id,
          source: "emitted",
          invoiceNumber: num,
          clientName: inv.clientName || "Client necunoscut",
          clientCUI: inv.clientCUI || "",
          issueDate: inv.issueDate || "",
          dueDate: inv.dueDate || "",
          totalBase: parseFloat(String(inv.subtotal || 0)),
          totalVAT: parseFloat(String(inv.totalVAT || 0)),
          total: parseFloat(String(inv.total || 0)),
          currency: inv.currency || "RON",
          status: inv.status || "draft",
          pdfUrl: `/api/pdf/emitted/${inv.id}`,
          spvIndex: inv.spvIndex || "",
        });
      }

      for (const inv of reInvoiceRows) {
        const num = inv.number || `REF-${inv.id}`;
        if (!seenEmittedNums.has(num.toLowerCase())) {
          seenEmittedNums.add(num.toLowerCase());
          combinedEmitted.push({
            id: inv.id,
            source: "reinvoice",
            invoiceNumber: num,
            clientName: inv.clientName || "Client necunoscut",
            clientCUI: inv.clientCUI || "",
            issueDate: inv.issueDate || "",
            dueDate: inv.dueDate || "",
            totalBase: parseFloat(String(inv.subtotal || 0)),
            totalVAT: parseFloat(String(inv.totalVAT || 0)),
            total: parseFloat(String(inv.total || 0)),
            currency: inv.currency || "RON",
            status: inv.status || "draft",
            pdfUrl: `/api/pdf/reinvoice/${inv.id}`,
            spvIndex: "",
          });
        }
      }

      for (const inv of outArchiveRows) {
        const num = inv.invoiceNumber || `FACT-SPV-${inv.id}`;
        if (!seenEmittedNums.has(num.toLowerCase())) {
          seenEmittedNums.add(num.toLowerCase());
          const totalNum = parseFloat(String(inv.total || 0));
          const vatNum = parseFloat(String(inv.totalVAT || 0));
          const baseNum = totalNum - vatNum;
          combinedEmitted.push({
            id: inv.id,
            source: "spv_out",
            invoiceNumber: num,
            clientName: inv.supplierName || "Client necunoscut",
            clientCUI: inv.supplierCUI || "",
            issueDate: inv.issueDate || "",
            dueDate: inv.dueDate || "",
            totalBase: Math.round(baseNum * 100) / 100,
            totalVAT: vatNum,
            total: totalNum,
            currency: inv.currency || "RON",
            status: inv.status || "emisa",
            pdfUrl: inv.source === "spv_anaf" || inv.fileUrl === "spv_import" ? `/api/pdf/archive/${inv.id}` : inv.fileUrl || `/api/pdf/archive/${inv.id}`,
            spvIndex: inv.spvIndex || "",
          });
        }
      }

      combinedEmitted.sort((a, b) => (b.issueDate || "").localeCompare(a.issueDate || ""));

      let emittedTotalBase = 0;
      let emittedTotalVat = 0;
      let emittedTotalGross = 0;
      for (const e of combinedEmitted) {
        emittedTotalBase += e.totalBase;
        emittedTotalVat += e.totalVAT;
        emittedTotalGross += e.total;
      }

      // 4. Calculăm sumarul statistic (Dashboard KPIs) pentru facturile primite
      let totalCount = enrichedInvoices.length;
      let totalBase = 0;
      let totalVat = 0;
      let totalGross = 0;
      let withNirCount = 0;
      let withoutNirCount = 0;

      for (const inv of enrichedInvoices) {
        totalBase += inv.totalBase;
        totalVat += inv.totalVAT;
        totalGross += inv.total;
        if (inv.hasNir) withNirCount++;
        else withoutNirCount++;
      }

      return {
        company: {
          id: tenant.id,
          name: tenant.name,
          cui: tenant.cui || "",
          address: tenant.address || "",
          logoUrl: settings.logoBase64 || "",
          logoBgColor: settings.logoBgColor || "",
          logoHasBackground: Boolean(settings.logoHasBackground),
          themeColor: settings.themeColor || "#16a34a",
        },
        invoices: enrichedInvoices,
        emittedInvoices: combinedEmitted,
        kpis: {
          totalCount,
          totalBase: Math.round(totalBase * 100) / 100,
          totalVat: Math.round(totalVat * 100) / 100,
          totalGross: Math.round(totalGross * 100) / 100,
          withNirCount,
          withoutNirCount,
          nirCoveragePercent: totalCount > 0 ? Math.round((withNirCount / totalCount) * 100) : 0,
        },
        emittedKpis: {
          totalCount: combinedEmitted.length,
          totalBase: Math.round(emittedTotalBase * 100) / 100,
          totalVat: Math.round(emittedTotalVat * 100) / 100,
          totalGross: Math.round(emittedTotalGross * 100) / 100,
        },
      };
    }),

  /**
   * Descarcă fișierul XML compatibil SAGA C pentru o lună sau pentru un NIR anume
   */
  downloadSagaXml: publicProcedure
    .input(
      z.object({
        token: z.string().trim(),
        sessionToken: z.string().trim(),
        month: z.number(), // 1-12 sau 0
        year: z.number(),
        nirId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const match = await findTenantByPortalToken(input.token);
      if (!match) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Portalul nu a fost găsit." });
      }

      const { tenant, settings, portal } = match;
      const hasPin = Boolean(portal.pinHash);
      if (hasPin && !verifyAccountantSessionToken(tenant.id, input.sessionToken)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Sesiune expirată sau neautorizată." });
      }

      const { generateSagaExportXML, generateSagaNirXML, getTenantCompanyProfile, toSagaXmlBuffer } = await import("./sagaXmlGenerator");

      let xml: string;
      let filename: string;
      const company = await getTenantCompanyProfile(tenant.id);
      const safeCui = company.cui.replace(/^RO/i, "").trim() || "EXPORT";

      if (input.nirId) {
        xml = await generateSagaNirXML(tenant.id, input.nirId);
        filename = `NIR_${input.nirId}_${safeCui}.xml`;
      } else {
        xml = await generateSagaExportXML(tenant.id, input.month, input.year);
        filename = `F_${safeCui}_${input.month}_${input.year}.xml`;
      }

      const buffer = toSagaXmlBuffer(xml);
      return {
        xml,
        filename,
        base64: buffer.toString("base64"),
      };
    }),

  /**
   * Returnează pozițiile/liniile unui document (pentru afișarea în grila de jos din modulul SAGA)
   */
  getDocumentLines: publicProcedure
    .input(
      z.object({
        token: z.string().trim(),
        sessionToken: z.string().trim(),
        docType: z.enum(["received", "emitted"]),
        docId: z.number(),
        nirId: z.number().optional().nullable(),
      })
    )
    .query(async ({ input }) => {
      const match = await findTenantByPortalToken(input.token);
      if (!match) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Portalul nu a fost găsit." });
      }

      const { tenant, portal } = match;
      if (portal.enabled === false) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Portalul contabil este dezactivat." });
      }

      const hasPin = Boolean(portal.pinHash);
      if (hasPin && !verifyAccountantSessionToken(tenant.id, input.sessionToken)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Sesiune expirată sau neautorizată." });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponibil" });

      if (input.docType === "received") {
        // 1. Dacă are NIR atașat, preluăm liniile din NIR (cu conturi contabile și tip contabil SAGA)
        if (input.nirId) {
          const nLines = await db
            .select()
            .from(schema.nirLines)
            .where(eq(schema.nirLines.nirId, input.nirId))
            .orderBy(schema.nirLines.lineOrder, schema.nirLines.id);

          if (nLines.length > 0) {
            return nLines.map((l, idx) => ({
              lineOrder: idx + 1,
              type: l.accountingType || "Mărfuri",
              description: l.description,
              unit: l.unit || "buc",
              quantity: parseFloat(String(l.cantitateReceptionata || l.cantitateComanda || 0)),
              unitPrice: parseFloat(String(l.unitPrice || 0)),
              vatRate: parseFloat(String(l.vatRate || 21)),
              total: parseFloat(String(l.total || 0)),
              account: l.accountingAccount || "371",
            }));
          }
        }

        // 2. Altfel, căutăm în liniile salvate din XML/arhivă
        const aLines = await db
          .select()
          .from(schema.invoiceArchiveLines)
          .where(eq(schema.invoiceArchiveLines.invoiceArchiveId, input.docId));

        if (aLines.length > 0) {
          return aLines.map((l, idx) => {
            const qty = parseFloat(String(l.quantity || 0));
            const price = parseFloat(String(l.unitPrice || 0));
            const tot = parseFloat(String(l.total || (qty * price)));
            const vat = parseFloat(String(l.vatRate || 21));
            return {
              lineOrder: idx + 1,
              type: "Mărfuri",
              description: l.description,
              unit: l.unit || "buc",
              quantity: qty,
              unitPrice: price,
              vatRate: vat,
              total: tot,
              account: "371",
            };
          });
        }

        return [];
      } else {
        // Facturi emise: verificăm emittedInvoiceLines, reInvoiceLines sau invoiceArchiveLines (pentru facturi din arhivă SPV)
        const eLines = await db
          .select()
          .from(schema.emittedInvoiceLines)
          .where(eq(schema.emittedInvoiceLines.emittedInvoiceId, input.docId))
          .orderBy(schema.emittedInvoiceLines.lineOrder, schema.emittedInvoiceLines.id);

        if (eLines.length > 0) {
          return eLines.map((l, idx) => {
            const qty = parseFloat(String(l.quantity || 0));
            const price = parseFloat(String(l.unitPrice || 0));
            const tot = parseFloat(String(l.total || (qty * price)));
            const vat = parseFloat(String(l.vatRate || 21));
            return {
              lineOrder: idx + 1,
              type: l.devizType === "MANOPERA" ? "Servicii" : "Produse",
              description: l.description,
              unit: l.unit || "buc",
              quantity: qty,
              unitPrice: price,
              vatRate: vat,
              total: tot,
              account: l.devizType === "MANOPERA" ? "704" : "707",
            };
          });
        }

        // Verificăm în reInvoiceLines
        const rLines = await db
          .select()
          .from(schema.reInvoiceLines)
          .where(eq(schema.reInvoiceLines.reInvoiceId, input.docId));

        if (rLines.length > 0) {
          return rLines.map((l, idx) => {
            const qty = parseFloat(String(l.quantity || 0));
            const price = parseFloat(String(l.unitPrice || 0));
            const tot = parseFloat(String(l.total || (qty * price)));
            const vat = parseFloat(String(l.vatRate || 21));
            return {
              lineOrder: idx + 1,
              type: "Servicii / Refacturare",
              description: l.description,
              unit: l.unit || "buc",
              quantity: qty,
              unitPrice: price,
              vatRate: vat,
              total: tot,
              account: "704",
            };
          });
        }

        // Verificăm în invoiceArchiveLines (facturi emise descărcate din SPV ANAF)
        const aLines = await db
          .select()
          .from(schema.invoiceArchiveLines)
          .where(eq(schema.invoiceArchiveLines.invoiceArchiveId, input.docId));

        if (aLines.length > 0) {
          return aLines.map((l, idx) => {
            const qty = parseFloat(String(l.quantity || 0));
            const price = parseFloat(String(l.unitPrice || 0));
            const tot = parseFloat(String(l.total || (qty * price)));
            const vat = parseFloat(String(l.vatRate || 21));
            return {
              lineOrder: idx + 1,
              type: "Produse / Servicii",
              description: l.description,
              unit: l.unit || "buc",
              quantity: qty,
              unitPrice: price,
              vatRate: vat,
              total: tot,
              account: "707",
            };
          });
        }

        return [];
      }
    }),
});
