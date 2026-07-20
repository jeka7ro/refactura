import { useState } from "react";
import { useLocation, Link } from "wouter";
import {
  AlertCircle,
  Loader2,
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  User,
  CheckCircle2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { toast } from "sonner";
import { GoogleLogin } from "@react-oauth/google";

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
  const googleLoginMutation = trpc.auth.googleLogin.useMutation();

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
      const result = await registerMutation.mutateAsync({
        email,
        password,
        confirmPassword: password,
      });
      if (result.success) {
        localStorage.setItem("authToken", result.token);
        window.location.href = "/dashboard";
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (!credentialResponse.credential) {
      setError("Înregistrare Google eșuată. Lipsesc date.");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      const result = await googleLoginMutation.mutateAsync({
        credential: credentialResponse.credential,
      });
      if (result.success) {
        localStorage.setItem("authToken", result.token);
        window.location.href = "/dashboard";
      }
    } catch (err) {
      setError((err as Error).message || "Eroare la înregistrarea cu Google");
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength =
    password.length === 0
      ? 0
      : password.length < 8
        ? 1
        : password.length < 12
          ? 2
          : 3;
  const strengthLabel = ["", "Slabă", "Bună", "Excelentă"];
  const strengthColor = ["", "bg-red-500", "bg-yellow-500", "bg-green-500"];

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Left panel - dark branding */}
      <div className="hidden lg:flex lg:flex-1 bg-slate-900 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none" />

        <Link href="/">
          <div className="flex items-center relative z-10 cursor-pointer hover:opacity-90 transition-opacity w-fit">
            <div className="bg-white px-6 py-3 rounded-2xl shadow-lg border border-white/20 flex-shrink-0 flex items-center justify-center">
              <img
                src="/logo_spv2.png"
                alt="Factura SPV"
                className="h-12 w-auto object-contain z-10"
              />
            </div>
          </div>
        </Link>

        <div className="relative z-10">
          <h2 className="text-4xl font-black text-white leading-tight mb-6">
            Automatizează
            <br />
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
            ].map(b => (
              <div key={b} className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
                <span className="text-slate-300 text-sm font-medium">{b}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-slate-600 text-sm relative z-10">
          © {new Date().getFullYear()} Refactura.ro · Toate drepturile rezervate
        </p>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50 overflow-y-auto">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <Link href="/">
            <div className="flex items-center mb-10 lg:hidden cursor-pointer w-fit">
              <div className="bg-white px-5 py-2.5 rounded-2xl shadow-lg border border-slate-200 flex items-center justify-center">
                <img
                  src="/logo_spv2.png"
                  alt="Factura SPV"
                  className="h-10 w-auto object-contain z-10"
                />
              </div>
            </div>
          </Link>

          <h1 className="text-2xl font-black text-slate-900 mb-4">
            Creează cont
          </h1>

          <div className="bg-white px-6 py-5 rounded-lg shadow-xl shadow-slate-200/50 border border-slate-100">
            {error && (
              <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3 items-start">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}

            <form
              onSubmit={handleRegister}
              className="space-y-4"
              autoComplete="on"
            >
              <div>
                <label
                  htmlFor="reg-name"
                  className="block text-sm font-semibold text-slate-700 mb-1 pl-2"
                >
                  Nume complet
                </label>
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
                    onChange={e => setName(e.target.value)}
                    placeholder="Ion Popescu"
                    disabled={isLoading}
                    className="py-3"
                  />
                </InputGroup>
              </div>

              <div>
                <label
                  htmlFor="reg-email"
                  className="block text-sm font-semibold text-slate-700 mb-1 pl-2"
                >
                  Adresă email
                </label>
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
                    onChange={e => setEmail(e.target.value)}
                    placeholder="email@companie.ro"
                    disabled={isLoading}
                    className="py-3"
                  />
                </InputGroup>
              </div>

              <div>
                <label
                  htmlFor="reg-password"
                  className="block text-sm font-semibold text-slate-700 mb-1 pl-2"
                >
                  Parolă
                </label>
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
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Minim 8 caractere"
                    disabled={isLoading}
                    className="py-3"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0 focus:outline-none px-2"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </InputGroup>
                {password.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 pl-2">
                    <div className="flex gap-1 flex-1">
                      {[1, 2, 3].map(i => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-all ${i <= passwordStrength ? strengthColor[passwordStrength] : "bg-slate-200"}`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-slate-500 font-medium">
                      {strengthLabel[passwordStrength]}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="reg-confirm"
                  className="block text-sm font-semibold text-slate-700 mb-1 pl-2"
                >
                  Confirmă parola
                </label>
                <InputGroup
                  className={`bg-white pr-2 !rounded-full overflow-hidden border-slate-200 shadow-sm px-2 ${confirmPassword.length > 0 && confirmPassword !== password ? "!border-red-300 has-[[data-slot=input-group-control]:focus-visible]:!ring-red-400" : ""}`}
                >
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
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repetă parola"
                    disabled={isLoading}
                    className="py-3"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    tabIndex={-1}
                    className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0 focus:outline-none px-2"
                  >
                    {showConfirm ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </InputGroup>
              </div>

              {/* GDPR Checkboxes */}
              <div className="space-y-2 mt-3">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="flex items-center h-4 mt-0.5">
                    <input
                      type="checkbox"
                      required
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </div>
                  <div className="text-[13px] text-slate-600 leading-tight">
                    Am citit și sunt de acord cu{" "}
                    <a href="/termeni" className="text-blue-600 hover:underline" target="_blank">
                      Termenii
                    </a>
                    ,{" "}
                    <a href="/gdpr" className="text-blue-600 hover:underline" target="_blank">
                      Confidențialitate
                    </a>{" "}
                    și{" "}
                    <a href="/dpa" className="text-blue-600 hover:underline" target="_blank">
                      DPA
                    </a>
                    . <span className="text-red-500">*</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="flex items-center h-4 mt-0.5">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </div>
                  <div className="text-[13px] text-slate-600 leading-tight">
                    Sunt de acord să primesc oferte comerciale prin email.
                  </div>
                </label>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 mt-2 text-base font-bold shadow-lg shadow-primary/20 !rounded-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Se creează
                    contul...
                  </>
                ) : (
                  <>
                    Creează cont gratuit <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-slate-500">
                    sau continuă cu
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex justify-center w-full">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => {
                      setError("Eroare la înregistrarea cu Google (Client side)");
                    }}
                    useOneTap
                    shape="rectangular"
                    text="signup_with"
                    theme="outline"
                  />
                </div>
              </div>
            </form>
          </div>

          <p className="text-sm text-slate-500 text-center mt-4">
            Ai deja cont?{" "}
            <Link
              href="/login"
              className="text-primary font-bold hover:underline"
            >
              Autentifică-te
            </Link>
          </p>
          
          <div className="mt-12 flex flex-col items-center justify-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 text-center leading-tight">
              Grup și Echipă de<br/>Producție Aplicație
            </span>
            <img src="/logo_full.png" alt="GettsApp" className="h-5 w-auto filter grayscale hover:grayscale-0 transition-all" />
          </div>
        </div>
      </div>
    </div>
  );
}
