import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

export function useAuth() {
  const [, setLocation] = useLocation();
  const token = localStorage.getItem("authToken");

  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: !!token,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minute cache
  });

  useEffect(() => {
    if (meQuery.isError) {
      localStorage.removeItem("authToken");
      setLocation("/login");
    }
  }, [meQuery.isError, setLocation]);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      localStorage.removeItem("authToken");
      localStorage.removeItem("savedCredentials");
      setLocation("/login");
    },
  });

  const logout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("savedCredentials");
    setLocation("/login");
  };

  // Dacă nu e token, user e null și loading e false
  if (!token) {
    return {
      user: null,
      loading: false,
      isAuthenticated: false,
      logout,
      logoutMutation,
    };
  }

  return {
    user: meQuery.data ?? (meQuery.isLoading ? undefined : null),
    loading: meQuery.isLoading,
    isAuthenticated: !!meQuery.data,
    logout,
    logoutMutation,
  };
}
