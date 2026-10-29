import { router, protectedProcedure } from "./_core/trpc";
import { tenantOf } from "./tenant";
import { z } from "zod";
import { getDb } from "./db";
import { contracts, contractLogs, clients, tenants } from "../drizzle/schema";
import { eq, and, desc, sql, like, or } from "drizzle-orm";
import { getAllContractTemplates } from "./contractTemplates";

export const contractsRouter = router({
  /**
   * Statistici pentru cardurile KPI
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = tenantOf(ctx);
    const db = await getDb();
    if (!db) return { totalActive: 0, totalAddendums: 0, expiringSoon: 0, totalFiles: 0 };

    const [activeRes] = await db
      .select({ count: sql`count(*)` })
      .from(contracts)
      .where(and(eq(contracts.tenantId, tenantId), eq(contracts.status, "activ")));

    const [addendumRes] = await db
      .select({ count: sql`count(*)` })
      .from(contracts)
      .where(and(eq(contracts.tenantId, tenantId), eq(contracts.type, "act_aditional")));

    const [filesRes] = await db
      .select({ count: sql`count(*)` })
      .from(contracts)
      .where(and(eq(contracts.tenantId, tenantId), sql`${contracts.fileUrl} IS NOT NULL AND ${contracts.fileUrl} != ''`));

    // Expiring within 30 days
    const today = new Date().toISOString().split("T")[0];
    const in30Days = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split("T")[0];
    const [expiringRes] = await db
      .select({ count: sql`count(*)` })
      .from(contracts)
      .where(
        and(
          eq(contracts.tenantId, tenantId),
          eq(contracts.status, "activ"),
          sql`${contracts.validUntil} IS NOT NULL AND ${contracts.validUntil} >= ${today} AND ${contracts.validUntil} <= ${in30Days}`
        )
      );

    return {
      totalActive: Number(activeRes?.count || 0),
      totalAddendums: Number(addendumRes?.count || 0),
      totalFiles: Number(filesRes?.count || 0),
      expiringSoon: Number(expiringRes?.count || 0),
    };
  }),

  /**
   * Lista contracte cu filtre (tip, status, partener, cautare)
   */
  list: protectedProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          type: z.string().optional(), // 'toate', 'contract', 'act_aditional', 'pv_receptie', 'anexa', 'altul'
          status: z.string().optional(), // 'toate', 'activ', 'draft', 'expirat', 'reziliat'
          partnerId: z.number().optional(),
          isSupplier: z.number().optional(), // 0 = client, 1 = furnizor
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const tenantId = tenantOf(ctx);
      const db = await getDb();
      if (!db) return [];

      const search = (input?.search || "").trim();
      const type = input?.type && input.type !== "toate" ? input.type : null;
      const status = input?.status && input.status !== "toate" ? (input.status as any) : null;
      const partnerId = input?.partnerId || null;
      const isSupplier = input?.isSupplier !== undefined ? input.isSupplier : null;

      // Base query joining contracts and clients
      let query = db
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
          language: contracts.language,
          fileUrl: contracts.fileUrl,
          fileName: contracts.fileName,
          fileSize: contracts.fileSize,
          notes: contracts.notes,
          supplierSignature: contracts.supplierSignature,
          clientSignature: contracts.clientSignature,
          signatureType: contracts.signatureType,
          signedAt: contracts.signedAt,
          createdAt: contracts.createdAt,
          updatedAt: contracts.updatedAt,
          partnerName: clients.name,
          partnerCui: clients.cui,
          partnerSagaCode: clients.sagaCode,
          partnerIsSupplier: clients.isSupplier,
          partnerCity: clients.city,
        })
        .from(contracts)
        .leftJoin(clients, eq(contracts.partnerId, clients.id))
        .where(
          and(
            eq(contracts.tenantId, tenantId),
            type ? eq(contracts.type, type) : undefined,
            status ? eq(contracts.status, status) : undefined,
            partnerId ? eq(contracts.partnerId, partnerId) : undefined,
            isSupplier !== null ? eq(clients.isSupplier, isSupplier) : undefined,
            search
              ? or(
                  like(contracts.number, `%${search}%`),
                  like(contracts.title, `%${search}%`),
                  like(clients.name, `%${search}%`),
                  like(clients.cui, `%${search}%`),
                  like(clients.sagaCode, `%${search}%`)
                )
              : undefined
          )
        )
        .orderBy(desc(contracts.date), desc(contracts.id));

      const rows = await query;

      // Count child addendums for each contract
      const parentIds = rows.map(r => r.id);
      const childCountMap = new Map<number, number>();
      if (parentIds.length > 0) {
        const childCounts = await db
          .select({
            parentId: contracts.parentContractId,
            cnt: sql`count(*)`,
          })
          .from(contracts)
          .where(and(eq(contracts.tenantId, tenantId), sql`${contracts.parentContractId} IS NOT NULL`))
          .groupBy(contracts.parentContractId);

        for (const c of childCounts) {
          if (c.parentId) childCountMap.set(c.parentId, Number(c.cnt || 0));
        }
      }

      return rows.map(r => ({
        ...r,
        childCount: childCountMap.get(r.id) || 0,
      }));
    }),

  /**
   * Detalii complete contract + Acte Aditionale + Jurnal Audit
   */
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const tenantId = tenantOf(ctx);
      const db = await getDb();
      if (!db) throw new Error("Baza de date indisponibilă");

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
          language: contracts.language,
          contentHtml: contracts.contentHtml,
          fileUrl: contracts.fileUrl,
          fileName: contracts.fileName,
          fileSize: contracts.fileSize,
          notes: contracts.notes,
          supplierSignature: contracts.supplierSignature,
          clientSignature: contracts.clientSignature,
          signatureType: contracts.signatureType,
          digitalSignatureMetadata: contracts.digitalSignatureMetadata,
          signedAt: contracts.signedAt,
          createdAt: contracts.createdAt,
          updatedAt: contracts.updatedAt,
          partnerName: clients.name,
          partnerCui: clients.cui,
          partnerSagaCode: clients.sagaCode,
          partnerRegCom: clients.regCom,
          partnerAddress: clients.address,
          partnerCity: clients.city,
          partnerCountry: clients.country,
          partnerPhone: clients.phone,
          partnerEmail: clients.email,
          partnerIsSupplier: clients.isSupplier,
        })
        .from(contracts)
        .leftJoin(clients, eq(contracts.partnerId, clients.id))
        .where(and(eq(contracts.id, input.id), eq(contracts.tenantId, tenantId)));

      if (!contract) {
        throw new Error("Contractul nu a fost găsit");
      }

      // Fetch child addendums
      const addendums = await db
        .select()
        .from(contracts)
        .where(and(eq(contracts.tenantId, tenantId), eq(contracts.parentContractId, input.id)))
        .orderBy(contracts.date, contracts.id);

      // Fetch audit logs
      const logs = await db
        .select()
        .from(contractLogs)
        .where(and(eq(contractLogs.tenantId, tenantId), eq(contractLogs.contractId, input.id)))
        .orderBy(desc(contractLogs.createdAt));

      // Fetch tenant company info
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));

      return {
        ...contract,
        addendums,
        logs,
        tenant,
      };
    }),

  /**
   * Creare contract nou sau act aditional
   */
  create: protectedProcedure
    .input(
      z.object({
        partnerId: z.number().optional().nullable(),
        partnerName: z.string().optional().nullable(),
        partnerCui: z.string().optional().nullable(),
        parentContractId: z.number().optional().nullable(),
        type: z.string().default("contract"),
        title: z.string().min(1, "Titlul este obligatoriu"),
        number: z.string().min(1, "Numărul este obligatoriu"),
        date: z.string().min(1, "Data este obligatorie"),
        validFrom: z.string().optional().nullable(),
        validUntil: z.string().optional().nullable(),
        value: z.string().optional().nullable(),
        currency: z.string().default("RON"),
        status: z.enum(["activ", "draft", "expirat", "reziliat"]).default("activ"),
        language: z.enum(["ro", "en", "ro_en"]).default("ro"),
        contentHtml: z.string().optional().nullable(),
        fileUrl: z.string().optional().nullable(),
        fileName: z.string().optional().nullable(),
        fileSize: z.number().optional().nullable(),
        notes: z.string().optional().nullable(),
        supplierSignature: z.string().optional().nullable(),
        clientSignature: z.string().optional().nullable(),
        signatureType: z.string().optional().nullable(),
        digitalSignatureMetadata: z.string().optional().nullable(),
        signedAt: z.string().optional().nullable(),
        explanation: z.string().optional(), // Justificare initiala
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = tenantOf(ctx);
      const db = await getDb();
      if (!db) throw new Error("Baza de date indisponibilă");

      let resolvedPartnerId = input.partnerId || null;
      if (!resolvedPartnerId && (input.partnerName || input.partnerCui)) {
        const allPartners = await db
          .select({ id: clients.id, name: clients.name, cui: clients.cui })
          .from(clients)
          .where(eq(clients.tenantId, tenantId));

        const cleanCui = (v: any) =>
          String(v || "")
            .toUpperCase()
            .replace(/\s+/g, "")
            .replace(/^RO/i, "")
            .trim();

        if (input.partnerCui) {
          const m = allPartners.find((p) => cleanCui(p.cui) && cleanCui(p.cui) === cleanCui(input.partnerCui));
          if (m) resolvedPartnerId = m.id;
        }
        if (!resolvedPartnerId && input.partnerName) {
          const searchNorm = input.partnerName.toLowerCase().trim();
          const m = allPartners.find(
            (p) =>
              p.name.toLowerCase().includes(searchNorm) || searchNorm.includes(p.name.toLowerCase())
          );
          if (m) resolvedPartnerId = m.id;
        }
        if (!resolvedPartnerId && input.partnerName) {
          const [ins] = await db.insert(clients).values({
            tenantId,
            name: input.partnerName.trim(),
            cui: input.partnerCui || null,
            country: input.partnerCui && /^[A-Z]{2}/i.test(input.partnerCui) && !/^RO/i.test(input.partnerCui)
              ? input.partnerCui.slice(0, 2).toUpperCase()
              : "RO",
            currency: input.currency || "EUR",
            isSupplier: 0,
            isActive: 1,
          });
          resolvedPartnerId = (ins as any).insertId || null;
        }
      }

      const [result] = await db.insert(contracts).values({
        tenantId,
        partnerId: resolvedPartnerId,
        parentContractId: input.parentContractId || null,
        type: input.type,
        title: input.title,
        number: input.number,
        date: input.date,
        validFrom: input.validFrom || null,
        validUntil: input.validUntil || null,
        value: input.value || "0.00",
        currency: input.currency || "RON",
        status: input.status,
        language: input.language || "ro",
        contentHtml: input.contentHtml || null,
        fileUrl: input.fileUrl || null,
        fileName: input.fileName || null,
        fileSize: input.fileSize || null,
        notes: input.notes || null,
        supplierSignature: input.supplierSignature || null,
        clientSignature: input.clientSignature || null,
        signatureType: input.signatureType || "none",
        digitalSignatureMetadata: input.digitalSignatureMetadata || null,
        signedAt: input.signedAt || null,
      });

      const newId = (result as any).insertId;

      // Inregistrare initiala in Jurnalul de Audit cu Timestamp
      const initialExplanation =
        input.explanation ||
        (input.type === "act_aditional"
          ? `Act adițional emis și înregistrat la contractul de bază`
          : `Contract creat și înregistrat în biblioteca virtuală`);

      await db.insert(contractLogs).values({
        tenantId,
        contractId: newId,
        userId: ctx.user?.id || null,
        userName: ctx.user?.name || ctx.user?.email || "Utilizator",
        actionType: input.type === "act_aditional" ? "act_aditional" : "creare",
        explanation: initialExplanation,
        details: JSON.stringify({
          number: input.number,
          date: input.date,
          status: input.status,
          partnerId: input.partnerId,
          signatureType: input.signatureType || "none",
        }),
      });

      return { success: true, id: newId };
    }),

  /**
   * Actualizare contract + Jurnalizare obligatorie cu timestamp si explicatie
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        partnerId: z.number().optional().nullable(),
        title: z.string().optional(),
        number: z.string().optional(),
        date: z.string().optional(),
        validFrom: z.string().optional().nullable(),
        validUntil: z.string().optional().nullable(),
        value: z.string().optional().nullable(),
        currency: z.string().optional(),
        status: z.enum(["activ", "draft", "expirat", "reziliat"]).optional(),
        language: z.enum(["ro", "en", "ro_en"]).optional(),
        contentHtml: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        supplierSignature: z.string().optional().nullable(),
        clientSignature: z.string().optional().nullable(),
        signatureType: z.string().optional().nullable(),
        digitalSignatureMetadata: z.string().optional().nullable(),
        signedAt: z.string().optional().nullable(),
        actionType: z.string().default("modificare_termeni"),
        explanation: z.string().min(3, "Explicația modificării este obligatorie pentru trasabilitate"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = tenantOf(ctx);
      const db = await getDb();
      if (!db) throw new Error("Baza de date indisponibilă");

      // Citim starea anterioara pentru comparatie
      const [prev] = await db
        .select()
        .from(contracts)
        .where(and(eq(contracts.id, input.id), eq(contracts.tenantId, tenantId)));

      if (!prev) throw new Error("Contractul nu a fost găsit");

      const updateData: any = {};
      if (input.partnerId !== undefined) updateData.partnerId = input.partnerId;
      if (input.title !== undefined) updateData.title = input.title;
      if (input.number !== undefined) updateData.number = input.number;
      if (input.date !== undefined) updateData.date = input.date;
      if (input.validFrom !== undefined) updateData.validFrom = input.validFrom;
      if (input.validUntil !== undefined) updateData.validUntil = input.validUntil;
      if (input.value !== undefined) updateData.value = input.value;
      if (input.currency !== undefined) updateData.currency = input.currency;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.language !== undefined) updateData.language = input.language;
      if (input.contentHtml !== undefined) updateData.contentHtml = input.contentHtml;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.supplierSignature !== undefined) updateData.supplierSignature = input.supplierSignature;
      if (input.clientSignature !== undefined) updateData.clientSignature = input.clientSignature;
      if (input.signatureType !== undefined) updateData.signatureType = input.signatureType;
      if (input.digitalSignatureMetadata !== undefined) updateData.digitalSignatureMetadata = input.digitalSignatureMetadata;
      if (input.signedAt !== undefined) updateData.signedAt = input.signedAt;

      await db
        .update(contracts)
        .set(updateData)
        .where(and(eq(contracts.id, input.id), eq(contracts.tenantId, tenantId)));

      // Inregistrare in Contract Logs cu Timestamp si Explicatie
      await db.insert(contractLogs).values({
        tenantId,
        contractId: input.id,
        userId: ctx.user?.id || null,
        userName: ctx.user?.name || ctx.user?.email || "Utilizator",
        actionType: input.actionType,
        explanation: input.explanation,
        details: JSON.stringify({
          updatedFields: Object.keys(updateData),
          previousStatus: prev.status,
          newStatus: input.status || prev.status,
          previousValidUntil: prev.validUntil,
          newValidUntil: input.validUntil || prev.validUntil,
        }),
      });

      return { success: true };
    }),

  /**
   * Semnare olografică sau electronică digitală
   */
  sign: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        role: z.enum(["supplier", "client"]),
        signatureType: z.enum(["olografic", "digital", "hibrid"]).default("olografic"),
        signatureData: z.string(), // Base64 data URL sau token certificat
        metadata: z.record(z.string(), z.any()).optional(),
        signatoryName: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = tenantOf(ctx);
      const db = await getDb();
      if (!db) throw new Error("Baza de date indisponibilă");

      const [contract] = await db
        .select()
        .from(contracts)
        .where(and(eq(contracts.id, input.id), eq(contracts.tenantId, tenantId)));

      if (!contract) throw new Error("Contractul nu a fost găsit");

      const nowStr = new Date().toISOString();
      const updateData: any = {
        signedAt: nowStr,
        signatureType: input.signatureType,
      };

      if (input.role === "supplier") {
        updateData.supplierSignature = input.signatureData;
      } else {
        updateData.clientSignature = input.signatureData;
      }

      if (input.metadata) {
        updateData.digitalSignatureMetadata = JSON.stringify(input.metadata);
      }

      await db
        .update(contracts)
        .set(updateData)
        .where(and(eq(contracts.id, input.id), eq(contracts.tenantId, tenantId)));

      const roleLabel = input.role === "supplier" ? "Furnizor / Prestator" : "Beneficiar / Client";
      const typeLabel = input.signatureType === "digital" ? "electronică digitală" : "olografică digitală";

      await db.insert(contractLogs).values({
        tenantId,
        contractId: input.id,
        userId: ctx.user?.id || null,
        userName: ctx.user?.name || ctx.user?.email || "Semnatar",
        actionType: "semnare",
        explanation: `Semnătură ${typeLabel} aplicată de ${roleLabel} (${input.signatoryName || "Reprezentant legal"})`,
        details: JSON.stringify({
          role: input.role,
          signatureType: input.signatureType,
          signatoryName: input.signatoryName,
          signedAt: nowStr,
          hasMetadata: !!input.metadata,
        }),
      });

      return { success: true };
    }),

  /**
   * Adaugare inregistrare explicita in jurnalul de audit / comunicare
   */
  addLog: protectedProcedure
    .input(
      z.object({
        contractId: z.number(),
        actionType: z.string().default("notificare"),
        explanation: z.string().min(3, "Explicația este obligatorie"),
        details: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = tenantOf(ctx);
      const db = await getDb();
      if (!db) throw new Error("Baza de date indisponibilă");

      await db.insert(contractLogs).values({
        tenantId,
        contractId: input.contractId,
        userId: ctx.user?.id || null,
        userName: ctx.user?.name || ctx.user?.email || "Utilizator",
        actionType: input.actionType,
        explanation: input.explanation,
        details: input.details || null,
      });

      return { success: true };
    }),

  /**
   * Stergere contract
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const tenantId = tenantOf(ctx);
      const db = await getDb();
      if (!db) throw new Error("Baza de date indisponibilă");

      await db
        .delete(contracts)
        .where(and(eq(contracts.id, input.id), eq(contracts.tenantId, tenantId)));

      return { success: true };
    }),

  /**
   * Import in masa al fisierelor din folder existent
   */
  bulkImport: protectedProcedure
    .input(
      z.object({
        files: z.array(
          z.object({
            fileName: z.string(),
            fileUrl: z.string(),
            fileSize: z.number().optional(),
            partnerId: z.number().optional().nullable(),
            cui: z.string().optional().nullable(),
            partnerName: z.string().optional().nullable(),
            number: z.string().optional().nullable(),
            date: z.string().optional().nullable(),
            value: z.string().optional().nullable(),
            currency: z.string().optional().nullable(),
            contentHtml: z.string().optional().nullable(),
            title: z.string().optional().nullable(),
            type: z.string().default("contract"),
            notes: z.string().optional().nullable(),
            explanation: z.string().optional().nullable(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = tenantOf(ctx);
      const db = await getDb();
      if (!db) throw new Error("Baza de date indisponibilă");

      // Incarcam partenerii existenti pentru auto-detectare
      const allPartners = await db
        .select({ id: clients.id, name: clients.name, cui: clients.cui })
        .from(clients)
        .where(eq(clients.tenantId, tenantId));

      const cleanCui = (v: any) =>
        String(v || "")
          .toUpperCase()
          .replace(/\s+/g, "")
          .replace(/^RO/i, "")
          .trim();

      const partnerByCui = new Map<string, number>();
      for (const p of allPartners) {
        const c = cleanCui(p.cui);
        if (c) partnerByCui.set(c, p.id);
      }

      let importedCount = 0;
      const results = [];

      for (const f of input.files) {
        let assignedPartnerId: number | null = f.partnerId || null;

        // Auto-match dupa CUI daca este detectat
        if (!assignedPartnerId && f.cui) {
          const matchId = partnerByCui.get(cleanCui(f.cui));
          if (matchId) assignedPartnerId = matchId;
        }

        // Auto-match fuzzy dupa nume daca nu e gasit dupa CUI
        if (!assignedPartnerId && f.partnerName) {
          const searchNorm = f.partnerName.toLowerCase().trim();
          const match = allPartners.find(p =>
            p.name.toLowerCase().includes(searchNorm) || searchNorm.includes(p.name.toLowerCase())
          );
          if (match) assignedPartnerId = match.id;
        }

        // Daca avem nume partener extras din PDF/Word dar nu exista inca in clienti, il cream automat
        if (!assignedPartnerId && f.partnerName) {
          const [ins] = await db.insert(clients).values({
            tenantId,
            name: f.partnerName.trim(),
            cui: f.cui || null,
            country: f.cui && /^[A-Z]{2}/i.test(f.cui) && !/^RO/i.test(f.cui)
              ? f.cui.slice(0, 2).toUpperCase()
              : "RO",
            currency: f.currency || "EUR",
            isSupplier: 0,
            isActive: 1,
          });
          const createdPartnerId = (ins as any).insertId || null;
          if (createdPartnerId) {
            assignedPartnerId = createdPartnerId;
            allPartners.push({ id: createdPartnerId, name: f.partnerName.trim(), cui: f.cui || null });
            if (f.cui) partnerByCui.set(cleanCui(f.cui), createdPartnerId);
          }
        }

        const fallbackNum =
          f.number ||
          f.fileName.replace(/\.(pdf|docx|doc)$/i, "").replace(/[^a-zA-Z0-9_-]/g, " ").trim().split(" ")[0] ||
          `CTR-${Date.now().toString().slice(-6)}`;

        const resolvedPartnerName =
          allPartners.find(p => p.id === assignedPartnerId)?.name || f.partnerName || "";

        const docTitle =
          f.title ||
          (resolvedPartnerName
            ? `Contract Nr. ${fallbackNum} — ${resolvedPartnerName}`
            : `Contract ${f.fileName.replace(/\.(pdf|docx|doc)$/i, "")}`);

        const todayStr = new Date().toISOString().split("T")[0];

        const [insertRes] = await db.insert(contracts).values({
          tenantId,
          partnerId: assignedPartnerId,
          type: f.type || "contract",
          title: docTitle,
          number: fallbackNum,
          date: f.date || todayStr,
          validFrom: f.date || todayStr,
          value: f.value || "0.00",
          currency: f.currency || "EUR",
          contentHtml: f.contentHtml || null,
          status: "activ",
          fileUrl: f.fileUrl,
          fileName: f.fileName,
          fileSize: f.fileSize || null,
          notes: f.notes || "Importat automat din arhiva de contracte",
        });

        const newId = (insertRes as any).insertId;

        await db.insert(contractLogs).values({
          tenantId,
          contractId: newId,
          userId: ctx.user?.id || null,
          userName: ctx.user?.name || ctx.user?.email || "Import Arhivă",
          actionType: "creare",
          explanation: f.explanation || `Fișier importat din arhivă (${f.fileName})`,
          details: JSON.stringify({
            originalFileName: f.fileName,
            autoMatchedPartner: !!assignedPartnerId,
          }),
        });

        importedCount++;
        results.push({ id: newId, fileName: f.fileName, partnerId: assignedPartnerId });
      }

      return { success: true, count: importedCount, results };
    }),

  /**
   * Sabloane oficiale preconfigurate (Romana, Engleza sau Bilingv) cu filtrare stricta per tenant
   */
  getTemplates: protectedProcedure
    .input(
      z
        .object({
          language: z.enum(["ro", "en", "ro_en"]).default("ro"),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const tenantId = tenantOf(ctx);
      const db = await getDb();

      let currentTenant: any = null;
      if (db) {
        const [t] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
        currentTenant = t;
      }

      const tenantCui = (currentTenant?.cui || "").toUpperCase();
      const tenantName = (currentTenant?.name || "").toUpperCase();

      const isTradeInvest = tenantId === 1 || tenantCui.includes("42322117") || tenantName.includes("TRADE INVEST");
      const isWoodGlass = tenantId === 4 || tenantCui.includes("28396216") || tenantName.includes("WOOD GLASS");
      const language = (input?.language as any) || "ro";

      return getAllContractTemplates({
        tenantId,
        tenantName,
        tenantCui,
        isTradeInvest,
        isWoodGlass,
        language,
      });
    }),
});
