import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "superadmin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Tenants table for multi-tenant SaaS
 */
export const tenants = mysqlTable("tenants", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  address: text("address"),
  cui: varchar("cui", { length: 20 }).unique(),
  subscriptionPlanId: int("subscriptionPlanId"),
  subscriptionStatus: mysqlEnum("subscriptionStatus", ["active", "inactive", "cancelled", "expired"]).default("active"),
  subscriptionStartDate: timestamp("subscriptionStartDate"),
  subscriptionEndDate: timestamp("subscriptionEndDate"),
  settings: text("settings"), // JSON stringified company settings
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

/**
 * Subscription plans
 */
export const subscriptionPlans = mysqlTable("subscriptionPlans", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(), // Basic, Pro, Enterprise
  description: text("description"),
  monthlyPrice: int("monthlyPrice").notNull(), // in cents
  maxCostCenters: int("maxCostCenters").notNull().default(1),
  maxUsers: int("maxUsers").notNull().default(1),
  features: text("features"), // JSON array of features
  isActive: int("isActive").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;

/**
 * User-Tenant mapping for multi-tenant support
 */
export const userTenants = mysqlTable("userTenants", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tenantId: int("tenantId").notNull(),
  role: mysqlEnum("role", ["superadmin", "admin", "user", "viewer"]).default("user").notNull(),
  isActive: int("isActive").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Integrations table for SmartBill, SPV, Oblio, etc.
 */
export const integrations = mysqlTable("integrations", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  provider: mysqlEnum("provider", ["smartbill", "spv", "oblio"]).notNull(),
  apiKey: text("apiKey"), // Can hold long access tokens
  apiSecret: text("apiSecret"), // Can hold long refresh tokens
  tokenExpiresAt: timestamp("tokenExpiresAt"), // For OAuth token expiry
  config: text("config"), // JSON: provider-specific config (email, cif, etc.)
  status: mysqlEnum("status", ["active", "inactive", "error"]).default("inactive"),
  lastSyncAt: timestamp("lastSyncAt"),
  syncCount: int("syncCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Integration = typeof integrations.$inferSelect;
export type InsertIntegration = typeof integrations.$inferInsert;

export type UserTenant = typeof userTenants.$inferSelect;

/**
 * Cost Centers (multiple locations per tenant)
 */
export const costCenters = mysqlTable("costCenters", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  cui: varchar("cui", { length: 20 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  city: varchar("city", { length: 100 }),
  country: varchar("country", { length: 2 }).default("RO"),
  isActive: int("isActive").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CostCenter = typeof costCenters.$inferSelect;
export type InsertCostCenter = typeof costCenters.$inferInsert;

/**
 * Quotations (from imported invoices)
 */
export const quotations = mysqlTable("quotations", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  costCenterId: int("costCenterId"),
  quotationNumber: varchar("quotationNumber", { length: 100 }).notNull(),
  clientName: varchar("clientName", { length: 255 }).notNull(),
  clientEmail: varchar("clientEmail", { length: 320 }),
  quotationDate: timestamp("quotationDate").defaultNow(),
  validUntil: timestamp("validUntil"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  vat: decimal("vat", { precision: 12, scale: 2 }).notNull(),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("RON"),
  status: mysqlEnum("status", ["draft", "sent", "accepted", "rejected", "expired"]).default("draft"),
  pdfUrl: varchar("pdfUrl", { length: 512 }),
  notes: text("notes"),
  sentAt: timestamp("sentAt"),
  acceptedAt: timestamp("acceptedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Quotation = typeof quotations.$inferSelect;
export type InsertQuotation = typeof quotations.$inferInsert;

/**
 * Quotation lines
 */
export const quotationLines = mysqlTable("quotationLines", {
  id: int("id").autoincrement().primaryKey(),
  quotationId: int("quotationId").notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal("unitPrice", { precision: 12, scale: 2 }).notNull(),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  lineOrder: int("lineOrder").notNull(),
});

export type QuotationLine = typeof quotationLines.$inferSelect;

/**
 * Inventory items with serial numbers
 */
export const inventoryItems = mysqlTable("inventoryItems", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  costCenterId: int("costCenterId"),
  serialNumber: varchar("serialNumber", { length: 255 }).notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: int("quantity").notNull().default(1),
  unitPrice: decimal("unitPrice", { precision: 12, scale: 2 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("RON"),
  category: varchar("category", { length: 100 }),
  status: mysqlEnum("status", ["active", "inactive", "damaged", "lost"]).default("active"),
  importedInvoiceId: int("importedInvoiceId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = typeof inventoryItems.$inferInsert;

/**
 * Accounts table for custom email/password authentication
 */
export const accounts = mysqlTable("accounts", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  tenantId: int("tenantId"),
  role: mysqlEnum("role", ["superadmin", "admin", "user"]).default("user").notNull(),
  isActive: int("isActive").default(1),
  lastLoginAt: timestamp("lastLoginAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Account = typeof accounts.$inferSelect;
export type InsertAccount = typeof accounts.$inferInsert;

/**
 * Clients table for customer management
 */
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  cui: varchar("cui", { length: 20 }),
  regCom: varchar("regCom", { length: 50 }),
  tva: int("tva").default(0),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  country: varchar("country", { length: 100 }).default("RO"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  currency: varchar("currency", { length: 3 }).default("RON"),
  totalInvoiced: decimal("totalInvoiced", { precision: 12, scale: 2 }).default("0.00"),
  invoiceCount: int("invoiceCount").default(0),
  reInvoiceCount: int("reInvoiceCount").default(0),
  isSupplier: int("isSupplier").default(0),
  isActive: int("isActive").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

/**
 * Product modules (Refacturare, Gestiune Costuri, etc.)
 */
export const modules = mysqlTable("modules", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(), // e.g. "refacturare", "gestiune-costuri", "combo"
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 100 }), // lucide icon name
  color: varchar("color", { length: 50 }), // tailwind color class or hex
  isCombo: int("isCombo").default(0), // 1 = combo of multiple modules
  comboModules: text("comboModules"), // JSON array of module slugs included
  sortOrder: int("sortOrder").default(0),
  isActive: int("isActive").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Module = typeof modules.$inferSelect;
export type InsertModule = typeof modules.$inferInsert;

/**
 * Module pricing (price per module, per currency, per billing period)
 */
export const modulePricing = mysqlTable("modulePricing", {
  id: int("id").autoincrement().primaryKey(),
  moduleId: int("moduleId").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("RON"), // RON, EUR, USD
  monthlyPrice: decimal("monthlyPrice", { precision: 10, scale: 2 }).notNull(),
  yearlyPrice: decimal("yearlyPrice", { precision: 10, scale: 2 }), // optional yearly discount
  trialDays: int("trialDays").default(7),
  isActive: int("isActive").default(1),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ModulePricing = typeof modulePricing.$inferSelect;
export type InsertModulePricing = typeof modulePricing.$inferInsert;

/**
 * Landing page leads (contact form submissions)
 */
export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  company: varchar("company", { length: 255 }),
  message: text("message"),
  planId: int("planId"), // which plan they clicked
  source: varchar("source", { length: 100 }).default("landing"),
  status: mysqlEnum("status", ["new", "contacted", "converted", "lost"]).default("new"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

/**
 * CMS Settings — key/value store for landing page content, SEO, etc.
 */
export const cmsSettings = mysqlTable("cmsSettings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  label: varchar("label", { length: 255 }),
  group: varchar("group", { length: 100 }).default("general"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CmsSetting = typeof cmsSettings.$inferSelect;

/**
 * Page visits tracking (simple analytics)
 */
export const pageVisits = mysqlTable("pageVisits", {
  id: int("id").autoincrement().primaryKey(),
  path: varchar("path", { length: 500 }).notNull(),
  referrer: varchar("referrer", { length: 500 }),
  userAgent: text("userAgent"),
  ip: varchar("ip", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PageVisit = typeof pageVisits.$inferSelect;

/**
 * Re-Invoices (generated from imported invoices)
 */
export const reInvoices = mysqlTable("reInvoices", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  number: varchar("number", { length: 100 }).notNull(),
  sourceInvoiceId: varchar("sourceInvoiceId", { length: 100 }), // original imported invoice ID
  sourceInvoiceNumber: varchar("sourceInvoiceNumber", { length: 100 }),
  sourceSupplierName: varchar("sourceSupplierName", { length: 255 }),
  clientId: int("clientId"),
  clientName: varchar("clientName", { length: 255 }).notNull(),
  clientCUI: varchar("clientCUI", { length: 20 }),
  clientAddress: text("clientAddress"),
  clientCity: varchar("clientCity", { length: 100 }),
  clientEmail: varchar("clientEmail", { length: 320 }),
  clientPhone: varchar("clientPhone", { length: 20 }),
  issueDate: varchar("issueDate", { length: 20 }).notNull(),
  dueDate: varchar("dueDate", { length: 20 }),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  totalVAT: decimal("totalVAT", { precision: 12, scale: 2 }).notNull(),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("RON"),
  status: mysqlEnum("status", ["draft", "sent", "paid", "overdue", "cancelled"]).default("draft"),
  notes: text("notes"),
  spvIndex: varchar("spvIndex", { length: 100 }),
  spvStatus: mysqlEnum("spvStatus", ["nesincronizat", "in_procesare", "validat", "eroare"]).default("nesincronizat"),
  spvError: text("spvError"),
  rawXml: text("rawXml"),
  pdfUrl: varchar("pdfUrl", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReInvoice = typeof reInvoices.$inferSelect;
export type InsertReInvoice = typeof reInvoices.$inferInsert;

/**
 * Re-Invoice Lines
 */
export const reInvoiceLines = mysqlTable("reInvoiceLines", {
  id: int("id").autoincrement().primaryKey(),
  reInvoiceId: int("reInvoiceId").notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  originalUnitPrice: decimal("originalUnitPrice", { precision: 12, scale: 2 }),
  unitPrice: decimal("unitPrice", { precision: 12, scale: 2 }).notNull(),
  unit: varchar("unit", { length: 20 }).default("buc"),
  vatRate: decimal("vatRate", { precision: 5, scale: 2 }).default("21.00"),
  markupPercent: decimal("markupPercent", { precision: 7, scale: 2 }),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  lineOrder: int("lineOrder").default(0),
});

export type ReInvoiceLine = typeof reInvoiceLines.$inferSelect;
export type InsertReInvoiceLine = typeof reInvoiceLines.$inferInsert;

/**
 * Invoice Archive — Evidență și Păstrare Facturi
 * Stores uploaded invoices from any source (PDF, XML, e-Factura, SmartBill, Oblio, FGO, SPV, manual)
 */
export const invoiceArchive = mysqlTable("invoiceArchive", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  // File storage (made optional for direct XML imports without S3)
  fileKey: varchar("fileKey", { length: 512 }),
  fileUrl: varchar("fileUrl", { length: 512 }),
  fileName: varchar("fileName", { length: 255 }),
  fileType: mysqlEnum("fileType", ["pdf", "xml", "efactura", "other"]).default("pdf"),
  fileSize: int("fileSize"), // bytes
  // Invoice metadata (extracted or manually entered)
  invoiceNumber: varchar("invoiceNumber", { length: 100 }),
  supplierName: varchar("supplierName", { length: 255 }),
  supplierCUI: varchar("supplierCUI", { length: 20 }),
  issueDate: varchar("issueDate", { length: 20 }),
  dueDate: varchar("dueDate", { length: 20 }),
  total: decimal("total", { precision: 12, scale: 2 }),
  totalVAT: decimal("totalVAT", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("RON"),
  // Source tracking
  source: mysqlEnum("source", ["smartbill", "oblio", "fgo", "spv_anaf", "efactura", "pdf_manual", "xml_manual", "other"]).default("pdf_manual"),
  // Direction: 'out' = emise de tine catre clienti, 'in' = primite de la furnizori
  direction: mysqlEnum("direction", ["in", "out"]).default("in"),
  // Status
  status: mysqlEnum("status", ["pending", "processed", "refactured", "archived"]).default("pending"),
  // Link to re-invoice if refactured
  reInvoiceId: int("reInvoiceId"),
  notes: text("notes"),
  rawXml: text("rawXml"), // Store original XML for on-demand PDF conversion
  tags: text("tags"), // JSON array of tags
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InvoiceArchive = typeof invoiceArchive.$inferSelect;
export type InsertInvoiceArchive = typeof invoiceArchive.$inferInsert;

export const invoiceArchiveLines = mysqlTable("invoiceArchiveLines", {
  id: int("id").autoincrement().primaryKey(),
  invoiceArchiveId: int("invoiceArchiveId").notNull(), // Foreign key to invoiceArchive
  description: varchar("description", { length: 512 }).notNull(),
  quantity: decimal("quantity", { precision: 12, scale: 2 }).notNull(),
  unitPrice: decimal("unitPrice", { precision: 12, scale: 2 }).notNull(),
  unit: varchar("unit", { length: 50 }).notNull().default("buc"),
  vatRate: decimal("vatRate", { precision: 5, scale: 2 }), // Percentage (e.g. 19.00)
  total: decimal("total", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("RON"),
});

export type InvoiceArchiveLine = typeof invoiceArchiveLines.$inferSelect;
export type InsertInvoiceArchiveLine = typeof invoiceArchiveLines.$inferInsert;
