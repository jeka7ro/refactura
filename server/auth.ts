import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { accounts, passwordResets } from "../drizzle/schema";
import crypto from "crypto";

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
 * Create a new account from Google Login
 */
export async function createGoogleAccount(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Generate a random secure password hash for google accounts 
  // since they won't use a password to login, but the column is NOT NULL
  const randomPassword = crypto.randomBytes(32).toString("hex");
  const passwordHash = await hashPassword(randomPassword);

  try {
    const [result] = await db.insert(accounts).values({
      email,
      passwordHash,
      role: "user",
      isActive: 1,
    });
    
    // Return the newly created account id
    return result.insertId;
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

/**
 * Generate a password reset token
 */
export async function generatePasswordResetToken(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const account = await getAccountByEmail(email);
  if (!account) return null; // Do not throw error for security (enum prevention)

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

  await db.insert(passwordResets).values({
    email,
    token,
    expiresAt,
  });

  return token;
}

/**
 * Reset password using a valid token
 */
export async function resetPasswordWithToken(token: string, newPassword: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [resetReq] = await db
    .select()
    .from(passwordResets)
    .where(eq(passwordResets.token, token))
    .limit(1);

  if (!resetReq) throw new Error("Invalid or expired token");
  if (resetReq.expiresAt < new Date()) {
    // Delete expired token
    await db.delete(passwordResets).where(eq(passwordResets.id, resetReq.id));
    throw new Error("Token has expired");
  }

  const account = await getAccountByEmail(resetReq.email);
  if (!account) throw new Error("Account no longer exists");

  const newHash = await hashPassword(newPassword);

  // Update password
  await db
    .update(accounts)
    .set({ passwordHash: newHash })
    .where(eq(accounts.id, account.id));

  // Consume token (delete all for this user to be safe)
  await db.delete(passwordResets).where(eq(passwordResets.email, account.email));

  return true;
}

/**
 * Change password for logged in user
 */
export async function changePassword(accountId: number, currentPassword: string, newPassword: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const account = await getAccountById(accountId);
  if (!account) throw new Error("Account not found");

  const isValid = await verifyPassword(currentPassword, account.passwordHash);
  if (!isValid) throw new Error("Parola curentă este incorectă");

  const newHash = await hashPassword(newPassword);

  await db
    .update(accounts)
    .set({ passwordHash: newHash })
    .where(eq(accounts.id, account.id));

  return true;
}
