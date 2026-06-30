/**
 * Role-Based Access Control (RBAC) for GetApp Smart Invoice
 * Provides middleware for tRPC procedures to enforce role-based permissions
 */

import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";

export type UserRole = "superadmin" | "admin" | "user" | "viewer";

/**
 * Check if user has required role
 */
export function hasRole(
  userRole: UserRole | undefined,
  requiredRole: UserRole
): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    superadmin: 4,
    admin: 3,
    user: 2,
    viewer: 1,
  };

  if (!userRole) return false;
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

/**
 * Middleware to require superadmin role
 */
export async function requireSuperadmin(ctx: TrpcContext) {
  if (!ctx.user || !hasRole(ctx.user.role as UserRole, "superadmin")) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Superadmin access required",
    });
  }
  return ctx;
}

/**
 * Middleware to require admin role
 */
export async function requireAdmin(ctx: TrpcContext) {
  if (!ctx.user || !hasRole(ctx.user.role as UserRole, "admin")) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return ctx;
}

/**
 * Middleware to require authenticated user
 */
export async function requireAuth(ctx: TrpcContext) {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }
  return ctx;
}

/**
 * Middleware to require specific tenant access
 * Note: Tenant association is stored in userTenants table, not directly on user
 */
export async function requireTenantAccess(ctx: TrpcContext, tenantId: number) {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }

  // Superadmin can access any tenant
  if (ctx.user.role === "superadmin") {
    return ctx;
  }

  // For other users, tenant access should be verified via userTenants table
  // This is a placeholder - actual implementation requires database query
  // TODO: Query userTenants table to verify user has access to tenantId

  return ctx;
}
