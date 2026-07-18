import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { horecaRouter } from "../modules/horeca";
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

export const appRouter = router({
  system: systemRouter,
  horeca: horecaRouter,
  auth: authRouter,

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
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { tenants } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await db
          .update(tenants)
          .set(input)
          .where(eq(tenants.id, ctx.user.tenantId));
        return { success: true };
      }),
  }),

  invoices: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user?.tenantId) throw new Error("No tenant context");
      const db = await getDb();
      if (!db) return [];
      const res = await db
        .select()
        .from(invoiceArchive)
        .where(
          and(
            eq(invoiceArchive.tenantId, ctx.user.tenantId),
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
      if (!ctx.user?.tenantId) throw new Error("No tenant context");
      const db = await getDb();
      if (!db) return [];
      const res = await db
        .select()
        .from(invoiceArchive)
        .where(
          and(
            eq(invoiceArchive.tenantId, ctx.user.tenantId),
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
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        const db = await getDb();
        if (!db) throw new Error("DB not connected");

        const tenantId = ctx.user.tenantId;
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
      if (!ctx.user?.tenantId) throw new Error("No tenant context");
      return getReInvoicesByTenant(ctx.user.tenantId);
    }),
    // Get next available re-invoice number
    nextNumber: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user?.tenantId) throw new Error("No tenant context");
      return getNextReInvoiceNumber(ctx.user.tenantId);
    }),
    // Get a single re-invoice with its lines
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        return getReInvoiceById(input.id, ctx.user.tenantId);
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
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        const number = await getNextReInvoiceNumber(ctx.user.tenantId);

        const res = await createReInvoice({
          tenantId: ctx.user.tenantId,
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
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        const db = await getDb();
        if (!db) throw new Error("No DB");

        // 1. Get invoice and lines
        const invoiceData = await getReInvoiceById(input.id, ctx.user.tenantId);
        if (!invoiceData) throw new Error("Invoice not found");

        // 2. Get tenant
        const { tenants } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const tenantData = await db
          .select()
          .from(tenants)
          .where(eq(tenants.id, ctx.user.tenantId))
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
          ctx.user.tenantId,
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
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        return updateReInvoiceStatus(input.id, ctx.user.tenantId, input.status);
      }),
    // Delete
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        return deleteReInvoice(input.id, ctx.user.tenantId);
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
      if (!ctx.user?.tenantId) throw new Error("No tenant context");
      return getCostCentersByTenant(ctx.user.tenantId);
    }),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          address: z.string().optional(),
          cui: z.string().optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          city: z.string().optional(),
          country: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        return createCostCenter({
          tenantId: ctx.user.tenantId,
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
          email: z.string().email().optional(),
          phone: z.string().optional(),
          city: z.string().optional(),
          country: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        const { id, ...data } = input;
        return updateCostCenter(id, ctx.user.tenantId, data);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        return deleteCostCenter(input.id, ctx.user.tenantId);
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        return getCostCenterById(input.id, ctx.user.tenantId);
      }),
  }),

  clients: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user?.tenantId) throw new Error("No tenant context");
      return getClientsByTenant(ctx.user.tenantId);
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
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        return createClient({
          tenantId: ctx.user.tenantId,
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
          tva: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        const { id, ...data } = input;
        return updateClient(id, ctx.user.tenantId, data);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        return deleteClient(input.id, ctx.user.tenantId);
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        return getClientById(input.id, ctx.user.tenantId);
      }),
    getDetails: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        const client = await getClientById(input.id, ctx.user.tenantId);
        if (!client) throw new Error("Client not found");

        const db = await import("./db").then(m => m.getDb());
        if (!db) throw new Error("DB not available");

        const { eq, or, and } = await import("drizzle-orm");
        const { reInvoices, invoiceArchive } =
          await import("../drizzle/schema");

        // Facturi emise către client
        const sentInvoices = await db
          .select()
          .from(reInvoices)
          .where(
            and(
              eq(reInvoices.tenantId, ctx.user.tenantId),
              eq(reInvoices.clientId, client.id)
            )
          )
          .orderBy(reInvoices.issueDate);

        // Facturi primite de la client (după CUI)
        let receivedInvoices: any[] = [];
        if (client.cui) {
          receivedInvoices = await db
            .select()
            .from(invoiceArchive)
            .where(
              and(
                eq(invoiceArchive.tenantId, ctx.user.tenantId),
                eq(invoiceArchive.supplierCUI, client.cui)
              )
            )
            .orderBy(invoiceArchive.issueDate);
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
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        return getInvoiceArchiveList(ctx.user.tenantId, input ?? {});
      }),

    stats: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user?.tenantId) throw new Error("No tenant context");
      return getInvoiceArchiveStats(ctx.user.tenantId);
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        return getInvoiceArchiveById(input.id, ctx.user.tenantId);
      }),

    getByIds: protectedProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        return getInvoiceArchiveByIds(input.ids, ctx.user.tenantId);
      }),

    getLines: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        const db = await getDb();
        if (!db) return [];
        return db
          .select()
          .from(invoiceArchiveLines)
          .where(eq(invoiceArchiveLines.invoiceArchiveId, input.id));
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
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        return createInvoiceArchiveEntry({
          ...input,
          tenantId: ctx.user.tenantId,
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
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        const { id, ...data } = input;
        return updateInvoiceArchiveEntry(id, ctx.user.tenantId, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        await deleteInvoiceArchiveEntry(input.id, ctx.user.tenantId);
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
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { invoiceArchive } = await import("../drizzle/schema");
        await db
          .update(invoiceArchive)
          .set({ status: input.status })
          .where(
            and(
              eq(invoiceArchive.id, input.id),
              eq(invoiceArchive.tenantId, ctx.user.tenantId)
            )
          );
        return { success: true };
      }),
  }),

  // ─── Integrations Router ─────────────────────────────────────────────────────
  integrations: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user?.tenantId) throw new Error("No tenant context");
      return getIntegrations(ctx.user.tenantId);
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
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        await upsertIntegration(ctx.user.tenantId, input.provider, {
          apiKey: input.apiKey,
          apiSecret: input.apiSecret,
          status: input.status,
        });
        return { success: true };
      }),
    syncOblio: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user?.tenantId) throw new Error("No tenant context");
      const { syncOblioInvoices } = await import("./oblioSync");
      return syncOblioInvoices(ctx.user.tenantId);
    }),
    disconnectOblio: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user?.tenantId) throw new Error("No tenant context");
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { integrations } = await import("../drizzle/schema");
      const { and, eq } = await import("drizzle-orm");
      await db
        .delete(integrations)
        .where(
          and(
            eq(integrations.tenantId, ctx.user.tenantId),
            eq(integrations.provider, "oblio")
          )
        );
      return { success: true };
    }),
    disconnectSpv: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user?.tenantId) throw new Error("No tenant context");
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { integrations } = await import("../drizzle/schema");
      const { and, eq } = await import("drizzle-orm");
      await db
        .delete(integrations)
        .where(
          and(
            eq(integrations.tenantId, ctx.user.tenantId),
            eq(integrations.provider, "spv")
          )
        );
      return { success: true };
    }),
    syncSpvManual: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user?.tenantId) throw new Error("No tenant context");
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { integrations } = await import("../drizzle/schema");
      const { and, eq } = await import("drizzle-orm");
      const [spvIntg] = await db
        .select()
        .from(integrations)
        .where(
          and(
            eq(integrations.tenantId, ctx.user.tenantId),
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
      if (!ctx.user?.tenantId) throw new Error("No tenant context");
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
      authUrl.searchParams.append("state", String(ctx.user.tenantId));
      // Fetch tenant CUI
      const { tenants } = await import("../drizzle/schema");
      const db = await getDb();
      const [tenant] = await db!
        .select({ cui: tenants.cui })
        .from(tenants)
        .where(eq(tenants.id, ctx.user.tenantId));
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
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        const { syncAllSpv } = await import("./spvCron");
        const result = await syncAllSpv(input?.zile || 60);
        return {
          success: true,
          imported: result?.imported || 0,
          limitHit: result?.limitHit || 0,
        };
      }),
    syncSmartBill: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user?.tenantId) throw new Error("No tenant context");
      const { syncSmartBillInvoices } = await import("./smartbillSync");
      return syncSmartBillInvoices(ctx.user.tenantId);
    }),
    // Backfill rawXml for existing SPV invoices
    repopulateXml: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user?.tenantId) throw new Error("No tenant context");
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
            eq(invoiceArchive.tenantId, ctx.user.tenantId),
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
            eq(integrations.tenantId, ctx.user.tenantId),
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
        .where(eq(products.tenantId, ctx.user.tenantId))
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
          tenantId: ctx.user.tenantId,
          name: input.name,
          unit: input.unit || "buc",
          defaultPrice: String(input.defaultPrice || 0),
          defaultVatRate: input.defaultVatRate || 21,
        });
        return { id: result[0].insertId };
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
        .where(eq(emittedInvoices.tenantId, ctx.user.tenantId))
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
              eq(emittedInvoices.tenantId, ctx.user.tenantId)
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

    nextNumber: protectedProcedure
      .input(z.object({ series: z.string().default("FACT") }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { emittedInvoices } = await import("../drizzle/schema");
        const { desc } = await import("drizzle-orm");
        const { sql } = await import("drizzle-orm");
        const last = await db
          .select({ number: emittedInvoices.number })
          .from(emittedInvoices)
          .where(
            and(
              eq(emittedInvoices.tenantId, ctx.user.tenantId),
              sql`${emittedInvoices.series} = ${input.series}`
            )
          )
          .orderBy(desc(emittedInvoices.id))
          .limit(1);
        let nextNum = 1;
        if (last.length > 0) {
          const match = last[0].number.match(/(\d+)$/);
          if (match) nextNum = parseInt(match[1]) + 1;
        }
        return `${input.series}-${String(nextNum).padStart(4, "0")}`;
      }),

    create: protectedProcedure
      .input(
        z.object({
          number: z.string(),
          series: z.string().optional(),
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
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { emittedInvoices, emittedInvoiceLines } =
          await import("../drizzle/schema");
        const { lines, ...invoiceData } = input;
        const [result] = await db
          .insert(emittedInvoices)
          .values({
            tenantId: ctx.user.tenantId,
            ...invoiceData,
            subtotal: String(invoiceData.subtotal),
            totalVAT: String(invoiceData.totalVAT),
            total: String(invoiceData.total),
          } as any)
          .$returningId();
        const invoiceId = result.id;

        let finalInvoiceLines = [...lines];
        const catalogLines = lines.filter(
          l => l.devizType && l.devizType !== "GROUPED_LABOR"
        );

        if (catalogLines.length > 0) {
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
              tenantId: ctx.user.tenantId,
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
                tenantId: ctx.user.tenantId,
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
        return { id: invoiceId };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          number: z.string().optional(),
          series: z.string().optional(),
          clientId: z.number().optional(),
          clientName: z.string().optional(),
          clientCUI: z.string().optional(),
          clientRegCom: z.string().optional(),
          clientAddress: z.string().optional(),
          clientCity: z.string().optional(),
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
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { emittedInvoices, emittedInvoiceLines } =
          await import("../drizzle/schema");
        const { id, lines, ...data } = input;
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
        if (Object.keys(updateData).length > 0) {
          await db
            .update(emittedInvoices)
            .set(updateData)
            .where(
              and(
                eq(emittedInvoices.id, id),
                eq(emittedInvoices.tenantId, ctx.user.tenantId)
              )
            );
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

            if (devizAllLines.length > 0) {
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
                  tenantId: ctx.user.tenantId,
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
                    tenantId: ctx.user.tenantId,
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
              eq(emittedInvoices.tenantId, ctx.user.tenantId)
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
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { emittedInvoices } = await import("../drizzle/schema");
        await db
          .update(emittedInvoices)
          .set({ status: input.status })
          .where(
            and(
              eq(emittedInvoices.id, input.id),
              eq(emittedInvoices.tenantId, ctx.user.tenantId)
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
              eq(emittedInvoices.tenantId, ctx.user.tenantId)
            )
          );
        if (!inv) throw new Error("Invoice not found");
        const lines = await db
          .select()
          .from(emittedInvoiceLines)
          .where(eq(emittedInvoiceLines.emittedInvoiceId, input.id));
        const [tenantData] = await db
          .select()
          .from(tenants)
          .where(eq(tenants.id, ctx.user.tenantId));
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
              eq(integrations.tenantId, ctx.user.tenantId),
              eq(integrations.provider, "spv"),
              eq(integrations.status, "active")
            )
          );
        if (!intg?.apiKey)
          return {
            success: false,
            error: "SPV nu este conectat sau token lipsă.",
          };
        const cui = (tenantData.cui || "").replace(/[^A-Z0-9]/gi, "");
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
              rawXml: xmlContent,
            })
            .where(eq(emittedInvoices.id, input.id));
          return { success: true, index_incarcare: spvIndex };
        } else {
          const errMatch = responseText.match(/<eroare>(.*?)<\/eroare>/i);
          const errMsg = errMatch?.[1] || responseText;
          await db
            .update(emittedInvoices)
            .set({ spvStatus: "eroare", spvError: errMsg, rawXml: xmlContent })
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
              eq(emittedInvoices.tenantId, ctx.user.tenantId)
            )
          );
        if (!inv) throw new Error("Factura nu a fost găsită");
        if (!inv.spvIndex) throw new Error("Factura nu are index SPV. Trimite-o mai întâi.");

        const [intg] = await db
          .select()
          .from(integrations)
          .where(
            and(
              eq(integrations.tenantId, ctx.user.tenantId),
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
      if (!ctx.user?.tenantId) throw new Error("No tenant context");
      const db = await getDb();
      if (!db) throw new Error("No DB");
      const { emittedInvoices, reInvoices, invoiceArchive } = await import("../drizzle/schema");
      const { eq, and, desc } = await import("drizzle-orm");

      // 1. Fetch Emitted Invoices
      const emitted = await db
        .select()
        .from(emittedInvoices)
        .where(eq(emittedInvoices.tenantId, ctx.user.tenantId))
        .orderBy(desc(emittedInvoices.createdAt));

      // 2. Fetch Re-Invoices
      const reInvs = await db
        .select()
        .from(reInvoices)
        .where(eq(reInvoices.tenantId, ctx.user.tenantId))
        .orderBy(desc(reInvoices.createdAt));

      // 3. Fetch Received (Archive)
      const archive = await db
        .select()
        .from(invoiceArchive)
        .where(
          and(
            eq(invoiceArchive.tenantId, ctx.user.tenantId),
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
          date: i.createdAt,
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
          date: i.createdAt,
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
      if (!ctx.user?.tenantId) throw new Error("No tenant context");
      const db = await getDb();
      if (!db) throw new Error("No DB");
      
      const { emittedInvoices, clients, invoiceArchive, users } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const myInvoices = await db.select().from(emittedInvoices).where(eq(emittedInvoices.tenantId, ctx.user.tenantId));
      const myClients = await db.select().from(clients).where(eq(clients.tenantId, ctx.user.tenantId));
      const myArchive = await db.select().from(invoiceArchive).where(eq(invoiceArchive.tenantId, ctx.user.tenantId));
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
      if (!ctx.user?.tenantId) throw new Error("No tenant context");
      const db = await getDb();
      if (!db) throw new Error("No DB");
      const { nir } = await import("../drizzle/schema");
      return db
        .select()
        .from(nir)
        .where(eq(nir.tenantId, ctx.user.tenantId))
        .orderBy(desc(nir.createdAt));
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { nir, nirLines } = await import("../drizzle/schema");
        const [nirRow] = await db
          .select()
          .from(nir)
          .where(
            and(eq(nir.id, input.id), eq(nir.tenantId, ctx.user.tenantId))
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
      if (!ctx.user?.tenantId) throw new Error("No tenant context");
      const db = await getDb();
      if (!db) throw new Error("No DB");
      const { nir } = await import("../drizzle/schema");
      const year = new Date().getFullYear();
      const last = await db
        .select({ nirNumber: nir.nirNumber })
        .from(nir)
        .where(eq(nir.tenantId, ctx.user.tenantId))
        .orderBy(desc(nir.id))
        .limit(1);
      let nextNum = 1;
      if (last[0]?.nirNumber) {
        const match = last[0].nirNumber.match(/(\d+)$/);
        if (match) nextNum = parseInt(match[1]) + 1;
      }
      return `NIR-${year}-${String(nextNum).padStart(4, "0")}`;
    }),

    createFromInvoice: protectedProcedure
      .input(
        z.object({
          invoiceArchiveId: z.number().optional(),
          nirNumber: z.string(),
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
              lineOrder: z.number().optional(),
            })
          ),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { nir, nirLines } = await import("../drizzle/schema");
        const [result] = await db.insert(nir).values({
          tenantId: ctx.user.tenantId,
          nirNumber: input.nirNumber,
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
          status: "draft",
        });
        const nirId = (result as any).insertId;
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
              lineOrder: l.lineOrder ?? idx,
            }))
          );
        }
        return { id: nirId, nirNumber: input.nirNumber };
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
                lineOrder: z.number().optional(),
              })
            )
            .optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
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
            .where(and(eq(nir.id, id), eq(nir.tenantId, ctx.user.tenantId)));
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
                lineOrder: l.lineOrder ?? idx,
              }))
            );
          }
        }
        return { success: true };
      }),

    finalize: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { nir } = await import("../drizzle/schema");
        await db
          .update(nir)
          .set({ status: "finalizat" })
          .where(
            and(eq(nir.id, input.id), eq(nir.tenantId, ctx.user.tenantId))
          );
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { nir, nirLines } = await import("../drizzle/schema");
        await db.delete(nirLines).where(eq(nirLines.nirId, input.id));
        await db
          .delete(nir)
          .where(
            and(eq(nir.id, input.id), eq(nir.tenantId, ctx.user.tenantId))
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
      if (!ctx.user?.tenantId) throw new Error("No tenant context");
      const db = await getDb();
      if (!db) throw new Error("No DB");
      const { devize } = await import("../drizzle/schema");
      return await db
        .select()
        .from(devize)
        .where(eq(devize.tenantId, ctx.user.tenantId))
        .orderBy(desc(devize.id));
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { devize, devizeLines } = await import("../drizzle/schema");

        const [deviz] = await db
          .select()
          .from(devize)
          .where(
            and(eq(devize.id, input.id), eq(devize.tenantId, ctx.user.tenantId))
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
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { devize, devizeLines } = await import("../drizzle/schema");

        const [deviz] = await db
          .select()
          .from(devize)
          .where(
            and(
              eq(devize.invoiceId, input.invoiceId),
              eq(devize.tenantId, ctx.user.tenantId)
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
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
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
          tenantId: ctx.user.tenantId,
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
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
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
            and(eq(devize.id, input.id), eq(devize.tenantId, ctx.user.tenantId))
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
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { devize, devizeLines } = await import("../drizzle/schema");
        await db.delete(devizeLines).where(eq(devizeLines.devizId, input.id));
        await db
          .delete(devize)
          .where(
            and(eq(devize.id, input.id), eq(devize.tenantId, ctx.user.tenantId))
          );
        return { success: true };
      }),
  }),

  // =========================================================================
  // BONURI CONSUM
  // =========================================================================
  bonuriConsum: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user?.tenantId) throw new Error("No tenant context");
      const db = await getDb();
      if (!db) throw new Error("No DB");
      const { bonuriConsum } = await import("../drizzle/schema");
      return await db
        .select()
        .from(bonuriConsum)
        .where(eq(bonuriConsum.tenantId, ctx.user.tenantId))
        .orderBy(desc(bonuriConsum.id));
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
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
              eq(bonuriConsum.tenantId, ctx.user.tenantId)
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
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { bonuriConsum, bonuriConsumLines } =
          await import("../drizzle/schema");

        const [insertResult] = await db.insert(bonuriConsum).values({
          tenantId: ctx.user.tenantId,
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
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
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
              eq(bonuriConsum.tenantId, ctx.user.tenantId)
            )
          );
        return { success: true };
      }),
  }),

});
export type AppRouter = typeof appRouter;
