/**
 * ProtectedRoute — Role-based route guard for frontend
 * Redirects unauthorized users based on their role
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { useEffect } from "react";

export type RequiredRole = "superadmin" | "admin" | "user" | "viewer";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: RequiredRole;
}

const roleHierarchy: Record<RequiredRole, number> = {
  superadmin: 4,
  admin: 3,
  user: 2,
  viewer: 1,
};

function hasRole(
  userRole: string | undefined,
  requiredRole: RequiredRole
): boolean {
  if (!userRole) return false;
  const userLevel = roleHierarchy[userRole as RequiredRole] || 0;
  return userLevel >= roleHierarchy[requiredRole];
}

export default function ProtectedRoute({
  children,
  requiredRole = "user",
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      // Not authenticated - redirect to login
      window.location.href = getLoginUrl();
      return;
    }

    if (!hasRole(user.role, requiredRole)) {
      // Insufficient permissions - redirect to dashboard
      setLocation("/");
      return;
    }
  }, [user, loading, requiredRole, setLocation]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  if (!hasRole(user.role, requiredRole)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Access Denied
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            You don't have permission to access this page.
          </p>
          <button
            onClick={() => setLocation("/")}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
