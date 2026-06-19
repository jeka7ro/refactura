import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AlertCircle, Loader2, Lock, Mail, ArrowRight, Layers, Eye, EyeOff } from "lucide-react";
import { trpc } from "@/lib/trpc";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663775520028/C8wLbaeYKAg5R5gqEkUmxw/logo-icon-HMKYoPLDnRUVqqQYYTWWRf.webp";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const loginMutation = trpc.auth.login.useMutation();

  // La mount, încarcă credențialele salvate dacă există
  useEffect(() => {
    const saved = localStorage.getItem("savedCredentials");
    if (saved) {
      try {
        const { email: e, password: p } = JSON.parse(saved);
        setEmail(e || "");
        setPassword(p || "");
        setRememberMe(true);
      } catch {}
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const result = await loginMutation.mutateAsync({ email, password });
      if (result.success) {
        localStorage.setItem("authToken", result.token);
        // Salvează sau șterge credențialele în funcție de "ține-mă minte"
        if (rememberMe) {
          localStorage.setItem("savedCredentials", JSON.stringify({ email, password }));
        } else {
          localStorage.removeItem("savedCredentials");
        }
        setLocation("/dashboard");
      }
    } catch (err) {
      setError((err as Error).message || "Autentificare eșuată");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex overflow-hidden" style={{ fontFamily: "'Inter', 'Outfit', sans-serif" }}>
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:flex-1 bg-slate-900 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background glows */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none" />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">SmartInvoice</span>
        </div>

        {/* Center content */}
        <div className="relative z-10">
          <h2 className="text-4xl font-black text-white leading-tight mb-6">
            Facturezi mai inteligent.<br />
            <span className="text-blue-400">Nu mai greu.</span>
          </h2>
          <p className="text-slate-400 text-lg leading-relaxed max-w-sm">
            Re-facturare automată din SPV, sincronizare Oblio și gestionare centre de cost — totul într-un singur loc.
          </p>

          {/* Stats */}
          <div className="mt-10 grid grid-cols-3 gap-6">
            {[
              { value: "2 min", label: "setup inițial" },
              { value: "100%", label: "conformitate SPV" },
              { value: "7 zile", label: "trial gratuit" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-2xl font-black text-white">{s.value}</div>
                <div className="text-slate-500 text-sm mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-slate-600 text-sm relative z-10">© {new Date().getFullYear()} SmartInvoice · Refactura.ro</p>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50 overflow-y-auto">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <img src={LOGO_URL} alt="SmartInvoice" className="h-9 w-9 object-contain" />
            <span className="font-bold text-xl text-slate-900 tracking-tight">SmartInvoice</span>
          </div>

          <h1 className="text-3xl font-black text-slate-900 mb-2">Bun venit înapoi</h1>
          <p className="text-slate-500 mb-8">Intră în contul tău pentru a continua.</p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3 items-start">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5" autoComplete="on">
            {/* Email */}
            <div>
              <label htmlFor="login-email" className="block text-sm font-semibold text-slate-700 mb-2">
                Adresă email
              </label>
              <div className="flex items-center border border-slate-200 bg-white rounded-[8px] focus-within:ring-2 focus-within:ring-blue-500 transition-all overflow-hidden">
                <Mail className="ml-3.5 w-4 h-4 text-slate-400 flex-shrink-0" />
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@companie.ro"
                  disabled={isLoading}
                  className="flex-1 py-3.5 pl-2.5 pr-4 bg-transparent text-slate-900 placeholder-slate-400 text-sm font-medium focus:outline-none disabled:opacity-60 border-none"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="login-password" className="block text-sm font-semibold text-slate-700">
                  Parolă
                </label>
                <button type="button" className="text-xs text-blue-600 hover:text-blue-700 font-semibold">
                  Ai uitat parola?
                </button>
              </div>
              <div className="flex items-center border border-slate-200 bg-white rounded-[8px] focus-within:ring-2 focus-within:ring-blue-500 transition-all overflow-hidden">
                <Lock className="ml-3.5 w-4 h-4 text-slate-400 flex-shrink-0" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLoading}
                  className="flex-1 py-3.5 pl-2.5 pr-2 bg-transparent text-slate-900 placeholder-slate-400 text-sm font-medium focus:outline-none disabled:opacity-60 border-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="mr-3.5 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Ține-mă minte */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                id="remember-me"
                onClick={() => setRememberMe(!rememberMe)}
                className={`w-5 h-5 rounded-[6px] border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                  rememberMe ? "bg-blue-600 border-blue-600" : "border-slate-300 bg-white hover:border-blue-400"
                }`}
              >
                {rememberMe && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <label htmlFor="remember-me" onClick={() => setRememberMe(!rememberMe)} className="text-sm text-slate-600 cursor-pointer select-none">
                Ține-mă minte pe acest dispozitiv
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-13 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-sm rounded-[8px] flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/30 mt-2"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Se autentifică...</>
              ) : (
                <>Intră în cont <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="text-sm text-slate-500 text-center mt-8">
            Nu ai cont?{" "}
            <button
              onClick={() => setLocation("/register")}
              className="text-blue-600 hover:text-blue-700 font-semibold"
            >
              Solicită acces
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
