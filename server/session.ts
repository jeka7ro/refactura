import crypto from "crypto";
import { SignJWT, jwtVerify } from "jose";

let cachedDerivedSecret: string | null = null;

export function getEffectiveJwtSecret(): string {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length > 0) {
    return process.env.JWT_SECRET.trim();
  }
  const privateEnvSeed =
    process.env.SESSION_SECRET ||
    process.env.COOKIE_SECRET ||
    process.env.DATABASE_URL ||
    process.env.ANAF_CLIENT_SECRET ||
    "";
  if (privateEnvSeed) {
    if (!cachedDerivedSecret) {
      cachedDerivedSecret = crypto
        .createHmac("sha256", "smart-invoice-prod-jwt-key-v1")
        .update(privateEnvSeed)
        .digest("hex");
      if (process.env.NODE_ENV === "production") {
        console.warn(
          "[SECURITY] JWT_SECRET nu este setat explicit; s-a derivat automat o cheie criptografică HMAC-SHA256 din configurația privată a serverului."
        );
      }
    }
    return cachedDerivedSecret;
  }
  if (process.env.NODE_ENV !== "production") {
    return "your-secret-key-change-in-production";
  }
  if (!cachedDerivedSecret) {
    cachedDerivedSecret = crypto.randomBytes(32).toString("hex");
    console.warn(
      "[SECURITY] JWT_SECRET nu este setat; s-a generat o cheie criptografică pe durata rulării containerului."
    );
  }
  return cachedDerivedSecret;
}

function getSecret(): Uint8Array {
  return new TextEncoder().encode(getEffectiveJwtSecret());
}

export interface SessionPayload {
  accountId: number;
  email: string;
  role: "superadmin" | "admin" | "user";
  tenantId?: number;
  iat?: number;
  exp?: number;
  [key: string]: any;
}

/**
 * Create a JWT session token
 */
export async function createSessionToken(
  payload: SessionPayload
): Promise<string> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());

  return token;
}

/**
 * Verify and decode a JWT session token
 */
export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const verified = await jwtVerify(token, getSecret());
    return verified.payload as unknown as SessionPayload;
  } catch (error) {
    console.error("[Session] Token verification failed:", error);
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1];
}
