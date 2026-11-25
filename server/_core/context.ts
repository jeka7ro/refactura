import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { verifySessionToken, extractTokenFromHeader } from "../session";
import { getAccountById } from "../auth";
import { getDb } from "../db";
import { resolveVerifiedAccountTenant } from "../tenant";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: (User & { tenantId?: number; accountId?: number }) | null;
};

export type Context = TrpcContext;

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: (User & { tenantId?: number; accountId?: number }) | null = null;

  // Try custom JWT auth first (email/password)
  try {
    const authHeader = opts.req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (token) {
      const sessionPayload = await verifySessionToken(token);
      if (sessionPayload) {
        const account = await getAccountById(sessionPayload.accountId);
        if (!account || !account.isActive) {
          return { req: opts.req, res: opts.res, user: null };
        }
        // Resolve tenantId read-only against active userTenants (and valid bidirectional pairs)
        let tenantId: number | undefined;
        if (account.role === "superadmin") {
          tenantId = account.tenantId || undefined;
        } else {
          try {
            const db = await getDb();
            const resolved = await resolveVerifiedAccountTenant(db, account);
            tenantId = resolved.tenantId;
          } catch (_) {
            tenantId = undefined;
          }
        }
        // Create user object from account
        user = {
          id: account.id,
          openId: `account_${account.id}`,
          name: account.email,
          email: account.email,
          phone: account.phone ?? null,
          loginMethod: "email",
          role: account.role as any,
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
          lastSignedIn: account.lastLoginAt || new Date(),
          tenantId,
          accountId: account.id,
        };
        return { req: opts.req, res: opts.res, user };
      }
    }
  } catch (error) {
    // Fall through to OAuth auth
  }

  // Fall back to OAuth auth
  try {
    user = await sdk.authenticateRequest(opts.req);

    // For OAuth users, look up their active tenant read-only
    if (user && (user as any).id) {
      try {
        const db = await getDb();
        const resolved = await resolveVerifiedAccountTenant(db, {
          id: (user as any).id,
          role: (user as any).role,
          tenantId: (user as any).tenantId ?? null,
        });
        if (resolved.tenantId) {
          (user as any).tenantId = resolved.tenantId;
        } else {
          delete (user as any).tenantId;
        }
      } catch (error) {
        console.error("[Context] Failed to get tenant for OAuth user:", error);
      }
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
