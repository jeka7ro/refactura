import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { generateReInvoicePDF } from "./pdf";
import { getDb, getTenantsByUser, getUserRole, createTenant, updateTenantSettings, createCostCenter, getCostCentersByTenant, updateCostCenter, deleteCostCenter, getCostCenterById, getClientsByTenant, createClient, updateClient, deleteClient, getClientById, createLead, getAllLeads, updateLeadStatus, deleteLead, getAllSubscriptionPlans, createSubscriptionPlan, updateSubscriptionPlan, deleteSubscriptionPlan, getCmsSettings, upsertCmsSetting, getAdminStats, getAllAccounts, getAllTenants, recordPageVisit, getPageVisitStats, getAllModules, getActiveModulesWithPricing, upsertModule, deleteModule, upsertModulePricing, deleteModulePricing, createReInvoice, getReInvoicesByTenant, getReInvoiceById, updateReInvoiceStatus, deleteReInvoice, getNextReInvoiceNumber, getInvoiceArchiveList, createInvoiceArchiveEntry, getInvoiceArchiveById, updateInvoiceArchiveEntry, deleteInvoiceArchiveEntry, getInvoiceArchiveStats, getIntegrations, upsertIntegration } from "./db";
import { authenticateAccount, createAccount, getAccountByEmail } from "./auth";
import { createSessionToken } from "./session";
import { eq, desc, and } from "drizzle-orm";
import { invoiceArchive, invoiceArchiveLines, products } from "../drizzle/schema";
import { convertXmlToPdf } from "./anafPdf";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(async (opts) => {
      const user = opts.ctx.user;
      if (!user) return null;
      // Attach tenant name + CUI for sidebar display
      if (user.tenantId) {
        try {
          const db = await getDb();
          if (db) {
            const { tenants } = await import("../drizzle/schema");
            const [tenant] = await db.select({ name: tenants.name, cui: tenants.cui })
              .from(tenants).where(eq(tenants.id, user.tenantId));
            if (tenant) return { ...user, tenantName: tenant.name, tenantCUI: tenant.cui };
          }
        } catch (_) {}
      }
      return user;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          const account = await authenticateAccount(input.email, input.password);
          const token = await createSessionToken({
            accountId: account.id,
            email: account.email,
            role: account.role,
            tenantId: account.tenantId || undefined,
          });
          return {
            success: true,
            token,
            account: {
              id: account.id,
              email: account.email,
              role: account.role,
              tenantId: account.tenantId,
            },
          };
        } catch (error) {
          throw new Error("Invalid email or password");
        }
      }),
    register: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(8),
        confirmPassword: z.string(),
      }))
      .mutation(async ({ input }) => {
        if (input.password !== input.confirmPassword) {
          throw new Error("Passwords do not match");
        }
        const existing = await getAccountByEmail(input.email);
        if (existing) {
          throw new Error("Email already registered");
        }
        await createAccount(input.email, input.password, undefined, "user");
        const account = await authenticateAccount(input.email, input.password);
        const token = await createSessionToken({
          accountId: account.id,
          email: account.email,
          role: account.role,
          tenantId: account.tenantId || undefined,
        });
        return {
          success: true,
          token,
          account: {
            id: account.id,
            email: account.email,
            role: account.role,
            tenantId: account.tenantId,
          },
        };
      }),
  }),

  tenants: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return [];
      return getTenantsByUser(ctx.user.id);
    }),
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        email: z.string().email(),
        phone: z.string().optional(),
        address: z.string().optional(),
        cui: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return createTenant(input);
      }),
  }),

  invoices: router({
    // Facturi PRIMITE (de la furnizori) — direction = 'in'
    list: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user?.tenantId) throw new Error("No tenant context");
      const db = await getDb();
      if (!db) return [];
      const res = await db.select().from(invoiceArchive)
        .where(and(eq(invoiceArchive.tenantId, ctx.user.tenantId), eq(invoiceArchive.direction, "in")))
        .orderBy(desc(invoiceArchive.createdAt));
      return res;
    }),
    // Facturi EMISE (catre clienti) — direction = 'out'
    listEmise: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user?.tenantId) throw new Error("No tenant context");
      const db = await getDb();
      if (!db) return [];
      const res = await db.select().from(invoiceArchive)
        .where(and(eq(invoiceArchive.tenantId, ctx.user.tenantId), eq(invoiceArchive.direction, "out")))
        .orderBy(desc(invoiceArchive.createdAt));
      return res;
    }),
    importSpv: protectedProcedure
      .input(z.array(z.object({
        invoiceNumber: z.string(),
        supplierName: z.string(),
        supplierCUI: z.string(),
        issueDate: z.string(),
        dueDate: z.string().optional(),
        total: z.number(),
        totalVAT: z.number(),
        currency: z.string().default("RON"),
        xmlContent: z.string().optional(),
        lines: z.array(z.object({
          description: z.string(),
          quantity: z.number(),
          unitPrice: z.number(),
          unit: z.string().default("buc"),
          vatRate: z.number().optional(),
        }))
      })))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        const db = await getDb();
        if (!db) throw new Error("DB not connected");
        
        const tenantId = ctx.user.tenantId;
        const insertedIds: number[] = [];
        
        for (const inv of input) {
          let finalFileUrl = (inv as any).pdfUrl || "spv_import";
          
          if (inv.xmlContent) {
            const pdfRes = await convertXmlToPdf(inv.xmlContent, `Factura_${inv.invoiceNumber}_${Date.now()}`);
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
            await db.insert(invoiceArchiveLines).values(inv.lines.map(l => ({
              invoiceArchiveId: result.insertId,
              description: l.description,
              quantity: l.quantity.toString() as any,
              unitPrice: l.unitPrice.toString() as any,
              unit: l.unit,
              vatRate: l.vatRate?.toString() as any,
              total: (l.quantity * l.unitPrice).toString() as any,
              currency: inv.currency,
            })));
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
      .input(z.object({
        sourceInvoiceId: z.string().optional(),
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
        status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).default("draft"),
        notes: z.string().optional(),
        lines: z.array(z.object({
          description: z.string(),
          quantity: z.number(),
          originalUnitPrice: z.number().optional(),
          unitPrice: z.number(),
          unit: z.string().optional(),
          vatRate: z.number().optional(),
          markupPercent: z.number().optional(),
          total: z.number(),
          lineOrder: z.number(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        const number = await getNextReInvoiceNumber(ctx.user.tenantId);
        return createReInvoice({
          tenantId: ctx.user.tenantId,
          number,
          ...input,
        });
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
        const tenantData = await db.select().from(tenants).where(eq(tenants.id, ctx.user.tenantId)).limit(1);
        if (tenantData.length === 0) throw new Error("Tenant not found");
        
        // 3. Generate XML
        const { generateUblXml } = await import("./anafXmlGenerator");
        const xmlContent = generateUblXml(invoiceData as any, invoiceData.lines as any, tenantData[0]);
        
        // 4. Upload to ANAF
        const { uploadInvoiceToSPV } = await import("./anafApi");
        const result = await uploadInvoiceToSPV(ctx.user.tenantId, input.id, xmlContent, tenantData[0].cui || "");
        
        return result;
      }),
      
    // Update status
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]),
      }))
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
      .input(z.object({
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
        lines: z.array(z.object({
          description: z.string(),
          quantity: z.number(),
          unitPrice: z.number(),
          unit: z.string(),
          vatRate: z.number(),
          total: z.number(),
        })),
        subtotal: z.number(),
        totalVAT: z.number(),
        total: z.number(),
        currency: z.string(),
        notes: z.string().optional(),
        logoBase64: z.string().optional(),
        template: z.enum(["classic", "modern", "minimal"]).optional(),
      }))
      .mutation(({ input, ctx }) => {
        const pdfStream = generateReInvoicePDF(input);
        ctx.res.setHeader("Content-Type", "application/pdf");
        ctx.res.setHeader("Content-Disposition", `attachment; filename="${input.number}.pdf"`);
        pdfStream.pipe(ctx.res);
        return { success: true };
      }),
    }),
  costCenters: router({
    list: protectedProcedure
      .query(async ({ ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        return getCostCentersByTenant(ctx.user.tenantId);
      }),
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        address: z.string().optional(),
        cui: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        return createCostCenter({
          tenantId: ctx.user.tenantId,
          ...input,
        });
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        address: z.string().optional(),
        cui: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
      }))
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
    list: protectedProcedure
      .query(async ({ ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        return getClientsByTenant(ctx.user.tenantId);
      }),
    create: protectedProcedure
      .input(z.object({
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
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        return createClient({
          tenantId: ctx.user.tenantId,
          ...input,
        });
      }),
    update: protectedProcedure
      .input(z.object({
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
      }))
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
        const { reInvoices, invoiceArchive } = await import("../drizzle/schema");

        // Facturi emise către client
        const sentInvoices = await db.select()
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
          receivedInvoices = await db.select()
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
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        company: z.string().optional(),
        message: z.string().optional(),
        planId: z.number().optional(),
        source: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await createLead(input);
        return { success: true };
      }),
    // Track page visit
    trackVisit: publicProcedure
      .input(z.object({
        path: z.string(),
        referrer: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const ip = ctx.req.headers['x-forwarded-for'] as string || ctx.req.socket.remoteAddress || '';
        const userAgent = ctx.req.headers['user-agent'] || '';
        await recordPageVisit({ path: input.path, referrer: input.referrer, userAgent, ip });
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
      if (ctx.user?.role !== 'superadmin' && ctx.user?.role !== 'admin') throw new Error('Forbidden');
      return getAdminStats();
    }),
    // All leads/registrations
    leads: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== 'superadmin' && ctx.user?.role !== 'admin') throw new Error('Forbidden');
      return getAllLeads();
    }),
    updateLeadStatus: protectedProcedure
      .input(z.object({ id: z.number(), status: z.enum(['new', 'contacted', 'converted', 'lost']) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'superadmin' && ctx.user?.role !== 'admin') throw new Error('Forbidden');
        return updateLeadStatus(input.id, input.status);
      }),
    deleteLead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'superadmin' && ctx.user?.role !== 'admin') throw new Error('Forbidden');
        return deleteLead(input.id);
      }),
    // Accounts list
    accounts: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== 'superadmin' && ctx.user?.role !== 'admin') throw new Error('Forbidden');
      return getAllAccounts();
    }),
    // Tenants list
    tenants: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== 'superadmin' && ctx.user?.role !== 'admin') throw new Error('Forbidden');
      return getAllTenants();
    }),
    // Subscription plans CRUD
    plans: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== 'superadmin' && ctx.user?.role !== 'admin') throw new Error('Forbidden');
      return getAllSubscriptionPlans();
    }),
    createPlan: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        monthlyPrice: z.number().min(0),
        maxCostCenters: z.number().min(1),
        maxUsers: z.number().min(1),
        features: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'superadmin' && ctx.user?.role !== 'admin') throw new Error('Forbidden');
        return createSubscriptionPlan(input);
      }),
    updatePlan: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        monthlyPrice: z.number().optional(),
        maxCostCenters: z.number().optional(),
        maxUsers: z.number().optional(),
        features: z.string().optional(),
        isActive: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'superadmin' && ctx.user?.role !== 'admin') throw new Error('Forbidden');
        const { id, ...data } = input;
        return updateSubscriptionPlan(id, data);
      }),
    deletePlan: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'superadmin' && ctx.user?.role !== 'admin') throw new Error('Forbidden');
        return deleteSubscriptionPlan(input.id);
      }),
    // CMS settings
    getCmsSettings: protectedProcedure
      .input(z.object({ group: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'superadmin' && ctx.user?.role !== 'admin') throw new Error('Forbidden');
        return getCmsSettings(input.group);
      }),
    upsertCmsSetting: protectedProcedure
      .input(z.object({
        key: z.string(),
        value: z.string(),
        label: z.string().optional(),
        group: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'superadmin' && ctx.user?.role !== 'admin') throw new Error('Forbidden');
        return upsertCmsSetting(input.key, input.value, input.label, input.group);
      }),
    // Traffic stats
    trafficStats: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== 'superadmin' && ctx.user?.role !== 'admin') throw new Error('Forbidden');
      return getPageVisitStats();
    }),
    // Modules CRUD
    modules: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== 'superadmin' && ctx.user?.role !== 'admin') throw new Error('Forbidden');
      return getAllModules();
    }),
    modulesWithPricing: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== 'superadmin' && ctx.user?.role !== 'admin') throw new Error('Forbidden');
      return getActiveModulesWithPricing();
    }),
    upsertModule: protectedProcedure
      .input(z.object({
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
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'superadmin' && ctx.user?.role !== 'admin') throw new Error('Forbidden');
        return upsertModule(input);
      }),
    deleteModule: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'superadmin' && ctx.user?.role !== 'admin') throw new Error('Forbidden');
        return deleteModule(input.id);
      }),
    upsertModulePricing: protectedProcedure
      .input(z.object({
        id: z.number().optional(),
        moduleId: z.number(),
        currency: z.string(),
        monthlyPrice: z.string(),
        yearlyPrice: z.string().optional(),
        trialDays: z.number().optional(),
        isActive: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'superadmin' && ctx.user?.role !== 'admin') throw new Error('Forbidden');
        return upsertModulePricing(input);
      }),
    deleteModulePricing: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'superadmin' && ctx.user?.role !== 'admin') throw new Error('Forbidden');
        return deleteModulePricing(input.id);
      }),
  }),

  // ─── Invoice Archive ────────────────────────────────────────────────────────
  invoiceArchive: router({
    list: protectedProcedure
      .input(z.object({
        source: z.string().optional(),
        status: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error('No tenant context');
        return getInvoiceArchiveList(ctx.user.tenantId, input ?? {});
      }),

    stats: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user?.tenantId) throw new Error('No tenant context');
      return getInvoiceArchiveStats(ctx.user.tenantId);
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error('No tenant context');
        return getInvoiceArchiveById(input.id, ctx.user.tenantId);
      }),

    create: protectedProcedure
      .input(z.object({
        fileKey: z.string(),
        fileUrl: z.string(),
        fileName: z.string(),
        fileType: z.enum(['pdf', 'xml', 'efactura', 'other']).optional(),
        fileSize: z.number().optional(),
        invoiceNumber: z.string().optional(),
        supplierName: z.string().optional(),
        supplierCUI: z.string().optional(),
        issueDate: z.string().optional(),
        dueDate: z.string().optional(),
        total: z.string().optional(),
        totalVAT: z.string().optional(),
        currency: z.string().optional(),
        source: z.enum(['smartbill', 'oblio', 'fgo', 'spv_anaf', 'efactura', 'pdf_manual', 'xml_manual', 'other']).optional(),
        notes: z.string().optional(),
        tags: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error('No tenant context');
        return createInvoiceArchiveEntry({ ...input, tenantId: ctx.user.tenantId });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        invoiceNumber: z.string().optional(),
        supplierName: z.string().optional(),
        supplierCUI: z.string().optional(),
        issueDate: z.string().optional(),
        dueDate: z.string().optional(),
        total: z.string().optional(),
        totalVAT: z.string().optional(),
        currency: z.string().optional(),
        status: z.enum(['pending', 'processed', 'refactured', 'archived']).optional(),
        notes: z.string().optional(),
        tags: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error('No tenant context');
        const { id, ...data } = input;
        return updateInvoiceArchiveEntry(id, ctx.user.tenantId, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error('No tenant context');
        await deleteInvoiceArchiveEntry(input.id, ctx.user.tenantId);
        return { success: true };
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending", "processed", "paid", "archived", "refactured"]),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { invoiceArchive } = await import("../drizzle/schema");
        await db.update(invoiceArchive)
          .set({ status: input.status })
          .where(and(eq(invoiceArchive.id, input.id), eq(invoiceArchive.tenantId, ctx.user.tenantId)));
        return { success: true };
      }),
  }),

  // ─── Integrations Router ─────────────────────────────────────────────────────
  integrations: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user?.tenantId) throw new Error('No tenant context');
      return getIntegrations(ctx.user.tenantId);
    }),
    upsert: protectedProcedure
      .input(z.object({
        provider: z.enum(['smartbill', 'spv', 'oblio']),
        apiKey: z.string().optional(),
        apiSecret: z.string().optional(),
        status: z.enum(['active', 'inactive', 'error']).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error('No tenant context');
        await upsertIntegration(ctx.user.tenantId, input.provider, {
          apiKey: input.apiKey,
          apiSecret: input.apiSecret,
          status: input.status,
        });
        return { success: true };
      }),
    syncOblio: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user?.tenantId) throw new Error('No tenant context');
      const { syncOblioInvoices } = await import('./oblioSync');
      return syncOblioInvoices(ctx.user.tenantId);
    }),
    disconnectOblio: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user?.tenantId) throw new Error('No tenant context');
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const { integrations } = await import('../drizzle/schema');
      const { and, eq } = await import('drizzle-orm');
      await db.delete(integrations)
        .where(and(eq(integrations.tenantId, ctx.user.tenantId), eq(integrations.provider, "oblio")));
      return { success: true };
    }),
    syncSpvManual: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user?.tenantId) throw new Error('No tenant context');
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const { integrations } = await import('../drizzle/schema');
      const { and, eq } = await import('drizzle-orm');
      const [spvIntg] = await db.select().from(integrations)
        .where(and(eq(integrations.tenantId, ctx.user.tenantId), eq(integrations.provider, "spv_oauth")));
      if (!spvIntg || !spvIntg.apiKey) {
        throw new Error('SPV nu este configurat sau lipsește token-ul de acces.');
      }
      const { syncSpvInvoices } = await import('./spvSync');
      return syncSpvInvoices(ctx.user.tenantId, spvIntg.apiKey);
    }),
    getSpvOAuthUrl: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user?.tenantId) throw new Error('No tenant context');
      const clientId = process.env.SPV_CLIENT_ID;
      const redirectUri = process.env.SPV_CALLBACK_URL || "https://refactura.up.railway.app/api/spv/callback";
      const authUrl = new URL("https://logincert.anaf.ro/anaf-oauth2/v1/authorize");
      authUrl.searchParams.append("response_type", "code");
      authUrl.searchParams.append("client_id", clientId || "");
      authUrl.searchParams.append("redirect_uri", redirectUri);
      authUrl.searchParams.append("state", String(ctx.user.tenantId));
      return { url: authUrl.toString() };
    }),
    syncSpv: protectedProcedure.input(z.object({ zile: z.number().min(1).max(365).optional() }).optional()).mutation(async ({ ctx, input }) => {
      if (!ctx.user?.tenantId) throw new Error('No tenant context');
      const { syncAllSpv } = await import('./spvCron');
      await syncAllSpv(input?.zile || 60);
      return { success: true };
    }),
    syncSmartBill: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user?.tenantId) throw new Error('No tenant context');
      const { syncSmartBillInvoices } = await import('./smartbillSync');
      return syncSmartBillInvoices(ctx.user.tenantId);
    }),
    // Backfill rawXml for existing SPV invoices
    repopulateXml: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user?.tenantId) throw new Error('No tenant context');
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');

      // Find all SPV invoices without rawXml
      const missing = await db.select({ id: invoiceArchive.id, fileName: invoiceArchive.fileName, tenantId: invoiceArchive.tenantId })
        .from(invoiceArchive)
        .where(and(
          eq(invoiceArchive.tenantId, ctx.user.tenantId),
          eq(invoiceArchive.source, 'spv_anaf'),
          sql`rawXml IS NULL`
        ));

      if (!missing.length) return { updated: 0 };

      // Get SPV token
      const [spvIntg] = await db.select().from(integrations)
        .where(and(
          eq(integrations.tenantId, ctx.user.tenantId),
          eq(integrations.provider, 'spv'),
          eq(integrations.status, 'active')
        ));

      if (!spvIntg?.apiKey) throw new Error('SPV nu este conectat');

      const AdmZip = (await import('adm-zip')).default;
      let updated = 0;

      for (const inv of missing) {
        // Try to extract download ID from fileName
        const match = inv.fileName?.match(/SPV_(\d+)/);
        if (!match) continue;

        try {
          const zipRes = await fetch(`https://api.anaf.ro/prod/FCTEL/rest/descarcare?id=${match[1]}`, {
            headers: { 'Authorization': `Bearer ${spvIntg.apiKey}` },
            signal: AbortSignal.timeout(30000),
          });
          if (!zipRes.ok) continue;

          const buffer = await zipRes.arrayBuffer();
          const zip = new AdmZip(Buffer.from(buffer));
          const xmlEntry = zip.getEntries().find(e =>
            e.entryName.toLowerCase().endsWith('.xml') && !e.entryName.toLowerCase().includes('semnatura')
          );
          if (xmlEntry) {
            const xmlContent = xmlEntry.getData().toString('utf8');
            await db.update(invoiceArchive).set({ rawXml: xmlContent }).where(eq(invoiceArchive.id, inv.id));
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
      return await db.select()
        .from(products)
        .where(eq(products.tenantId, ctx.user.tenantId))
        .orderBy(desc(products.id));
    }),
    create: protectedProcedure.input(z.object({
      name: z.string(),
      unit: z.string().optional(),
      defaultPrice: z.number().optional(),
      defaultVatRate: z.number().optional(),
    })).mutation(async ({ ctx, input }) => {
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
      const { emittedInvoices, emittedInvoiceLines } = await import("../drizzle/schema");
      const { desc } = await import("drizzle-orm");
      const rows = await db.select().from(emittedInvoices)
        .where(eq(emittedInvoices.tenantId, ctx.user.tenantId))
        .orderBy(desc(emittedInvoices.createdAt));
      return rows;
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { emittedInvoices, emittedInvoiceLines } = await import("../drizzle/schema");
        const [inv] = await db.select().from(emittedInvoices)
          .where(and(eq(emittedInvoices.id, input.id), eq(emittedInvoices.tenantId, ctx.user.tenantId)));
        if (!inv) throw new Error("Not found");
        const lines = await db.select().from(emittedInvoiceLines)
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
        const last = await db.select({ number: emittedInvoices.number }).from(emittedInvoices)
          .where(and(
            eq(emittedInvoices.tenantId, ctx.user.tenantId),
            sql`${emittedInvoices.series} = ${input.series}`
          ))
          .orderBy(desc(emittedInvoices.id)).limit(1);
        let nextNum = 1;
        if (last.length > 0) {
          const match = last[0].number.match(/(\d+)$/);
          if (match) nextNum = parseInt(match[1]) + 1;
        }
        return `${input.series}-${String(nextNum).padStart(4, "0")}`;
      }),

    create: protectedProcedure
      .input(z.object({
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
        status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).default("draft"),
        notes: z.string().optional(),
        lines: z.array(z.object({
          description: z.string(),
          quantity: z.number(),
          unitPrice: z.number(),
          unit: z.string().optional(),
          vatRate: z.number().optional(),
          total: z.number(),
          lineOrder: z.number(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { emittedInvoices, emittedInvoiceLines } = await import("../drizzle/schema");
        const { lines, ...invoiceData } = input;
        const [result] = await db.insert(emittedInvoices).values({
          tenantId: ctx.user.tenantId,
          ...invoiceData,
          subtotal: String(invoiceData.subtotal),
          totalVAT: String(invoiceData.totalVAT),
          total: String(invoiceData.total),
        } as any).$returningId();
        const invoiceId = result.id;
        if (lines.length > 0) {
          await db.insert(emittedInvoiceLines).values(
            lines.map((l, i) => ({
              emittedInvoiceId: invoiceId,
              description: l.description,
              quantity: String(l.quantity),
              unitPrice: String(l.unitPrice),
              unit: l.unit || "buc",
              vatRate: String(l.vatRate ?? 21),
              total: String(l.total),
              lineOrder: l.lineOrder ?? i,
            } as any))
          );
        }
        return { id: invoiceId };
      }),

    update: protectedProcedure
      .input(z.object({
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
        status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).optional(),
        notes: z.string().optional(),
        lines: z.array(z.object({
          description: z.string(),
          quantity: z.number(),
          unitPrice: z.number(),
          unit: z.string().optional(),
          vatRate: z.number().optional(),
          total: z.number(),
          lineOrder: z.number(),
        })).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { emittedInvoices, emittedInvoiceLines } = await import("../drizzle/schema");
        const { id, lines, ...data } = input;
        const updateData: any = {};
        if (data.subtotal !== undefined) updateData.subtotal = String(data.subtotal);
        if (data.totalVAT !== undefined) updateData.totalVAT = String(data.totalVAT);
        if (data.total !== undefined) updateData.total = String(data.total);
        if (data.clientName) updateData.clientName = data.clientName;
        if (data.clientCUI !== undefined) updateData.clientCUI = data.clientCUI;
        if (data.clientRegCom !== undefined) updateData.clientRegCom = data.clientRegCom;
        if (data.clientAddress !== undefined) updateData.clientAddress = data.clientAddress;
        if (data.clientCity !== undefined) updateData.clientCity = data.clientCity;
        if (data.clientEmail !== undefined) updateData.clientEmail = data.clientEmail;
        if (data.clientPhone !== undefined) updateData.clientPhone = data.clientPhone;
        if (data.issueDate) updateData.issueDate = data.issueDate;
        if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
        if (data.currency) updateData.currency = data.currency;
        if (data.status) updateData.status = data.status;
        if (data.notes !== undefined) updateData.notes = data.notes;
        if (data.number) updateData.number = data.number;
        if (data.series) updateData.series = data.series;
        if (Object.keys(updateData).length > 0) {
          await db.update(emittedInvoices).set(updateData)
            .where(and(eq(emittedInvoices.id, id), eq(emittedInvoices.tenantId, ctx.user.tenantId)));
        }
        if (lines) {
          await db.delete(emittedInvoiceLines).where(eq(emittedInvoiceLines.emittedInvoiceId, id));
          if (lines.length > 0) {
            await db.insert(emittedInvoiceLines).values(
              lines.map((l, i) => ({
                emittedInvoiceId: id,
                description: l.description,
                quantity: String(l.quantity),
                unitPrice: String(l.unitPrice),
                unit: l.unit || "buc",
                vatRate: String(l.vatRate ?? 21),
                total: String(l.total),
                lineOrder: l.lineOrder ?? i,
              } as any))
            );
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
        const { emittedInvoices, emittedInvoiceLines } = await import("../drizzle/schema");
        await db.delete(emittedInvoiceLines).where(eq(emittedInvoiceLines.emittedInvoiceId, input.id));
        await db.delete(emittedInvoices).where(and(eq(emittedInvoices.id, input.id), eq(emittedInvoices.tenantId, ctx.user.tenantId)));
        return { success: true };
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant context");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { emittedInvoices } = await import("../drizzle/schema");
        await db.update(emittedInvoices)
          .set({ status: input.status })
          .where(and(eq(emittedInvoices.id, input.id), eq(emittedInvoices.tenantId, ctx.user.tenantId)));
        return { success: true };
      }),

    sendToSpv: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.tenantId) throw new Error("No tenant");
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { emittedInvoices, emittedInvoiceLines, tenants } = await import("../drizzle/schema");
        const [inv] = await db.select().from(emittedInvoices)
          .where(and(eq(emittedInvoices.id, input.id), eq(emittedInvoices.tenantId, ctx.user.tenantId)));
        if (!inv) throw new Error("Invoice not found");
        const lines = await db.select().from(emittedInvoiceLines)
          .where(eq(emittedInvoiceLines.emittedInvoiceId, input.id));
        const [tenantData] = await db.select().from(tenants).where(eq(tenants.id, ctx.user.tenantId));
        if (!tenantData) throw new Error("Tenant not found");
        const { generateUblXml } = await import("./anafXmlGenerator");
        // Map emitted invoice to the same shape generateUblXml expects (ReInvoice-like)
        const invoiceLike: any = { ...inv };
        const linesLike: any[] = lines.map(l => ({ ...l, quantity: l.quantity, unitPrice: l.unitPrice, vatRate: l.vatRate }));
        const xmlContent = generateUblXml(invoiceLike, linesLike, tenantData);
        const { uploadInvoiceToSPV } = await import("./anafApi");
        // uploadInvoiceToSPV works on reInvoices; we need a version for emittedInvoices
        // We'll do the upload inline here and update emittedInvoices directly
        const { integrations } = await import("../drizzle/schema");
        const [intg] = await db.select().from(integrations)
          .where(and(eq(integrations.tenantId, ctx.user.tenantId), eq(integrations.provider, "spv"), eq(integrations.status, "active")));
        if (!intg?.apiKey) return { success: false, error: "SPV nu este conectat sau token lipsă." };
        const cui = (tenantData.cui || "").replace(/[^A-Z0-9]/gi, "");
        const uploadUrl = `https://api.anaf.ro/prod/FCTEL/rest/upload?standard=UBL&cif=${cui}`;
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Authorization": `Bearer ${intg.apiKey}`, "Content-Type": "application/xml" },
          body: xmlContent,
        });
        const responseText = await response.text();
        const indexMatch = responseText.match(/<index_incarcare>(\d+)<\/index_incarcare>/);
        if (indexMatch?.[1]) {
          await db.update(emittedInvoices).set({ spvIndex: indexMatch[1], spvStatus: "in_procesare", rawXml: xmlContent })
            .where(eq(emittedInvoices.id, input.id));
          return { success: true, index_incarcare: indexMatch[1] };
        } else {
          const errMatch = responseText.match(/<eroare>(.*?)<\/eroare>/i);
          const errMsg = errMatch?.[1] || responseText;
          await db.update(emittedInvoices).set({ spvStatus: "eroare", spvError: errMsg, rawXml: xmlContent })
            .where(eq(emittedInvoices.id, input.id));
          return { success: false, error: errMsg };
        }
      }),
  }),
});
export type AppRouter = typeof appRouter;
