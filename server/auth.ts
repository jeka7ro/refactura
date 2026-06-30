import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { accounts } from "../drizzle/schema";

const SALT_ROUNDS = 10;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Create a new account (register)
 */
export async function createAccount(
  email: string,
  password: string,
  tenantId?: number,
  role: "superadmin" | "admin" | "user" = "user"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const passwordHash = await hashPassword(password);

  try {
    const result = await db.insert(accounts).values({
      email,
      passwordHash,
      tenantId,
      role,
      isActive: 1,
    });
    return result;
  } catch (error) {
    if ((error as any).code === "ER_DUP_ENTRY") {
      throw new Error("Email already exists");
    }
    throw error;
  }
}

/**
 * Authenticate a user (login)
 */
export async function authenticateAccount(email: string, password: string) {
  const db = await getDb();
  if (!db) {
    console.warn("Database not available. Simulating login for local testing.");
    return {
      id: 1,
      email: email,
      passwordHash: "mock",
      tenantId: 1,
      role: "admin" as const,
      isActive: 1,
    };
  }

  const result = await db
    .select()
    .from(accounts)
    .where(eq(accounts.email, email))
    .limit(1);

  if (result.length === 0) {
    throw new Error("Invalid email or password");
  }

  const account = result[0];

  if (!account.isActive) {
    throw new Error("Account is inactive");
  }

  const isValid = await verifyPassword(password, account.passwordHash);
  if (!isValid) {
    throw new Error("Invalid email or password");
  }

  // Update last login
  await db
    .update(accounts)
    .set({ lastLoginAt: new Date() })
    .where(eq(accounts.id, account.id));

  return account;
}

/**
 * Get account by email
 */
export async function getAccountByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(accounts)
    .where(eq(accounts.email, email))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * Get account by ID
 */
export async function getAccountById(id: number) {
  const db = await getDb();
  if (!db) {
    // Fără DB (local testing) — returnăm un cont mock cu ID-ul cerut
    return {
      id,
      email: "local@refactura.ro",
      passwordHash: "mock",
      tenantId: 1,
      role: "admin" as const,
      isActive: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: new Date(),
    };
  }

  const result = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}
