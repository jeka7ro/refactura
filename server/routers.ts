import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { horecaRouter } from "../modules/horeca";
import { sagaRouter } from "../modules/saga";
import { z } from "zod";
import { generateReInvoicePDF } from "./pdf";
import {
  getDb,
  getTenantsByUser,
  getUserRole,
  createTenant,
  createCostCenter,
  getCostCentersByTenant,
  updateCostCenter,
  deleteCostCenter,
  getCostCenterById,
  getClientsByTenant,
  createClient,
  updateClient,
  deleteClient,
  getClientById,
  createLead,
  getAllLeads,
  updateLeadStatus,
  deleteLead,
  getAllSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  getCmsSettings,
  upsertCmsSetting,
  getAdminStats,
  getAllAccounts,
  getAllTenants,
  getAdminUserActivity,
  recordPageVisit,
  getPageVisitStats,
  getAllModules,
  getActiveModulesWithPricing,
  upsertModule,
  deleteModule,
  upsertModulePricing,
  deleteModulePricing,
  createReInvoice,
  getReInvoicesByTenant,
  getReInvoiceById,
  updateReInvoiceStatus,
  deleteReInvoice,
  getNextReInvoiceNumber,
  getInvoiceArchiveList,
  createInvoiceArchiveEntry,
  getInvoiceArchiveById,
  getInvoiceArchiveByIds,
  updateInvoiceArchiveEntry,
  deleteInvoiceArchiveEntry,
  getInvoiceArchiveStats,
  getIntegrations,
  upsertIntegration,
} from "./db";
import { authenticateAccount, createAccount, getAccountByEmail } from "./auth";
import { authRouter } from "./auth-routers";
import { createSessionToken } from "./session";
import { eq, desc, and, inArray } from "drizzle-orm";
import {
  invoiceArchive,
  invoiceArchiveLines,
  products,
  integrations,
  emittedInvoices,
  emittedInvoiceLines,
} from "../drizzle/schema";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Pre-parsare catalog eDevize la pornirea serverului
const _edevizeDir = path.dirname(fileURLToPath(import.meta.url));
const _edevizeCsvPath = path.resolve(_edevizeDir, "..", "coduri_edevize.csv");
let _edevizeCache: { cod: string; denumire: string; tip: string }[] = [];
try {
  const _csvContent = fs.readFileSync(_edevizeCsvPath, "utf8");
  const _csvLines = _csvContent.split("\n").filter(l => l.trim() !== "");
  for (let i = 1; i < _csvLines.length; i++) {
    const line = _csvLines[i];
    const firstComma = line.indexOf(",");
    const lastComma = line.lastIndexOf(",");
    if (firstComma > 0 && lastComma > firstComma) {
      const cod = line.substring(0, firstComma).trim();
      const tip = line.substring(lastComma + 1).trim();
      let denumire = line.substring(firstComma + 1, lastComma).trim();
      if (denumire.startsWith('"') && denumire.endsWith('"')) {
        denumire = denumire.substring(1, denumire.length - 1);
      }
      _edevizeCache.push({ cod, denumire, tip });
    }
  }
  console.log(
    `[edevize] Catalog încărcat: ${_edevizeCache.length} articole din ${_edevizeCsvPath}`
  );
} catch (err) {
  console.error("[edevize] Nu s-a putut încărca catalogul CSV:", err);
}

import { convertXmlToPdf } from "./anafPdf";
import { generateApiKey } from "./publicApi";
import { apiKeys } from "../drizzle/schema";

const apiKeysRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user?.tenantId) return [];
    const db = await getDb();
    const { eq } = await import("drizzle-orm");
    return db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        isActive: apiKeys.isActive,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.tenantId, (ctx.user?.tenantId || 1)));
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.tenantId) throw new Error("No tenant");
      const db = await getDb();
      const { raw, prefix, hash } = generateApiKey();
      await db.insert(apiKeys).values({
        tenantId: (ctx.user?.tenantId || 1),
        name: input.name,
        keyHash: hash,
        keyPrefix: prefix,
        isActive: 1,
      });
      return { rawKey: raw, prefix };
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.tenantId) throw new Error("No tenant");
      const db = await getDb();
      const { eq, and } = await import("drizzle-orm");
      await db.update(apiKeys)
        .set({ isActive: 0 })
        .where(and(eq(apiKeys.id, input.id), eq(apiKeys.tenantId, (ctx.user?.tenantId || 1))));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.tenantId) throw new Error("No tenant");
      const db = await getDb();
      const { eq, and } = await import("drizzle-orm");
      await db.delete(apiKeys)
        .where(and(eq(apiKeys.id, input.id), eq(apiKeys.tenantId, (ctx.user?.tenantId || 1))));
      return { success: true };
    }),
});

export const appRouter = router({
  system: systemRouter,
  horeca: horecaRouter,
  saga: sagaRouter,
  auth: authRouter,
  apiKeys: apiKeysRouter,

  tenants: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return [];
      return getTenantsByUser(ctx.user.id);
    }),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string(),
          email: z.string().email(),
          phone: z.string().optional(),
          address: z.string().optional(),
          cui: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return createTenant(input);
      }),
    current: protectedProcedure.query(async ({ ctx }) => {
      const tenantId = ctx.user?.tenantId;
      if (!tenantId) return null;
      const db = await getDb();
      if (!db) return null;
      const { tenants } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [t] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
      return t || null;
    }),
    updateSettings: protectedProcedure
      .input(
        z.object({
          name: z.string().optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          address: z.string().optional(),
          cui: z.string().optional(),
          settings: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const tenantId = ctx.user?.tenantId;
        if (!tenantId) throw new Error("No active tenant");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { tenants } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await db
          .update(tenants)
          .set(input)
          .where(eq(tenants.id, tenantId));
        return { success: true };
      }),
    switchTenant: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error("Neautentificat");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { accounts, userTenants } = await import("../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");

        // Verificare strictă de securitate: tenant-ul trebuie să fie explicit asignat utilizatorului în userTenants
        const [hasAccess] = await db
          .select()
          .from(userTenants)
          .where(
            and(
              eq(userTenants.userId, ctx.user.id),
              eq(userTenants.tenantId, input.tenantId),
              eq(userTenants.isActive, 1)
            )
          );

        if (!hasAccess) {
          throw new Error("Acces interzis: datele fiecărui tenant sunt strict confidențiale.");
        }

        await db
          .update(accounts)
          .set({ tenantId: input.tenantId })
          .where(eq(accounts.id, ctx.user.id));

        return { success: true, tenantId: input.tenantId };
      }),
  }),

  invoices: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      
      const db = await getDb();
      if (!db) return [];
      const res = await db
        .select()
        .from(invoiceArchive)
        .where(
          and(
            eq(invoiceArchive.tenantId, (ctx.user?.tenantId || 1)),
            eq(invoiceArchive.direction, "in")
          )
        )
        .orderBy(desc(invoiceArchive.createdAt));

      if (res.length === 0) return [];
      const itemIds = res.map(r => r.id);
      const lines = await db
        .select()
        .from(invoiceArchiveLines)
        .where(inArray(invoiceArchiveLines.invoiceArchiveId, itemIds));

      const linesMap = new Map<number, string[]>();
      for (const l of lines) {
        if (!linesMap.has(l.invoiceArchiveId))
          linesMap.set(l.invoiceArchiveId, []);
        linesMap.get(l.invoiceArchiveId)!.push(l.description);
      }

      return res.map(row => ({
        ...row,
        itemsText: (linesMap.get(row.id) || []).join(" "),
      }));
    }),
    listEmise: protectedProcedure.query(async ({ ctx }) => {
      
      const db = await getDb();
      if (!db) return [];
      const res = await db
        .select()
        .from(invoiceArchive)
        .where(
          and(
            eq(invoiceArchive.tenantId, (ctx.user?.tenantId || 1)),
            eq(invoiceArchive.direction, "out")
          )
        )
        .orderBy(desc(invoiceArchive.createdAt));

      if (res.length === 0) return [];
      const itemIds = res.map(r => r.id);
      const lines = await db
        .select()
        .from(invoiceArchiveLines)
        .where(inArray(invoiceArchiveLines.invoiceArchiveId, itemIds));

      const linesMap = new Map<number, string[]>();
      for (const l of lines) {
        if (!linesMap.has(l.invoiceArchiveId))
          linesMap.set(l.invoiceArchiveId, []);
        linesMap.get(l.invoiceArchiveId)!.push(l.description);
      }

      return res.map(row => ({
        ...row,
        itemsText: (linesMap.get(row.id) || []).join(" "),
      }));
    }),
    importSpv: protectedProcedure
      .input(
        z.array(
          z.object({
            invoiceNumber: z.string(),
            supplierName: z.string(),
            supplierCUI: z.string(),
            issueDate: z.string(),
            dueDate: z.string().optional(),
            total: z.number(),
            totalVAT: z.number(),
            currency: z.string().default("RON"),
            xmlContent: z.string().optional(),
            lines: z.array(
              z.object({
                description: z.string(),
                quantity: z.number(),
                unitPrice: z.number(),
                unit: z.string().default("buc"),
                vatRate: z.number().optional(),
              })
            ),
          })
        )
      )
      .mutation(async ({ input, ctx }) => {
        
        const db = await getDb();
        if (!db) throw new Error("DB not connected");

        const tenantId = (ctx.user?.tenantId || 1);
        const insertedIds: number[] = [];

        for (const inv of input) {
          let finalFileUrl = (inv as any).pdfUrl || "spv_import";

          if (inv.xmlContent) {
            const pdfRes = await convertXmlToPdf(
              inv.xmlContent,
              `Factura_${inv.invoiceNumber}_${Date.now()}`
            );
            if (pdfRes) {
              finalFileUrl = pdfRes.url;
            }
          }

          const [result] = await db.insert(invoiceArchive).values({
            tenantId,
            fileKey: "spv_import",
            fileUrl: finalFileUrl,
            fileName: `Factura_${inv.invoiceNumber}.xml`,
            fileType: "xml",
            invoiceNumber: inv.invoiceNumber,
            supplierName: inv.supplierName,
            supplierCUI: inv.supplierCUI,
            issueDate: inv.issueDate,
            dueDate: inv.dueDate,
            total: inv.total.toString() as any,
            totalVAT: inv.totalVAT.toString() as any,
            currency: inv.currency,
            source: "spv_anaf",
            direction: "in",
            status: "pending",
            rawXml: inv.xmlContent || null,
          });

          if (inv.lines.length > 0) {
            await db.insert(invoiceArchiveLines).values(
              inv.lines.map(l => ({
                invoiceArchiveId: result.insertId,
                description: l.description,
                quantity: l.quantity.toString() as any,
                unitPrice: l.unitPrice.toString() as any,
                unit: l.unit,
                vatRate: l.vatRate?.toString() as any,
                total: (l.quantity * l.unitPrice).toString() as any,
                currency: inv.currency,
              }))
            );
          }
          insertedIds.push(result.insertId);
        }
        return insertedIds;
      }),
  }),

  reinvoice: router({
    // List all re-invoices for the current tenant
    list: protectedProcedure.query(async ({ ctx }) => {
      
      return getReInvoicesByTenant((ctx.user?.tenantId || 1));
    }),
    // Get next available re-invoice number
    nextNumber: protectedProcedure.query(async ({ ctx }) => {
      
      return getNextReInvoiceNumber((ctx.user?.tenantId || 1));
    }),
    // Get a single re-invoice with its lines
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        
        return getReInvoiceById(input.id, (ctx.user?.tenantId || 1));
      }),
    // Create (generate) a new re-invoice and save to DB
    create: protectedProcedure
      .input(
        z.object({
          sourceInvoiceId: z.string().optional(),
          sourceInvoiceIds: z.array(z.number()).optional(),
          sourceInvoiceNumber: z.string().optional(),
          sourceSupplierName: z.string().optional(),
          clientId: z.number().optional(),
          clientName: z.string(),
          clientCUI: z.string().optional(),
          clientAddress: z.string().optional(),
          clientCity: z.string().optional(),
          clientEmail: z.string().optional(),
          clientPhone: z.string().optional(),
          issueDate: z.string(),
          dueDate: z.string().optional(),
          subtotal: z.number(),
          totalVAT: z.number(),
          total: z.number(),
          currency: z.string().default("RON"),
          status: z
            .enum(["draft", "sent", "paid", "overdue", "cancelled"])
            .default("draft"),
          notes: z.string().optional(),
          lines: z.array(
            z.object({
              description: z.string(),
              quantity: z.number(),
              originalUnitPrice: z.number().optional(),
              unitPrice: z.number(),
              unit: z.string().optional(),
              vatRate: z.number().optional(),
              markupPercent: z.number().optional(),
              total: z.number(),
              lineOrder: z.number(),
              devizType: z.string().nullable().optional(),
              devizCode: z.string().nullable().optional(),
            })
          ),
        })
      )
      .mutation(async ({ input, ctx }) => {
        
        const number = await getNextReInvoiceNumber((ctx.user?.tenantId || 1));

        const res = await createReInvoice({
          tenantId: (ctx.user?.tenantId || 1),
          number,
          ...input,
        });

        // Update archive status to refactured
        const db = await getDb();
        if (db) {
          const { invoiceArchive } = await import("../drizzle/schema");
          const { eq, inArray } = await import("drizzle-orm");
          if (input.sourceInvoiceId && input.sourceInvoiceId !== "multiplu") {
            await db
              .update(invoiceArchive)
              .set({ status: "refactured" })
              .where(eq(invoiceArchive.id, parseInt(input.sourceInvoiceId)));
          } else if (
            input.sourceInvoiceIds &&
            input.sourceInvoiceIds.length > 0
          ) {
            await db
              .update(invoiceArchive)
              .set({ status: "refactured" })
              .where(inArray(invoiceArchive.id, input.sourceInvoiceIds));
          }
        }

        return res;
      }),

    sendToSpv: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");

        // 1. Get invoice and lines
        const invoiceData = await getReInvoiceById(input.id, (ctx.user?.tenantId || 1));
        if (!invoiceData) throw new Error("Invoice not found");

        // 2. Get tenant
        const { tenants } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const tenantData = await db
          .select()
          .from(tenants)
          .where(eq(tenants.id, (ctx.user?.tenantId || 1)))
          .limit(1);
        if (tenantData.length === 0) throw new Error("Tenant not found");

        // 3. Generate XML
        const { generateUblXml } = await import("./anafXmlGenerator");
        const xmlContent = generateUblXml(
          invoiceData as any,
          invoiceData.lines as any,
          tenantData[0]
        );

        // 4. Upload to ANAF
        const { uploadInvoiceToSPV } = await import("./anafApi");
        const result = await uploadInvoiceToSPV(
          (ctx.user?.tenantId || 1),
          input.id,
          xmlContent,
          tenantData[0].cui || ""
        );

        return result;
      }),

    // Update status
    updateStatus: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        
        return updateReInvoiceStatus(input.id, (ctx.user?.tenantId || 1), input.status);
      }),
    // Delete
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        
        return deleteReInvoice(input.id, (ctx.user?.tenantId || 1));
      }),
    // Download PDF (unchanged)
    downloadPDF: protectedProcedure
      .input(
        z.object({
          number: z.string(),
          date: z.string(),
          dueDate: z.string(),
          clientName: z.string(),
          clientCUI: z.string(),
          clientAddress: z.string(),
          clientCity: z.string(),
          clientCounty: z.string(),
          clientEmail: z.string(),
          clientPhone: z.string(),
          companyName: z.string(),
          companyCUI: z.string(),
          companyAddress: z.string(),
          companyCity: z.string(),
          companyCounty: z.string(),
          companyEmail: z.string(),
          companyPhone: z.string(),
          companyIBAN: z.string(),
          companyBank: z.string(),
          lines: z.array(
            z.object({
              description: z.string(),
              quantity: z.number(),
              unitPrice: z.number(),
              unit: z.string(),
              vatRate: z.number(),
              total: z.number(),
            })
          ),
          subtotal: z.number(),
          totalVAT: z.number(),
          total: z.number(),
          currency: z.string(),
          notes: z.string().optional(),
          logoBase64: z.string().optional(),
          template: z.enum(["classic", "modern", "minimal"]).optional(),
        })
      )
      .mutation(({ input, ctx }) => {
        const pdfStream = generateReInvoicePDF(input);
        ctx.res.setHeader("Content-Type", "application/pdf");
        ctx.res.setHeader(
          "Content-Disposition",
          `attachment; filename="${input.number}.pdf"`
        );
        pdfStream.pipe(ctx.res);
        return { success: true };
      }),
  }),
  costCenters: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      
      return getCostCentersByTenant((ctx.user?.tenantId || 1));
    }),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          address: z.string().optional(),
          cui: z.string().optional(),
          email: z.string().email().optional().or(z.literal("")),
          phone: z.string().optional(),
          city: z.string().optional(),
          country: z.string().optional(),
          categoryId: z.number().nullable().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        
        return createCostCenter({
          tenantId: (ctx.user?.tenantId || 1),
          ...input,
        });
      }),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          address: z.string().optional(),
          cui: z.string().optional(),
          email: z.string().email().optional().or(z.literal("")),
          phone: z.string().optional(),
          city: z.string().optional(),
          country: z.string().optional(),
          categoryId: z.number().nullable().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        
        const { id, ...data } = input;
        return updateCostCenter(id, (ctx.user?.tenantId || 1), data);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        
        return deleteCostCenter(input.id, (ctx.user?.tenantId || 1));
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        
        return getCostCenterById(input.id, (ctx.user?.tenantId || 1));
      }),

    // ─── Categories Nomenclator ───────────────────────────────
    listCategories: protectedProcedure.query(async ({ ctx }) => {
      
      const db = await getDb();
      const { costCenterCategories } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      return db.select().from(costCenterCategories)
        .where(eq(costCenterCategories.tenantId, (ctx.user?.tenantId || 1)))
        .orderBy(costCenterCategories.name);
    }),
    createCategory: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(100), color: z.string().length(7).optional() }))
      .mutation(async ({ input, ctx }) => {
        
        const db = await getDb();
        const { costCenterCategories } = await import("../drizzle/schema");
        await db.insert(costCenterCategories).values({
          tenantId: (ctx.user?.tenantId || 1),
          name: input.name.trim(),
          color: input.color || "#6366f1",
        });
        return { success: true };
      }),
    updateCategory: protectedProcedure
      .input(z.object({ id: z.number(), name: z.string().min(1).max(100).optional(), color: z.string().length(7).optional() }))
      .mutation(async ({ input, ctx }) => {
        
        const db = await getDb();
        const { costCenterCategories } = await import("../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        const { id, ...data } = input;
        await db.update(costCenterCategories).set(data)
          .where(and(eq(costCenterCategories.id, id), eq(costCenterCategories.tenantId, (ctx.user?.tenantId || 1))));
        return { success: true };
      }),
    deleteCategory: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        
        const db = await getDb();
        const { costCenterCategories } = await import("../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        await db.delete(costCenterCategories)
          .where(and(eq(costCenterCategories.id, input.id), eq(costCenterCategories.tenantId, (ctx.user?.tenantId || 1))));
        return { success: true };
      }),
    listRules: protectedProcedure.query(async ({ ctx }) => {
      
      const db = await getDb();
      const { costCenterRules } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      return db.select().from(costCenterRules).where(eq(costCenterRules.tenantId, (ctx.user?.tenantId || 1)));
    }),
    createRule: protectedProcedure
      .input(
        z.object({
          costCenterId: z.number(),
          conditionValue: z.string().optional(), // CUI filter
          matchName: z.string().optional(),      // Name filter
          addressKeyword: z.string().optional(), // Location filter
          lineKeyword: z.string().optional(),    // Keyword in invoice lines
        })
      )
      .mutation(async ({ input, ctx }) => {
        
        const db = await getDb();
        const { costCenterRules } = await import("../drizzle/schema");
        return db.insert(costCenterRules).values({
          tenantId: (ctx.user?.tenantId || 1),
          conditionType: "MULTI",
          conditionValue: input.conditionValue || "",
          matchName: input.matchName || null,
          addressKeyword: input.addressKeyword || null,
          lineKeyword: input.lineKeyword || null,
          costCenterId: input.costCenterId,
        });
      }),
    deleteRule: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        
        const db = await getDb();
        const { costCenterRules } = await import("../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        return db
          .delete(costCenterRules)
          .where(and(eq(costCenterRules.id, input.id), eq(costCenterRules.tenantId, (ctx.user?.tenantId || 1))));
      }),
    updateRule: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          costCenterId: z.number(),
          conditionValue: z.string().optional(), // CUI filter
          matchName: z.string().optional(),      // Name filter
          addressKeyword: z.string().optional(), // Location filter
          lineKeyword: z.string().optional(),    // Keyword in invoice lines
        })
      )
      .mutation(async ({ input, ctx }) => {
        
        const db = await getDb();
        const { costCenterRules } = await import("../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        const { id, ...data } = input;
        return db
          .update(costCenterRules)
          .set({
            conditionType: "MULTI",
            conditionValue: data.conditionValue || "",
            matchName: data.matchName || null,
            addressKeyword: data.addressKeyword || null,
            lineKeyword: data.lineKeyword || null,
            costCenterId: data.costCenterId,
          })
          .where(and(eq(costCenterRules.id, id), eq(costCenterRules.tenantId, (ctx.user?.tenantId || 1))));
      }),
    getInvoicesByCostCenter: protectedProcedure
      .input(z.object({
        costCenterId: z.number(),
        supplierSearch: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        
        const db = await getDb();
        const { invoiceArchive } = await import("../drizzle/schema");
        const { eq, and, like, gte, lte, or } = await import("drizzle-orm");

        const conditions: any[] = [
          eq(invoiceArchive.tenantId, (ctx.user?.tenantId || 1)),
          eq(invoiceArchive.costCenterId, input.costCenterId),
        ];

        if (input.supplierSearch && input.supplierSearch.trim()) {
          const term = `%${input.supplierSearch.trim()}%`;
          conditions.push(or(
            like(invoiceArchive.supplierName, term),
            like(invoiceArchive.supplierCUI, term)
          ));
        }
        if (input.dateFrom) conditions.push(gte(invoiceArchive.issueDate, input.dateFrom));
        if (input.dateTo) conditions.push(lte(invoiceArchive.issueDate, input.dateTo));

        return db
          .select({
            id: invoiceArchive.id,
            invoiceNumber: invoiceArchive.invoiceNumber,
            supplierName: invoiceArchive.supplierName,
            supplierCUI: invoiceArchive.supplierCUI,
            total: invoiceArchive.total,
            totalVAT: invoiceArchive.totalVAT,
            currency: invoiceArchive.currency,
            issueDate: invoiceArchive.issueDate,
            dueDate: invoiceArchive.dueDate,
            status: invoiceArchive.status,
            direction: invoiceArchive.direction,
          })
          .from(invoiceArchive)
          .where(and(...conditions))
          .orderBy(invoiceArchive.issueDate)
          .limit(1000);
      }),
    getUniqueSuppliers: protectedProcedure.query(async ({ ctx }) => {
      
      const db = await getDb();
      const { invoiceArchive } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      
      // Fetch ALL suppliers from ALL invoices (no direction filter)
      const distinctSuppliers = await db
        .select({
          supplierCUI: invoiceArchive.supplierCUI,
          supplierName: invoiceArchive.supplierName,
        })
        .from(invoiceArchive)
        .where(eq(invoiceArchive.tenantId, (ctx.user?.tenantId || 1)))
        .groupBy(invoiceArchive.supplierCUI, invoiceArchive.supplierName)
        .limit(500);

      return distinctSuppliers.filter(s => s.supplierCUI || s.supplierName);
    }),
    recalculateRules: protectedProcedure.mutation(async ({ ctx }) => {
      
      const db = await getDb();
      const { invoiceArchive, costCenterRules, invoiceArchiveLines } = await import("../drizzle/schema");
      const { eq, and, inArray } = await import("drizzle-orm");
      
      const rules = await db
        .select()
        .from(costCenterRules)
        .where(and(eq(costCenterRules.tenantId, (ctx.user?.tenantId || 1)), eq(costCenterRules.isActive, 1)));
        
      if (rules.length === 0) return { updated: 0 };
      
      const invoices = await db
        .select()
        .from(invoiceArchive)
        .where(eq(invoiceArchive.tenantId, (ctx.user?.tenantId || 1)));

      // Pre-load all lines for this tenant's invoices (batch, not per invoice)
      const invoiceIds = invoices.map(i => i.id);
      let linesMap = new Map<number, string[]>(); // invoiceId -> [descriptions]
      if (invoiceIds.length > 0) {
        const allLines = await db
          .select({ invoiceArchiveId: invoiceArchiveLines.invoiceArchiveId, description: invoiceArchiveLines.description })
          .from(invoiceArchiveLines)
          .where(inArray(invoiceArchiveLines.invoiceArchiveId, invoiceIds));
        for (const l of allLines) {
          if (!linesMap.has(l.invoiceArchiveId)) linesMap.set(l.invoiceArchiveId, []);
          linesMap.get(l.invoiceArchiveId)!.push((l.description || "").toLowerCase());
        }
      }
        
      let updatedCount = 0;
      for (const invoice of invoices) {
        let assignedCostCenterId = null;
        const invoiceLines = linesMap.get(invoice.id) || [];

        for (const rule of rules) {
          const hasCUI  = rule.conditionValue && rule.conditionValue.trim() !== "";
          const hasName = rule.matchName && rule.matchName.trim() !== "";
          const hasAddr = rule.addressKeyword && rule.addressKeyword.trim() !== "";
          const hasLine = rule.lineKeyword && rule.lineKeyword.trim() !== "";

          if (!hasCUI && !hasName && !hasAddr && !hasLine) continue; // empty rule

          const cuiOk  = !hasCUI  || (invoice.supplierCUI  && invoice.supplierCUI.toLowerCase().includes(rule.conditionValue!.toLowerCase()));
          const nameOk = !hasName || (invoice.supplierName && invoice.supplierName.toLowerCase().includes(rule.matchName!.toLowerCase()));
          const addrOk = !hasAddr || (invoice.supplierAddress && invoice.supplierAddress.toLowerCase().includes(rule.addressKeyword!.toLowerCase()));
          // lineKeyword: at least one line description must contain the keyword
          const lineOk = !hasLine || invoiceLines.some(desc => desc.includes(rule.lineKeyword!.toLowerCase()));

          if (cuiOk && nameOk && addrOk && lineOk) {
            assignedCostCenterId = rule.costCenterId;
            break;
          }
        }
        
        if (assignedCostCenterId && assignedCostCenterId !== invoice.costCenterId) {
          await db
            .update(invoiceArchive)
            .set({ costCenterId: assignedCostCenterId })
            .where(eq(invoiceArchive.id, invoice.id));
          updatedCount++;
        }
      }
      return { updated: updatedCount };
    }),
  }),

  clients: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      
      return getClientsByTenant((ctx.user?.tenantId || 1));
    }),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          cui: z.string().optional(),
          address: z.string().optional(),
          city: z.string().optional(),
          country: z.string().optional(),
          email: z.string().email().optional().or(z.literal("")),
          phone: z.string().optional(),
          currency: z.string().optional(),
          regCom: z.string().optional(),
          tva: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        
        return createClient({
          tenantId: (ctx.user?.tenantId || 1),
          ...input,
        });
      }),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          cui: z.string().optional(),
          address: z.string().optional(),
          city: z.string().optional(),
          country: z.string().optional(),
          email: z.string().email().optional().or(z.literal("")),
          phone: z.string().optional(),
          currency: z.string().optional(),
          regCom: z.string().optional(),
          tva: z.coerce.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        
        const { id, ...data } = input;
        return updateClient(id, (ctx.user?.tenantId || 1), data);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        
        return deleteClient(input.id, (ctx.user?.tenantId || 1));
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        
        return getClientById(input.id, (ctx.user?.tenantId || 1));
      }),
    getDetails: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        
        const client = await getClientById(input.id, (ctx.user?.tenantId || 1));
        if (!client) throw new Error("Client not found");

        const db = await import("./db").then(m => m.getDb());
        if (!db) throw new Error("DB not available");

        const { eq, or, and, sql, desc } = await import("drizzle-orm");
        const { emittedInvoices, reInvoices, invoiceArchive } =
          await import("../drizzle/schema");

        const rawCui = (client.cui || "").trim();
        const cleanCui = rawCui.replace(/^[A-Z]{2}/i, "").trim();

        // Facturi emise către client (atât din modulul nou de Facturi Emise cât și din Re-Facturi)
        const emitted = await db
          .select()
          .from(emittedInvoices)
          .where(
            and(
              eq(emittedInvoices.tenantId, (ctx.user?.tenantId || 1)),
              or(
                eq(emittedInvoices.clientId, client.id),
                rawCui ? eq(emittedInvoices.clientCUI, rawCui) : sql`1=0`,
                cleanCui
                  ? sql`REPLACE(REPLACE(REPLACE(UPPER(${emittedInvoices.clientCUI}), 'RO', ''), 'BE', ''), ' ', '') = ${cleanCui.toUpperCase()}`
                  : sql`1=0`,
                sql`LOWER(TRIM(${emittedInvoices.clientName})) = LOWER(TRIM(${client.name}))`
              )
            )
          )
          .orderBy(desc(emittedInvoices.issueDate), desc(emittedInvoices.id));

        const reinv = await db
          .select()
          .from(reInvoices)
          .where(
            and(
              eq(reInvoices.tenantId, (ctx.user?.tenantId || 1)),
              or(
                eq(reInvoices.clientId, client.id),
                rawCui ? eq(reInvoices.clientCUI, rawCui) : sql`1=0`,
                cleanCui
                  ? sql`REPLACE(REPLACE(REPLACE(UPPER(${reInvoices.clientCUI}), 'RO', ''), 'BE', ''), ' ', '') = ${cleanCui.toUpperCase()}`
                  : sql`1=0`,
                sql`LOWER(TRIM(${reInvoices.clientName})) = LOWER(TRIM(${client.name}))`
              )
            )
          )
          .orderBy(desc(reInvoices.issueDate), desc(reInvoices.id));

        const sentInvoices = [
          ...emitted.map(e => {
            const rawNum = (e.number || `FACT-${e.id}`).trim();
            const rawSer = (e.series || "").trim();
            const fullNum = rawNum.toUpperCase().startsWith(rawSer.toUpperCase())
              ? rawNum
              : `${rawSer} ${rawNum}`.trim();
            return {
              id: e.id,
              number: fullNum,
              issueDate: e.issueDate,
              dueDate: e.dueDate,
              total: e.total,
              currency: e.currency || "RON",
              status: e.status || "draft",
              type: "emitted",
            };
          }),
          ...reinv.map(r => ({
            id: r.id,
            number: r.number || `RF-${r.id}`,
            issueDate: r.issueDate,
            dueDate: r.dueDate,
            total: r.total,
            currency: r.currency || "RON",
            status: r.status || "draft",
            type: "reinvoice",
          })),
        ];

        // Facturi primite de la client (în cazul în care este și furnizor)
        let receivedInvoices: any[] = [];
        if (client.cui || client.name) {
          receivedInvoices = await db
            .select()
            .from(invoiceArchive)
            .where(
              and(
                eq(invoiceArchive.tenantId, (ctx.user?.tenantId || 1)),
                or(
                  rawCui ? eq(invoiceArchive.supplierCUI, rawCui) : sql`1=0`,
                  cleanCui
                    ? sql`REPLACE(REPLACE(REPLACE(UPPER(${invoiceArchive.supplierCUI}), 'RO', ''), 'BE', ''), ' ', '') = ${cleanCui.toUpperCase()}`
                    : sql`1=0`,
                  sql`LOWER(TRIM(${invoiceArchive.supplierName})) = LOWER(TRIM(${client.name}))`
                )
              )
            )
            .orderBy(desc(invoiceArchive.issueDate), desc(invoiceArchive.id));
        }

        return { client, sentInvoices, receivedInvoices };
      }),
  }),

  // ─── Public endpoints (no auth needed) ─────────────────────────────────────
  public: router({
    // Get active subscription plans for landing page
    plans: publicProcedure.query(async () => {
      const plans = await getAllSubscriptionPlans();
      return plans.filter((p: any) => p.isActive);
    }),
    // Get active modules with pricing for landing page
    modulesWithPricing: publicProcedure.query(async () => {
      return getActiveModulesWithPricing();
    }),
    // Submit trial/lead registration
    submitLead: publicProcedure
      .input(
        z.object({
          name: z.string().min(1),
          email: z.string().email(),
          phone: z.string().optional(),
          company: z.string().optional(),
          message: z.string().optional(),
          planId: z.number().optional(),
          source: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await createLead(input);
        return { success: true };
      }),
    // Track page visit
    trackVisit: publicProcedure
      .input(
        z.object({
          path: z.string(),
          referrer: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const ip =
          (ctx.req.headers["x-forwarded-for"] as string) ||
          ctx.req.socket.remoteAddress ||
          "";
        const userAgent = ctx.req.headers["user-agent"] || "";
        await recordPageVisit({
          path: input.path,
          referrer: input.referrer,
          userAgent,
          ip,
        });
        return { success: true };
      }),
    // Get CMS settings (public, for landing page)
    cmsSettings: publicProcedure
      .input(z.object({ group: z.string().optional() }))
      .query(async ({ input }) => {
        return getCmsSettings(input.group);
      }),
  }),

  // ─── Admin-only endpoints ────────────────────────────────────────────────────
  admin: router({
    // Stats overview
    stats: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "superadmin" && ctx.user?.role !== "admin")
        throw new Error("Forbidden");
      return getAdminStats();
    }),
    // All leads/registrations
    leads: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "superadmin" && ctx.user?.role !== "admin")
        throw new Error("Forbidden");
      return getAllLeads();
    }),
    updateLeadStatus: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["new", "contacted", "converted", "lost"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "superadmin" && ctx.user?.role !== "admin")
          throw new Error("Forbidden");
        return updateLeadStatus(input.id, input.status);
      }),
    deleteLead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "superadmin" && ctx.user?.role !== "admin")
          throw new Error("Forbidden");
        return deleteLead(input.id);
      }),
    // Accounts list
    accounts: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "superadmin" && ctx.user?.role !== "admin")
        throw new Error("Forbidden");
      return getAllAccounts();
    }),
    // Tenants list
    tenants: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "superadmin" && ctx.user?.role !== "admin")
        throw new Error("Forbidden");
      return getAllTenants();
    }),
    // User Activity & Logins list
    userActivity: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "superadmin" && ctx.user?.role !== "admin")
        throw new Error("Forbidden");
      return getAdminUserActivity();
    }),
    // Subscription plans CRUD
    plans: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "superadmin" && ctx.user?.role !== "admin")
        throw new Error("Forbidden");
      return getAllSubscriptionPlans();
    }),
    createPlan: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          monthlyPrice: z.number().min(0),
          maxCostCenters: z.number().min(1),
          maxUsers: z.number().min(1),
          features: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "superadmin" && ctx.user?.role !== "admin")
          throw new Error("Forbidden");
        return createSubscriptionPlan(input);
      }),
    updatePlan: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          description: z.string().optional(),
          monthlyPrice: z.number().optional(),
          maxCostCenters: z.number().optional(),
          maxUsers: z.number().optional(),
          features: z.string().optional(),
          isActive: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "superadmin" && ctx.user?.role !== "admin")
          throw new Error("Forbidden");
        const { id, ...data } = input;
        return updateSubscriptionPlan(id, data);
      }),
    deletePlan: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "superadmin" && ctx.user?.role !== "admin")
          throw new Error("Forbidden");
        return deleteSubscriptionPlan(input.id);
      }),
    // CMS settings
    getCmsSettings: protectedProcedure
      .input(z.object({ group: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user?.role !== "superadmin" && ctx.user?.role !== "admin")
          throw new Error("Forbidden");
        return getCmsSettings(input.group);
      }),
    upsertCmsSetting: protectedProcedure
      .input(
        z.object({
          key: z.string(),
          value: z.string(),
          label: z.string().optional(),
          group: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "superadmin" && ctx.user?.role !== "admin")
          throw new Error("Forbidden");
        return upsertCmsSetting(
          input.key,
          input.value,
          input.label,
          input.group
        );
      }),
    // Traffic stats
    trafficStats: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "superadmin" && ctx.user?.role !== "admin")
        throw new Error("Forbidden");
      return getPageVisitStats();
    }),
    // Modules CRUD
    modules: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "superadmin" && ctx.user?.role !== "admin")
        throw new Error("Forbidden");
      return getAllModules();
    }),
    modulesWithPricing: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "superadmin" && ctx.user?.role !== "admin")
        throw new Error("Forbidden");
      return getActiveModulesWithPricing();
    }),
    upsertModule: protectedProcedure
      .input(
        z.object({
          id: z.number().optional(),
          slug: z.string(),
          name: z.string(),
          description: z.string().optional(),
          icon: z.string().optional(),
          color: z.string().optional(),
          isCombo: z.number().optional(),
          comboModules: z.string().optional(),
          sortOrder: z.number().optional(),
          isActive: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "superadmin" && ctx.user?.role !== "admin")
          throw new Error("Forbidden");
        return upsertModule(input);
      }),
    deleteModule: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "superadmin" && ctx.user?.role !== "admin")
          throw new Error("Forbidden");
        return deleteModule(input.id);
      }),
    upsertModulePricing: protectedProcedure
      .input(
        z.object({
          id: z.number().optional(),
          moduleId: z.number(),
          currency: z.string(),
          monthlyPrice: z.string(),
          yearlyPrice: z.string().optional(),
          trialDays: z.number().optional(),
          isActive: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "superadmin" && ctx.user?.role !== "admin")
          throw new Error("Forbidden");
        return upsertModulePricing(input);
      }),
    deleteModulePricing: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "superadmin" && ctx.user?.role !== "admin")
          throw new Error("Forbidden");
        return deleteModulePricing(input.id);
      }),
  }),

  // ─── Invoice Archive ────────────────────────────────────────────────────────
  invoiceArchive: router({
    list: protectedProcedure
      .input(
        z
          .object({
            source: z.string().optional(),
            status: z.string().optional(),
            search: z.string().optional(),
            limit: z.number().optional(),
            offset: z.number().optional(),
          })
          .optional()
      )
      .query(async ({ input, ctx }) => {
        
        return getInvoiceArchiveList((ctx.user?.tenantId || 1), input ?? {});
      }),

    stats: protectedProcedure.query(async ({ ctx }) => {
      
      return getInvoiceArchiveStats((ctx.user?.tenantId || 1));
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        
        return getInvoiceArchiveById(input.id, (ctx.user?.tenantId || 1));
      }),

    getByIds: protectedProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .query(async ({ input, ctx }) => {
        
        return getInvoiceArchiveByIds(input.ids, (ctx.user?.tenantId || 1));
      }),

    getLines: protectedProcedure
      .input(z.object({ id: z.number(), excludeNirId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        
        const db = await getDb();
        if (!db) return [];
        const { nir, nirLines } = await import("../drizzle/schema");
        const lines = await db
          .select()
          .from(invoiceArchiveLines)
          .where(eq(invoiceArchiveLines.invoiceArchiveId, input.id));

        // Find all NIRs linked to this invoice
        const existingNirs = await db
          .select({ id: nir.id })
          .from(nir)
          .where(
            and(
              eq(nir.invoiceArchiveId, input.id),
              eq(nir.tenantId, (ctx.user?.tenantId || 1))
            )
          );

        // Optionally exclude the current NIR being edited
        const nirIds = existingNirs
          .map(n => n.id)
          .filter(id => id !== input.excludeNirId);

        let allNirLines: any[] = [];
        if (nirIds.length > 0) {
          allNirLines = await db
            .select()
            .from(nirLines)
            .where(inArray(nirLines.nirId, nirIds));
        }

        const receivedMap = new Map<string, number>();
        for (const nl of allNirLines) {
          const qty = parseFloat(String(nl.cantitateReceptionata || "0"));
          const desc = nl.description || "";
          receivedMap.set(desc, (receivedMap.get(desc) || 0) + qty);
        }

        return lines.map(l => ({
          ...l,
          receivedQuantity: receivedMap.get(l.description || "") || 0,
        }));
      }),

    create: protectedProcedure
      .input(
        z.object({
          fileKey: z.string(),
          fileUrl: z.string(),
          fileName: z.string(),
          fileType: z.enum(["pdf", "xml", "efactura", "other"]).optional(),
          fileSize: z.number().optional(),
          invoiceNumber: z.string().optional(),
          supplierName: z.string().optional(),
          supplierCUI: z.string().optional(),
          issueDate: z.string().optional(),
          dueDate: z.string().optional(),
          total: z.string().optional(),
          totalVAT: z.string().optional(),
          currency: z.string().optional(),
          source: z
            .enum([
              "smartbill",
              "oblio",
              "fgo",
              "spv_anaf",
              "efactura",
              "pdf_manual",
              "xml_manual",
              "other",
            ])
            .optional(),
          notes: z.string().optional(),
          tags: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        
        return createInvoiceArchiveEntry({
          ...input,
          tenantId: (ctx.user?.tenantId || 1),
        });
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          invoiceNumber: z.string().optional(),
          supplierName: z.string().optional(),
          supplierCUI: z.string().optional(),
          issueDate: z.string().optional(),
          dueDate: z.string().optional(),
          total: z.string().optional(),
          totalVAT: z.string().optional(),
          currency: z.string().optional(),
          status: z
            .enum(["pending", "processed", "refactured", "archived"])
            .optional(),
          notes: z.string().optional(),
          tags: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        
        const { id, ...data } = input;
        return updateInvoiceArchiveEntry(id, (ctx.user?.tenantId || 1), data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        
        await deleteInvoiceArchiveEntry(input.id, (ctx.user?.tenantId || 1));
        return { success: true };
      }),

    updateStatus: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["pending", "processed", "archived", "refactured"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { invoiceArchive } = await import("../drizzle/schema");
        await db
          .update(invoiceArchive)
          .set({ status: input.status })
          .where(
            and(
              eq(invoiceArchive.id, input.id),
              eq(invoiceArchive.tenantId, (ctx.user?.tenantId || 1))
            )
          );
        return { success: true };
      }),
  }),

  // ─── Integrations Router ─────────────────────────────────────────────────────
  integrations: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      
      return getIntegrations((ctx.user?.tenantId || 1));
    }),
    exportSaga: protectedProcedure
      .input(
        z.object({
          month: z.number(),
          year: z.number(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { generateSagaExportXML, getTenantCompanyProfile } = await import("./sagaXmlGenerator");
        const tenantId = ctx.user?.tenantId || 1;
        const xml = await generateSagaExportXML(
          tenantId,
          input.month,
          input.year
        );
        const company = await getTenantCompanyProfile(tenantId);
        const safeCui = company.cui.replace(/^RO/i, "").trim() || "EXPORT";
        const filename = `F_${safeCui}_${input.month}_${input.year}.xml`;
        return { xml, filename };
      }),
    upsert: protectedProcedure
      .input(
        z.object({
          provider: z.enum(["smartbill", "spv", "oblio"]),
          apiKey: z.string().optional(),
          apiSecret: z.string().optional(),
          status: z.enum(["active", "inactive", "error"]).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        
        await upsertIntegration((ctx.user?.tenantId || 1), input.provider, {
          apiKey: input.apiKey,
          apiSecret: input.apiSecret,
          status: input.status,
        });
        return { success: true };
      }),
    syncOblio: protectedProcedure.mutation(async ({ ctx }) => {
      
      const { syncOblioInvoices } = await import("./oblioSync");
      return syncOblioInvoices((ctx.user?.tenantId || 1));
    }),
    disconnectOblio: protectedProcedure.mutation(async ({ ctx }) => {
      
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { integrations } = await import("../drizzle/schema");
      const { and, eq } = await import("drizzle-orm");
      await db
        .delete(integrations)
        .where(
          and(
            eq(integrations.tenantId, (ctx.user?.tenantId || 1)),
            eq(integrations.provider, "oblio")
          )
        );
      return { success: true };
    }),
    disconnectSpv: protectedProcedure.mutation(async ({ ctx }) => {
      
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { integrations } = await import("../drizzle/schema");
      const { and, eq } = await import("drizzle-orm");
      await db
        .delete(integrations)
        .where(
          and(
            eq(integrations.tenantId, (ctx.user?.tenantId || 1)),
            eq(integrations.provider, "spv")
          )
        );
      return { success: true };
    }),
    syncSpvManual: protectedProcedure.mutation(async ({ ctx }) => {
      
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { integrations } = await import("../drizzle/schema");
      const { and, eq } = await import("drizzle-orm");
      const [spvIntg] = await db
        .select()
        .from(integrations)
        .where(
          and(
            eq(integrations.tenantId, (ctx.user?.tenantId || 1)),
            eq(integrations.provider, "spv")
          )
        );

      if (!spvIntg || !spvIntg.apiKey) {
        throw new Error(
          "SPV nu este configurat sau lipsește token-ul de acces."
        );
      }
      const { syncAllSpv } = await import("./spvCron");
      const result = await syncAllSpv(60);
      return {
        success: true,
        imported: result?.imported || 0,
        limitHit: result?.limitHit || 0,
      };
    }),
    getSpvOAuthUrl: protectedProcedure.query(async ({ ctx }) => {
      
      const clientId = process.env.SPV_CLIENT_ID;
      const clientSecret = process.env.SPV_CLIENT_SECRET;
      const redirectUri =
        process.env.SPV_CALLBACK_URL ||
        "https://refactura.up.railway.app/api/spv/callback";
      const authUrl = new URL(
        "https://logincert.anaf.ro/anaf-oauth2/v1/authorize"
      );
      authUrl.searchParams.append("response_type", "code");
      authUrl.searchParams.append("client_id", clientId || "");
      authUrl.searchParams.append("redirect_uri", redirectUri);
      authUrl.searchParams.append("state", String((ctx.user?.tenantId || 1)));
      // Fetch tenant CUI
      const { tenants } = await import("../drizzle/schema");
      const db = await getDb();
      const [tenant] = await db!
        .select({ cui: tenants.cui })
        .from(tenants)
        .where(eq(tenants.id, (ctx.user?.tenantId || 1)));
      return {
        url: authUrl.toString(),
        serverConfigured: !!(clientId && clientSecret),
        tenantCui: tenant?.cui || "",
      };
    }),
    syncSpv: protectedProcedure
      .input(
        z.object({ zile: z.number().min(1).max(365).optional() }).optional()
      )
      .mutation(async ({ ctx, input }) => {
        
        const { syncAllSpv } = await import("./spvCron");
        const result = await syncAllSpv(input?.zile || 60);
        return {
          success: true,
          imported: result?.imported || 0,
          limitHit: result?.limitHit || 0,
        };
      }),
    syncSmartBill: protectedProcedure.mutation(async ({ ctx }) => {
      
      const { syncSmartBillInvoices } = await import("./smartbillSync");
      return syncSmartBillInvoices((ctx.user?.tenantId || 1));
    }),
    // Backfill rawXml for existing SPV invoices
    repopulateXml: protectedProcedure.mutation(async ({ ctx }) => {
      
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Find all SPV invoices without rawXml
      const missing = await db
        .select({
          id: invoiceArchive.id,
          fileName: invoiceArchive.fileName,
          tenantId: invoiceArchive.tenantId,
        })
        .from(invoiceArchive)
        .where(
          and(
            eq(invoiceArchive.tenantId, (ctx.user?.tenantId || 1)),
            eq(invoiceArchive.source, "spv_anaf"),
            sql`rawXml IS NULL`
          )
        );

      if (!missing.length) return { updated: 0 };

      // Get SPV token
      const [spvIntg] = await db
        .select()
        .from(integrations)
        .where(
          and(
            eq(integrations.tenantId, (ctx.user?.tenantId || 1)),
            eq(integrations.provider, "spv"),
            eq(integrations.status, "active")
          )
        );

      if (!spvIntg?.apiKey) throw new Error("SPV nu este conectat");

      const AdmZip = (await import("adm-zip")).default;
      let updated = 0;

      for (const inv of missing) {
        // Try to extract download ID from fileName
        const match = inv.fileName?.match(/SPV_(\d+)/);
        if (!match) continue;

        try {
          const zipRes = await fetch(
            `https://api.anaf.ro/prod/FCTEL/rest/descarcare?id=${match[1]}`,
            {
              headers: { Authorization: `Bearer ${spvIntg.apiKey}` },
              signal: AbortSignal.timeout(30000),
            }
          );
          if (!zipRes.ok) continue;

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
            const xmlContent = xmlEntry.getData().toString("utf8");
            await db
              .update(invoiceArchive)
              .set({ rawXml: xmlContent })
              .where(eq(invoiceArchive.id, inv.id));
            updated++;
          }
        } catch {}
      }
      return { updated, total: missing.length };
    }),
  }),

  products: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user?.tenantId) throw new Error("No tenant");
      const db = await getDb();
      if (!db) return [];
      return await db
        .select()
        .from(products)
        .where(eq(products.tenantId, (ctx.user?.tenantId || 1)))
        .orderBy(desc(products.id));
    }),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string(),
          unit: z.string().optional(),
          defaultPrice: z.number().optional(),
          defaultVatRate: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const result = await db.insert(products).values({
          tenantId: (ctx.user?.tenantId || 1),
          name: input.name,
          unit: input.unit || "buc",
          defaultPrice: String(input.defaultPrice || 0),
          defaultVatRate:
            input.defaultVatRate !== undefined ? input.defaultVatRate : 21,
        });
        return { id: result[0].insertId };
      }),
    upsert: protectedProcedure
      .input(
        z.object({
          name: z.string(),
          unit: z.string().optional(),
          defaultPrice: z.number().optional(),
          defaultVatRate: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const trimmedName = input.name.trim();
        if (!trimmedName) return { id: 0 };

        const [existing] = await db
          .select()
          .from(products)
          .where(
            and(
              eq(products.tenantId, (ctx.user?.tenantId || 1)),
              eq(products.name, trimmedName)
            )
          )
          .limit(1);

        if (existing) {
          await db
            .update(products)
            .set({
              unit: input.unit || existing.unit || "buc",
              defaultPrice: String(input.defaultPrice ?? existing.defaultPrice ?? 0),
              defaultVatRate: input.defaultVatRate ?? existing.defaultVatRate ?? 21,
            })
            .where(eq(products.id, existing.id));
          return { id: existing.id };
        } else {
          const result = await db.insert(products).values({
            tenantId: (ctx.user?.tenantId || 1),
            name: trimmedName,
            unit: input.unit || "buc",
            defaultPrice: String(input.defaultPrice || 0),
            defaultVatRate: input.defaultVatRate ?? 21,
          });
          return { id: result[0].insertId };
        }
      }),
  }),

  emittedInvoice: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user?.tenantId) throw new Error("No tenant");
      const db = await getDb();
      if (!db) throw new Error("No DB");
      const rows = await db
        .select()
        .from(emittedInvoices)
        .where(eq(emittedInvoices.tenantId, (ctx.user?.tenantId || 1)))
        .orderBy(desc(emittedInvoices.createdAt));

      if (rows.length === 0) return [];

      const rowIds = rows.map(r => r.id);
      const lines = await db
        .select()
        .from(emittedInvoiceLines)
        .where(inArray(emittedInvoiceLines.emittedInvoiceId, rowIds));

      const linesMap = new Map<number, string[]>();
      for (const l of lines) {
        if (!linesMap.has(l.emittedInvoiceId))
          linesMap.set(l.emittedInvoiceId, []);
        linesMap.get(l.emittedInvoiceId)!.push(l.description);
      }

      return rows.map(row => ({
        ...row,
        itemsText: (linesMap.get(row.id) || []).join(" "),
      }));
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { emittedInvoices, emittedInvoiceLines } =
          await import("../drizzle/schema");
        const [inv] = await db
          .select()
          .from(emittedInvoices)
          .where(
            and(
              eq(emittedInvoices.id, input.id),
              eq(emittedInvoices.tenantId, (ctx.user?.tenantId || 1))
            )
          );
        if (!inv) throw new Error("Not found");
        const lines = await db
          .select()
          .from(emittedInvoiceLines)
          .where(eq(emittedInvoiceLines.emittedInvoiceId, input.id))
          .orderBy(emittedInvoiceLines.lineOrder);
        return { ...inv, lines };
      }),

    seriesList: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user?.tenantId) return ["FACT", "INV"];
      const db = await getDb();
      if (!db) return ["FACT", "INV"];
      const { emittedInvoices } = await import("../drizzle/schema");
      const rows = await db
        .selectDistinct({ series: emittedInvoices.series })
        .from(emittedInvoices)
        .where(eq(emittedInvoices.tenantId, (ctx.user?.tenantId || 1)));
      const list = rows.map(r => r.series).filter(Boolean) as string[];
      if (!list.includes("FACT")) list.unshift("FACT");
      if (!list.includes("INV")) list.push("INV");
      return list;
    }),

    nextNumber: protectedProcedure
      .input(z.object({ series: z.string().default("FACT") }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { emittedInvoices } = await import("../drizzle/schema");
        const { desc } = await import("drizzle-orm");
        const { sql } = await import("drizzle-orm");
        const cleanSeries = (input.series || "FACT").trim().toUpperCase();
        const last = await db
          .select({ number: emittedInvoices.number })
          .from(emittedInvoices)
          .where(
            and(
              eq(emittedInvoices.tenantId, (ctx.user?.tenantId || 1)),
              sql`UPPER(${emittedInvoices.series}) = ${cleanSeries}`
            )
          )
          .orderBy(desc(emittedInvoices.id))
          .limit(1);
        let nextNum = 1;
        if (last.length > 0) {
          const match = last[0].number.match(/(\d+)$/);
          if (match) nextNum = parseInt(match[1]) + 1;
        }
        return `${cleanSeries}-${String(nextNum).padStart(4, "0")}`;
      }),

    create: protectedProcedure
      .input(
        z.object({
          number: z.string(),
          series: z.string().optional(),
          companyIBAN: z.string().optional(),
          companyBank: z.string().optional(),
          clientId: z.number().optional(),
          clientName: z.string(),
          clientCUI: z.string().optional(),
          clientRegCom: z.string().optional(),
          clientAddress: z.string().optional(),
          clientCity: z.string().optional(),
          clientCountry: z.string().optional(),
          clientEmail: z.string().optional(),
          clientPhone: z.string().optional(),
          issueDate: z.string(),
          dueDate: z.string().optional(),
          subtotal: z.number(),
          totalVAT: z.number(),
          total: z.number(),
          currency: z.string().default("RON"),
          status: z
            .enum(["draft", "sent", "paid", "overdue", "cancelled"])
            .default("draft"),
          notes: z.string().optional(),
          lines: z.array(
            z.object({
              description: z.string(),
              quantity: z.number(),
              unitPrice: z.number(),
              unit: z.string().optional(),
              vatRate: z.number().optional(),
              total: z.number(),
              lineOrder: z.number(),
              devizCode: z.string().nullable().optional(),
              devizType: z.string().nullable().optional(),
            })
          ),
          createDeviz: z.boolean().default(false).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { emittedInvoices, emittedInvoiceLines } =
          await import("../drizzle/schema");
        const { lines, createDeviz, ...invoiceData } = input;

        let safeCountry = "RO";
        if (invoiceData.clientCountry) {
          safeCountry = invoiceData.clientCountry.trim().slice(0, 2).toUpperCase();
        } else if (invoiceData.clientCUI) {
          const m = invoiceData.clientCUI.trim().match(/^([A-Za-z]{2})/);
          if (m && m[1].toUpperCase() !== "RO") {
            safeCountry = m[1].toUpperCase();
          }
        }

        let assignedClientId = invoiceData.clientId;
        if (!assignedClientId && invoiceData.clientName) {
          try {
            const { clients } = await import("../drizzle/schema");
            const existing = await db
              .select({ id: clients.id })
              .from(clients)
              .where(
                and(
                  eq(clients.tenantId, (ctx.user?.tenantId || 1)),
                  invoiceData.clientCUI
                    ? eq(clients.cui, invoiceData.clientCUI.trim())
                    : eq(clients.name, invoiceData.clientName.trim())
                )
              )
              .limit(1);

            if (existing.length > 0) {
              assignedClientId = existing[0].id;
              const updateClientData: any = {};
              if (invoiceData.clientAddress) updateClientData.address = invoiceData.clientAddress.trim();
              if (invoiceData.clientCity) updateClientData.city = invoiceData.clientCity.trim();
              if (safeCountry) updateClientData.country = safeCountry;
              if (invoiceData.clientEmail) updateClientData.email = invoiceData.clientEmail.trim();
              if (invoiceData.clientPhone) updateClientData.phone = invoiceData.clientPhone.trim();
              if (invoiceData.clientRegCom) updateClientData.regCom = invoiceData.clientRegCom.trim();
              if (invoiceData.clientCUI) updateClientData.cui = invoiceData.clientCUI.trim();
              if (Object.keys(updateClientData).length > 0) {
                await db.update(clients).set(updateClientData).where(eq(clients.id, assignedClientId));
              }
            } else {
              const [newClient] = await db
                .insert(clients)
                .values({
                  tenantId: (ctx.user?.tenantId || 1),
                  name: invoiceData.clientName.trim(),
                  cui: invoiceData.clientCUI?.trim() || null,
                  regCom: invoiceData.clientRegCom?.trim() || null,
                  address: invoiceData.clientAddress?.trim() || null,
                  city: invoiceData.clientCity?.trim() || null,
                  country: safeCountry,
                  email: invoiceData.clientEmail?.trim() || null,
                  phone: invoiceData.clientPhone?.trim() || null,
                  currency: invoiceData.currency || "RON",
                })
                .$returningId();
              if (newClient?.id) assignedClientId = newClient.id;
            }
          } catch (err) {
            console.error("Failed to auto-save client:", err);
          }
        } else if (assignedClientId) {
          try {
            const { clients } = await import("../drizzle/schema");
            const updateClientData: any = {};
            if (invoiceData.clientAddress) updateClientData.address = invoiceData.clientAddress.trim();
            if (invoiceData.clientCity) updateClientData.city = invoiceData.clientCity.trim();
            if (safeCountry) updateClientData.country = safeCountry;
            if (invoiceData.clientEmail) updateClientData.email = invoiceData.clientEmail.trim();
            if (invoiceData.clientPhone) updateClientData.phone = invoiceData.clientPhone.trim();
            if (invoiceData.clientRegCom) updateClientData.regCom = invoiceData.clientRegCom.trim();
            if (invoiceData.clientCUI) updateClientData.cui = invoiceData.clientCUI.trim();
            if (Object.keys(updateClientData).length > 0) {
              await db.update(clients).set(updateClientData).where(eq(clients.id, assignedClientId));
            }
          } catch (err) {
            console.error("Failed to sync client:", err);
          }
        }

        const isExternal =
          (safeCountry && safeCountry.toUpperCase() !== "RO") ||
          (invoiceData.currency && invoiceData.currency !== "RON" && safeCountry !== "RO") ||
          (/^[A-Za-z]{2}/.test(invoiceData.clientCUI || "") && !invoiceData.clientCUI?.toUpperCase().startsWith("RO"));

        const [result] = await db
          .insert(emittedInvoices)
          .values({
            tenantId: (ctx.user?.tenantId || 1),
            ...invoiceData,
            clientId: assignedClientId || null,
            clientCountry: safeCountry,
            subtotal: String(invoiceData.subtotal),
            totalVAT: String(invoiceData.totalVAT),
            total: String(invoiceData.total),
            spvStatus: isExternal ? "extern" : "nesincronizat",
          } as any)
          .$returningId();
        const invoiceId = result.id;

        let finalInvoiceLines = [...lines];
        const catalogLines = lines.filter(
          l => l.devizType && l.devizType !== "GROUPED_LABOR"
        );

        if (input.createDeviz && catalogLines.length > 0) {
          const { devize, devizeLines, bonuriConsum, bonuriConsumLines } =
            await import("../drizzle/schema");
          const devizNum = `DEV-${invoiceId}`;
          let tMat = 0;
          let tLab = 0;
          let tTot = 0;
          for (const cl of catalogLines) {
            const lTot = cl.total;
            tTot += lTot;
            if (cl.devizType === "MATERIAL") tMat += lTot;
            else if (
              cl.devizType === "MANOPERA" ||
              cl.devizType === "NORMA" ||
              cl.devizType === "UTILAJ"
            )
              tLab += lTot;
          }

          const [dRes] = await db
            .insert(devize)
            .values({
              tenantId: (ctx.user?.tenantId || 1),
              number: devizNum,
              date: new Date(),
              invoiceId,
              totalMaterials: String(tMat),
              totalLabor: String(tLab),
              total: String(tTot),
              status: "final",
            } as any)
            .$returningId();

          await db.insert(devizeLines).values(
            catalogLines.map(
              (cl, i) =>
                ({
                  devizId: dRes.id,
                  type: cl.devizType as any,
                  code: cl.devizCode,
                  description: cl.description,
                  quantity: String(cl.quantity),
                  unitPrice: String(cl.unitPrice),
                  total: String(cl.total),
                  lineOrder: i,
                }) as any
            )
          );

          const matLines = catalogLines.filter(l => l.devizType === "MATERIAL");
          if (matLines.length > 0) {
            const [bRes] = await db
              .insert(bonuriConsum)
              .values({
                tenantId: (ctx.user?.tenantId || 1),
                devizId: dRes.id,
                number: `BC-${invoiceId}`,
                date: new Date(),
                status: "final",
              } as any)
              .$returningId();
            await db.insert(bonuriConsumLines).values(
              matLines.map(
                (ml, i) =>
                  ({
                    bonId: bRes.id,
                    materialCode: ml.devizCode,
                    description: ml.description,
                    quantity: String(ml.quantity),
                    unitPrice: String(ml.unitPrice),
                    total: String(ml.total),
                    lineOrder: i,
                  }) as any
              )
            );
          }

          const labLines = catalogLines.filter(
            l =>
              l.devizType === "MANOPERA" ||
              l.devizType === "NORMA" ||
              l.devizType === "UTILAJ"
          );
          if (labLines.length > 0) {
            const sumLab = labLines.reduce((acc, curr) => acc + curr.total, 0);
            finalInvoiceLines = finalInvoiceLines.filter(
              l =>
                l.devizType !== "MANOPERA" &&
                l.devizType !== "NORMA" &&
                l.devizType !== "UTILAJ"
            );
            finalInvoiceLines.push({
              description: `Manoperă conform deviz ${devizNum}`,
              quantity: 1,
              unitPrice: sumLab,
              unit: "buc",
              vatRate: labLines[0].vatRate || 19,
              total: sumLab,
              lineOrder: 9999,
              devizType: "GROUPED_LABOR",
            });
          }
        }

        if (finalInvoiceLines.length > 0) {
          await db.insert(emittedInvoiceLines).values(
            finalInvoiceLines.map(
              (l, i) =>
                ({
                  emittedInvoiceId: invoiceId,
                  description: l.description,
                  quantity: String(l.quantity),
                  unitPrice: String(l.unitPrice),
                  unit: l.unit || "buc",
                  vatRate: String(l.vatRate ?? 21),
                  total: String(l.total),
                  lineOrder: l.lineOrder ?? i,
                  devizCode: l.devizCode,
                  devizType: l.devizType,
                }) as any
            )
          );
        }

        // Salvează / actualizează produsele din linii în nomenclatorul de produse
        try {
          const { products } = await import("../drizzle/schema");
          for (const l of lines) {
            const pName = l.description?.trim();
            if (!pName) continue;
            const [existing] = await db
              .select({ id: products.id })
              .from(products)
              .where(
                and(
                  eq(products.tenantId, (ctx.user?.tenantId || 1)),
                  eq(products.name, pName)
                )
              )
              .limit(1);

            if (existing) {
              await db
                .update(products)
                .set({
                  unit: l.unit || "buc",
                  defaultPrice: String(l.unitPrice || 0),
                  defaultVatRate: Math.round(l.vatRate ?? 21),
                })
                .where(eq(products.id, existing.id));
            } else {
              await db.insert(products).values({
                tenantId: (ctx.user?.tenantId || 1),
                name: pName,
                unit: l.unit || "buc",
                defaultPrice: String(l.unitPrice || 0),
                defaultVatRate: Math.round(l.vatRate ?? 21),
              });
            }
          }
        } catch (prodErr) {
          console.error("Failed to auto-save products on invoice creation:", prodErr);
        }

        return { id: invoiceId };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          number: z.string().optional(),
          series: z.string().optional(),
          companyIBAN: z.string().optional(),
          companyBank: z.string().optional(),
          clientId: z.number().optional(),
          clientName: z.string().optional(),
          clientCUI: z.string().optional(),
          clientRegCom: z.string().optional(),
          clientAddress: z.string().optional(),
          clientCity: z.string().optional(),
          clientCountry: z.string().optional(),
          clientEmail: z.string().optional(),
          clientPhone: z.string().optional(),
          issueDate: z.string().optional(),
          dueDate: z.string().optional(),
          subtotal: z.number().optional(),
          totalVAT: z.number().optional(),
          total: z.number().optional(),
          currency: z.string().optional(),
          status: z
            .enum(["draft", "sent", "paid", "overdue", "cancelled"])
            .optional(),
          notes: z.string().optional(),
          lines: z
            .array(
              z.object({
                description: z.string(),
                quantity: z.number(),
                unitPrice: z.number(),
                unit: z.string().optional(),
                vatRate: z.number().optional(),
                total: z.number(),
                lineOrder: z.number(),
                devizCode: z.string().nullable().optional(),
                devizType: z.string().nullable().optional(),
              })
            )
            .optional(),
          createDeviz: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { emittedInvoices, emittedInvoiceLines } =
          await import("../drizzle/schema");
        const { id, lines, createDeviz, ...data } = input;
        const updateData: any = {};
        if (data.subtotal !== undefined)
          updateData.subtotal = String(data.subtotal);
        if (data.totalVAT !== undefined)
          updateData.totalVAT = String(data.totalVAT);
        if (data.total !== undefined) updateData.total = String(data.total);
        if (data.clientName) updateData.clientName = data.clientName;
        if (data.clientCUI !== undefined) updateData.clientCUI = data.clientCUI;
        if (data.clientRegCom !== undefined)
          updateData.clientRegCom = data.clientRegCom;
        if (data.clientAddress !== undefined)
          updateData.clientAddress = data.clientAddress;
        if (data.clientCity !== undefined)
          updateData.clientCity = data.clientCity;
        if (data.clientCountry !== undefined) {
          updateData.clientCountry = data.clientCountry.trim().slice(0, 2).toUpperCase();
        } else if (data.clientCUI) {
          const m = data.clientCUI.trim().match(/^([A-Za-z]{2})/);
          if (m && m[1].toUpperCase() !== "RO") {
            updateData.clientCountry = m[1].toUpperCase();
          }
        }
        if (data.clientEmail !== undefined)
          updateData.clientEmail = data.clientEmail;
        if (data.clientPhone !== undefined)
          updateData.clientPhone = data.clientPhone;
        if (data.issueDate) updateData.issueDate = data.issueDate;
        if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
        if (data.currency) updateData.currency = data.currency;
        if (data.status) updateData.status = data.status;
        if (data.notes !== undefined) updateData.notes = data.notes;
        if (data.number) updateData.number = data.number;
        if (data.series) updateData.series = data.series;
        if (updateData.clientCountry && updateData.clientCountry !== "RO") {
          updateData.spvStatus = "extern";
          updateData.spvError = null;
        } else if (updateData.clientCUI && /^[A-Za-z]{2}/.test(updateData.clientCUI) && !updateData.clientCUI.toUpperCase().startsWith("RO")) {
          updateData.spvStatus = "extern";
          updateData.spvError = null;
        }
        if (Object.keys(updateData).length > 0) {
          await db
            .update(emittedInvoices)
            .set(updateData)
            .where(
              and(
                eq(emittedInvoices.id, id),
                eq(emittedInvoices.tenantId, (ctx.user?.tenantId || 1))
              )
            );

          if (data.clientId) {
            try {
              const { clients } = await import("../drizzle/schema");
              const updateClientData: any = {};
              if (data.clientAddress !== undefined) updateClientData.address = data.clientAddress.trim() || null;
              if (data.clientCity !== undefined) updateClientData.city = data.clientCity.trim() || null;
              if (updateData.clientCountry) updateClientData.country = updateData.clientCountry;
              if (data.clientEmail !== undefined) updateClientData.email = data.clientEmail.trim() || null;
              if (data.clientPhone !== undefined) updateClientData.phone = data.clientPhone.trim() || null;
              if (data.clientRegCom !== undefined) updateClientData.regCom = data.clientRegCom.trim() || null;
              if (data.clientCUI !== undefined) updateClientData.cui = data.clientCUI.trim() || null;
              if (Object.keys(updateClientData).length > 0) {
                await db.update(clients).set(updateClientData).where(eq(clients.id, data.clientId));
              }
            } catch (e) {
              console.error("Failed to sync client on update:", e);
            }
          }
        }
        if (lines) {
          const { devize, devizeLines, bonuriConsum, bonuriConsumLines } =
            await import("../drizzle/schema");

          await db
            .delete(emittedInvoiceLines)
            .where(eq(emittedInvoiceLines.emittedInvoiceId, id));

          // Delete old devize & bonuri for this invoice to regenerate cleanly
          const oldDevize = await db
            .select({ id: devize.id })
            .from(devize)
            .where(eq(devize.invoiceId, id));
          for (const od of oldDevize) {
            await db.delete(devizeLines).where(eq(devizeLines.devizId, od.id));
            const oldBonuri = await db
              .select({ id: bonuriConsum.id })
              .from(bonuriConsum)
              .where(eq(bonuriConsum.devizId, od.id));
            for (const ob of oldBonuri) {
              await db
                .delete(bonuriConsumLines)
                .where(eq(bonuriConsumLines.bonId, ob.id));
            }
            await db
              .delete(bonuriConsum)
              .where(eq(bonuriConsum.devizId, od.id));
          }
          await db.delete(devize).where(eq(devize.invoiceId, id));

          if (lines.length > 0) {
            let finalInvoiceLines = [...lines];
            // Include TOATE liniile in deviz: cele cu devizType + liniile din NIR (fara devizType = MATERIAL)
            const devizAllLines = lines
              .filter(l => l.devizType !== "GROUPED_LABOR")
              .map(l => ({
                ...l,
                devizType: l.devizType || "MATERIAL", // NIR lines fara devizType → MATERIAL
              }));
            const catalogLines = lines.filter(
              l => l.devizType && l.devizType !== "GROUPED_LABOR"
            );

            if (createDeviz && devizAllLines.length > 0) {
              const devizNum = `DEV-${id}`;
              let tMat = 0;
              let tLab = 0;
              let tTot = 0;
              for (const cl of devizAllLines) {
                const lTot = cl.total;
                tTot += lTot;
                if (cl.devizType === "MATERIAL") tMat += lTot;
                else if (
                  cl.devizType === "MANOPERA" ||
                  cl.devizType === "NORMA" ||
                  cl.devizType === "UTILAJ"
                )
                  tLab += lTot;
              }

              const [dRes] = await db
                .insert(devize)
                .values({
                  tenantId: (ctx.user?.tenantId || 1),
                  number: devizNum,
                  date: new Date(),
                  invoiceId: id,
                  totalMaterials: String(tMat),
                  totalLabor: String(tLab),
                  total: String(tTot),
                  status: "final",
                } as any)
                .$returningId();

              await db.insert(devizeLines).values(
                devizAllLines.map(
                  (cl, i) =>
                    ({
                      devizId: dRes.id,
                      type: cl.devizType as any,
                      code: cl.devizCode || null,
                      description: cl.description,
                      quantity: String(cl.quantity),
                      unitPrice: String(cl.unitPrice),
                      total: String(cl.total),
                      lineOrder: i,
                    }) as any
                )
              );

              // Bonuri consum: toate liniile MATERIAL (catalog + NIR)
              const matLines = devizAllLines.filter(
                l => l.devizType === "MATERIAL"
              );
              if (matLines.length > 0) {
                const [bRes] = await db
                  .insert(bonuriConsum)
                  .values({
                    tenantId: (ctx.user?.tenantId || 1),
                    devizId: dRes.id,
                    number: `BC-${id}`,
                    date: new Date(),
                    status: "final",
                  } as any)
                  .$returningId();
                await db.insert(bonuriConsumLines).values(
                  matLines.map(
                    (ml, i) =>
                      ({
                        bonId: bRes.id,
                        materialCode: ml.devizCode || null,
                        description: ml.description,
                        quantity: String(ml.quantity),
                        unitPrice: String(ml.unitPrice),
                        total: String(ml.total),
                        lineOrder: i,
                      }) as any
                  )
                );
              }

              const labLines = catalogLines.filter(
                l =>
                  l.devizType === "MANOPERA" ||
                  l.devizType === "NORMA" ||
                  l.devizType === "UTILAJ"
              );
              if (labLines.length > 0) {
                const sumLab = labLines.reduce(
                  (acc, curr) => acc + curr.total,
                  0
                );
                finalInvoiceLines = finalInvoiceLines.filter(
                  l =>
                    l.devizType !== "MANOPERA" &&
                    l.devizType !== "NORMA" &&
                    l.devizType !== "UTILAJ"
                );
                finalInvoiceLines.push({
                  description: `Manoperă conform deviz ${devizNum}`,
                  quantity: 1,
                  unitPrice: sumLab,
                  unit: "buc",
                  vatRate: labLines[0].vatRate || 19,
                  total: sumLab,
                  lineOrder: 9999,
                  devizType: "GROUPED_LABOR",
                });
              }
            }

            if (finalInvoiceLines.length > 0) {
              await db.insert(emittedInvoiceLines).values(
                finalInvoiceLines.map(
                  (l, i) =>
                    ({
                      emittedInvoiceId: id,
                      description: l.description,
                      quantity: String(l.quantity),
                      unitPrice: String(l.unitPrice),
                      unit: l.unit || "buc",
                      vatRate: String(l.vatRate ?? 21),
                      total: String(l.total),
                      lineOrder: l.lineOrder ?? i,
                      devizCode: l.devizCode,
                      devizType: l.devizType,
                    }) as any
                )
              );
            }
          }
        }
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { emittedInvoices, emittedInvoiceLines } =
          await import("../drizzle/schema");
        await db
          .delete(emittedInvoiceLines)
          .where(eq(emittedInvoiceLines.emittedInvoiceId, input.id));
        await db
          .delete(emittedInvoices)
          .where(
            and(
              eq(emittedInvoices.id, input.id),
              eq(emittedInvoices.tenantId, (ctx.user?.tenantId || 1))
            )
          );
        return { success: true };
      }),

    updateStatus: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { emittedInvoices } = await import("../drizzle/schema");
        await db
          .update(emittedInvoices)
          .set({ status: input.status })
          .where(
            and(
              eq(emittedInvoices.id, input.id),
              eq(emittedInvoices.tenantId, (ctx.user?.tenantId || 1))
            )
          );
        return { success: true };
      }),

    sendToSpv: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { emittedInvoices, emittedInvoiceLines, tenants } =
          await import("../drizzle/schema");
        const [inv] = await db
          .select()
          .from(emittedInvoices)
          .where(
            and(
              eq(emittedInvoices.id, input.id),
              eq(emittedInvoices.tenantId, (ctx.user?.tenantId || 1))
            )
          );
        if (!inv) throw new Error("Invoice not found");

        const isExternal =
          inv.spvStatus === "extern" ||
          (inv.clientCountry && inv.clientCountry.toUpperCase() !== "RO") ||
          (/^[A-Za-z]{2}/.test(inv.clientCUI || "") && !inv.clientCUI?.toUpperCase().startsWith("RO"));

        if (isExternal) {
          await db
            .update(emittedInvoices)
            .set({ spvStatus: "extern", spvError: null })
            .where(eq(emittedInvoices.id, input.id));
          return {
            success: false,
            error: "Facturile emise către clienți din afara României (extern/intracomunitar) nu se transmit în sistemul RO e-Factura. Acestea se declară în Declarația 390 VIES și se transmit clientului pe e-mail.",
          };
        }
        const lines = await db
          .select()
          .from(emittedInvoiceLines)
          .where(eq(emittedInvoiceLines.emittedInvoiceId, input.id));
        const [tenantData] = await db
          .select()
          .from(tenants)
          .where(eq(tenants.id, (ctx.user?.tenantId || 1)));
        if (!tenantData) throw new Error("Tenant not found");
        const { generateUblXml } = await import("./anafXmlGenerator");
        // Map emitted invoice to the same shape generateUblXml expects (ReInvoice-like)
        const invoiceLike: any = { ...inv };
        const linesLike: any[] = lines.map(l => ({
          ...l,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          vatRate: l.vatRate,
        }));
        const xmlContent = generateUblXml(invoiceLike, linesLike, tenantData);
        const { uploadInvoiceToSPV } = await import("./anafApi");
        // uploadInvoiceToSPV works on reInvoices; we need a version for emittedInvoices
        // We'll do the upload inline here and update emittedInvoices directly
        const { integrations } = await import("../drizzle/schema");
        const [intg] = await db
          .select()
          .from(integrations)
          .where(
            and(
              eq(integrations.tenantId, (ctx.user?.tenantId || 1)),
              eq(integrations.provider, "spv"),
              eq(integrations.status, "active")
            )
          );
        if (!intg?.apiKey)
          return {
            success: false,
            error: "SPV nu este conectat sau token lipsă.",
          };
        const cui = (tenantData.cui || "").replace(/\D/g, "");
        if (!cui) {
          return {
            success: false,
            error: "CUI-ul companiei este invalid sau lipsește.",
          };
        }
        const uploadUrl = `https://api.anaf.ro/prod/FCTEL/rest/upload?standard=UBL&cif=${cui}`;
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${intg.apiKey}`,
            "Content-Type": "application/xml",
          },
          body: xmlContent,
        });
        const responseText = await response.text();
        console.log(`[SPV Upload Emitted] Invoice ${input.id} Response:`, responseText);
        
        let spvIndex: string | null = null;
        const indexTagMatch = responseText.match(/<index_incarcare>(\d+)<\/index_incarcare>/i);
        const indexAttrMatch = responseText.match(/index_incarcare=["'](\d+)["']/i);
        
        if (indexTagMatch && indexTagMatch[1]) spvIndex = indexTagMatch[1];
        else if (indexAttrMatch && indexAttrMatch[1]) spvIndex = indexAttrMatch[1];

        if (spvIndex) {
          await db
            .update(emittedInvoices)
            .set({
              spvIndex: spvIndex,
              spvStatus: "in_procesare",
              spvSentAt: new Date(),
              rawXml: xmlContent,
            })
            .where(eq(emittedInvoices.id, input.id));
          return { success: true, index_incarcare: spvIndex };
        } else {
          const errMatch =
            responseText.match(/errorMessage=["'](.*?)["']/i) ||
            responseText.match(/<Errors[^>]*>([\s\S]*?)<\/Errors>/i) ||
            responseText.match(/<eroare>(.*?)<\/eroare>/i);
          const errMsg = errMatch?.[1]?.trim() || responseText;
          await db
            .update(emittedInvoices)
            .set({ spvStatus: "eroare", spvError: errMsg, spvSentAt: new Date(), rawXml: xmlContent })
            .where(eq(emittedInvoices.id, input.id));
          return { success: false, error: errMsg };
        }
      }),

    checkSpvStatus: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { emittedInvoices, integrations } = await import("../drizzle/schema");
        const [inv] = await db
          .select()
          .from(emittedInvoices)
          .where(
            and(
              eq(emittedInvoices.id, input.id),
              eq(emittedInvoices.tenantId, (ctx.user?.tenantId || 1))
            )
          );
        if (!inv) throw new Error("Factura nu a fost găsită");
        if (!inv.spvIndex) throw new Error("Factura nu are index SPV. Trimite-o mai întâi.");

        const [intg] = await db
          .select()
          .from(integrations)
          .where(
            and(
              eq(integrations.tenantId, (ctx.user?.tenantId || 1)),
              eq(integrations.provider, "spv"),
              eq(integrations.status, "active")
            )
          );
        if (!intg?.apiKey) throw new Error("SPV nu este conectat.");

        const statusUrl = `https://api.anaf.ro/prod/FCTEL/rest/stareMesaj?id_incarcare=${inv.spvIndex}`;
        const resp = await fetch(statusUrl, {
          headers: { Authorization: `Bearer ${intg.apiKey}` },
          signal: AbortSignal.timeout(15000),
        });
        const text = await resp.text();
        console.log(`[SPV Status] Invoice ${input.id} index ${inv.spvIndex}:`, text);

        // ANAF returns XML: <header stare="ok|nok|in prelucrare" id_descarcare="..." />
        // Must parse XML attributes, NOT tags
        let stare = "";
        let errors: string[] = [];
        let idDescarcare = "";

        try {
          // Try JSON first (older ANAF responses)
          const json = JSON.parse(text);
          stare = json.stare || json.Stare || "";
          if (json.Erori && Array.isArray(json.Erori)) {
            errors = json.Erori.map((e: any) => e.errorMessage || e.message || String(e));
          }
        } catch {
          // Parse XML attributes
          const stareAttr = text.match(/stare="([^"]+)"/i);
          if (stareAttr) stare = stareAttr[1];
          const idDescAttr = text.match(/id_descarcare="([^"]+)"/i);
          if (idDescAttr) idDescarcare = idDescAttr[1];
        }

        // If nok and we have id_descarcare, download error details ZIP and extract error messages
        if (stare.toLowerCase() === "nok" && idDescarcare) {
          try {
            const AdmZip = (await import("adm-zip")).default;
            const errResp = await fetch(
              `https://api.anaf.ro/prod/FCTEL/rest/descarcare?id=${idDescarcare}`,
              { headers: { Authorization: `Bearer ${intg.apiKey}` }, signal: AbortSignal.timeout(15000) }
            );
            const buf = Buffer.from(await errResp.arrayBuffer());
            console.log(`[SPV Error Details] ${idDescarcare}: ${buf.length} bytes, first4=${buf.slice(0,4).toString("hex")}`);

            let errXml = "";
            if (buf.slice(0,4).toString("hex") === "504b0304") {
              // It's a ZIP — extract XML
              const zip = new AdmZip(buf);
              const xmlEntry = zip.getEntries().find(e =>
                e.entryName.toLowerCase().endsWith(".xml") &&
                !e.entryName.toLowerCase().includes("semnatura")
              );
              if (xmlEntry) errXml = xmlEntry.getData().toString("utf8");
            } else {
              errXml = buf.toString("utf8");
            }

            console.log(`[SPV Error XML] ${idDescarcare}:`, errXml.slice(0, 600));

            // Extract error messages from ANAF error XML
            // Format: <Error errorMessage="..."/> or <eroare>...</eroare>
            const errMsgMatches = [...errXml.matchAll(/errorMessage="([^"]+)"/gi)];
            for (const m of errMsgMatches) errors.push(m[1]);
            const descMatches = [...errXml.matchAll(/descriere="([^"]+)"/gi)];
            for (const m of descMatches) errors.push(m[1]);
            if (!errors.length) {
              const tagMatches = [...errXml.matchAll(/<eroare[^>]*>([^<]+)<\/eroare>/gi)];
              for (const m of tagMatches) errors.push(m[1]);
            }
            if (!errors.length) {
              errors.push("Factura a fost respinsă de ANAF. Intră în portalul SPV pentru detalii.");
            }
          } catch (e: any) {
            console.warn("[SPV Error Details] Failed:", e.message);
            errors.push("Factura a fost respinsă de ANAF. Intră în portalul SPV pentru detalii.");
          }
        }

        // Map ANAF stare to internal status
        const normalized = stare.toLowerCase();
        let newStatus: string = inv.spvStatus || "in_procesare";
        if (normalized === "ok") newStatus = "validat";
        else if (normalized.includes("prelucrare") || normalized.includes("procesare")) newStatus = "in_procesare";
        else if (normalized === "nok") newStatus = "eroare";

        // Update DB
        await db
          .update(emittedInvoices)
          .set({
            spvStatus: newStatus as any,
            spvError: errors.length > 0 ? errors.join("; ") : (newStatus === "eroare" ? stare : null),
          })
          .where(eq(emittedInvoices.id, input.id));

        return {
          status: newStatus,
          stare,
          errors,
          raw: text.slice(0, 500),
        };
      }),
  }),

  // ─── SPV Logs Router ──────────────────────────────────────────────────────────
  spvLogs: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      
      const db = await getDb();
      if (!db) throw new Error("No DB");
      const { emittedInvoices, reInvoices, invoiceArchive } = await import("../drizzle/schema");
      const { eq, and, desc } = await import("drizzle-orm");

      // 1. Fetch Emitted Invoices
      const emitted = await db
        .select()
        .from(emittedInvoices)
        .where(eq(emittedInvoices.tenantId, (ctx.user?.tenantId || 1)))
        .orderBy(desc(emittedInvoices.createdAt));

      // 2. Fetch Re-Invoices
      const reInvs = await db
        .select()
        .from(reInvoices)
        .where(eq(reInvoices.tenantId, (ctx.user?.tenantId || 1)))
        .orderBy(desc(reInvoices.createdAt));

      // 3. Fetch Received (Archive)
      const archive = await db
        .select()
        .from(invoiceArchive)
        .where(
          and(
            eq(invoiceArchive.tenantId, (ctx.user?.tenantId || 1)),
            eq(invoiceArchive.direction, "in")
          )
        )
        .orderBy(desc(invoiceArchive.createdAt));

      const logs = [
        ...emitted.filter(i => i.spvIndex).map(i => ({
          id: `emitted-${i.id}`,
          type: "trimisa" as const,
          invoiceNumber: i.number,
          partnerName: i.clientName,
          total: i.total,
          currency: i.currency,
          date: i.spvSentAt || i.updatedAt || i.createdAt,
          issueDate: i.issueDate,
          spvIndex: i.spvIndex,
          spvStatus: i.spvStatus,
          spvError: i.spvError,
          originalId: i.id,
          sourceType: "emittedInvoice"
        })),
        ...reInvs.filter(i => i.spvIndex).map(i => ({
          id: `reinv-${i.id}`,
          type: "trimisa" as const,
          invoiceNumber: i.number,
          partnerName: i.clientName,
          total: i.total,
          currency: i.currency,
          date: i.spvSentAt || i.updatedAt || i.createdAt,
          issueDate: i.issueDate,
          spvIndex: i.spvIndex,
          spvStatus: i.spvStatus,
          spvError: i.spvError,
          originalId: i.id,
          sourceType: "reInvoice"
        })),
        ...archive.filter(i => i.fileName && i.fileName.startsWith("SPV_")).map(i => {
          const match = i.fileName?.match(/SPV_(\d+)/);
          const spvIdx = match ? match[1] : null;
          return {
            id: `archive-${i.id}`,
            type: "primita" as const,
            invoiceNumber: i.invoiceNumber || "-",
            partnerName: i.supplierName || "Necunoscut",
            total: i.total ? String(i.total) : "0",
            currency: i.currency || "RON",
            date: i.createdAt,
            issueDate: i.issueDate,
            spvIndex: spvIdx,
            spvStatus: "validat" as const, // primite sunt mereu validate
            spvError: null,
            originalId: i.id,
            sourceType: "invoiceArchive"
          };
        })
      ];

      return logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }),
  }),
  // ─── GDPR Router ──────────────────────────────────────────────────────────────
  gdpr: router({
    exportData: protectedProcedure.mutation(async ({ ctx }) => {
      
      const db = await getDb();
      if (!db) throw new Error("No DB");
      
      const { emittedInvoices, clients, invoiceArchive, users } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const myInvoices = await db.select().from(emittedInvoices).where(eq(emittedInvoices.tenantId, (ctx.user?.tenantId || 1)));
      const myClients = await db.select().from(clients).where(eq(clients.tenantId, (ctx.user?.tenantId || 1)));
      const myArchive = await db.select().from(invoiceArchive).where(eq(invoiceArchive.tenantId, (ctx.user?.tenantId || 1)));
      const myUser = await db.select().from(users).where(eq(users.id, ctx.user.id));

      const exportData = {
        user: myUser[0],
        clients: myClients,
        emittedInvoices: myInvoices,
        invoiceArchive: myArchive,
        exportedAt: new Date().toISOString()
      };

      return exportData;
    }),

    deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user?.id) throw new Error("Not logged in");
      const db = await getDb();
      if (!db) throw new Error("No DB");
      
      const { users, userTenants } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      // We only delete the user link to respect fiscal laws for the tenant's invoices.
      // Soft delete or anonymize user
      // 1. Remove user from userTenants to revoke access
      await db.delete(userTenants).where(eq(userTenants.userId, ctx.user.id));
      
      // 2. Anonymize user details to keep DB integrity if constraints exist, or delete if safe.
      // In Drizzle, deleting the user might cascade or fail. Let's try to delete.
      await db.delete(users).where(eq(users.id, ctx.user.id));

      return { success: true };
    }),
  }),

  // ─── NIR Router ───────────────────────────────────────────────────────────────
  nir: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      
      const db = await getDb();
      if (!db) throw new Error("No DB");
      const { nir } = await import("../drizzle/schema");
      return db
        .select()
        .from(nir)
        .where(eq(nir.tenantId, (ctx.user?.tenantId || 1)))
        .orderBy(desc(nir.createdAt));
    }),

    listWithLines: protectedProcedure.query(async ({ ctx }) => {
      
      const db = await getDb();
      if (!db) throw new Error("No DB");
      const { nir, nirLines } = await import("../drizzle/schema");
      
      const nirs = await db
        .select()
        .from(nir)
        .where(eq(nir.tenantId, (ctx.user?.tenantId || 1)))
        .orderBy(desc(nir.createdAt));
        
      if (nirs.length === 0) return [];
      
      const lines = await db
        .select()
        .from(nirLines)
        .where(inArray(nirLines.nirId, nirs.map(n => n.id)));
        
      const linesByNirId = lines.reduce((acc, l) => {
        if (!acc[l.nirId]) acc[l.nirId] = [];
        acc[l.nirId].push(l);
        return acc;
      }, {} as Record<number, any[]>);
      
      return nirs.map(n => ({
        ...n,
        lines: linesByNirId[n.id] || []
      }));
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { nir, nirLines } = await import("../drizzle/schema");
        const [nirRow] = await db
          .select()
          .from(nir)
          .where(
            and(eq(nir.id, input.id), eq(nir.tenantId, (ctx.user?.tenantId || 1)))
          );
        if (!nirRow) throw new Error("NIR not found");
        const lines = await db
          .select()
          .from(nirLines)
          .where(eq(nirLines.nirId, input.id))
          .orderBy(nirLines.lineOrder);
        return { ...nirRow, lines };
      }),

    getNextNumber: protectedProcedure.query(async ({ ctx }) => {
      
      const db = await getDb();
      if (!db) throw new Error("No DB");
      const { nir } = await import("../drizzle/schema");
      const year = new Date().getFullYear();
      const last = await db
        .select({ nirNumber: nir.nirNumber })
        .from(nir)
        .where(eq(nir.tenantId, (ctx.user?.tenantId || 1)))
        .orderBy(desc(nir.id))
        .limit(1);
      let nextNum = 1;
      if (last[0]?.nirNumber) {
        const match = last[0].nirNumber.match(/(\d+)$/);
        if (match) nextNum = parseInt(match[1]) + 1;
      }
      return `NIR-${year}-${String(nextNum).padStart(4, "0")}`;
    }),

    consumeLine: protectedProcedure
      .input(
        z.object({
          lines: z.array(
            z.object({
              nirLineId: z.number(),
              qty: z.number(),
            })
          ),
        })
      )
      .mutation(async ({ input, ctx }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { nirLines } = await import("../drizzle/schema");
        const { eq, sql } = await import("drizzle-orm");

        for (const line of input.lines) {
          // Increment the consumedQty by the amount consumed
          await db
            .update(nirLines)
            .set({
              consumedQty: sql`${nirLines.consumedQty} + ${line.qty.toFixed(2)}`,
            })
            .where(eq(nirLines.id, line.nirLineId));
        }
        return { success: true };
      }),

    createFromInvoice: protectedProcedure
      .input(
        z.object({
          invoiceArchiveId: z.number().optional(),
          nirNumber: z.string().optional(),
          invoiceNumber: z.string().optional(),
          avizNumber: z.string().optional(),
          supplierName: z.string().optional(),
          supplierCUI: z.string().optional(),
          supplierAddress: z.string().optional(),
          gestiune: z.string().optional(),
          receiptDate: z.string(),
          member1Name: z.string().optional(),
          member1Function: z.string().optional(),
          member2Name: z.string().optional(),
          member2Function: z.string().optional(),
          member3Name: z.string().optional(),
          member3Function: z.string().optional(),
          hasDifferences: z.number().optional(),
          differenceNotes: z.string().optional(),
          notes: z.string().optional(),
          accountingType: z.string().optional(),
          accountingAccount: z.string().optional(),
          lines: z.array(
            z.object({
              description: z.string(),
              unit: z.string().optional(),
              cantitateComanda: z.string(),
              cantitateReceptionata: z.string(),
              unitPrice: z.string().optional(),
              vatRate: z.string().optional(),
              total: z.string().optional(),
              observations: z.string().optional(),
              accountingType: z.string().optional(),
              accountingAccount: z.string().optional(),
              lineOrder: z.number().optional(),
              sagaArticleId: z.number().optional(),
            })
          ),
        })
      )
      .mutation(async ({ input, ctx }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { nir, nirLines } = await import("../drizzle/schema");
        const { sagaIntrari, sagaIntrariLinii, sagaArticles } = await import("../modules/saga/schema");
        const { desc, eq, inArray } = await import("drizzle-orm");

        // 1. Auto-assign NIR if empty
        let finalNirNumber = input.nirNumber;
        if (!finalNirNumber || finalNirNumber.trim() === "") {
          const year = new Date().getFullYear();
          const last = await db
            .select({ nirNumber: nir.nirNumber })
            .from(nir)
            .where(eq(nir.tenantId, (ctx.user?.tenantId || 1)))
            .orderBy(desc(nir.id))
            .limit(1);
          let nextNum = 1;
          if (last[0]?.nirNumber) {
            const match = last[0].nirNumber.match(/(\d+)$/);
            if (match) nextNum = parseInt(match[1]) + 1;
          }
          finalNirNumber = `NIR-${year}-${String(nextNum).padStart(4, "0")}`;
        }

        // 2. Insert into main NIR table
        const [result] = await db.insert(nir).values({
          tenantId: (ctx.user?.tenantId || 1),
          nirNumber: finalNirNumber,
          invoiceArchiveId: input.invoiceArchiveId,
          invoiceNumber: input.invoiceNumber,
          avizNumber: input.avizNumber,
          supplierName: input.supplierName,
          supplierCUI: input.supplierCUI,
          supplierAddress: input.supplierAddress,
          gestiune: input.gestiune,
          receiptDate: input.receiptDate,
          member1Name: input.member1Name,
          member1Function: input.member1Function,
          member2Name: input.member2Name,
          member2Function: input.member2Function,
          member3Name: input.member3Name,
          member3Function: input.member3Function,
          hasDifferences: input.hasDifferences ?? 0,
          differenceNotes: input.differenceNotes,
          notes: input.notes,
          accountingType: input.accountingType,
          accountingAccount: input.accountingAccount,
          status: "draft",
        });
        const nirId = (result as any).insertId;

        // 3. Insert into nirLines
        if (input.lines.length > 0) {
          await db.insert(nirLines).values(
            input.lines.map((l, idx) => ({
              nirId,
              description: l.description,
              unit: l.unit || "buc",
              cantitateComanda: l.cantitateComanda,
              cantitateReceptionata: l.cantitateReceptionata,
              unitPrice: l.unitPrice,
              vatRate: l.vatRate,
              total: l.total,
              observations: l.observations,
              accountingType: l.accountingType || "Marfa",
              accountingAccount: l.accountingAccount || "371",
              lineOrder: l.lineOrder ?? idx,
              sagaArticleId: l.sagaArticleId,
            }))
          );
        }

        // 4. Create in sagaIntrari so it shows in the Saga module
        let totalValoare = 0;
        let totalTvaSuma = 0;
        
        input.lines.forEach(l => {
          totalValoare += parseFloat(l.total || "0");
          totalTvaSuma += (parseFloat(l.total || "0") * parseFloat(l.vatRate || "19")) / 100;
        });

        const [sagaIntResult] = await db.insert(sagaIntrari).values({
          tenantId: ctx.user?.tenantId || 1,
          tip: "Factura",
          nrDoc: input.invoiceNumber || finalNirNumber,
          numeFurnizor: input.supplierName,
          cuiFurnizor: input.supplierCUI,
          data: input.receiptDate,
          scadent: input.receiptDate,
          valoare: totalValoare.toString(),
          tva: totalTvaSuma.toString(),
          total: (totalValoare + totalTvaSuma).toString(),
          neachitat: (totalValoare + totalTvaSuma).toString(),
          nirId: nirId,
          status: "draft",
        });
        const intrareId = (sagaIntResult as any).insertId;

        if (input.lines.length > 0) {
          // Preload articles to get codes
          const articleIds = input.lines.map(l => l.sagaArticleId).filter(Boolean) as number[];
          const loadedArticles = articleIds.length > 0 
            ? await db.select().from(sagaArticles).where(inArray(sagaArticles.id, articleIds))
            : [];

          await db.insert(sagaIntrariLinii).values(
            input.lines.map((l, idx) => {
              const art = loadedArticles.find(a => a.id === l.sagaArticleId);
              const val = parseFloat(l.total || "0");
              const tva = (val * parseFloat(l.vatRate || "19")) / 100;
              return {
                intrareId,
                tip: l.accountingType || "Marfa",
                articolId: l.sagaArticleId,
                cod: art?.code || undefined,
                denumire: l.description,
                um: l.unit || "buc",
                tvaPercent: l.vatRate || "19",
                cantitate: l.cantitateReceptionata,
                pretUnitar: l.unitPrice || "0",
                valoare: val.toString(),
                tvaSuma: tva.toString(),
                total: (val + tva).toString(),
                cont: l.accountingAccount || "371",
                lineOrder: l.lineOrder ?? idx,
              };
            })
          );
        }

        return { id: nirId, nirNumber: finalNirNumber };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          receiptDate: z.string().optional(),
          avizNumber: z.string().optional(),
          gestiune: z.string().optional(),
          supplierAddress: z.string().optional(),
          member1Name: z.string().optional(),
          member1Function: z.string().optional(),
          member2Name: z.string().optional(),
          member2Function: z.string().optional(),
          member3Name: z.string().optional(),
          member3Function: z.string().optional(),
          hasDifferences: z.number().optional(),
          differenceNotes: z.string().optional(),
          notes: z.string().optional(),
          accountingType: z.string().optional(),
          accountingAccount: z.string().optional(),
          status: z.enum(["draft", "finalizat"]).optional(),
          lines: z
            .array(
              z.object({
                id: z.number().optional(),
                description: z.string(),
                unit: z.string().optional(),
                cantitateComanda: z.string(),
                cantitateReceptionata: z.string(),
                unitPrice: z.string().optional(),
                vatRate: z.string().optional(),
                total: z.string().optional(),
                observations: z.string().optional(),
                accountingType: z.string().optional(),
                accountingAccount: z.string().optional(),
                lineOrder: z.number().optional(),
                sagaArticleId: z.number().optional(),
              })
            )
            .optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { nir, nirLines } = await import("../drizzle/schema");
        const { id, lines, ...updateData } = input;
        const filtered: any = {};
        const fields = [
          "receiptDate",
          "avizNumber",
          "gestiune",
          "supplierAddress",
          "member1Name",
          "member1Function",
          "member2Name",
          "member2Function",
          "member3Name",
          "member3Function",
          "hasDifferences",
          "differenceNotes",
          "notes",
          "accountingType",
          "accountingAccount",
          "status",
        ] as const;
        for (const f of fields) {
          if ((updateData as any)[f] !== undefined)
            filtered[f] = (updateData as any)[f];
        }
        if (Object.keys(filtered).length > 0) {
          await db
            .update(nir)
            .set(filtered)
            .where(and(eq(nir.id, id), eq(nir.tenantId, (ctx.user?.tenantId || 1))));
        }
        if (lines) {
          await db.delete(nirLines).where(eq(nirLines.nirId, id));
          if (lines.length > 0) {
            await db.insert(nirLines).values(
              lines.map((l, idx) => ({
                nirId: id,
                description: l.description,
                unit: l.unit || "buc",
                cantitateComanda: l.cantitateComanda,
                cantitateReceptionata: l.cantitateReceptionata,
                unitPrice: l.unitPrice,
                vatRate: l.vatRate,
                total: l.total,
                observations: l.observations,
                accountingType: l.accountingType || "Marfa",
                accountingAccount: l.accountingAccount || "371",
                lineOrder: l.lineOrder ?? idx,
                sagaArticleId: l.sagaArticleId,
              }))
            );
          }
          
          // Also sync to sagaIntrari
          const { sagaIntrari, sagaIntrariLinii, sagaArticles } = await import("../modules/saga/schema");
          const { inArray } = await import("drizzle-orm");
          
          const existingSagaIntrari = await db.select().from(sagaIntrari).where(eq(sagaIntrari.nirId, id));
          if (existingSagaIntrari.length > 0) {
            const intrareId = existingSagaIntrari[0].id;
            let totalValoare = 0;
            let totalTvaSuma = 0;
            lines.forEach(l => {
              totalValoare += parseFloat(l.total || "0");
              totalTvaSuma += (parseFloat(l.total || "0") * parseFloat(l.vatRate || "19")) / 100;
            });
            
            await db.update(sagaIntrari).set({
              valoare: totalValoare.toString(),
              tva: totalTvaSuma.toString(),
              total: (totalValoare + totalTvaSuma).toString(),
              neachitat: (totalValoare + totalTvaSuma).toString(),
            }).where(eq(sagaIntrari.id, intrareId));
            
            await db.delete(sagaIntrariLinii).where(eq(sagaIntrariLinii.intrareId, intrareId));
            
            if (lines.length > 0) {
              const articleIds = lines.map(l => l.sagaArticleId).filter(Boolean) as number[];
              const loadedArticles = articleIds.length > 0 
                ? await db.select().from(sagaArticles).where(inArray(sagaArticles.id, articleIds))
                : [];
                
              await db.insert(sagaIntrariLinii).values(
                lines.map((l, idx) => {
                  const art = loadedArticles.find(a => a.id === l.sagaArticleId);
                  const val = parseFloat(l.total || "0");
                  const tva = (val * parseFloat(l.vatRate || "19")) / 100;
                  return {
                    intrareId,
                    tip: l.accountingType || "Marfa",
                    articolId: l.sagaArticleId,
                    cod: art?.code || undefined,
                    denumire: l.description,
                    um: l.unit || "buc",
                    tvaPercent: l.vatRate || "19",
                    cantitate: l.cantitateReceptionata,
                    pretUnitar: l.unitPrice || "0",
                    valoare: val.toString(),
                    tvaSuma: tva.toString(),
                    total: (val + tva).toString(),
                    cont: l.accountingAccount || "371",
                    lineOrder: l.lineOrder ?? idx,
                  };
                })
              );
            }
          }
        }
        return { success: true };
      }),

    finalize: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { nir } = await import("../drizzle/schema");
        await db
          .update(nir)
          .set({ status: "finalizat" })
          .where(
            and(eq(nir.id, input.id), eq(nir.tenantId, (ctx.user?.tenantId || 1)))
          );
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { nir, nirLines } = await import("../drizzle/schema");
        await db.delete(nirLines).where(eq(nirLines.nirId, input.id));
        await db
          .delete(nir)
          .where(
            and(eq(nir.id, input.id), eq(nir.tenantId, (ctx.user?.tenantId || 1)))
          );
        return { success: true };
      }),
  }),

  // =========================================================================
  // CATALOG E-DEVIZE
  // =========================================================================
  edevize: router({
    search: protectedProcedure
      .input(
        z.object({
          query: z.string().optional(),
          limit: z.number().optional().default(50),
          offset: z.number().optional().default(0),
        })
      )
      .query(({ input }) => {
        // Normalizare: scoate diacritice, lowercase
        const norm = (s: string) =>
          s
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[șş]/g, "s")
            .replace(/[țţ]/g, "t")
            .replace(/[ăâ]/g, "a")
            .replace(/î/g, "i");

        // Distanta Levenshtein pentru fuzzy matching
        const levenshtein = (a: string, b: string): number => {
          const m = a.length,
            n = b.length;
          if (m === 0) return n;
          if (n === 0) return m;
          const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
            Array.from({ length: n + 1 }, (_, j) =>
              i === 0 ? j : j === 0 ? i : 0
            )
          );
          for (let i = 1; i <= m; i++)
            for (let j = 1; j <= n; j++)
              dp[i][j] =
                a[i - 1] === b[j - 1]
                  ? dp[i - 1][j - 1]
                  : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
          return dp[m][n];
        };

        // Verifica daca un cuvant din query se gaseste fuzzy in haystack
        const fuzzyWordMatch = (
          word: string,
          haystack: string
        ): { match: boolean; score: number } => {
          // Match exact substring - cel mai bun
          if (haystack.includes(word)) return { match: true, score: 3 };
          // Cauta in fiecare cuvant din haystack
          const hWords = haystack.split(/\s+/);
          for (const hw of hWords) {
            if (hw.length < 3) continue;
            // Permite o eroare pentru cuvinte scurte, doua pentru lungi
            const maxDist = word.length <= 4 ? 1 : word.length <= 7 ? 2 : 3;
            if (levenshtein(word, hw) <= maxDist)
              return { match: true, score: 1 };
            // Verifica si prefix (word e prefix al hw)
            if (
              hw.startsWith(word) ||
              word.startsWith(hw.substring(0, word.length))
            )
              return { match: true, score: 2 };
          }
          return { match: false, score: 0 };
        };

        let results = _edevizeCache.map(r => ({ ...r, _score: 0 }));

        if (input.query && input.query.trim()) {
          const words = norm(input.query)
            .split(/\s+/)
            .filter(w => w.length >= 1);

          results = results
            .map(r => {
              const haystack = norm(r.cod + " " + r.denumire);
              let totalScore = 0;
              let allMatch = true;

              for (const word of words) {
                const { match, score } = fuzzyWordMatch(word, haystack);
                if (match) {
                  totalScore += score;
                } else {
                  allMatch = false;
                  break;
                }
              }

              return { ...r, _score: allMatch ? totalScore : -1 };
            })
            .filter(r => r._score >= 0)
            .sort((a, b) => b._score - a._score);
        }

        const totalCount = results.length;
        const items = results
          .slice(input.offset, input.offset + input.limit)
          .map(({ _score, ...r }) => r);
        return { items, totalCount };
      }),
  }),

  // =========================================================================
  // DEVIZE
  // =========================================================================
  devize: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      
      const db = await getDb();
      if (!db) throw new Error("No DB");
      const { devize } = await import("../drizzle/schema");
      return await db
        .select()
        .from(devize)
        .where(eq(devize.tenantId, (ctx.user?.tenantId || 1)))
        .orderBy(desc(devize.id));
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { devize, devizeLines } = await import("../drizzle/schema");

        const [deviz] = await db
          .select()
          .from(devize)
          .where(
            and(eq(devize.id, input.id), eq(devize.tenantId, (ctx.user?.tenantId || 1)))
          );
        if (!deviz) throw new Error("Not found");

        const lines = await db
          .select()
          .from(devizeLines)
          .where(eq(devizeLines.devizId, deviz.id))
          .orderBy(devizeLines.lineOrder);

        return { deviz, lines };
      }),

    getByInvoiceId: protectedProcedure
      .input(z.object({ invoiceId: z.number() }))
      .query(async ({ input, ctx }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { devize, devizeLines } = await import("../drizzle/schema");

        const [deviz] = await db
          .select()
          .from(devize)
          .where(
            and(
              eq(devize.invoiceId, input.invoiceId),
              eq(devize.tenantId, (ctx.user?.tenantId || 1))
            )
          );
        if (!deviz) return null;

        const lines = await db
          .select()
          .from(devizeLines)
          .where(eq(devizeLines.devizId, deviz.id))
          .orderBy(devizeLines.lineOrder);

        return { deviz, lines };
      }),

    create: protectedProcedure
      .input(
        z.object({
          number: z.string(),
          date: z.string(),
          invoiceId: z.number().optional(),
          notes: z.string().optional(),
          lines: z.array(
            z.object({
              type: z.enum(["MATERIAL", "MANOPERA", "UTILAJ", "NORMA"]),
              code: z.string().optional(),
              description: z.string(),
              quantity: z.number(),
              unitPrice: z.number(),
            })
          ),
        })
      )
      .mutation(async ({ input, ctx }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { devize, devizeLines } = await import("../drizzle/schema");

        let totalMaterials = 0;
        let totalLabor = 0;
        let total = 0;

        for (const line of input.lines) {
          const lTotal = line.quantity * line.unitPrice;
          total += lTotal;
          if (line.type === "MATERIAL") totalMaterials += lTotal;
          if (line.type === "MANOPERA" || line.type === "NORMA")
            totalLabor += lTotal;
        }

        const [insertResult] = await db.insert(devize).values({
          tenantId: (ctx.user?.tenantId || 1),
          number: input.number,
          date: new Date(input.date),
          invoiceId: input.invoiceId,
          totalMaterials: totalMaterials.toFixed(2),
          totalLabor: totalLabor.toFixed(2),
          total: total.toFixed(2),
          notes: input.notes,
          status: "final",
        });

        const devizId = insertResult.insertId;

        if (input.lines.length > 0) {
          await db.insert(devizeLines).values(
            input.lines.map((l, idx) => ({
              devizId,
              type: l.type,
              code: l.code || null,
              description: l.description,
              quantity: l.quantity.toFixed(2),
              unitPrice: l.unitPrice.toFixed(2),
              total: (l.quantity * l.unitPrice).toFixed(2),
              lineOrder: idx,
            }))
          );
        }
        return { id: devizId };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          notes: z.string().optional(),
          lines: z.array(
            z.object({
              type: z.enum(["MATERIAL", "MANOPERA", "UTILAJ", "NORMA"]),
              code: z.string().nullable().optional(),
              description: z.string(),
              quantity: z.number(),
              unitPrice: z.number(),
            })
          ),
        })
      )
      .mutation(async ({ input, ctx }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { devize, devizeLines } = await import("../drizzle/schema");

        let totalMaterials = 0;
        let totalLabor = 0;
        let total = 0;
        for (const line of input.lines) {
          const lTotal = line.quantity * line.unitPrice;
          total += lTotal;
          if (line.type === "MATERIAL") totalMaterials += lTotal;
          if (line.type === "MANOPERA" || line.type === "NORMA")
            totalLabor += lTotal;
        }

        await db
          .update(devize)
          .set({
            totalMaterials: totalMaterials.toFixed(2),
            totalLabor: totalLabor.toFixed(2),
            total: total.toFixed(2),
            notes: input.notes,
          })
          .where(
            and(eq(devize.id, input.id), eq(devize.tenantId, (ctx.user?.tenantId || 1)))
          );

        await db.delete(devizeLines).where(eq(devizeLines.devizId, input.id));
        if (input.lines.length > 0) {
          await db.insert(devizeLines).values(
            input.lines.map((l, idx) => ({
              devizId: input.id,
              type: l.type,
              code: l.code || null,
              description: l.description,
              quantity: l.quantity.toFixed(2),
              unitPrice: l.unitPrice.toFixed(2),
              total: (l.quantity * l.unitPrice).toFixed(2),
              lineOrder: idx,
            }))
          );
        }
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { devize, devizeLines } = await import("../drizzle/schema");
        await db.delete(devizeLines).where(eq(devizeLines.devizId, input.id));
        await db
          .delete(devize)
          .where(
            and(eq(devize.id, input.id), eq(devize.tenantId, (ctx.user?.tenantId || 1)))
          );
        return { success: true };
      }),
  }),

  // =========================================================================
  // INVENTORY (GESTIUNE STOCURI)
  // =========================================================================
  inventory: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      
      const db = await getDb();
      if (!db) throw new Error("No DB");
      const { nir, nirLines } = await import("../drizzle/schema");
      const { eq, sql } = await import("drizzle-orm");

      // We want to fetch all nirLines joined with nir, where available quantity > 0
      // Available quantity is cantitateReceptionata - consumedQty
      const rows = await db
        .select({
          lineId: nirLines.id,
          nirId: nir.id,
          description: nirLines.description,
          supplierName: nir.supplierName,
          receiptDate: nir.receiptDate,
          nirNumber: nir.nirNumber,
          gestiune: nir.gestiune,
          unit: nirLines.unit,
          unitPrice: nirLines.unitPrice,
          vatRate: nirLines.vatRate,
          initialQty: nirLines.cantitateReceptionata,
          consumedQty: nirLines.consumedQty,
        })
        .from(nirLines)
        .innerJoin(nir, eq(nir.id, nirLines.nirId))
        .where(
          sql`${nir.tenantId} = ${(ctx.user?.tenantId || 1)} AND ${nirLines.cantitateReceptionata} > ${nirLines.consumedQty}`
        )
        .orderBy(sql`${nir.receiptDate} DESC`);
        
      return rows.map(r => ({
        ...r,
        availableQty: Number(r.initialQty) - Number(r.consumedQty)
      }));
    }),
  }),

  // =========================================================================
  // BONURI CONSUM
  // =========================================================================
  bonuriConsum: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      
      const db = await getDb();
      if (!db) throw new Error("No DB");
      const { bonuriConsum } = await import("../drizzle/schema");
      return await db
        .select()
        .from(bonuriConsum)
        .where(eq(bonuriConsum.tenantId, (ctx.user?.tenantId || 1)))
        .orderBy(desc(bonuriConsum.id));
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { bonuriConsum, bonuriConsumLines } =
          await import("../drizzle/schema");

        const [bon] = await db
          .select()
          .from(bonuriConsum)
          .where(
            and(
              eq(bonuriConsum.id, input.id),
              eq(bonuriConsum.tenantId, (ctx.user?.tenantId || 1))
            )
          );
        if (!bon) throw new Error("Not found");

        const lines = await db
          .select()
          .from(bonuriConsumLines)
          .where(eq(bonuriConsumLines.bonId, bon.id))
          .orderBy(bonuriConsumLines.lineOrder);

        return { bon, lines };
      }),

    create: protectedProcedure
      .input(
        z.object({
          number: z.string(),
          date: z.string(),
          devizId: z.number().optional(),
          gestiune: z.string().optional(),
          lines: z.array(
            z.object({
              materialCode: z.string().optional(),
              description: z.string(),
              quantity: z.number(),
              unitPrice: z.number(),
            })
          ),
        })
      )
      .mutation(async ({ input, ctx }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { bonuriConsum, bonuriConsumLines } =
          await import("../drizzle/schema");

        const [insertResult] = await db.insert(bonuriConsum).values({
          tenantId: (ctx.user?.tenantId || 1),
          number: input.number,
          date: new Date(input.date),
          devizId: input.devizId,
          gestiune: input.gestiune,
          status: "final",
        });

        const bonId = insertResult.insertId;

        if (input.lines.length > 0) {
          await db.insert(bonuriConsumLines).values(
            input.lines.map((l, idx) => ({
              bonId,
              materialCode: l.materialCode || null,
              description: l.description,
              quantity: l.quantity.toFixed(2),
              unitPrice: l.unitPrice.toFixed(2),
              total: (l.quantity * l.unitPrice).toFixed(2),
              lineOrder: idx,
            }))
          );
        }
        return { id: bonId };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { bonuriConsum, bonuriConsumLines } =
          await import("../drizzle/schema");
        await db
          .delete(bonuriConsumLines)
          .where(eq(bonuriConsumLines.bonId, input.id));
        await db
          .delete(bonuriConsum)
          .where(
            and(
              eq(bonuriConsum.id, input.id),
              eq(bonuriConsum.tenantId, (ctx.user?.tenantId || 1))
            )
          );
        return { success: true };
      }),
  }),

});

export type AppRouter = typeof appRouter;
