import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { verifySessionToken, extractTokenFromHeader } from "../session";
import { getAccountById } from "../auth";
import { getDefaultTenantForUser } from "../db";

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
        if (account) {
          // Resolve tenantId: prefer direct account.tenantId, fall back to userTenants lookup
          // userTenants.userId stores accounts.id for email/password users
          let tenantId: number | undefined = account.tenantId || undefined;
          if (!tenantId) {
            try {
              const fallbackTenantId = await getDefaultTenantForUser(
                account.id
              );
              if (fallbackTenantId) tenantId = fallbackTenantId;
            } catch (_) {
              // ignore — tenantId stays undefined
            }
          }
          // Create user object from account
          user = {
            id: account.id,
            openId: `account_${account.id}`,
            name: account.email,
            email: account.email,
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
    }
  } catch (error) {
    // Fall through to OAuth auth
  }

  // Fall back to OAuth auth
  try {
    user = await sdk.authenticateRequest(opts.req);

    // For OAuth users, look up their default tenant
    if (user && (user as any).id) {
      try {
        const tenantId = await getDefaultTenantForUser((user as any).id);
        if (tenantId) {
          (user as any).tenantId = tenantId;
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
