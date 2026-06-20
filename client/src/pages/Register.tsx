import { useState } from "react";
import { useLocation, Link } from "wouter";
import { AlertCircle, Loader2, Lock, Mail, ArrowRight, Eye, EyeOff, User, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { toast } from "sonner";

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
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Left panel - dark branding */}
      <div className="hidden lg:flex lg:flex-1 bg-slate-900 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none" />

        <Link href="/">
          <div className="flex items-center gap-3 relative z-10 cursor-pointer hover:opacity-90 transition-opacity w-fit">
            <img src="/refactura-logo.png" alt="Refactura.ro" className="w-10 h-10 object-contain" />
            <div>
              <div className="text-white font-black text-xl tracking-tight leading-none">Refactura</div>
              <div className="text-blue-400 text-xs font-semibold">.ro</div>
            </div>
          </div>
        </Link>

        <div className="relative z-10">
          <h2 className="text-4xl font-black text-white leading-tight mb-6">
            Automatizează<br />
            <span className="text-blue-400">re-facturarea ta.</span>
          </h2>
          <p className="text-slate-400 text-base leading-relaxed max-w-sm mb-10">
            Import SPV, adaos automat, emitere în Oblio. Gata în 2 minute.
          </p>

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
          <Link href="/">
            <div className="flex items-center gap-3 mb-10 lg:hidden cursor-pointer w-fit">
              <img src="/refactura-logo.png" alt="Refactura.ro" className="w-9 h-9 object-contain" />
              <div>
                <span className="font-black text-xl text-slate-900 tracking-tight leading-none">Refactura</span>
                <span className="text-primary font-black text-xl">.ro</span>
              </div>
            </div>
          </Link>

          <h1 className="text-3xl font-black text-slate-900 mb-6">Creează cont</h1>

          <div className="bg-white p-8 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100">
          {error && (
            <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3 items-start">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4" autoComplete="on">
            <div>
              <label htmlFor="reg-name" className="block text-sm font-semibold text-slate-700 mb-2 pl-2">Nume complet</label>
              <InputGroup className="bg-white !rounded-full overflow-hidden border-slate-200 shadow-sm px-2">
                <InputGroupAddon>
                  <User className="w-4 h-4 text-slate-400" />
                </InputGroupAddon>
                <InputGroupInput
                  id="reg-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ion Popescu"
                  disabled={isLoading}
                  className="py-6"
                />
              </InputGroup>
            </div>

            <div>
              <label htmlFor="reg-email" className="block text-sm font-semibold text-slate-700 mb-2 pl-2">Adresă email</label>
              <InputGroup className="bg-white !rounded-full overflow-hidden border-slate-200 shadow-sm px-2">
                <InputGroupAddon>
                  <Mail className="w-4 h-4 text-slate-400" />
                </InputGroupAddon>
                <InputGroupInput
                  id="reg-email"
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
              <label htmlFor="reg-password" className="block text-sm font-semibold text-slate-700 mb-2 pl-2">Parolă</label>
              <InputGroup className="bg-white pr-2 !rounded-full overflow-hidden border-slate-200 shadow-sm px-2">
                <InputGroupAddon>
                  <Lock className="w-4 h-4 text-slate-400" />
                </InputGroupAddon>
                <InputGroupInput
                  id="reg-password"
                  name="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minim 8 caractere"
                  disabled={isLoading}
                  className="py-6"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1} className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0 focus:outline-none px-2">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </InputGroup>
              {password.length > 0 && (
                <div className="mt-2 flex items-center gap-2 pl-2">
                  <div className="flex gap-1 flex-1">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= passwordStrength ? strengthColor[passwordStrength] : "bg-slate-200"}`} />
                    ))}
                  </div>
                  <span className="text-xs text-slate-500 font-medium">{strengthLabel[passwordStrength]}</span>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="reg-confirm" className="block text-sm font-semibold text-slate-700 mb-2 pl-2">Confirmă parola</label>
              <InputGroup className={`bg-white pr-2 !rounded-full overflow-hidden border-slate-200 shadow-sm px-2 ${confirmPassword.length > 0 && confirmPassword !== password ? "!border-red-300 has-[[data-slot=input-group-control]:focus-visible]:!ring-red-400" : ""}`}>
                <InputGroupAddon>
                  <Lock className="w-4 h-4 text-slate-400" />
                </InputGroupAddon>
                <InputGroupInput
                  id="reg-confirm"
                  name="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repetă parola"
                  disabled={isLoading}
                  className="py-6"
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} tabIndex={-1} className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0 focus:outline-none px-2">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </InputGroup>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full py-6 mt-4 text-base font-bold shadow-lg shadow-primary/20 !rounded-full"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Se creează contul...</>
              ) : (
                <>Creează cont gratuit <ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-slate-500">sau continuă cu</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => toast.info("Implementare în lucru", { description: "Vă rugăm să utilizați adresa de email temporar." })}
                className="flex items-center justify-center gap-2 h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-[0.98]"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Google
              </button>
              <button
                type="button"
                onClick={() => toast.info("Implementare în lucru", { description: "Vă rugăm să utilizați adresa de email temporar." })}
                className="flex items-center justify-center gap-2 h-11 px-4 bg-[#1877F2] text-white rounded-xl text-sm font-semibold hover:bg-[#1865F2] shadow-sm transition-all active:scale-[0.98]"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                Facebook
              </button>
            </div>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500">
            Prin înregistrare, ești de acord cu <a href="#" className="font-semibold text-primary hover:underline">Termenii și condițiile</a>
          </p>
          </div>

          <p className="text-sm text-slate-500 text-center mt-6">
            Ai deja cont?{" "}
            <Link href="/login" className="text-primary font-bold hover:underline">
              Autentifică-te
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
