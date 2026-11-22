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
      setLocation("/dashboard");
      return;
    }
  }, [user, loading, requiredRole, setLocation]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen apple-canvas">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-sm text-[#636366] dark:text-[#98989d]">Se încarcă...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  if (!hasRole(user.role, requiredRole)) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6 apple-canvas">
        <div className="text-center apple-glass rounded-[22px] p-8 max-w-md w-full border border-black/[0.06] dark:border-white/[0.09]">
          <h1 className="text-2xl font-bold text-[#1d1d1f] dark:text-white mb-2">
            Acces restricționat
          </h1>
          <p className="text-sm text-[#636366] dark:text-[#98989d] mb-6">
            Nu aveți permisiunea necesară pentru a accesa această pagină.
          </p>
          <button
            type="button"
            onClick={() => setLocation("/dashboard")}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-full transition-colors cursor-pointer"
          >
            Mergi la Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
