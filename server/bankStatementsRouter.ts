import { TRPCError } from "@trpc/server";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { eq, and, desc, sql } from "drizzle-orm";
import { protectedProcedure, router } from "./_core/trpc";
import { tenantOf } from "./tenant";
import { getDb, getUserRole } from "./db";
import { bankStatements, tenants } from "../drizzle/schema";

let _bankStatementsTableEnsured = false;

export async function ensureBankStatementsTable(db: any): Promise<void> {
  if (_bankStatementsTableEnsured || !db) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS bankStatements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenantId INT NOT NULL,
        bankName VARCHAR(150) NOT NULL,
        iban VARCHAR(64) NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'RON',
        statementNumber VARCHAR(100) NULL,
        statementMonth VARCHAR(20) NOT NULL,
        periodStart VARCHAR(20) NULL,
        periodEnd VARCHAR(20) NULL,
        openingBalance DECIMAL(14, 2) NULL,
        closingBalance DECIMAL(14, 2) NULL,
        totalDebit DECIMAL(14, 2) NULL,
        totalCredit DECIMAL(14, 2) NULL,
        transactionsCount INT NULL,
        fileKey VARCHAR(512) NOT NULL,
        fileUrl VARCHAR(512) NOT NULL,
        fileName VARCHAR(255) NOT NULL,
        fileType VARCHAR(20) NOT NULL DEFAULT 'pdf',
        fileSize INT NULL,
        notes TEXT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_bank_statements_tenant_month (tenantId, statementMonth)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    _bankStatementsTableEnsured = true;
  } catch (err: any) {
    console.error("[BankStatements] Failed to ensure table:", err?.message || err);
  }
}

async function assertWriteRole(ctx: any, tenantId: number) {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Neautentificat." });
  }
  if (ctx.user.role === "superadmin") return;
  const memberRole = await getUserRole(ctx.user.id, tenantId);
  if (memberRole === "viewer") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Contul are rol doar de vizualizare (viewer) și nu poate efectua modificări.",
    });
  }
}

async function assertSafeBankStatementFileUrl(
  db: any,
  rawUrl: string,
  tenantId: number
): Promise<string> {
  const clean = String(rawUrl || "").trim();
  if (
    !clean ||
    clean.includes("..") ||
    clean.includes("\0") ||
    clean.includes("\\") ||
    !/^\/uploads\/bank_statements\/t(\d+)-[A-Za-z0-9._\- ()]+$/.test(clean)
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Calea fișierului extrasului de cont este invalidă.",
    });
  }
  const baseName = path.basename(clean);
  const prefixMatch = baseName.match(/^t(\d+)-/);
  if (!prefixMatch || parseInt(prefixMatch[1], 10) !== tenantId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Fișierul încărcat nu aparține firmei active.",
    });
  }
  const [otherOwner] = await db
    .select({ id: bankStatements.id })
    .from(bankStatements)
    .where(and(eq(bankStatements.fileUrl, clean), sql`${bankStatements.tenantId} != ${tenantId}`))
    .limit(1);
  if (otherOwner) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Fișierul aparține unei alte firme.",
    });
  }
  return clean;
}

export const RO_BIC_BANKS: Record<string, string> = {
  BTRL: "Banca Transilvania",
  INGB: "ING Bank",
  RZBR: "Raiffeisen Bank",
  RNCB: "BCR (Banca Comercială Română)",
  BRDE: "BRD - Groupe Société Générale",
  BACX: "UniCredit Bank",
  CECE: "CEC Bank",
  REVO: "Revolut Bank",
  OTPV: "OTP Bank",
  UGBI: "Garanti BBVA",
  PIRB: "First Bank",
  LIBR: "Libra Internet Bank",
  TREZ: "Trezoreria Statului",
  BUCU: "Alpha Bank",
  EGNA: "Vista Bank",
  BREL: "Salt Bank",
  BFER: "Exim Banca Românească",
  CARP: "Patria Bank",
  MIND: "ProCredit Bank",
};

export function detectBankFromIban(iban?: string | null): string | null {
  const clean = String(iban || "").replace(/\s+/g, "").toUpperCase();
  const roMatch = clean.match(/^RO\d{2}([A-Z]{4})/);
  if (roMatch && RO_BIC_BANKS[roMatch[1]]) {
    return RO_BIC_BANKS[roMatch[1]];
  }
  if (/^LT\d{2}32500/.test(clean) || /^IE\d{2}REVO/.test(clean)) return "Revolut Bank";
  if (/^BE\d{2}967/.test(clean)) return "Wise";
  return null;
}

function normalizeDecimalOrNull(val?: string | number | null): string | null {
  if (val === undefined || val === null || String(val).trim() === "") return null;
  const cleaned = String(val).trim().replace(/\s+/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return num.toFixed(2);
}

export const bankStatementsRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          month: z.string().optional(),
          currency: z.string().optional(),
          search: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { items: [], savedAccounts: [] };
      const tenantId = tenantOf(ctx);
      await ensureBankStatementsTable(db);

      const rows = await db
        .select()
        .from(bankStatements)
        .where(eq(bankStatements.tenantId, tenantId))
        .orderBy(desc(bankStatements.statementMonth), desc(bankStatements.periodEnd), desc(bankStatements.id));

      let filtered = rows;
      if (input?.month && input.month !== "all") {
        filtered = filtered.filter((r) => r.statementMonth === input.month);
      }
      if (input?.currency && input.currency !== "all") {
        filtered = filtered.filter(
          (r) => String(r.currency || "RON").toUpperCase() === input.currency!.toUpperCase()
        );
      }
      if (input?.search && input.search.trim()) {
        const q = input.search.trim().toLowerCase();
        filtered = filtered.filter(
          (r) =>
            (r.bankName || "").toLowerCase().includes(q) ||
            (r.iban || "").toLowerCase().includes(q) ||
            (r.statementNumber || "").toLowerCase().includes(q) ||
            (r.fileName || "").toLowerCase().includes(q) ||
            (r.notes || "").toLowerCase().includes(q)
        );
      }

      // Collect tenant's configured bank accounts for quick 1-click selection
      const savedAccountsMap = new Map<string, { bankName: string; iban: string; currency: string }>();
      const [tenantRow] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      const registerAcc = (ibanRaw?: string | null, bankRaw?: string | null, curRaw?: string | null) => {
        const cleanIban = String(ibanRaw || "").replace(/\s+/g, "").toUpperCase();
        if (!cleanIban) return;
        const detectedBank =
          (bankRaw && String(bankRaw).trim()) || detectBankFromIban(cleanIban) || "Cont Bancar";
        let cur = (curRaw && String(curRaw).trim().toUpperCase()) || "";
        if (!cur) {
          if (/EUR/i.test(cleanIban)) cur = "EUR";
          else if (/USD/i.test(cleanIban)) cur = "USD";
          else cur = "RON";
        }
        if (!savedAccountsMap.has(cleanIban)) {
          savedAccountsMap.set(cleanIban, {
            bankName: detectedBank,
            iban: cleanIban,
            currency: cur,
          });
        }
      };

      if (tenantRow?.settings) {
        try {
          const parsed = JSON.parse(tenantRow.settings);
          registerAcc(parsed.iban, parsed.bank, "RON");
          registerAcc(parsed.ibanEur, parsed.bankEur || parsed.bank, "EUR");
          registerAcc(parsed.ibanUsd, parsed.bankUsd || parsed.bank, "USD");
          if (Array.isArray(parsed.bankAccounts)) {
            for (const acc of parsed.bankAccounts) {
              registerAcc(acc?.iban, acc?.bankName || acc?.bank, acc?.currency);
            }
          }
        } catch {}
      }
      for (const r of rows) {
        if (r.iban) {
          registerAcc(r.iban, r.bankName, r.currency);
        }
      }

      return {
        items: filtered.map((r) => ({
          ...r,
          openingBalance: r.openingBalance !== null ? parseFloat(String(r.openingBalance)) : null,
          closingBalance: r.closingBalance !== null ? parseFloat(String(r.closingBalance)) : null,
          totalDebit: r.totalDebit !== null ? parseFloat(String(r.totalDebit)) : null,
          totalCredit: r.totalCredit !== null ? parseFloat(String(r.totalCredit)) : null,
          downloadUrl: `/api/pdf/bank-statement/${r.id}`,
        })),
        savedAccounts: Array.from(savedAccountsMap.values()),
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        bankName: z.string().min(1).max(150),
        iban: z.string().max(64).optional().nullable(),
        currency: z.string().min(1).max(10).default("RON"),
        statementNumber: z.string().max(100).optional().nullable(),
        statementMonth: z.string().regex(/^\d{4}-\d{2}$/, "Luna trebuie să fie în format YYYY-MM"),
        periodStart: z.string().max(20).optional().nullable(),
        periodEnd: z.string().max(20).optional().nullable(),
        openingBalance: z.union([z.string(), z.number()]).optional().nullable(),
        closingBalance: z.union([z.string(), z.number()]).optional().nullable(),
        totalDebit: z.union([z.string(), z.number()]).optional().nullable(),
        totalCredit: z.union([z.string(), z.number()]).optional().nullable(),
        transactionsCount: z.number().int().optional().nullable(),
        fileKey: z.string().min(1).max(512),
        fileUrl: z.string().min(1).max(512),
        fileName: z.string().min(1).max(255),
        fileType: z.string().max(20).default("pdf"),
        fileSize: z.number().int().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Baza de date indisponibilă" });
      const tenantId = tenantOf(ctx);
      await assertWriteRole(ctx, tenantId);
      await ensureBankStatementsTable(db);

      const safeFileUrl = await assertSafeBankStatementFileUrl(db, input.fileUrl, tenantId);
      const cleanIban = input.iban ? input.iban.replace(/\s+/g, "").toUpperCase() : null;

      const [res] = await db.insert(bankStatements).values({
        tenantId,
        bankName: input.bankName.trim(),
        iban: cleanIban,
        currency: input.currency.trim().toUpperCase().slice(0, 10) || "RON",
        statementNumber: input.statementNumber?.trim() || null,
        statementMonth: input.statementMonth.trim(),
        periodStart: input.periodStart?.trim() || null,
        periodEnd: input.periodEnd?.trim() || null,
        openingBalance: normalizeDecimalOrNull(input.openingBalance) as any,
        closingBalance: normalizeDecimalOrNull(input.closingBalance) as any,
        totalDebit: normalizeDecimalOrNull(input.totalDebit) as any,
        totalCredit: normalizeDecimalOrNull(input.totalCredit) as any,
        transactionsCount: input.transactionsCount ?? null,
        fileKey: input.fileKey.trim(),
        fileUrl: safeFileUrl,
        fileName: input.fileName.trim(),
        fileType: input.fileType.trim().toLowerCase().slice(0, 20) || "pdf",
        fileSize: input.fileSize ?? null,
        notes: input.notes?.trim() || null,
      });

      return { id: (res as any).insertId, success: true };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        bankName: z.string().min(1).max(150).optional(),
        iban: z.string().max(64).optional().nullable(),
        currency: z.string().min(1).max(10).optional(),
        statementNumber: z.string().max(100).optional().nullable(),
        statementMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
        periodStart: z.string().max(20).optional().nullable(),
        periodEnd: z.string().max(20).optional().nullable(),
        openingBalance: z.union([z.string(), z.number()]).optional().nullable(),
        closingBalance: z.union([z.string(), z.number()]).optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Baza de date indisponibilă" });
      const tenantId = tenantOf(ctx);
      await assertWriteRole(ctx, tenantId);
      await ensureBankStatementsTable(db);

      const updateFields: Record<string, any> = {};
      if (input.bankName !== undefined) updateFields.bankName = input.bankName.trim();
      if (input.iban !== undefined)
        updateFields.iban = input.iban ? input.iban.replace(/\s+/g, "").toUpperCase() : null;
      if (input.currency !== undefined)
        updateFields.currency = input.currency.trim().toUpperCase().slice(0, 10);
      if (input.statementNumber !== undefined)
        updateFields.statementNumber = input.statementNumber?.trim() || null;
      if (input.statementMonth !== undefined) updateFields.statementMonth = input.statementMonth.trim();
      if (input.periodStart !== undefined) updateFields.periodStart = input.periodStart?.trim() || null;
      if (input.periodEnd !== undefined) updateFields.periodEnd = input.periodEnd?.trim() || null;
      if (input.openingBalance !== undefined)
        updateFields.openingBalance = normalizeDecimalOrNull(input.openingBalance);
      if (input.closingBalance !== undefined)
        updateFields.closingBalance = normalizeDecimalOrNull(input.closingBalance);
      if (input.notes !== undefined) updateFields.notes = input.notes?.trim() || null;

      await db
        .update(bankStatements)
        .set(updateFields)
        .where(and(eq(bankStatements.id, input.id), eq(bankStatements.tenantId, tenantId)));

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Baza de date indisponibilă" });
      const tenantId = tenantOf(ctx);
      await assertWriteRole(ctx, tenantId);
      await ensureBankStatementsTable(db);

      const [existing] = await db
        .select()
        .from(bankStatements)
        .where(and(eq(bankStatements.id, input.id), eq(bankStatements.tenantId, tenantId)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Extrasul de cont nu a fost găsit." });
      }

      await db
        .delete(bankStatements)
        .where(and(eq(bankStatements.id, input.id), eq(bankStatements.tenantId, tenantId)));

      // Clean up physical file if no other record points to it
      const [stillReferenced] = await db
        .select({ id: bankStatements.id })
        .from(bankStatements)
        .where(eq(bankStatements.fileUrl, existing.fileUrl))
        .limit(1);

      if (!stillReferenced && existing.fileUrl.startsWith("/uploads/bank_statements/")) {
        const baseName = path.basename(existing.fileUrl);
        if (baseName.startsWith(`t${tenantId}-`) && !baseName.includes("..")) {
          for (const rootDir of [
            path.resolve(process.cwd(), "dist", "public", "uploads", "bank_statements"),
            path.resolve(process.cwd(), "client", "public", "uploads", "bank_statements"),
          ]) {
            const candidate = path.resolve(rootDir, baseName);
            if (candidate.startsWith(rootDir + path.sep) && fs.existsSync(candidate)) {
              await fs.promises.unlink(candidate).catch(() => {});
            }
          }
        }
      }

      return { success: true };
    }),
});
