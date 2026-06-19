import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key-change-in-production");

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
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

  return token;
}

/**
 * Verify and decode a JWT session token
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const verified = await jwtVerify(token, secret);
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
