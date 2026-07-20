import { eq, and, desc, sql, count, isNull, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  tenants,
  userTenants,
  costCenters,
  subscriptionPlans,
  clients,
  leads,
  cmsSettings,
  pageVisits,
  accounts,
  modules,
  modulePricing,
  reInvoices,
  reInvoiceLines,
  invoiceArchive,
  invoiceArchiveLines,
  InsertInvoiceArchive,
  integrations,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { runHorecaMigrations } from "../modules/horeca/migrations";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
      // Safe migration: add rawXml column if missing
      try {
        await _db.execute(
          sql`ALTER TABLE invoiceArchive ADD COLUMN rawXml LONGTEXT NULL`
        );
        console.log("[DB] Added rawXml column to invoiceArchive");
      } catch {
        // Column already exists — ignore
      }

      // Safe migrations: add indexes for lines tables to prevent full table scans
      try {
        await _db.execute(
          sql`CREATE INDEX idx_invoiceArchiveId ON invoiceArchiveLines(invoiceArchiveId)`
        );
      } catch {}
      try {
        await _db.execute(
          sql`CREATE INDEX idx_reInvoiceId ON reInvoiceLines(reInvoiceId)`
        );
      } catch {}
      try {
        await _db.execute(
          sql`CREATE INDEX idx_emittedInvoiceId ON emittedInvoiceLines(emittedInvoiceId)`
        );
      } catch {}
      // Module migrations — fiecare modul izolat, safe
      await runHorecaMigrations(_db as any);

      // Safe migrations: add cron tracking fields to integrations
      try {
        await _db.execute(sql`ALTER TABLE integrations ADD COLUMN lastCronImported INT DEFAULT 0`);
      } catch {}
      try {
        await _db.execute(sql`ALTER TABLE integrations ADD COLUMN lastCronAt TIMESTAMP NULL`);
      } catch {}
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Multi-tenant helpers
 */

export async function getTenantsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(tenants)
    .innerJoin(userTenants, eq(userTenants.tenantId, tenants.id))
    .where(eq(userTenants.userId, userId));
}

export async function getUserRole(userId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(userTenants)
    .where(
      and(eq(userTenants.userId, userId), eq(userTenants.tenantId, tenantId))
    )
    .limit(1);

  return result.length > 0 ? result[0].role : null;
}

export async function getDefaultTenantForUser(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(userTenants)
    .where(eq(userTenants.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0].tenantId : null;
}

export async function createTenant(data: {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  cui?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(tenants).values(data);
  return result;
}

export async function createCostCenter(data: {
  tenantId: number;
  name: string;
  address?: string;
  cui?: string;
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.insert(costCenters).values(data);
}

export async function getCostCentersByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(costCenters)
    .where(eq(costCenters.tenantId, tenantId));
}

export async function getSubscriptionPlan(planId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, planId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

// TODO: add more feature queries here as your schema grows.

export async function updateCostCenter(
  id: number,
  tenantId: number,
  data: Partial<{
    name: string;
    address?: string;
    cui?: string;
    email?: string;
    phone?: string;
    city?: string;
    country?: string;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .update(costCenters)
    .set(data)
    .where(and(eq(costCenters.id, id), eq(costCenters.tenantId, tenantId)));
}

export async function deleteCostCenter(id: number, tenantId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .delete(costCenters)
    .where(and(eq(costCenters.id, id), eq(costCenters.tenantId, tenantId)));
}

export async function getCostCenterById(id: number, tenantId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(costCenters)
    .where(and(eq(costCenters.id, id), eq(costCenters.tenantId, tenantId)))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

// ─── In-memory fallback for local dev (no DATABASE_URL) ──────────────────────
type ClientRow = {
  id: number;
  tenantId: number;
  name: string;
  cui?: string;
  regCom?: string;
  tva?: number;
  address?: string;
  city?: string;
  country?: string;
  email?: string;
  phone?: string;
  currency?: string;
  totalInvoiced?: string;
  invoiceCount?: number;
  reInvoiceCount?: number;
  isActive?: number;
  createdAt: Date;
  updatedAt: Date;
};
let _memClients: ClientRow[] = [];
let _memClientSeq = 1;

// Client functions
export async function getClientsByTenant(tenantId: number) {
  const db = await getDb();
  if (!db)
    return _memClients.filter(c => c.tenantId === tenantId && c.isActive !== 0);
  return db.select().from(clients).where(eq(clients.tenantId, tenantId));
}

export async function createClient(data: {
  tenantId: number;
  name: string;
  cui?: string;
  regCom?: string;
  tva?: boolean;
  address?: string;
  city?: string;
  country?: string;
  email?: string;
  phone?: string;
  currency?: string;
}) {
  const db = await getDb();
  if (!db) {
    const row: ClientRow = {
      ...data,
      tva: data.tva ? 1 : 0,
      id: _memClientSeq++,
      isActive: 1,
      totalInvoiced: "0.00",
      invoiceCount: 0,
      reInvoiceCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    _memClients.push(row);
    console.log(
      "[Dev] Client creat în memorie:",
      row.name,
      "| Total:",
      _memClients.length
    );
    return row;
  }
  return db.insert(clients).values({ ...data, tva: data.tva ? 1 : 0 });
}

export async function updateClient(
  id: number,
  tenantId: number,
  data: Partial<{
    name: string;
    cui: string;
    regCom: string;
    tva: boolean;
    address: string;
    city: string;
    country: string;
    email: string;
    phone: string;
    currency: string;
  }>
) {
  const db = await getDb();
  if (!db) {
    const idx = _memClients.findIndex(
      c => c.id === id && c.tenantId === tenantId
    );
    if (idx !== -1) {
      _memClients[idx] = {
        ..._memClients[idx],
        ...data,
        tva: data.tva ? 1 : 0,
        updatedAt: new Date(),
      };
    }
    return _memClients[idx];
  }
  return db
    .update(clients)
    .set({ ...data, tva: (data as any).tva ? 1 : 0, updatedAt: new Date() })
    .where(and(eq(clients.id, id), eq(clients.tenantId, tenantId)));
}

export async function deleteClient(id: number, tenantId: number) {
  const db = await getDb();
  if (!db) {
    _memClients = _memClients.filter(
      c => !(c.id === id && c.tenantId === tenantId)
    );
    return { success: true };
  }
  return db
    .delete(clients)
    .where(and(eq(clients.id, id), eq(clients.tenantId, tenantId)));
}

export async function getClientById(id: number, tenantId: number) {
  const db = await getDb();
  if (!db)
    return (
      _memClients.find(c => c.id === id && c.tenantId === tenantId) ?? null
    );
  const result = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.tenantId, tenantId)))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

// ─── Leads / Trial Registrations ─────────────────────────────────────────────

export async function createLead(data: {
  name?: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
  planId?: number;
  source?: string;
}) {
  const db = await getDb();
  if (!db) {
    console.warn("Database not available, skipping lead creation in DB:", data);
    return true; // Simulate success for local testing
  }
  return db.insert(leads).values(data);
}

export async function getAllLeads() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(leads).orderBy(desc(leads.createdAt));
}

export async function updateLeadStatus(
  id: number,
  status: "new" | "contacted" | "converted" | "lost"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(leads).set({ status }).where(eq(leads.id, id));
}

export async function deleteLead(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(leads).where(eq(leads.id, id));
}

// ─── Subscription Plans CRUD ─────────────────────────────────────────────────

export async function getAllSubscriptionPlans() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(subscriptionPlans)
    .orderBy(subscriptionPlans.monthlyPrice);
}

export async function createSubscriptionPlan(data: {
  name: string;
  description?: string;
  monthlyPrice: number;
  maxCostCenters: number;
  maxUsers: number;
  features?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(subscriptionPlans).values({ ...data, isActive: 1 });
}

export async function updateSubscriptionPlan(
  id: number,
  data: Partial<{
    name: string;
    description: string;
    monthlyPrice: number;
    maxCostCenters: number;
    maxUsers: number;
    features: string;
    isActive: number;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .update(subscriptionPlans)
    .set(data)
    .where(eq(subscriptionPlans.id, id));
}

export async function deleteSubscriptionPlan(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, id));
}

// ─── CMS Settings ─────────────────────────────────────────────────────────────

export async function getCmsSettings(group?: string) {
  const db = await getDb();
  if (!db) return [];
  if (group) {
    return db.select().from(cmsSettings).where(eq(cmsSettings.group, group));
  }
  return db.select().from(cmsSettings);
}

export async function upsertCmsSetting(
  key: string,
  value: string,
  label?: string,
  group?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .insert(cmsSettings)
    .values({ key, value, label: label ?? key, group: group ?? "general" })
    .onDuplicateKeyUpdate({ set: { value } });
}

// ─── Admin Stats ──────────────────────────────────────────────────────────────

export async function getAdminStats() {
  const db = await getDb();
  if (!db)
    return { totalLeads: 0, newLeads: 0, totalTenants: 0, totalAccounts: 0 };

  const [leadsCount] = await db.select({ total: count() }).from(leads);
  const [newLeadsCount] = await db
    .select({ total: count() })
    .from(leads)
    .where(eq(leads.status, "new"));
  const [tenantsCount] = await db.select({ total: count() }).from(tenants);
  const [accountsCount] = await db.select({ total: count() }).from(accounts);

  return {
    totalLeads: leadsCount?.total ?? 0,
    newLeads: newLeadsCount?.total ?? 0,
    totalTenants: tenantsCount?.total ?? 0,
    totalAccounts: accountsCount?.total ?? 0,
  };
}

export async function getAllAccounts() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: accounts.id,
      email: accounts.email,
      role: accounts.role,
      isActive: accounts.isActive,
      tenantId: accounts.tenantId,
      lastLoginAt: accounts.lastLoginAt,
      createdAt: accounts.createdAt,
    })
    .from(accounts)
    .orderBy(desc(accounts.createdAt));
}

export async function getAllTenants() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tenants).orderBy(desc(tenants.createdAt));
}

// ─── Page Visits ──────────────────────────────────────────────────────────────

export async function recordPageVisit(data: {
  path: string;
  referrer?: string;
  userAgent?: string;
  ip?: string;
}) {
  const db = await getDb();
  if (!db) return;
  return db.insert(pageVisits).values(data);
}

export async function getPageVisitStats() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      path: pageVisits.path,
      visits: count(),
    })
    .from(pageVisits)
    .groupBy(pageVisits.path)
    .orderBy(desc(count()));
}

// ─── Modules & Module Pricing ─────────────────────────────────────────────────

export async function getAllModules() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(modules).orderBy(modules.sortOrder);
}

export async function getActiveModulesWithPricing() {
  const db = await getDb();
  if (!db) return [];
  const mods = await db
    .select()
    .from(modules)
    .where(eq(modules.isActive, 1))
    .orderBy(modules.sortOrder);
  const prices = await db
    .select()
    .from(modulePricing)
    .where(eq(modulePricing.isActive, 1));
  return mods.map(m => ({
    ...m,
    pricing: prices.filter(p => p.moduleId === m.id),
  }));
}

export async function upsertModule(data: {
  id?: number;
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  isCombo?: number;
  comboModules?: string;
  sortOrder?: number;
  isActive?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.id) {
    const { id, ...rest } = data;
    return db.update(modules).set(rest).where(eq(modules.id, id));
  }
  return db.insert(modules).values(data);
}

export async function deleteModule(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(modulePricing).where(eq(modulePricing.moduleId, id));
  return db.delete(modules).where(eq(modules.id, id));
}

export async function upsertModulePricing(data: {
  id?: number;
  moduleId: number;
  currency: string;
  monthlyPrice: string;
  yearlyPrice?: string;
  trialDays?: number;
  isActive?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.id) {
    const { id, ...rest } = data;
    return db.update(modulePricing).set(rest).where(eq(modulePricing.id, id));
  }
  return db.insert(modulePricing).values(data);
}

export async function deleteModulePricing(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(modulePricing).where(eq(modulePricing.id, id));
}

// ─── Re-Invoices ─────────────────────────────────────────────────────────────

export async function getNextReInvoiceNumber(
  tenantId: number
): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const year = new Date().getFullYear();
  const rows = await db
    .select({ id: reInvoices.id })
    .from(reInvoices)
    .where(eq(reInvoices.tenantId, tenantId));
  const seq = (rows.length + 1).toString().padStart(4, "0");
  return `RF-${year}-${seq}`;
}

// ─── In-memory fallback pentru Re-Facturi (local dev fără DB) ───────────────
type ReInvoiceRow = any;
let _memReInvoices: ReInvoiceRow[] = [];
let _memReInvoiceSeq = 1;

export async function createReInvoice(data: {
  tenantId: number;
  number: string;
  sourceInvoiceId?: string;
  sourceInvoiceNumber?: string;
  sourceSupplierName?: string;
  clientId?: number;
  clientName: string;
  clientCUI?: string;
  clientAddress?: string;
  clientCity?: string;
  clientEmail?: string;
  clientPhone?: string;
  issueDate: string;
  dueDate?: string;
  subtotal: number;
  totalVAT: number;
  total: number;
  currency: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  notes?: string;
  lines: Array<{
    description: string;
    quantity: number;
    originalUnitPrice?: number;
    unitPrice: number;
    unit?: string;
    vatRate?: number;
    markupPercent?: number;
    total: number;
    lineOrder: number;
  }>;
}) {
  const db = await getDb();
  if (!db) {
    const id = _memReInvoiceSeq++;
    const row = { ...data, id, createdAt: new Date(), updatedAt: new Date() };
    _memReInvoices.push(row);
    console.log("[Dev] Re-Factură creată în memorie:", data.number);
    return { id, number: data.number };
  }
  const { lines, sourceInvoiceIds, ...header } = data as any;

  let finalLines = lines;
  let devizNum = "";
  let hasDeviz = false;

  const catalogLines = finalLines.filter((l: any) => l.devizType);
  const normalLines = finalLines.filter((l: any) => !l.devizType);

  if (catalogLines.length > 0) {
    hasDeviz = true;
    const baseVat = catalogLines[0]?.vatRate ?? 19;
    const laborTotal = catalogLines.reduce(
      (sum: number, l: any) => sum + l.quantity * l.unitPrice,
      0
    );

    normalLines.push({
      description: `Manoperă și materiale conform deviz`,
      quantity: 1,
      unitPrice: laborTotal,
      vatRate: baseVat,
      markupPercent: 0,
      originalUnitPrice: laborTotal,
      total: laborTotal * (1 + baseVat / 100),
      lineOrder: 9999,
    });
  }

  finalLines = normalLines;

  let tTotal = 0;
  let tVat = 0;
  finalLines.forEach((l: any) => {
    const rowTotal = l.quantity * l.unitPrice;
    tVat += rowTotal * ((l.vatRate ?? 19) / 100);
    tTotal += rowTotal + rowTotal * ((l.vatRate ?? 19) / 100);
  });

  const [result] = await db.insert(reInvoices).values({
    ...header,
    subtotal: (tTotal - tVat).toString() as any,
    totalVAT: tVat.toString() as any,
    total: tTotal.toString() as any,
  });

  const reInvoiceId = (result as any).insertId as number;

  if (hasDeviz) {
    const { devize, devizeLines, bonuriConsum, bonuriConsumLines } =
      await import("../drizzle/schema");
    devizNum = `DEV-RF-${reInvoiceId}`;
    let tMat = 0;
    let tLab = 0;
    let tTot = 0;
    for (const cl of catalogLines) {
      const lTot = cl.quantity * cl.unitPrice;
      tTot += lTot;
      if (cl.devizType === "MATERIAL") tMat += lTot;
      else if (
        cl.devizType === "MANOPERA" ||
        cl.devizType === "NORMA" ||
        cl.devizType === "UTILAJ"
      )
        tLab += lTot;
    }

    const [dRes] = await db.insert(devize).values({
      tenantId: header.tenantId,
      number: devizNum,
      date: new Date(),
      invoiceId: reInvoiceId,
      totalMaterials: String(tMat),
      totalLabor: String(tLab),
      total: String(tTot),
      status: "final",
    });

    await db.insert(devizeLines).values(
      catalogLines.map((cl: any, i: number) => ({
        devizId: dRes.insertId as number,
        type: cl.devizType as "MATERIAL" | "MANOPERA" | "UTILAJ" | "NORMA",
        code: cl.devizCode,
        description: cl.description,
        quantity: String(cl.quantity),
        unitPrice: String(cl.unitPrice),
        total: String(cl.quantity * cl.unitPrice),
        lineOrder: i,
      }))
    );

    const matLines = catalogLines.filter(
      (l: any) => l.devizType === "MATERIAL"
    );
    if (matLines.length > 0) {
      const [bRes] = await db.insert(bonuriConsum).values({
        tenantId: header.tenantId,
        devizId: dRes.insertId as number,
        number: `BC-RF-${reInvoiceId}`,
        date: new Date(),
        status: "final",
      });
      await db.insert(bonuriConsumLines).values(
        matLines.map(
          (ml: any, i: number) =>
            ({
              bonId: bRes.insertId as number,
              materialCode: ml.devizCode,
              description: ml.description,
              quantity: String(ml.quantity),
              unitPrice: String(ml.unitPrice),
              total: String(ml.quantity * ml.unitPrice),
              lineOrder: i,
            }) as any
        )
      );
    }

    const lToModify = finalLines.find(
      (l: any) => l.description === "Manoperă și materiale conform deviz"
    );
    if (lToModify) {
      lToModify.description = `Manoperă și materiale conform deviz ${devizNum}`;
    }
  }

  if (finalLines.length > 0) {
    await db.insert(reInvoiceLines).values(
      finalLines.map((l: any, i: number) => ({
        reInvoiceId,
        description: l.description,
        quantity: l.quantity.toString() as any,
        originalUnitPrice: l.originalUnitPrice?.toString() as any,
        unitPrice: l.unitPrice.toString() as any,
        unit: l.unit ?? "buc",
        vatRate: (l.vatRate ?? 21).toString() as any,
        markupPercent: l.markupPercent?.toString() as any,
        total: l.total.toString() as any,
        lineOrder: l.lineOrder ?? i,
      }))
    );
  }
  return { id: reInvoiceId, number: header.number };
}

export async function getReInvoicesByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return _memReInvoices.filter(r => r.tenantId === tenantId);
  const items = await db
    .select()
    .from(reInvoices)
    .where(eq(reInvoices.tenantId, tenantId))
    .orderBy(desc(reInvoices.createdAt));

  if (items.length === 0) return [];

  const itemIds = items.map(i => i.id);
  const lines = await db
    .select()
    .from(reInvoiceLines)
    .where(inArray(reInvoiceLines.reInvoiceId, itemIds));

  const linesMap = new Map<number, string[]>();
  for (const l of lines) {
    if (!linesMap.has(l.reInvoiceId)) linesMap.set(l.reInvoiceId, []);
    linesMap.get(l.reInvoiceId)!.push(l.description);
  }

  return items.map(item => ({
    ...item,
    itemsText: (linesMap.get(item.id) || []).join(" "),
  }));
}

export async function getReInvoiceById(id: number, tenantId: number) {
  const db = await getDb();
  if (!db)
    return (
      _memReInvoices.find(r => r.id === id && r.tenantId === tenantId) ?? null
    );
  const [inv] = await db
    .select()
    .from(reInvoices)
    .where(and(eq(reInvoices.id, id), eq(reInvoices.tenantId, tenantId)));
  if (!inv) return null;
  const lines = await db
    .select()
    .from(reInvoiceLines)
    .where(eq(reInvoiceLines.reInvoiceId, id))
    .orderBy(reInvoiceLines.lineOrder);
  return { ...inv, lines };
}

// ─── Integrations ──────────────────────────────────────────────────────────────

export async function getIntegrations(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(integrations)
    .where(eq(integrations.tenantId, tenantId));
}

export async function upsertIntegration(
  tenantId: number,
  provider: "smartbill" | "spv" | "oblio",
  data: {
    apiKey?: string;
    apiSecret?: string;
    tokenExpiresAt?: Date;
    status?: "active" | "inactive" | "error";
  }
) {
  const db = await getDb();
  if (!db) return;

  const [existing] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.tenantId, tenantId),
        eq(integrations.provider, provider)
      )
    );

  if (existing) {
    return db
      .update(integrations)
      .set({ ...data })
      .where(eq(integrations.id, existing.id));
  } else {
    return db
      .insert(integrations)
      .values({ tenantId, provider, ...data, status: data.status || "active" });
  }
}

export async function updateReInvoiceStatus(
  id: number,
  tenantId: number,
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled"
) {
  const db = await getDb();
  if (!db) {
    const r = _memReInvoices.find(r => r.id === id && r.tenantId === tenantId);
    if (r) r.status = status;
    return r;
  }
  return db
    .update(reInvoices)
    .set({ status })
    .where(and(eq(reInvoices.id, id), eq(reInvoices.tenantId, tenantId)));
}

export async function deleteReInvoice(id: number, tenantId: number) {
  const db = await getDb();
  if (!db) {
    _memReInvoices = _memReInvoices.filter(
      r => !(r.id === id && r.tenantId === tenantId)
    );
    return { success: true };
  }
  await db.delete(reInvoiceLines).where(eq(reInvoiceLines.reInvoiceId, id));
  return db
    .delete(reInvoices)
    .where(and(eq(reInvoices.id, id), eq(reInvoices.tenantId, tenantId)));
}

// ─── Invoice Archive helpers ──────────────────────────────────────────────────

export async function getInvoiceArchiveList(
  tenantId: number,
  filters?: {
    source?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }
) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  let query = db
    .select()
    .from(invoiceArchive)
    .where(eq(invoiceArchive.tenantId, tenantId));
  const items = await db
    .select()
    .from(invoiceArchive)
    .where(eq(invoiceArchive.tenantId, tenantId))
    .orderBy(desc(invoiceArchive.createdAt))
    .limit(limit)
    .offset(offset);

  let itemsWithLines = items.map(item => ({ ...item, itemsText: "", nirStatus: "none" }));
  if (items.length > 0) {
    const itemIds = items.map(i => i.id);
    const lines = await db
      .select()
      .from(invoiceArchiveLines)
      .where(inArray(invoiceArchiveLines.invoiceArchiveId, itemIds));

    // Get NIRs and NIR lines to calculate NIR status
    const { nir, nirLines } = await import("../drizzle/schema");
    const nirs = await db
      .select({ id: nir.id, invoiceArchiveId: nir.invoiceArchiveId })
      .from(nir)
      .where(inArray(nir.invoiceArchiveId, itemIds));

    const nirIds = nirs.map(n => n.id);
    let allNirLines: any[] = [];
    if (nirIds.length > 0) {
      allNirLines = await db
        .select()
        .from(nirLines)
        .where(inArray(nirLines.nirId, nirIds));
    }

    const linesMap = new Map<number, string[]>();
    const invoiceQtyMap = new Map<number, number>(); // Total qty per invoice
    const nirQtyMap = new Map<number, number>(); // Received qty per invoice

    for (const l of lines) {
      if (!linesMap.has(l.invoiceArchiveId))
        linesMap.set(l.invoiceArchiveId, []);
      linesMap.get(l.invoiceArchiveId)!.push(l.description);

      invoiceQtyMap.set(
        l.invoiceArchiveId,
        (invoiceQtyMap.get(l.invoiceArchiveId) || 0) + parseFloat(String(l.quantity || "0"))
      );
    }

    // Map NIR lines to invoices
    const nirToInvoice = new Map(nirs.map(n => [n.id, n.invoiceArchiveId]));
    for (const nl of allNirLines) {
      const invId = nirToInvoice.get(nl.nirId);
      if (invId) {
        nirQtyMap.set(
          invId,
          (nirQtyMap.get(invId) || 0) + parseFloat(String(nl.cantitateReceptionata || "0"))
        );
      }
    }

    itemsWithLines = items.map(item => {
      const totalQty = invoiceQtyMap.get(item.id) || 0;
      const receivedQty = nirQtyMap.get(item.id) || 0;
      let nirStatus = "none";
      if (receivedQty > 0) {
        nirStatus = receivedQty >= totalQty - 0.001 ? "full" : "partial";
      }

      return {
        ...item,
        itemsText: (linesMap.get(item.id) || []).join(" "),
        nirStatus,
      };
    });
  }

  const [{ total }] = await db
    .select({ total: count() })
    .from(invoiceArchive)
    .where(eq(invoiceArchive.tenantId, tenantId));

  return { items: itemsWithLines, total };
}

export async function createInvoiceArchiveEntry(data: InsertInvoiceArchive) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(invoiceArchive).values(data);
  const id = (result as any).insertId;
  const [entry] = await db
    .select()
    .from(invoiceArchive)
    .where(eq(invoiceArchive.id, id));
  return entry;
}

export async function getInvoiceArchiveById(id: number, tenantId: number) {
  const db = await getDb();
  if (!db) return null;
  const [entry] = await db
    .select()
    .from(invoiceArchive)
    .where(
      and(eq(invoiceArchive.id, id), eq(invoiceArchive.tenantId, tenantId))
    );
  if (!entry) return null;
  const lines = await db
    .select()
    .from(invoiceArchiveLines)
    .where(eq(invoiceArchiveLines.invoiceArchiveId, id));

  // Compute cantitate deja NIRata
  const { nir, nirLines } = await import("../drizzle/schema");
  const existingNirs = await db
    .select({ id: nir.id })
    .from(nir)
    .where(and(eq(nir.invoiceArchiveId, id), eq(nir.tenantId, tenantId)));

  const nirIds = existingNirs.map(n => n.id);
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

  const linesWithReceived = lines.map(l => ({
    ...l,
    receivedQuantity: receivedMap.get(l.description || "") || 0,
  }));

  return { ...entry, lines: linesWithReceived } as any;
}

export async function getInvoiceArchiveByIds(ids: number[], tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  const entries = await db
    .select()
    .from(invoiceArchive)
    .where(
      and(
        inArray(invoiceArchive.id, ids),
        eq(invoiceArchive.tenantId, tenantId)
      )
    );
  if (entries.length === 0) return [];
  const lines = await db
    .select()
    .from(invoiceArchiveLines)
    .where(inArray(invoiceArchiveLines.invoiceArchiveId, ids));

  return entries.map(entry => ({
    ...entry,
    lines: lines.filter(l => l.invoiceArchiveId === entry.id),
  }));
}

export async function updateInvoiceArchiveEntry(
  id: number,
  tenantId: number,
  data: Partial<InsertInvoiceArchive>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(invoiceArchive)
    .set(data)
    .where(
      and(eq(invoiceArchive.id, id), eq(invoiceArchive.tenantId, tenantId))
    );
  return getInvoiceArchiveById(id, tenantId);
}

export async function deleteInvoiceArchiveEntry(id: number, tenantId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(invoiceArchive)
    .where(
      and(eq(invoiceArchive.id, id), eq(invoiceArchive.tenantId, tenantId))
    );
}

export async function getInvoiceArchiveStats(tenantId: number) {
  const db = await getDb();
  if (!db) return { total: 0, pending: 0, processed: 0, refactured: 0 };
  const rows = await db
    .select({
      status: invoiceArchive.status,
      cnt: count(),
    })
    .from(invoiceArchive)
    .where(eq(invoiceArchive.tenantId, tenantId))
    .groupBy(invoiceArchive.status);

  const stats = {
    total: 0,
    pending: 0,
    processed: 0,
    refactured: 0,
    archived: 0,
  };
  for (const r of rows) {
    stats.total += Number(r.cnt);
    if (r.status === "pending") stats.pending = Number(r.cnt);
    if (r.status === "processed") stats.processed = Number(r.cnt);
    if (r.status === "refactured") stats.refactured = Number(r.cnt);
    if (r.status === "archived") stats.archived = Number(r.cnt);
  }
  return stats;
}
