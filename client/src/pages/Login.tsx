import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import {
  AlertCircle,
  Loader2,
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

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
    // Dacă utilizatorul are deja un token (sesiune activă), redirecționează-l automat
    const token = localStorage.getItem("authToken");
    if (token) {
      setLocation("/dashboard");
      return;
    }

    const saved = localStorage.getItem("savedCredentials");
    if (saved) {
      try {
        const { email: e, password: p } = JSON.parse(saved);
        setEmail(e || "");
        setPassword(p || "");
        setRememberMe(true);
      } catch {}
    }
  }, [setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const result = await loginMutation.mutateAsync({ email, password });
      if (result.success) {
        localStorage.setItem("authToken", result.token);
        if (rememberMe) {
          localStorage.setItem(
            "savedCredentials",
            JSON.stringify({ email, password })
          );
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
    <div 
        className="min-h-screen flex items-center justify-center p-4 relative bg-slate-900"
        style={{
            backgroundImage: `linear-gradient(to right, rgba(15, 23, 42, 0.2), rgba(30, 58, 138, 0.4), rgba(15, 23, 42, 0.9)), url('/davide_chape_fleet.png')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
            backgroundRepeat: 'no-repeat'
        }}
    >
        {/* Decorative background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl"></div>
        </div>

        <div className="w-full max-w-md relative z-10">

            {/* Login Card */}
            <div className="bg-gradient-to-br from-blue-100/50 via-white/40 to-yellow-100/50 backdrop-blur-xl rounded-[2.5rem] shadow-[0_8px_32px_0_rgba(31,38,135,0.2)] p-6 sm:p-8 border border-white/50 relative z-10 hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.3)] transition-all duration-300">
                
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-56 h-16 mt-2 mb-4 drop-shadow-sm">
                        <img src="/logo.png" alt="GetApp Refactura" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-1">
                        GetApp Refactura
                    </h1>
                    <p className="text-sm text-slate-500 font-medium">
                        Facturezi mai inteligent. Nu mai greu.
                    </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    {/* Email Input */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Adresă email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white/50 backdrop-blur-sm border-2 border-white/60 rounded-2xl 
                     focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/20 
                     outline-none transition-all duration-200 text-slate-800 font-medium
                     placeholder:text-slate-500 placeholder:font-normal shadow-inner"
                            placeholder="email@companie.ro"
                            required
                            autoFocus
                        />
                    </div>

                    {/* Password Input */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Parolă
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-2.5 pr-12 bg-white/50 backdrop-blur-sm border-2 border-white/60 rounded-2xl 
                         focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/20 
                         outline-none transition-all duration-200 text-slate-800 font-medium
                         placeholder:text-slate-500 placeholder:font-normal shadow-inner text-lg"
                                placeholder="••••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {/* Remember Me */}
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="w-4 h-4 rounded border-2 border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                        />
                        <span className="text-sm text-slate-600 font-medium">Ține-mă minte</span>
                    </label>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                            <p className="text-red-700 text-sm font-medium">{error}</p>
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full text-white px-6 py-3.5 rounded-2xl font-semibold text-base
                   active:scale-[0.98] transition-all duration-200
                   disabled:opacity-50 disabled:cursor-not-allowed
                   flex items-center justify-center gap-2 group bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40`}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Se autentifică...</span>
                            </>
                        ) : (
                            <>
                                <span>Intră în cont</span>
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-6 mb-6 text-center">
                    <Link href="/register" className="text-sm text-slate-600 hover:text-blue-600 transition-colors font-medium">
                        Nu ai cont? Solicită acces
                    </Link>
                </div>

                {/* Footer Inside Box */}
                <div className="pt-6 border-t border-slate-200/50 text-center flex flex-col items-center justify-center gap-3">
                    <p className="text-xs text-slate-500 font-medium tracking-wide">
                        O soluție marca <a href="https://getapp.ro" target="_blank" rel="noopener noreferrer" className="text-slate-700 hover:text-blue-600 font-bold transition-all underline decoration-slate-300 underline-offset-4">getapp.ro</a>
                    </p>
                </div>
            </div>
        </div>
    </div>
  );
}
