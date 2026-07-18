import { useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle, Loader2, Lock, Eye, EyeOff } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { toast } from "sonner";

export default function ResetPassword() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const resetPasswordMutation = trpc.auth.resetPassword.useMutation();

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-lg shadow-xl shadow-slate-200/50 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Link Invalid</h1>
          <p className="text-slate-500 mb-6">Link-ul de resetare a parolei este invalid sau a expirat.</p>
          <Button onClick={() => setLocation("/login")} className="w-full">
            Înapoi la Autentificare
          </Button>
        </div>
      </div>
    );
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Parolele nu coincid");
      return;
    }

    if (password.length < 8) {
      setError("Parola trebuie să aibă minim 8 caractere");
      return;
    }

    setIsLoading(true);
    try {
      await resetPasswordMutation.mutateAsync({ token, newPassword: password });
      toast.success("Parola a fost resetată cu succes!");
      setLocation("/login");
    } catch (err) {
      setError((err as Error).message || "A apărut o eroare la resetarea parolei");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-black text-slate-900 mb-1">
          Alege o nouă parolă
        </h1>
        <p className="text-slate-500 text-sm mb-8">
          Te rugăm să introduci și să confirmi noua ta parolă.
        </p>

        <div className="bg-white p-8 rounded-lg shadow-xl shadow-slate-200/50 border border-slate-100">
          {error && (
            <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3 items-start">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label
                htmlFor="new-password"
                className="block text-sm font-semibold text-slate-700 mb-2 pl-2"
              >
                Parola Nouă
              </label>
              <InputGroup className="bg-white pr-2 !rounded-full overflow-hidden border-slate-200 shadow-sm px-2">
                <InputGroupAddon>
                  <Lock className="w-4 h-4 text-slate-400" />
                </InputGroupAddon>
                <InputGroupInput
                  id="new-password"
                  name="newPassword"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLoading}
                  className="py-6"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0 focus:outline-none px-2"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </InputGroup>
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="block text-sm font-semibold text-slate-700 mb-2 pl-2"
              >
                Confirmă Parola
              </label>
              <InputGroup className="bg-white pr-2 !rounded-full overflow-hidden border-slate-200 shadow-sm px-2">
                <InputGroupAddon>
                  <Lock className="w-4 h-4 text-slate-400" />
                </InputGroupAddon>
                <InputGroupInput
                  id="confirm-password"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLoading}
                  className="py-6"
                />
              </InputGroup>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full py-6 mt-4 text-base font-bold shadow-lg shadow-primary/20 !rounded-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Se salvează...
                </>
              ) : (
                "Salvează Parola"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
