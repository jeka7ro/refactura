import {
  int,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
} from "drizzle-orm/mysql-core";

// ─────────────────────────────────────────────────────────────────────────────
//  SAGA SYNC MODULE — Schema izolat
//  Tabelele acestui modul NU sunt importate în drizzle/schema.ts principal.
//  Sunt gestionate exclusiv prin modules/saga/migrations.ts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SAGA Articles — Nomenclator intern de articole, compatibil SAGA
 * Codul poate fi importat din SAGA sau auto-generat (ART-0001)
 */
export const sagaArticles = mysqlTable("sagaArticles", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  code: varchar("code", { length: 50 }).notNull(),       // Cod intern (ART-0001 sau cod SAGA importat)
  name: varchar("name", { length: 255 }).notNull(),       // Denumire articol
  unit: varchar("unit", { length: 20 }).default("buc"),   // Unitate de măsură
  vatRate: decimal("vatRate", { precision: 5, scale: 2 }).default("19.00"),
  category: varchar("category", { length: 100 }).default("Marfuri"), // Grupa/tipul
  accountingAccount: varchar("accountingAccount", { length: 20 }).default("371"), // Cont contabil
  sagaCode: varchar("sagaCode", { length: 50 }),          // Codul original din SAGA (dacă importat)
  barcode: varchar("barcode", { length: 50 }),            // Cod de bare (opțional)
  isActive: int("isActive").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SagaArticle = typeof sagaArticles.$inferSelect;
export type InsertSagaArticle = typeof sagaArticles.$inferInsert;

/**
 * SAGA Article Mappings — Mapare denumiri furnizori → articol intern
 * Memorează asocierea între denumirea de pe factura furnizorului și codul nostru intern.
 * La următoarea apariție a aceleiași denumiri, maparea se face automat.
 */
export const sagaArticleMappings = mysqlTable("sagaArticleMappings", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  sagaArticleId: int("sagaArticleId").notNull(),          // FK → sagaArticles.id
  supplierCUI: varchar("supplierCUI", { length: 20 }),    // CUI furnizor (opțional, mapare per furnizor)
  externalName: varchar("externalName", { length: 512 }).notNull(), // Denumirea exactă de pe factură
  confidence: decimal("confidence", { precision: 5, scale: 2 }).default("100.00"), // 100=manual, <100=auto
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SagaArticleMapping = typeof sagaArticleMappings.$inferSelect;
export type InsertSagaArticleMapping = typeof sagaArticleMappings.$inferInsert;

/**
 * SAGA Export History — Istoricul exporturilor SAGA generate
 */
export const sagaExportHistory = mysqlTable("sagaExportHistory", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  month: int("month").notNull(),
  year: int("year").notNull(),
  articlesCount: int("articlesCount").default(0),
  entriesCount: int("entriesCount").default(0),
  exitsCount: int("exitsCount").default(0),
  bonuriCount: int("bonuriCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SagaExportHistoryRow = typeof sagaExportHistory.$inferSelect;
export type InsertSagaExportHistoryRow = typeof sagaExportHistory.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════════
//  GESTIUNI — Locații de stoc (Depozit, Magazin, Producție, etc.)
//  Câmpuri identice SAGA Web: Cod, Denumire, Tip, Gestionar, Analitice conturi
// ═══════════════════════════════════════════════════════════════════════════════
export const sagaGestiuni = mysqlTable("sagaGestiuni", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  cod: varchar("cod", { length: 20 }).notNull(),
  denumire: varchar("denumire", { length: 255 }).notNull(),
  tipGestiune: varchar("tipGestiune", { length: 50 }).default("cantitativ-valorica"),
  gestionar: varchar("gestionar", { length: 255 }),
  laPretVanzare: int("laPretVanzare").default(0),       // checkbox 0/1
  analitic371: varchar("analitic371", { length: 20 }),   // Cont analitic mărfuri
  analitic378: varchar("analitic378", { length: 20 }),   // Dif. preț mărfuri
  analitic4428: varchar("analitic4428", { length: 20 }), // TVA neexigibilă
  analitic607: varchar("analitic607", { length: 20 }),   // Chelt. mărfuri
  analitic707: varchar("analitic707", { length: 20 }),   // Venituri mărfuri
  tvaImplicit: decimal("tvaImplicit", { precision: 5, scale: 2 }).default("19.00"),
  isActive: int("isActive").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SagaGestiune = typeof sagaGestiuni.$inferSelect;
export type InsertSagaGestiune = typeof sagaGestiuni.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════════
//  FURNIZORI SAGA — Nomenclator furnizori compatibil SAGA
// ═══════════════════════════════════════════════════════════════════════════════
export const sagaFurnizori = mysqlTable("sagaFurnizori", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  cod: varchar("cod", { length: 20 }).notNull(),
  denumire: varchar("denumire", { length: 255 }).notNull(),
  cui: varchar("cui", { length: 20 }),
  regCom: varchar("regCom", { length: 50 }),
  adresa: text("adresa"),
  judet: varchar("judet", { length: 50 }),
  localitate: varchar("localitate", { length: 100 }),
  banca: varchar("banca", { length: 255 }),
  contBanca: varchar("contBanca", { length: 50 }),      // IBAN
  telefon: varchar("telefon", { length: 30 }),
  email: varchar("email", { length: 255 }),
  contFurnizor: varchar("contFurnizor", { length: 20 }).default("401"),
  isActive: int("isActive").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SagaFurnizor = typeof sagaFurnizori.$inferSelect;
export type InsertSagaFurnizor = typeof sagaFurnizori.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════════
//  INTRĂRI SAGA — Facturi furnizori / NIR-uri (Header + Linii)
// ═══════════════════════════════════════════════════════════════════════════════
export const sagaIntrari = mysqlTable("sagaIntrari", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  tip: varchar("tip", { length: 20 }).default("Factura"),   // Factura / Aviz / Retur
  nrIntern: int("nrIntern"),                                 // Nr. intern auto
  nrDoc: varchar("nrDoc", { length: 50 }),                   // Nr. document furnizor
  codFurnizor: varchar("codFurnizor", { length: 20 }),       // FK sagaFurnizori.cod
  numeFurnizor: varchar("numeFurnizor", { length: 255 }),
  cuiFurnizor: varchar("cuiFurnizor", { length: 20 }),
  tvaInclus: int("tvaInclus").default(0),                    // TVA inclusă 0/1
  data: varchar("data", { length: 20 }).notNull(),           // Data intrare
  scadent: varchar("scadent", { length: 20 }),               // Data scadență
  valoare: decimal("valoare", { precision: 12, scale: 2 }).default("0"),
  tva: decimal("tva", { precision: 12, scale: 2 }).default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).default("0"),
  neachitat: decimal("neachitat", { precision: 12, scale: 2 }).default("0"),
  idSPV: varchar("idSPV", { length: 100 }),                  // ID încărcare SPV
  nirId: int("nirId"),                                        // Link la NIR existent (opțional)
  status: varchar("status", { length: 20 }).default("draft"), // draft / validat / stornat
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SagaIntrare = typeof sagaIntrari.$inferSelect;
export type InsertSagaIntrare = typeof sagaIntrari.$inferInsert;

export const sagaIntrariLinii = mysqlTable("sagaIntrariLinii", {
  id: int("id").autoincrement().primaryKey(),
  intrareId: int("intrareId").notNull(),                     // FK sagaIntrari.id
  tip: varchar("tip", { length: 30 }).default("Marfa"),      // Marfa / Materie prima / Serviciu
  gestiuneId: int("gestiuneId"),                              // FK sagaGestiuni.id
  articolId: int("articolId"),                                // FK sagaArticles.id
  cod: varchar("cod", { length: 50 }),
  denumire: varchar("denumire", { length: 255 }).notNull(),
  um: varchar("um", { length: 20 }).default("buc"),
  tvaPercent: decimal("tvaPercent", { precision: 5, scale: 2 }).default("19.00"),
  cantitate: decimal("cantitate", { precision: 12, scale: 3 }).default("0"),
  pretUnitar: decimal("pretUnitar", { precision: 12, scale: 4 }).default("0"),
  valoare: decimal("valoare", { precision: 12, scale: 2 }).default("0"),
  tvaSuma: decimal("tvaSuma", { precision: 12, scale: 2 }).default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).default("0"),
  nedeductibil: decimal("nedeductibil", { precision: 12, scale: 2 }).default("0"),
  cont: varchar("cont", { length: 20 }).default("371"),       // Cont contabil
  lineOrder: int("lineOrder").default(0),
});

export type SagaIntrareLinii = typeof sagaIntrariLinii.$inferSelect;
export type InsertSagaIntrareLinii = typeof sagaIntrariLinii.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════════
//  COMENZI + PRODUCȚIE (Header + Produse + Consumuri)
// ═══════════════════════════════════════════════════════════════════════════════
export const sagaComenzi = mysqlTable("sagaComenzi", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  tipComanda: varchar("tipComanda", { length: 30 }).default("Productie"),
  nrComanda: int("nrComanda"),
  data: varchar("data", { length: 20 }).notNull(),
  codClient: varchar("codClient", { length: 20 }),
  denumireClient: varchar("denumireClient", { length: 255 }),
  adresaLivrare: text("adresaLivrare"),
  valuta: varchar("valuta", { length: 3 }).default("RON"),
  valoare: decimal("valoare", { precision: 12, scale: 2 }).default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).default("0"),
  tva: decimal("tva", { precision: 12, scale: 2 }).default("0"),
  dataLivrarii: varchar("dataLivrarii", { length: 20 }),
  dataInchidere: varchar("dataInchidere", { length: 20 }),
  status: varchar("status", { length: 20 }).default("draft"), // draft / productie / livrat / facturat
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SagaComanda = typeof sagaComenzi.$inferSelect;
export type InsertSagaComanda = typeof sagaComenzi.$inferInsert;

/** Ce se produce — linii de produse finite */
export const sagaComenziLinii = mysqlTable("sagaComenziLinii", {
  id: int("id").autoincrement().primaryKey(),
  comandaId: int("comandaId").notNull(),
  gestiuneId: int("gestiuneId"),
  articolId: int("articolId"),
  cod: varchar("cod", { length: 50 }),
  denumire: varchar("denumire", { length: 255 }).notNull(),
  um: varchar("um", { length: 20 }).default("buc"),
  tvaPercent: decimal("tvaPercent", { precision: 5, scale: 2 }).default("19.00"),
  cantitate: decimal("cantitate", { precision: 12, scale: 3 }).default("0"),
  pretUnitar: decimal("pretUnitar", { precision: 12, scale: 4 }).default("0"),
  valoare: decimal("valoare", { precision: 12, scale: 2 }).default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).default("0"),
  tvaSuma: decimal("tvaSuma", { precision: 12, scale: 2 }).default("0"),
  dataLivrarii: varchar("dataLivrarii", { length: 20 }),
  dataInchidere: varchar("dataInchidere", { length: 20 }),
  lineOrder: int("lineOrder").default(0),
});

export type SagaComandaLinie = typeof sagaComenziLinii.$inferSelect;
export type InsertSagaComandaLinie = typeof sagaComenziLinii.$inferInsert;

/** Ce se consumă din stoc — materii prime */
export const sagaComenziConsumuri = mysqlTable("sagaComenziConsumuri", {
  id: int("id").autoincrement().primaryKey(),
  comandaId: int("comandaId").notNull(),
  gestiuneDescarcareId: int("gestiuneDescarcareId"),
  articolId: int("articolId"),
  cod: varchar("cod", { length: 50 }),
  denumire: varchar("denumire", { length: 255 }).notNull(),
  um: varchar("um", { length: 20 }).default("buc"),
  tvaPercent: decimal("tvaPercent", { precision: 5, scale: 2 }).default("19.00"),
  cantitate: decimal("cantitate", { precision: 12, scale: 3 }).default("0"),
  pretUnitar: decimal("pretUnitar", { precision: 12, scale: 4 }).default("0"),
  valoare: decimal("valoare", { precision: 12, scale: 2 }).default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).default("0"),
  tvaSuma: decimal("tvaSuma", { precision: 12, scale: 2 }).default("0"),
  lineOrder: int("lineOrder").default(0),
});

export type SagaComandaConsum = typeof sagaComenziConsumuri.$inferSelect;
export type InsertSagaComandaConsum = typeof sagaComenziConsumuri.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════════
//  REȚETE (Bill of Materials) — ce materiale trebuie pt un produs finit
// ═══════════════════════════════════════════════════════════════════════════════
export const sagaRetete = mysqlTable("sagaRetete", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  articolProdusId: int("articolProdusId").notNull(),   // FK sagaArticles (produsul finit)
  denumire: varchar("denumire", { length: 255 }).notNull(),
  isActive: int("isActive").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SagaReteta = typeof sagaRetete.$inferSelect;
export type InsertSagaReteta = typeof sagaRetete.$inferInsert;

export const sagaReteteLinii = mysqlTable("sagaReteteLinii", {
  id: int("id").autoincrement().primaryKey(),
  retetaId: int("retetaId").notNull(),                 // FK sagaRetete.id
  articolMaterieId: int("articolMaterieId").notNull(), // FK sagaArticles (materia primă)
  cantitate: decimal("cantitate", { precision: 12, scale: 4 }).notNull(), // per 1 unitate produs
  um: varchar("um", { length: 20 }).default("buc"),
  lineOrder: int("lineOrder").default(0),
});

export type SagaRetetaLinie = typeof sagaReteteLinii.$inferSelect;
export type InsertSagaRetetaLinie = typeof sagaReteteLinii.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════════
//  ARTICOLE CONTABILE — Registru de înregistrări contabile
// ═══════════════════════════════════════════════════════════════════════════════
export const sagaArticoleContabile = mysqlTable("sagaArticoleContabile", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  data: varchar("data", { length: 20 }).notNull(),
  nrDocument: varchar("nrDocument", { length: 50 }),
  contDebit: varchar("contDebit", { length: 20 }).notNull(),
  contCredit: varchar("contCredit", { length: 20 }).notNull(),
  suma: decimal("suma", { precision: 12, scale: 2 }).notNull(),
  valuta: varchar("valuta", { length: 3 }).default("RON"),
  curs: decimal("curs", { precision: 12, scale: 4 }),
  sumaValuta: decimal("sumaValuta", { precision: 12, scale: 2 }),
  explicatie: text("explicatie"),
  tip: varchar("tip", { length: 50 }),                // Intrare / Iesire / Productie / Transfer
  activitate: varchar("activitate", { length: 50 }),
  sourceType: varchar("sourceType", { length: 20 }),  // intrare / iesire / comanda
  sourceId: int("sourceId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SagaArticolContabil = typeof sagaArticoleContabile.$inferSelect;
export type InsertSagaArticolContabil = typeof sagaArticoleContabile.$inferInsert;

