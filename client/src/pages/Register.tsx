import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AlertCircle, Loader2, Lock, Mail, ArrowRight, Eye, EyeOff, User, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Register() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const registerMutation = trpc.auth.register.useMutation();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Parolele nu coincid.");
      return;
    }
    if (password.length < 8) {
      setError("Parola trebuie să aibă minim 8 caractere.");
      return;
    }
    setIsLoading(true);
    try {
      const result = await registerMutation.mutateAsync({ email, password, confirmPassword: password });
      if (result.success) {
        localStorage.setItem("authToken", result.token);
        setLocation("/dashboard");
      }
    } catch (err) {
      setError((err as Error).message || "Înregistrare eșuată. Încearcă din nou.");
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = password.length === 0 ? 0 : password.length < 8 ? 1 : password.length < 12 ? 2 : 3;
  const strengthLabel = ["", "Slabă", "Bună", "Excelentă"];
  const strengthColor = ["", "bg-red-500", "bg-yellow-500", "bg-green-500"];

  return (
    <div className="h-screen flex overflow-hidden" style={{ fontFamily: "'Inter', 'Outfit', sans-serif" }}>
      {/* Left panel - dark branding */}
      <div className="hidden lg:flex lg:flex-1 bg-slate-900 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none" />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <img src="/refactura-logo.png" alt="Refactura.ro" className="w-10 h-10 object-contain" />
          <div>
            <div className="text-white font-black text-xl tracking-tight leading-none">Refactura</div>
            <div className="text-blue-400 text-xs font-semibold">.ro</div>
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10">
          <h2 className="text-4xl font-black text-white leading-tight mb-6">
            Automatizează<br />
            <span className="text-blue-400">re-facturarea ta.</span>
          </h2>
          <p className="text-slate-400 text-base leading-relaxed max-w-sm mb-10">
            Import SPV, adaos automat, emitere în Oblio. Gata în 2 minute.
          </p>

          {/* Benefits */}
          <div className="flex flex-col gap-4">
            {[
              "7 zile gratuit, fără card",
              "Sincronizare automată SPV & Oblio",
              "Centre de cost & rapoarte în timp real",
            ].map((b) => (
              <div key={b} className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
                <span className="text-slate-300 text-sm font-medium">{b}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-slate-600 text-sm relative z-10">© {new Date().getFullYear()} Refactura.ro · Toate drepturile rezervate</p>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50 overflow-y-auto">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <img src="/refactura-logo.png" alt="Refactura.ro" className="w-9 h-9 object-contain" />
            <div>
              <span className="font-black text-xl text-slate-900 tracking-tight leading-none">Refactura</span>
              <span className="text-blue-600 font-black text-xl">.ro</span>
            </div>
          </div>

          <h1 className="text-3xl font-black text-slate-900 mb-1">Creează cont</h1>
          <p className="text-slate-500 text-sm mb-8">7 zile gratuit · Fără card · Anulezi oricând</p>

          {error && (
            <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3 items-start">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4" autoComplete="on">
            {/* Nume */}
            <div>
              <label htmlFor="reg-name" className="block text-sm font-semibold text-slate-700 mb-2">Nume complet</label>
              <div className="flex items-center border border-slate-200 bg-white rounded-lg focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                <User className="ml-3.5 w-4 h-4 text-slate-400 flex-shrink-0" />
                <input
                  id="reg-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ion Popescu"
                  disabled={isLoading}
                  className="flex-1 py-3.5 pl-2.5 pr-4 bg-transparent text-slate-900 placeholder-slate-400 text-sm font-medium focus:outline-none disabled:opacity-60"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="reg-email" className="block text-sm font-semibold text-slate-700 mb-2">Adresă email</label>
              <div className="flex items-center border border-slate-200 bg-white rounded-lg focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                <Mail className="ml-3.5 w-4 h-4 text-slate-400 flex-shrink-0" />
                <input
                  id="reg-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@companie.ro"
                  disabled={isLoading}
                  className="flex-1 py-3.5 pl-2.5 pr-4 bg-transparent text-slate-900 placeholder-slate-400 text-sm font-medium focus:outline-none disabled:opacity-60"
                />
              </div>
            </div>

            {/* Parolă */}
            <div>
              <label htmlFor="reg-password" className="block text-sm font-semibold text-slate-700 mb-2">Parolă</label>
              <div className="flex items-center border border-slate-200 bg-white rounded-lg focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                <Lock className="ml-3.5 w-4 h-4 text-slate-400 flex-shrink-0" />
                <input
                  id="reg-password"
                  name="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minim 8 caractere"
                  disabled={isLoading}
                  className="flex-1 py-3.5 pl-2.5 pr-2 bg-transparent text-slate-900 placeholder-slate-400 text-sm font-medium focus:outline-none disabled:opacity-60"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1} className="mr-3.5 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex gap-1 flex-1">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= passwordStrength ? strengthColor[passwordStrength] : "bg-slate-200"}`} />
                    ))}
                  </div>
                  <span className="text-xs text-slate-500 font-medium">{strengthLabel[passwordStrength]}</span>
                </div>
              )}
            </div>

            {/* Confirmare parolă */}
            <div>
              <label htmlFor="reg-confirm" className="block text-sm font-semibold text-slate-700 mb-2">Confirmă parola</label>
              <div className={`flex items-center bg-white rounded-lg border transition-all focus-within:ring-2 ${
                    confirmPassword.length > 0 && confirmPassword !== password
                      ? "border-red-300 focus-within:ring-red-400"
                      : "border-slate-200 focus-within:ring-blue-500"
                  }`}>
                <Lock className="ml-3.5 w-4 h-4 text-slate-400 flex-shrink-0" />
                <input
                  id="reg-confirm"
                  name="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repetă parola"
                  disabled={isLoading}
                  className="flex-1 py-3.5 pl-2.5 pr-2 bg-transparent text-slate-900 placeholder-slate-400 text-sm font-medium focus:outline-none disabled:opacity-60"
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} tabIndex={-1} className="mr-3.5 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-sm rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/30 mt-2"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Se creează contul...</>
              ) : (
                <>Creează cont gratuit <ArrowRight className="w-4 h-4" /></>
              )}
            </button>

            <p className="text-xs text-slate-400 text-center">
              Prin înregistrare, ești de acord cu{" "}
              <span className="text-blue-600 cursor-pointer hover:underline">Termenii și condițiile</span>
            </p>
          </form>

          <p className="text-sm text-slate-500 text-center mt-6">
            Ai deja cont?{" "}
            <button onClick={() => setLocation("/login")} className="text-blue-600 hover:text-blue-700 font-semibold">
              Autentifică-te
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
