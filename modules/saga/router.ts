import { z } from "zod";
import { router, protectedProcedure } from "../../server/_core/trpc";
import { getDb } from "../../server/db";
import {
  sagaArticles, sagaArticleMappings, sagaExportHistory,
  sagaGestiuni, sagaFurnizori,
  sagaIntrari, sagaIntrariLinii,
  sagaComenzi, sagaComenziLinii, sagaComenziConsumuri,
  sagaRetete, sagaReteteLinii,
  sagaArticoleContabile,
} from "./schema";
import { eq, and, desc, like, sql, count } from "drizzle-orm";

export const sagaRouter = router({
  articles: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      
      const db = await getDb();
      if (!db) throw new Error("No DB");
      return db
        .select()
        .from(sagaArticles)
        .where(eq(sagaArticles.tenantId, (ctx.user?.tenantId || 1)))
        .orderBy(sagaArticles.name);
    }),

    nextCode: protectedProcedure.query(async ({ ctx }) => {
      
      const db = await getDb();
      if (!db) throw new Error("No DB");
      const [result] = await db
        .select({ total: count() })
        .from(sagaArticles)
        .where(eq(sagaArticles.tenantId, (ctx.user?.tenantId || 1)));
      const next = (result?.total || 0) + 1;
      return `ART-${String(next).padStart(4, "0")}`;
    }),

    create: protectedProcedure
      .input(
        z.object({
          code: z.string().min(1),
          name: z.string().min(1),
          unit: z.string().default("buc"),
          vatRate: z.number().default(19),
          category: z.string().default("Marfuri"),
          accountingAccount: z.string().default("371"),
          sagaCode: z.string().optional(),
          barcode: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        await db.insert(sagaArticles).values({
          tenantId: (ctx.user?.tenantId || 1),
          code: input.code,
          name: input.name,
          unit: input.unit,
          vatRate: String(input.vatRate),
          category: input.category,
          accountingAccount: input.accountingAccount,
          sagaCode: input.sagaCode || null,
          barcode: input.barcode || null,
        });
        return { success: true };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          code: z.string().optional(),
          name: z.string().optional(),
          unit: z.string().optional(),
          vatRate: z.number().optional(),
          category: z.string().optional(),
          accountingAccount: z.string().optional(),
          sagaCode: z.string().optional(),
          barcode: z.string().optional(),
          isActive: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { id, vatRate, ...rest } = input;
        const updateData: any = { ...rest };
        if (vatRate !== undefined) updateData.vatRate = String(vatRate);
        await db
          .update(sagaArticles)
          .set(updateData)
          .where(
            and(
              eq(sagaArticles.id, id),
              eq(sagaArticles.tenantId, (ctx.user?.tenantId || 1))
            )
          );
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        // Also delete associated mappings
        await db
          .delete(sagaArticleMappings)
          .where(
            and(
              eq(sagaArticleMappings.sagaArticleId, input.id),
              eq(sagaArticleMappings.tenantId, (ctx.user?.tenantId || 1))
            )
          );
        await db
          .delete(sagaArticles)
          .where(
            and(
              eq(sagaArticles.id, input.id),
              eq(sagaArticles.tenantId, (ctx.user?.tenantId || 1))
            )
          );
        return { success: true };
      }),

    importFromFile: protectedProcedure
      .input(
        z.object({
          articles: z.array(
            z.object({
              code: z.string(),
              name: z.string(),
              unit: z.string().default("buc"),
              vatRate: z.number().default(19),
              category: z.string().default("Marfuri"),
              accountingAccount: z.string().default("371"),
              barcode: z.string().optional(),
            })
          ),
        })
      )
      .mutation(async ({ input, ctx }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");

        let imported = 0;
        let skipped = 0;

        for (const art of input.articles) {
          // Check if article with this code already exists
          const [existing] = await db
            .select({ id: sagaArticles.id })
            .from(sagaArticles)
            .where(
              and(
                eq(sagaArticles.tenantId, (ctx.user?.tenantId || 1)),
                eq(sagaArticles.code, art.code)
              )
            );

          if (existing) {
            // Update existing
            await db
              .update(sagaArticles)
              .set({
                name: art.name,
                unit: art.unit,
                vatRate: String(art.vatRate),
                category: art.category,
                accountingAccount: art.accountingAccount,
                sagaCode: art.code,
                barcode: art.barcode || null,
              })
              .where(eq(sagaArticles.id, existing.id));
            skipped++;
          } else {
            await db.insert(sagaArticles).values({
              tenantId: (ctx.user?.tenantId || 1),
              code: art.code,
              name: art.name,
              unit: art.unit,
              vatRate: String(art.vatRate),
              category: art.category,
              accountingAccount: art.accountingAccount,
              sagaCode: art.code, // Preserve original SAGA code
              barcode: art.barcode || null,
            });
            imported++;
          }
        }

        return { imported, updated: skipped };
      }),
  }),

  mappings: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      
      const db = await getDb();
      if (!db) throw new Error("No DB");
      const rows = await db
        .select({
          id: sagaArticleMappings.id,
          sagaArticleId: sagaArticleMappings.sagaArticleId,
          supplierCUI: sagaArticleMappings.supplierCUI,
          externalName: sagaArticleMappings.externalName,
          confidence: sagaArticleMappings.confidence,
          createdAt: sagaArticleMappings.createdAt,
          articleCode: sagaArticles.code,
          articleName: sagaArticles.name,
        })
        .from(sagaArticleMappings)
        .leftJoin(
          sagaArticles,
          eq(sagaArticleMappings.sagaArticleId, sagaArticles.id)
        )
        .where(eq(sagaArticleMappings.tenantId, (ctx.user?.tenantId || 1)))
        .orderBy(desc(sagaArticleMappings.createdAt));
      return rows;
    }),

    create: protectedProcedure
      .input(
        z.object({
          sagaArticleId: z.number(),
          externalName: z.string().min(1),
          supplierCUI: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        await db.insert(sagaArticleMappings).values({
          tenantId: (ctx.user?.tenantId || 1),
          sagaArticleId: input.sagaArticleId,
          externalName: input.externalName,
          supplierCUI: input.supplierCUI || null,
          confidence: "100.00", // Manual mapping = 100% confidence
        });
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        await db
          .delete(sagaArticleMappings)
          .where(
            and(
              eq(sagaArticleMappings.id, input.id),
              eq(sagaArticleMappings.tenantId, (ctx.user?.tenantId || 1))
            )
          );
        return { success: true };
      }),

    // Suggest matches for unmapped invoice line descriptions
    suggest: protectedProcedure
      .input(z.object({ description: z.string() }))
      .query(async ({ input, ctx }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");

        // Simple fuzzy: search articles whose name contains words from the description
        const words = input.description
          .toLowerCase()
          .split(/[\s,;.\-\/]+/)
          .filter((w) => w.length > 2);

        if (words.length === 0) return [];

        // Search for articles matching any significant word
        const allArticles = await db
          .select()
          .from(sagaArticles)
          .where(eq(sagaArticles.tenantId, (ctx.user?.tenantId || 1)));

        const scored = allArticles
          .map((art) => {
            const artName = art.name.toLowerCase();
            const matchedWords = words.filter((w) => artName.includes(w));
            const score = words.length > 0 ? (matchedWords.length / words.length) * 100 : 0;
            return { ...art, score };
          })
          .filter((a) => a.score > 20)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

        return scored;
      }),

    // Get unmapped descriptions from NIR lines that don't have a mapping yet
    unmapped: protectedProcedure.query(async ({ ctx }) => {
      
      const db = await getDb();
      if (!db) throw new Error("No DB");

      const { nirLines, nir } = await import("../../drizzle/schema");

      // Get all unique descriptions from NIR lines
      const allLines = await db
        .select({
          description: nirLines.description,
          unit: nirLines.unit,
          supplierName: nir.supplierName,
          supplierCUI: nir.supplierCUI,
        })
        .from(nirLines)
        .innerJoin(nir, eq(nir.id, nirLines.nirId))
        .where(eq(nir.tenantId, (ctx.user?.tenantId || 1)));

      // Get all existing mappings
      const existingMappings = await db
        .select({ externalName: sagaArticleMappings.externalName })
        .from(sagaArticleMappings)
        .where(eq(sagaArticleMappings.tenantId, (ctx.user?.tenantId || 1)));

      const mappedNames = new Set(
        existingMappings.map((m) => m.externalName.toLowerCase())
      );

      // Find unique unmapped descriptions
      const unmappedMap = new Map<
        string,
        { description: string; unit: string; supplierName: string | null; supplierCUI: string | null; count: number }
      >();

      for (const line of allLines) {
        const key = line.description.toLowerCase().trim();
        if (mappedNames.has(key)) continue;
        if (unmappedMap.has(key)) {
          unmappedMap.get(key)!.count++;
        } else {
          unmappedMap.set(key, {
            description: line.description,
            unit: line.unit || "buc",
            supplierName: line.supplierName,
            supplierCUI: line.supplierCUI,
            count: 1,
          });
        }
      }

      return Array.from(unmappedMap.values()).sort((a, b) => b.count - a.count);
    }),
  }),

  export: protectedProcedure
    .input(z.object({ month: z.number(), year: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const { generateSagaExportXML, getTenantCompanyProfile } = await import(
        "../../server/sagaXmlGenerator"
      );
      const tenantId = ctx.user?.tenantId || 1;
      const xml = await generateSagaExportXML(tenantId, input.month, input.year);
      const company = await getTenantCompanyProfile(tenantId);
      const safeCui = company.cui.replace(/^RO/i, "").trim() || "EXPORT";
      const filename = `F_${safeCui}_${input.month}_${input.year}.xml`;

      // Save export history
      const db = await getDb();
      if (db) {
        await db.insert(sagaExportHistory).values({
          tenantId,
          month: input.month,
          year: input.year,
        });
      }

      return { xml, filename };
    }),

  exportArticole: protectedProcedure.mutation(async ({ ctx }) => {
    const { generateSagaArticlesXML } = await import("../../server/sagaXmlGenerator");
    const { format } = await import("date-fns");
    const tenantId = ctx.user?.tenantId || 1;
    const xml = await generateSagaArticlesXML(tenantId);
    const filename = `ART_${format(new Date(), "ddMMyyyy")}.xml`;
    return { xml, filename };
  }),

  exportClienti: protectedProcedure.mutation(async ({ ctx }) => {
    const { generateSagaClientsXML } = await import("../../server/sagaXmlGenerator");
    const { format } = await import("date-fns");
    const tenantId = ctx.user?.tenantId || 1;
    const xml = await generateSagaClientsXML(tenantId);
    const filename = `CLI_${format(new Date(), "ddMMyyyy")}.xml`;
    return { xml, filename };
  }),

  getSagaWebConfig: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const tenantId = ctx.user?.tenantId || 1;
    if (!db) return { sagaWebToken: "", sagaWebCui: "" };
    const { tenants } = await import("../../drizzle/schema");
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    let sagaWebToken = "";
    let sagaWebCui = tenant?.cui?.replace(/^RO/i, "").trim() || "";
    if (tenant?.settings) {
      try {
        const s = JSON.parse(tenant.settings);
        if (s.sagaWebToken) sagaWebToken = s.sagaWebToken;
        if (s.sagaWebCui) sagaWebCui = s.sagaWebCui;
      } catch {}
    }
    return { sagaWebToken, sagaWebCui };
  }),

  saveSagaWebConfig: protectedProcedure
    .input(
      z.object({
        sagaWebToken: z.string().optional(),
        sagaWebCui: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const tenantId = ctx.user?.tenantId || 1;
      if (!db) throw new Error("DB unavailable");
      const { tenants } = await import("../../drizzle/schema");
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      let settings: any = {};
      if (tenant?.settings) {
        try {
          settings = JSON.parse(tenant.settings);
        } catch {}
      }
      if (input.sagaWebToken !== undefined) settings.sagaWebToken = input.sagaWebToken.trim();
      if (input.sagaWebCui !== undefined) settings.sagaWebCui = input.sagaWebCui.trim();

      await db
        .update(tenants)
        .set({ settings: JSON.stringify(settings) })
        .where(eq(tenants.id, tenantId));

      return { success: true };
    }),

  pushToSagaWeb: protectedProcedure
    .input(
      z.object({
        month: z.number(),
        year: z.number(),
        sagaToken: z.string().optional(),
        sagaCui: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const axios = (await import("axios")).default;
      const FormData = (await import("form-data")).default;
      const { generateSagaExportXML, getTenantCompanyProfile, updateTenantSagaToken } =
        await import("../../server/sagaXmlGenerator");
      const tenantId = ctx.user?.tenantId || 1;

      const db = await getDb();
      let token = input.sagaToken?.trim();
      let cui = input.sagaCui?.trim();

      if (!token || !cui) {
        if (db) {
          const { tenants } = await import("../../drizzle/schema");
          const [t] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
          if (t?.settings) {
            try {
              const s = JSON.parse(t.settings);
              if (!token) token = s.sagaWebToken;
              if (!cui) cui = s.sagaWebCui || t.cui?.replace(/^RO/i, "");
            } catch {}
          }
          if (!cui && t?.cui) cui = t.cui.replace(/^RO/i, "");
        }
      }

      if (!token) {
        throw new Error("Lipsește token-ul SAGA Web. Completează cheia generată din Saga Web: Administrare > Utilizatori > Integrare API.");
      }
      if (!cui) {
        const company = await getTenantCompanyProfile(tenantId);
        cui = company.cui.replace(/^RO/i, "").trim();
      }

      const xmlContent = await generateSagaExportXML(tenantId, input.month, input.year);
      const fileName = `F_${cui}_${input.month}_${input.year}.xml`;

      const form = new FormData();
      form.append("file", Buffer.from(xmlContent, "utf8"), {
        filename: fileName,
        contentType: "application/xml",
      });

      try {
        const response = await axios.post("https://web.sagasoft.ro/api/v20260225/Import", form, {
          headers: {
            ...form.getHeaders(),
            "X-Saga-Cod-Fiscal": cui,
            Authorization: `Bearer ${token}`,
          },
          timeout: 30000,
        });

        const newToken = response.headers["x-saga-refresh-token"];
        if (newToken) {
          await updateTenantSagaToken(tenantId, newToken);
        }

        // Salvează în istoric
        if (db) {
          await db.insert(sagaExportHistory).values({
            tenantId,
            month: input.month,
            year: input.year,
          });
        }

        return {
          success: true,
          message: response.data?.message || "Import realizat cu succes în SAGA Web!",
          data: response.data,
          newToken: newToken || null,
        };
      } catch (err: any) {
        const errMsg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err.message ||
          "Eroare la apelul către SAGA Web API";
        throw new Error(errMsg);
      }
    }),

  exportHistory: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(sagaExportHistory)
      .where(eq(sagaExportHistory.tenantId, (ctx.user?.tenantId || 1)))
      .orderBy(desc(sagaExportHistory.createdAt))
      .limit(20);
  }),

  getExportPreview: protectedProcedure
    .input(
      z
        .object({
          month: z.number().optional(),
          year: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      const tenantId = ctx.user?.tenantId || 1;
      if (!db) return { invoices: [], nirs: [], totalAllInvoices: 0, totalAllNirs: 0 };

      const schema = await import("../../drizzle/schema");

      // Query Emitted Invoices
      const invoices = await db
        .select({
          id: schema.emittedInvoices.id,
          number: schema.emittedInvoices.number,
          issueDate: schema.emittedInvoices.issueDate,
          dueDate: schema.emittedInvoices.dueDate,
          total: schema.emittedInvoices.total,
          currency: schema.emittedInvoices.currency,
          clientName: schema.clients.name,
          clientCui: schema.clients.cui,
        })
        .from(schema.emittedInvoices)
        .leftJoin(schema.clients, eq(schema.emittedInvoices.clientId, schema.clients.id))
        .where(eq(schema.emittedInvoices.tenantId, tenantId))
        .orderBy(desc(schema.emittedInvoices.issueDate));

      // Query NIRs
      const nirs = await db
        .select({
          id: schema.nir.id,
          nirNumber: schema.nir.nirNumber,
          invoiceNumber: schema.nir.invoiceNumber,
          receiptDate: schema.nir.receiptDate,
          supplierName: schema.nir.supplierName,
          supplierCUI: schema.nir.supplierCUI,
          accountingAccount: schema.nir.accountingAccount,
          status: schema.nir.status,
        })
        .from(schema.nir)
        .where(eq(schema.nir.tenantId, tenantId))
        .orderBy(desc(schema.nir.receiptDate));

      const nirLines = await db
        .select({
          nirId: schema.nirLines.nirId,
          total: schema.nirLines.total,
        })
        .from(schema.nirLines);

      const nirTotals = new Map<number, number>();
      for (const l of nirLines) {
        const val = parseFloat(String(l.total)) || 0;
        nirTotals.set(l.nirId, (nirTotals.get(l.nirId) || 0) + val);
      }

      const nirsWithTotals = nirs.map((n) => ({
        ...n,
        total: (nirTotals.get(n.id) || 0).toFixed(2),
      }));

      // Filter by month/year if specified
      let filteredInvoices = invoices;
      let filteredNirs = nirsWithTotals;

      if (input?.month && input?.year) {
        const startStr = `${input.year}-${String(input.month).padStart(2, "0")}-01`;
        const lastDay = new Date(input.year, input.month, 0).getDate();
        const endStr = `${input.year}-${String(input.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

        filteredInvoices = invoices.filter((i) => {
          if (!i.issueDate) return false;
          const d = i.issueDate.substring(0, 10);
          return d >= startStr && d <= endStr;
        });

        filteredNirs = nirsWithTotals.filter((n) => {
          if (!n.receiptDate) return false;
          const d = n.receiptDate.substring(0, 10);
          return d >= startStr && d <= endStr;
        });
      }

      return {
        invoices: filteredInvoices,
        nirs: filteredNirs,
        totalAllInvoices: invoices.length,
        totalAllNirs: nirs.length,
      };
    }),

  // Plan de Conturi — returneaza lista completa de conturi SAGA
  planConturi: protectedProcedure
    .input(z.object({ query: z.string().optional(), stockOnly: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      const { SAGA_PLAN_CONTURI, getStockRelevantAccounts, searchAccounts } = await import("./planConturi");
      if (input?.query) return searchAccounts(input.query);
      if (input?.stockOnly) return getStockRelevantAccounts();
      return SAGA_PLAN_CONTURI;
    }),

  // ═════════════════════════════════════════════════════════════════════════
  //  GESTIUNI — CRUD
  // ═════════════════════════════════════════════════════════════════════════
  gestiuni: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      
      const db = await getDb();
      if (!db) return [];
      return db.select().from(sagaGestiuni)
        .where(eq(sagaGestiuni.tenantId, (ctx.user?.tenantId || 1)))
        .orderBy(sagaGestiuni.cod);
    }),

    create: protectedProcedure
      .input(z.object({
        cod: z.string().min(1),
        denumire: z.string().min(1),
        tipGestiune: z.string().optional(),
        gestionar: z.string().optional(),
        laPretVanzare: z.number().optional(),
        analitic371: z.string().optional(),
        analitic378: z.string().optional(),
        analitic4428: z.string().optional(),
        analitic607: z.string().optional(),
        analitic707: z.string().optional(),
        tvaImplicit: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        await db.insert(sagaGestiuni).values({ ...input, tenantId: (ctx.user?.tenantId || 1) });
        return { ok: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        cod: z.string().optional(),
        denumire: z.string().optional(),
        tipGestiune: z.string().optional(),
        gestionar: z.string().optional(),
        laPretVanzare: z.number().optional(),
        analitic371: z.string().optional(),
        analitic378: z.string().optional(),
        analitic4428: z.string().optional(),
        analitic607: z.string().optional(),
        analitic707: z.string().optional(),
        tvaImplicit: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { id, ...data } = input;
        await db.update(sagaGestiuni).set(data)
          .where(and(eq(sagaGestiuni.id, id), eq(sagaGestiuni.tenantId, (ctx.user?.tenantId || 1))));
        return { ok: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        await db.delete(sagaGestiuni)
          .where(and(eq(sagaGestiuni.id, input.id), eq(sagaGestiuni.tenantId, (ctx.user?.tenantId || 1))));
        return { ok: true };
      }),

    nextCode: protectedProcedure.query(async ({ ctx }) => {
      
      const db = await getDb();
      if (!db) return "0001";
      const result = await db.select({ cnt: count() }).from(sagaGestiuni)
        .where(eq(sagaGestiuni.tenantId, (ctx.user?.tenantId || 1)));
      return String((result[0]?.cnt || 0) + 1).padStart(4, "0");
    }),
  }),

  // ═════════════════════════════════════════════════════════════════════════
  //  FURNIZORI — CRUD
  // ═════════════════════════════════════════════════════════════════════════
  furnizori: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      
      const db = await getDb();
      if (!db) return [];
      return db.select().from(sagaFurnizori)
        .where(eq(sagaFurnizori.tenantId, (ctx.user?.tenantId || 1)))
        .orderBy(sagaFurnizori.cod);
    }),

    create: protectedProcedure
      .input(z.object({
        cod: z.string().min(1),
        denumire: z.string().min(1),
        cui: z.string().optional(),
        regCom: z.string().optional(),
        adresa: z.string().optional(),
        judet: z.string().optional(),
        localitate: z.string().optional(),
        banca: z.string().optional(),
        contBanca: z.string().optional(),
        telefon: z.string().optional(),
        email: z.string().optional(),
        contFurnizor: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        await db.insert(sagaFurnizori).values({ ...input, tenantId: (ctx.user?.tenantId || 1) });
        return { ok: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        cod: z.string().optional(),
        denumire: z.string().optional(),
        cui: z.string().optional(),
        regCom: z.string().optional(),
        adresa: z.string().optional(),
        judet: z.string().optional(),
        localitate: z.string().optional(),
        banca: z.string().optional(),
        contBanca: z.string().optional(),
        telefon: z.string().optional(),
        email: z.string().optional(),
        contFurnizor: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { id, ...data } = input;
        await db.update(sagaFurnizori).set(data)
          .where(and(eq(sagaFurnizori.id, id), eq(sagaFurnizori.tenantId, (ctx.user?.tenantId || 1))));
        return { ok: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        await db.delete(sagaFurnizori)
          .where(and(eq(sagaFurnizori.id, input.id), eq(sagaFurnizori.tenantId, (ctx.user?.tenantId || 1))));
        return { ok: true };
      }),

    nextCode: protectedProcedure.query(async ({ ctx }) => {
      
      const db = await getDb();
      if (!db) return "F001";
      const result = await db.select({ cnt: count() }).from(sagaFurnizori)
        .where(eq(sagaFurnizori.tenantId, (ctx.user?.tenantId || 1)));
      return "F" + String((result[0]?.cnt || 0) + 1).padStart(3, "0");
    }),
  }),

  // ═════════════════════════════════════════════════════════════════════════
  //  INTRĂRI — Master-Detail CRUD
  // ═════════════════════════════════════════════════════════════════════════
  intrari: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      
      const db = await getDb();
      if (!db) return [];
      return db.select().from(sagaIntrari)
        .where(eq(sagaIntrari.tenantId, (ctx.user?.tenantId || 1)))
        .orderBy(desc(sagaIntrari.data));
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const [header] = await db.select().from(sagaIntrari)
          .where(and(eq(sagaIntrari.id, input.id), eq(sagaIntrari.tenantId, (ctx.user?.tenantId || 1))));
        if (!header) throw new Error("Intrare not found");
        const lines = await db.select().from(sagaIntrariLinii)
          .where(eq(sagaIntrariLinii.intrareId, input.id))
          .orderBy(sagaIntrariLinii.lineOrder);
        return { ...header, lines };
      }),

    create: protectedProcedure
      .input(z.object({
        tip: z.string().optional(),
        nrDoc: z.string().optional(),
        codFurnizor: z.string().optional(),
        numeFurnizor: z.string().optional(),
        cuiFurnizor: z.string().optional(),
        tvaInclus: z.number().optional(),
        data: z.string(),
        scadent: z.string().optional(),
        lines: z.array(z.object({
          tip: z.string().optional(),
          gestiuneId: z.number().optional(),
          articolId: z.number().optional(),
          cod: z.string().optional(),
          denumire: z.string(),
          um: z.string().optional(),
          tvaPercent: z.string().optional(),
          cantitate: z.string().optional(),
          pretUnitar: z.string().optional(),
          cont: z.string().optional(),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        // Get next nrIntern
        const existing = await db.select({ cnt: count() }).from(sagaIntrari)
          .where(eq(sagaIntrari.tenantId, (ctx.user?.tenantId || 1)));
        const nrIntern = (existing[0]?.cnt || 0) + 1;
        
        const { lines, ...headerData } = input;
        // Calculate totals from lines
        let valoare = 0, tvaTot = 0;
        for (const l of (lines || [])) {
          const cant = parseFloat(l.cantitate || "0");
          const pret = parseFloat(l.pretUnitar || "0");
          const tvaP = parseFloat(l.tvaPercent || "19");
          const val = cant * pret;
          valoare += val;
          tvaTot += val * tvaP / 100;
        }

        const [result] = await db.insert(sagaIntrari).values({
          ...headerData,
          tenantId: (ctx.user?.tenantId || 1),
          nrIntern,
          valoare: String(valoare.toFixed(2)),
          tva: String(tvaTot.toFixed(2)),
          total: String((valoare + tvaTot).toFixed(2)),
          neachitat: String((valoare + tvaTot).toFixed(2)),
        });
        const intrareId = result.insertId;

        // Insert lines
        if (lines?.length) {
          for (let i = 0; i < lines.length; i++) {
            const l = lines[i];
            const cant = parseFloat(l.cantitate || "0");
            const pret = parseFloat(l.pretUnitar || "0");
            const tvaP = parseFloat(l.tvaPercent || "19");
            const val = cant * pret;
            const tvaS = val * tvaP / 100;
            await db.insert(sagaIntrariLinii).values({
              intrareId,
              tip: l.tip,
              gestiuneId: l.gestiuneId,
              articolId: l.articolId,
              cod: l.cod,
              denumire: l.denumire,
              um: l.um,
              tvaPercent: l.tvaPercent,
              cantitate: l.cantitate,
              pretUnitar: l.pretUnitar,
              valoare: String(val.toFixed(2)),
              tvaSuma: String(tvaS.toFixed(2)),
              total: String((val + tvaS).toFixed(2)),
              cont: l.cont,
              lineOrder: i,
            });
          }
        }
        return { id: intrareId, nrIntern };
      }),

    addLine: protectedProcedure
      .input(z.object({
        intrareId: z.number(),
        tip: z.string().optional(),
        gestiuneId: z.number().optional(),
        articolId: z.number().optional(),
        cod: z.string().optional(),
        denumire: z.string(),
        um: z.string().optional(),
        tvaPercent: z.string().optional(),
        cantitate: z.string().optional(),
        pretUnitar: z.string().optional(),
        cont: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const cant = parseFloat(input.cantitate || "0");
        const pret = parseFloat(input.pretUnitar || "0");
        const tvaP = parseFloat(input.tvaPercent || "19");
        const val = cant * pret;
        const tvaS = val * tvaP / 100;
        await db.insert(sagaIntrariLinii).values({
          ...input,
          valoare: String(val.toFixed(2)),
          tvaSuma: String(tvaS.toFixed(2)),
          total: String((val + tvaS).toFixed(2)),
        });
        // Recalculate header totals
        const allLines = await db.select().from(sagaIntrariLinii)
          .where(eq(sagaIntrariLinii.intrareId, input.intrareId));
        let totVal = 0, totTva = 0;
        for (const l of allLines) { totVal += parseFloat(String(l.valoare)); totTva += parseFloat(String(l.tvaSuma)); }
        await db.update(sagaIntrari).set({
          valoare: String(totVal.toFixed(2)),
          tva: String(totTva.toFixed(2)),
          total: String((totVal + totTva).toFixed(2)),
          neachitat: String((totVal + totTva).toFixed(2)),
        }).where(eq(sagaIntrari.id, input.intrareId));
        return { ok: true };
      }),

    deleteLine: protectedProcedure
      .input(z.object({ id: z.number(), intrareId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        await db.delete(sagaIntrariLinii).where(eq(sagaIntrariLinii.id, input.id));
        // Recalculate header
        const allLines = await db.select().from(sagaIntrariLinii)
          .where(eq(sagaIntrariLinii.intrareId, input.intrareId));
        let totVal = 0, totTva = 0;
        for (const l of allLines) { totVal += parseFloat(String(l.valoare)); totTva += parseFloat(String(l.tvaSuma)); }
        await db.update(sagaIntrari).set({
          valoare: String(totVal.toFixed(2)),
          tva: String(totTva.toFixed(2)),
          total: String((totVal + totTva).toFixed(2)),
        }).where(eq(sagaIntrari.id, input.intrareId));
        return { ok: true };
      }),

    validate: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        await db.update(sagaIntrari).set({ status: "validat" })
          .where(and(eq(sagaIntrari.id, input.id), eq(sagaIntrari.tenantId, (ctx.user?.tenantId || 1))));
        // TODO: auto-generate articole contabile (371=D / 401=C)
        return { ok: true };
      }),

    stornare: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        await db.update(sagaIntrari).set({ status: "stornat" })
          .where(and(eq(sagaIntrari.id, input.id), eq(sagaIntrari.tenantId, (ctx.user?.tenantId || 1))));
        return { ok: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        await db.delete(sagaIntrariLinii).where(eq(sagaIntrariLinii.intrareId, input.id));
        await db.delete(sagaIntrari)
          .where(and(eq(sagaIntrari.id, input.id), eq(sagaIntrari.tenantId, (ctx.user?.tenantId || 1))));
        return { ok: true };
      }),
  }),

  // ═════════════════════════════════════════════════════════════════════════
  //  COMENZI + PRODUCȚIE
  // ═════════════════════════════════════════════════════════════════════════
  comenzi: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      
      const db = await getDb();
      if (!db) return [];
      return db.select().from(sagaComenzi)
        .where(eq(sagaComenzi.tenantId, (ctx.user?.tenantId || 1)))
        .orderBy(desc(sagaComenzi.data));
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const [header] = await db.select().from(sagaComenzi)
          .where(and(eq(sagaComenzi.id, input.id), eq(sagaComenzi.tenantId, (ctx.user?.tenantId || 1))));
        if (!header) throw new Error("Comanda not found");
        const produse = await db.select().from(sagaComenziLinii)
          .where(eq(sagaComenziLinii.comandaId, input.id))
          .orderBy(sagaComenziLinii.lineOrder);
        const consumuri = await db.select().from(sagaComenziConsumuri)
          .where(eq(sagaComenziConsumuri.comandaId, input.id))
          .orderBy(sagaComenziConsumuri.lineOrder);
        return { ...header, produse, consumuri };
      }),

    create: protectedProcedure
      .input(z.object({
        tipComanda: z.string().optional(),
        data: z.string(),
        codClient: z.string().optional(),
        denumireClient: z.string().optional(),
        adresaLivrare: z.string().optional(),
        dataLivrarii: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const existing = await db.select({ cnt: count() }).from(sagaComenzi)
          .where(eq(sagaComenzi.tenantId, (ctx.user?.tenantId || 1)));
        const nrComanda = (existing[0]?.cnt || 0) + 1;
        const [result] = await db.insert(sagaComenzi).values({
          ...input, tenantId: (ctx.user?.tenantId || 1), nrComanda,
        });
        return { id: result.insertId, nrComanda };
      }),

    addProduct: protectedProcedure
      .input(z.object({
        comandaId: z.number(),
        gestiuneId: z.number().optional(),
        articolId: z.number().optional(),
        cod: z.string().optional(),
        denumire: z.string(),
        um: z.string().optional(),
        tvaPercent: z.string().optional(),
        cantitate: z.string().optional(),
        pretUnitar: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const cant = parseFloat(input.cantitate || "0");
        const pret = parseFloat(input.pretUnitar || "0");
        const tvaP = parseFloat(input.tvaPercent || "19");
        const val = cant * pret;
        const tvaS = val * tvaP / 100;
        await db.insert(sagaComenziLinii).values({
          ...input,
          valoare: String(val.toFixed(2)),
          tvaSuma: String(tvaS.toFixed(2)),
          total: String((val + tvaS).toFixed(2)),
        });
        return { ok: true };
      }),

    addConsum: protectedProcedure
      .input(z.object({
        comandaId: z.number(),
        gestiuneDescarcareId: z.number().optional(),
        articolId: z.number().optional(),
        cod: z.string().optional(),
        denumire: z.string(),
        um: z.string().optional(),
        tvaPercent: z.string().optional(),
        cantitate: z.string().optional(),
        pretUnitar: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const cant = parseFloat(input.cantitate || "0");
        const pret = parseFloat(input.pretUnitar || "0");
        const tvaP = parseFloat(input.tvaPercent || "19");
        const val = cant * pret;
        const tvaS = val * tvaP / 100;
        await db.insert(sagaComenziConsumuri).values({
          ...input,
          valoare: String(val.toFixed(2)),
          tvaSuma: String(tvaS.toFixed(2)),
          total: String((val + tvaS).toFixed(2)),
        });
        return { ok: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        await db.delete(sagaComenziLinii).where(eq(sagaComenziLinii.comandaId, input.id));
        await db.delete(sagaComenziConsumuri).where(eq(sagaComenziConsumuri.comandaId, input.id));
        await db.delete(sagaComenzi)
          .where(and(eq(sagaComenzi.id, input.id), eq(sagaComenzi.tenantId, (ctx.user?.tenantId || 1))));
        return { ok: true };
      }),
  }),

  // ═════════════════════════════════════════════════════════════════════════
  //  REȚETE (Bill of Materials)
  // ═════════════════════════════════════════════════════════════════════════
  retete: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      
      const db = await getDb();
      if (!db) return [];
      return db.select().from(sagaRetete)
        .where(eq(sagaRetete.tenantId, (ctx.user?.tenantId || 1)))
        .orderBy(sagaRetete.denumire);
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const [reteta] = await db.select().from(sagaRetete)
          .where(and(eq(sagaRetete.id, input.id), eq(sagaRetete.tenantId, (ctx.user?.tenantId || 1))));
        if (!reteta) throw new Error("Reteta not found");
        const linii = await db.select().from(sagaReteteLinii)
          .where(eq(sagaReteteLinii.retetaId, input.id))
          .orderBy(sagaReteteLinii.lineOrder);
        return { ...reteta, linii };
      }),

    create: protectedProcedure
      .input(z.object({
        articolProdusId: z.number(),
        denumire: z.string().min(1),
        linii: z.array(z.object({
          articolMaterieId: z.number(),
          cantitate: z.string(),
          um: z.string().optional(),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const [result] = await db.insert(sagaRetete).values({
          tenantId: (ctx.user?.tenantId || 1),
          articolProdusId: input.articolProdusId,
          denumire: input.denumire,
        });
        const retetaId = result.insertId;
        if (input.linii?.length) {
          for (let i = 0; i < input.linii.length; i++) {
            await db.insert(sagaReteteLinii).values({
              retetaId,
              articolMaterieId: input.linii[i].articolMaterieId,
              cantitate: input.linii[i].cantitate,
              um: input.linii[i].um,
              lineOrder: i,
            });
          }
        }
        return { id: retetaId };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        await db.delete(sagaReteteLinii).where(eq(sagaReteteLinii.retetaId, input.id));
        await db.delete(sagaRetete)
          .where(and(eq(sagaRetete.id, input.id), eq(sagaRetete.tenantId, (ctx.user?.tenantId || 1))));
        return { ok: true };
      }),
  }),

  // ═════════════════════════════════════════════════════════════════════════
  //  ARTICOLE CONTABILE
  // ═════════════════════════════════════════════════════════════════════════
  articoleContabile: router({
    list: protectedProcedure
      .input(z.object({ month: z.number().optional(), year: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        
        const db = await getDb();
        if (!db) return [];
        return db.select().from(sagaArticoleContabile)
          .where(eq(sagaArticoleContabile.tenantId, (ctx.user?.tenantId || 1)))
          .orderBy(desc(sagaArticoleContabile.data))
          .limit(500);
      }),

    create: protectedProcedure
      .input(z.object({
        data: z.string(),
        nrDocument: z.string().optional(),
        contDebit: z.string(),
        contCredit: z.string(),
        suma: z.string(),
        valuta: z.string().optional(),
        curs: z.string().optional(),
        sumaValuta: z.string().optional(),
        explicatie: z.string().optional(),
        tip: z.string().optional(),
        activitate: z.string().optional(),
        sourceType: z.string().optional(),
        sourceId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        await db.insert(sagaArticoleContabile).values({ ...input, tenantId: (ctx.user?.tenantId || 1) });
        return { ok: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        
        const db = await getDb();
        if (!db) throw new Error("No DB");
        await db.delete(sagaArticoleContabile)
          .where(and(eq(sagaArticoleContabile.id, input.id), eq(sagaArticoleContabile.tenantId, (ctx.user?.tenantId || 1))));
        return { ok: true };
      }),
  }),
});

