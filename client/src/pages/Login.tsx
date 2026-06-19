import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { AlertCircle, Loader2, Lock, Mail, ArrowRight, Layers, Eye, EyeOff } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Checkbox } from "@/components/ui/checkbox"; // Assuming this exists, if not I'll keep the custom one but let's use a standard wrapper

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
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:flex-1 bg-slate-900 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none" />

        <Link href="/">
          <div className="flex items-center gap-3 relative z-10 cursor-pointer hover:opacity-90 transition-opacity w-fit">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
              <Layers className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-white font-bold text-xl tracking-tight">SmartInvoice</span>
          </div>
        </Link>

        <div className="relative z-10">
          <h2 className="text-4xl font-black text-white leading-tight mb-6">
            Facturezi mai inteligent.<br />
            <span className="text-blue-400">Nu mai greu.</span>
          </h2>
          <p className="text-slate-400 text-lg leading-relaxed max-w-sm">
            Re-facturare automată din SPV, sincronizare Oblio și gestionare centre de cost — totul într-un singur loc.
          </p>

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
          <Link href="/">
            <div className="flex items-center gap-3 mb-10 lg:hidden cursor-pointer w-fit">
              <img src={LOGO_URL} alt="SmartInvoice" className="h-9 w-9 object-contain" />
              <span className="font-bold text-xl text-slate-900 tracking-tight">SmartInvoice</span>
            </div>
          </Link>

          <h1 className="text-3xl font-black text-slate-900 mb-2">Bun venit înapoi</h1>
          <p className="text-slate-500 mb-8">Intră în contul tău pentru a continua.</p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3 items-start">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5" autoComplete="on">
            <div>
              <label htmlFor="login-email" className="block text-sm font-semibold text-slate-700 mb-2">
                Adresă email
              </label>
              <InputGroup className="bg-white !rounded-full overflow-hidden border-slate-200 shadow-sm px-2">
                <InputGroupAddon>
                  <Mail className="w-4 h-4 text-slate-400" />
                </InputGroupAddon>
                <InputGroupInput
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@companie.ro"
                  disabled={isLoading}
                  className="py-6"
                />
              </InputGroup>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="login-password" className="block text-sm font-semibold text-slate-700">
                  Parolă
                </label>
                <button type="button" className="text-xs text-primary hover:text-primary/80 font-semibold">
                  Ai uitat parola?
                </button>
              </div>
              <InputGroup className="bg-white pr-2 !rounded-full overflow-hidden border-slate-200 shadow-sm px-2">
                <InputGroupAddon>
                  <Lock className="w-4 h-4 text-slate-400" />
                </InputGroupAddon>
                <InputGroupInput
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </InputGroup>
            </div>

            <div className="flex items-center gap-3 pl-2">
              <button
                type="button"
                id="remember-me"
                onClick={() => setRememberMe(!rememberMe)}
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                  rememberMe ? "bg-primary border-primary" : "border-slate-300 bg-white hover:border-primary/50"
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

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full py-6 mt-4 text-base font-bold shadow-lg shadow-primary/20 !rounded-full"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Se autentifică...</>
              ) : (
                <>Intră în cont <ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          </form>

          <p className="text-sm text-slate-500 text-center mt-8">
            Nu ai cont?{" "}
            <Link href="/register">
              <span className="text-primary hover:text-primary/80 font-semibold cursor-pointer">
                Solicită acces
              </span>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
