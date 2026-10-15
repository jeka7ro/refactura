import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { contracts, contractLogs, clients, tenants } from "../drizzle/schema";
import { eq, and, desc, sql, like, or } from "drizzle-orm";

export const contractsRouter = router({
  /**
   * Statistici pentru cardurile KPI
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user?.tenantId || 1;
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
      const tenantId = ctx.user?.tenantId || 1;
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
          fileUrl: contracts.fileUrl,
          fileName: contracts.fileName,
          fileSize: contracts.fileSize,
          notes: contracts.notes,
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
      const tenantId = ctx.user?.tenantId || 1;
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
          contentHtml: contracts.contentHtml,
          fileUrl: contracts.fileUrl,
          fileName: contracts.fileName,
          fileSize: contracts.fileSize,
          notes: contracts.notes,
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
        contentHtml: z.string().optional().nullable(),
        fileUrl: z.string().optional().nullable(),
        fileName: z.string().optional().nullable(),
        fileSize: z.number().optional().nullable(),
        notes: z.string().optional().nullable(),
        explanation: z.string().optional(), // Justificare initiala
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user?.tenantId || 1;
      const db = await getDb();
      if (!db) throw new Error("Baza de date indisponibilă");

      const [result] = await db.insert(contracts).values({
        tenantId,
        partnerId: input.partnerId || null,
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
        contentHtml: input.contentHtml || null,
        fileUrl: input.fileUrl || null,
        fileName: input.fileName || null,
        fileSize: input.fileSize || null,
        notes: input.notes || null,
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
        contentHtml: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        actionType: z.string().default("modificare_termeni"),
        explanation: z.string().min(3, "Explicația modificării este obligatorie pentru trasabilitate"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user?.tenantId || 1;
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
      if (input.contentHtml !== undefined) updateData.contentHtml = input.contentHtml;
      if (input.notes !== undefined) updateData.notes = input.notes;

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
      const tenantId = ctx.user?.tenantId || 1;
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
      const tenantId = ctx.user?.tenantId || 1;
      const db = await getDb();
      if (!db) throw new Error("Baza de date indisponibilă");

      await db
        .delete(contracts)
        .where(and(eq(contracts.id, input.id), eq(contracts.tenantId, tenantId)));

      return { success: true };
    }),

  /**
   * Import in masa al fisierelor din folderul existent Wood Glass
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
            title: z.string().optional().nullable(),
            type: z.string().default("contract"),
            notes: z.string().optional().nullable(),
            explanation: z.string().optional().nullable(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user?.tenantId || 1;
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

        const fallbackNum =
          f.number ||
          f.fileName.replace(/\.pdf$/i, "").replace(/[^a-zA-Z0-9_-]/g, " ").trim().split(" ")[0] ||
          `CTR-${Date.now().toString().slice(-6)}`;

        const docTitle =
          f.title ||
          (assignedPartnerId
            ? `Contract ${allPartners.find(p => p.id === assignedPartnerId)?.name || ""}`
            : `Contract ${f.fileName}`);

        const todayStr = new Date().toISOString().split("T")[0];

        const [insertRes] = await db.insert(contracts).values({
          tenantId,
          partnerId: assignedPartnerId,
          type: f.type || "contract",
          title: docTitle,
          number: fallbackNum,
          date: f.date || todayStr,
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
          explanation: f.explanation || `Fișier importat din arhiva Wood Glass (${f.fileName})`,
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
   * Sabloane oficiale preconfigurate (Contract Cadru Tamplarie/Sticla, Act Aditional, PV Receptie)
   */
  getTemplates: protectedProcedure.query(async () => {
    return [
      {
        id: "contract-woodglass-oficial",
        name: "Contract Vânzare-Cumpărare Tâmplărie Lemn Stratificat (Model Oficial Wood Glass)",
        type: "contract",
        description: "Șablonul oficial S.C. WOOD GLASS S.R.L. utilizat pentru producție tâmplărie lemn stratificat Pin/Stejar 68mm, avans 50%, garanție 3 ani și livrare 60 zile",
        contentHtml: `
<h2>CONTRACT DE VÂNZARE-CUMPĂRARE</h2>
<p><strong>Nr. {{contract.number}} din data de {{contract.date}}</strong></p>

<h3>PĂRȚILE CONTRACTANTE</h3>
<p><strong>1. S.C. WOOD GLASS S.R.L.</strong>, cu sediul în Brașov, Str. Zizinului nr. 625, înregistrată la Oficiul Comerțului sub nr. J2011000729084, CUI RO28396216, cont RON: RO43INGB0000999915654676, cont EURO: RO59INGB0000999915654679, deschis la ING Brașov, reprezentată prin dl. Șaran Vitalie, în calitate de <strong>Furnizor</strong>,</p>
<p>și</p>
<p><strong>2. {{partner.name}}</strong>, cu sediul / domiciliul în {{partner.city}}, {{partner.address}}, identificată prin CUI/CNP/VAT {{partner.cui}}, reprezentată prin {{partner.delegat}}, în calitate de <strong>Beneficiar</strong>,</p>
<p>au convenit să încheie prezentul contract de vânzare-cumpărare cu respectarea următoarelor clauze:</p>

<h3>A. OBIECTUL CONTRACTULUI</h3>
<p>Furnizorul se obligă să producă (și să transporte), iar Beneficiarul acceptă să cumpere <strong>Tâmplărie din Lemn Stratificat (esență Pin/Stejar 68 mm)</strong>, conform Ofertei de preț nr. {{contract.offerNumber}} / {{contract.offerDate}}, care face parte integrantă din prezentul contract.<br/>
Mărfurile care fac obiectul prezentului contract vor fi executate și livrate la adresa stabilită de Beneficiar.<br/>
Specificațiile tehnice detaliate (dimensiuni, finisaje, accesorii și caracteristici de montaj) sunt incluse în anexele contractului.</p>

<h3>B. GARANȚII ȘI RISCURI</h3>
<p>Furnizorul garantează bunurile vândute împotriva evicțiunii și contra viciilor ascunse. La recepția lucrării și achitarea integrală a prețului, Beneficiarul va primi certificatul de garanție corespunzător lucrării prestate de Furnizor. <strong>Garanția oferită este de 3 ani.</strong><br/>
Proprietatea asupra mărfii trece de la Furnizor la Beneficiar în momentul achitării integrale a produselor livrate.</p>

<h3>C. VALOAREA CONTRACTULUI</h3>
<p>Valoarea lucrărilor ce fac obiectul prezentului contract este de <strong>{{contract.value}} {{contract.currency}}</strong>.</p>

<h3>D. MODALITĂȚI DE PLATĂ</h3>
<p>Plățile se vor efectua astfel, pe baza facturii emise de Furnizor pentru fiecare tranșă:<br/>
• <strong>50%</strong> se va achita la data semnării prezentului contract (avans);<br/>
• <strong>50%</strong> se va achita cu cinci zile înainte de livrare.<br/>
Livrarea produselor este condiționată de achitarea integrală a prețului contractului.<br/>
Plata se va efectua în contul Furnizorului deschis la ING Brașov (RON: RO43INGB0000999915654676 / EURO: RO59INGB0000999915654679).</p>

<h3>E. TERMEN DE LIVRARE</h3>
<p>Furnizorul se obligă să producă mărfurile ce fac obiectul prezentului contract în termen de <strong>60 de zile calendaristice</strong> de la plata avansului și a confirmării tuturor detaliilor tehnice necesare execuției.</p>

<h3>F. RECEPȚIA LUCRĂRILOR</h3>
<p>Recepția mărfurilor se consideră efectuată în momentul livrării la adresa indicată de Beneficiar, conform documentului de transport (CMR / Proces-Verbal) semnat de acesta sau de reprezentantul său.</p>

<h3>G. RĂSPUNDEREA CONTRACTUALĂ</h3>
<p>Dacă Beneficiarul întârzie plata produselor, va plăti penalități de <strong>0,1%</strong> din suma datorată pentru fiecare zi de întârziere.<br/>
Dacă Furnizorul întârzie livrarea produselor față de termenul contractual, va plăti penalități de <strong>0,1%</strong> din valoarea produselor nelivrate pentru fiecare zi de întârziere.</p>

<h3>H. FORȚA MAJORĂ</h3>
<p>Forța majoră exonerează de răspundere partea care o invocă în condițiile legii, cu condiția notificării scrise în termen de 3 zile de la apariția cazului respectiv.</p>

<h3>I. CLAUZE FINALE ȘI LITIGII</h3>
<p>Eventualele litigii vor fi soluționate pe cale amiabilă sau de instanțele competente din România, respectiv Tribunalul Brașov. Prezentul contract este guvernat de legea română.</p>

<table style="width: 100%; margin-top: 40px;">
  <tr>
    <td style="width: 50%; vertical-align: top;">
      <strong>FURNIZOR</strong><br/>
      S.C. WOOD GLASS S.R.L.<br/>
      Reprezentant: ȘARAN VITALIE<br/>
      Semnătură: __________________________
    </td>
    <td style="width: 50%; vertical-align: top;">
      <strong>BENEFICIAR</strong><br/>
      {{partner.name}}<br/>
      Reprezentant: {{partner.delegat}}<br/>
      Semnătură: __________________________
    </td>
  </tr>
</table>
`,
      },
      {
        id: "contract-cadru-woodglass",
        name: "Contract Cadru de Furnizare & Montaj Tâmplărie / Sticlă",
        type: "contract",
        description: "Șablon standardizat pentru vânzare și instalare tâmplărie PVC/Aluminiu, sticlă termoizolantă și fațade",
        contentHtml: `
<h2>CONTRACT CADRU DE FURNIZARE ȘI MONTAJ</h2>
<p><strong>Nr. {{contract.number}} din data de {{contract.date}}</strong></p>

<h3>1. PĂRȚILE CONTRACTANTE</h3>
<p><strong>1.1. PRESTATOR / FURNIZOR:</strong><br/>
<strong>{{tenant.name}}</strong>, cu sediul în {{tenant.city}}, {{tenant.address}}, CUI {{tenant.cui}}, Reg. Com. {{tenant.regCom}}, Cont IBAN: {{tenant.iban}}, deschis la {{tenant.bank}}, reprezentată legal prin Administrator.</p>

<p><strong>1.2. BENEFICIAR / CLIENT:</strong><br/>
<strong>{{partner.name}}</strong>, cu sediul în {{partner.city}}, {{partner.address}}, CUI {{partner.cui}}, Reg. Com. {{partner.regCom}}, Cont IBAN: {{partner.iban}}, deschis la {{partner.bank}}, reprezentată legal prin {{partner.delegat}}.</p>

<h3>2. OBIECTUL CONTRACTULUI</h3>
<p>2.1. Obiectul prezentului contract îl constituie producția, livrarea și, după caz, montajul elementelor de tâmplărie termoizolantă, sticlă securizată și accesorii conexe, conform devizelor și anexelor tehnice agreate de ambele părți.</p>

<h3>3. VALOAREA CONTRACTULUI ȘI MODALITĂȚI DE PLATĂ</h3>
<p>3.1. Valoarea totală estimată a contractului este de <strong>{{contract.value}} {{contract.currency}}</strong> (la care se adaugă TVA conform legislației în vigoare).</p>
<p>3.2. Plata se va efectua prin ordin de plată sau transfer bancar pe baza facturilor fiscale emise de Prestator, cu termen de scadență de <strong>{{contract.paymentTerm}} zile</strong> de la data emiterii facturii.</p>

<h3>4. TERMENE DE LIVRARE ȘI MONTAJ</h3>
<p>4.1. Livrarea produselor se va efectua în termen de <strong>{{contract.deliveryDays}} zile lucrătoare</strong> de la achitarea avansului și aprobarea cotelor finale de execuție.</p>

<h3>5. GARANȚIA PRODUSELOR ȘI LUCRĂRILOR</h3>
<p>5.1. Prestatorul acordă o garanție de <strong>{{contract.warrantyMonths}} luni</strong> pentru profile și feronerie, respectiv <strong>{{contract.glassWarrantyMonths}} luni</strong> pentru pachetul de sticlă termoizolantă.</p>

<h3>6. SEMNĂTURILE PĂRȚILOR</h3>
<table style="width: 100%; margin-top: 40px;">
  <tr>
    <td style="width: 50%; vertical-align: top;">
      <strong>FURNIZOR / PRESTATOR</strong><br/>
      {{tenant.name}}<br/>
      Administrator<br/>
      __________________________
    </td>
    <td style="width: 50%; vertical-align: top;">
      <strong>BENEFICIAR / CLIENT</strong><br/>
      {{partner.name}}<br/>
      Reprezentant Legal<br/>
      __________________________
    </td>
  </tr>
</table>
`,
      },
      {
        id: "act-aditional-modificare",
        name: "Act Adițional — Modificare Termene / Prețuri / Clauze",
        type: "act_aditional",
        description: "Pentru modificarea termenelor de plată, a valorilor contractuale sau suplimentarea lucrărilor",
        contentHtml: `
<h2>ACT ADIȚIONAL Nr. {{contract.number}}</h2>
<p><strong>La Contractul Cadru Nr. {{parentContract.number}} din data de {{parentContract.date}}</strong></p>

<h3>PĂRȚILE CONTRACTANTE</h3>
<p>Între <strong>{{tenant.name}}</strong> (Furnizor/Prestator) și <strong>{{partner.name}}</strong> (Beneficiar/Client), ambele părți contractante ale Contractului Cadru menționat.</p>

<h3>ARTICOLUL 1. OBIECTUL ACTULUI ADIȚIONAL</h3>
<p>Părțile convin de comun acord modificarea următoarelor clauze contractuale începând cu data de <strong>{{contract.date}}</strong>:</p>
<p><em>{{contract.explanation}}</em></p>

<h3>ARTICOLUL 2. CLAUZE MODIFICATE</h3>
<p>2.1. Termenul de plată agreat devine <strong>{{contract.paymentTerm}} zile</strong> de la emiterea facturii.</p>
<p>2.2. Valoarea adițională a lucrărilor este de <strong>{{contract.value}} {{contract.currency}}</strong>.</p>

<h3>ARTICOLUL 3. DISPOZIȚII FINALE</h3>
<p>Celelalte clauze ale Contractului Cadru rămân neschimbate și își păstrează valabilitatea integrală.</p>

<table style="width: 100%; margin-top: 40px;">
  <tr>
    <td style="width: 50%; vertical-align: top;">
      <strong>FURNIZOR</strong><br/>
      {{tenant.name}}<br/>
      __________________________
    </td>
    <td style="width: 50%; vertical-align: top;">
      <strong>BENEFICIAR</strong><br/>
      {{partner.name}}<br/>
      __________________________
    </td>
  </tr>
</table>
`,
      },
      {
        id: "pv-receptie-lucrari",
        name: "Proces Verbal de Recepție Lucrări & Montaj",
        type: "pv_receptie",
        description: "Pentru recepția calitativă și cantitativă a produselor și montajului la locația clientului",
        contentHtml: `
<h2>PROCES VERBAL DE RECEPȚIE CALITATIVĂ ȘI CANTITATIVĂ</h2>
<p><strong>Nr. {{contract.number}} din data de {{contract.date}}</strong></p>

<p>Încheiat astăzi, <strong>{{contract.date}}</strong>, la obiectivul din <strong>{{partner.city}}, {{partner.address}}</strong>.</p>

<p>Comisia de recepție formată din:</p>
<ul>
  <li>Reprezentant Furnizor ({{tenant.name}}): __________________________</li>
  <li>Reprezentant Beneficiar ({{partner.name}}): __________________________</li>
</ul>

<h3>CONSTATĂRI</h3>
<p>1. Lucrările executate conform Contractului Nr. {{parentContract.number}} au fost verificate pe teren.</p>
<p>2. Elementele livrate corespund dimensional și calitativ cerințelor din anexa tehnică.</p>
<p>3. Feroneria, etanșeitatea și funcționarea sistemelor au fost testate și declarate corespunzătoare.</p>

<h3>OBSERVAȚII</h3>
<p>{{contract.notes}}</p>

<table style="width: 100%; margin-top: 40px;">
  <tr>
    <td style="width: 50%; vertical-align: top;">
      <strong>PREDAT DE FURNIZOR</strong><br/>
      Semnătura: _________________
    </td>
    <td style="width: 50%; vertical-align: top;">
      <strong>PRIMIT DE BENEFICIAR</strong><br/>
      Semnătura: _________________
    </td>
  </tr>
</table>
`,
      },
    ];
  }),
});
