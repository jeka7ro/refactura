import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { generateReInvoicePDF } from "./pdf";
import { getTenantsByUser, getUserRole, createTenant, createCostCenter, getCostCentersByTenant, updateCostCenter, deleteCostCenter, getCostCenterById, getClientsByTenant, createClient, updateClient, deleteClient, getClientById, createLead, getAllLeads, updateLeadStatus, deleteLead, getAllSubscriptionPlans, createSubscriptionPlan, updateSubscriptionPlan, deleteSubscriptionPlan, getCmsSettings, upsertCmsSetting, getAdminStats, getAllAccounts, getAllTenants, recordPageVisit, getPageVisitStats, getAllModules, getActiveModulesWithPricing, upsertModule, deleteModule, upsertModulePricing, deleteModulePricing, createReInvoice, getReInvoicesByTenant, getReInvoiceById, updateReInvoiceStatus, deleteReInvoice, getNextReInvoiceNumber, getInvoiceArchiveList, createInvoiceArchiveEntry, getInvoiceArchiveById, updateInvoiceArchiveEntry, deleteInvoiceArchiveEntry, getInvoiceArchiveStats } from "./db";
import { authenticateAccount, createAccount, getAccountByEmail } from "./auth";
import { createSessionToken } from "./session";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
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
  }),
});
export type AppRouter = typeof appRouter;
