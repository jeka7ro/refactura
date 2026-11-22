import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    const hasSession = Boolean(localStorage.getItem("authToken"));
    setLocation(hasSession ? "/dashboard" : "/");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center apple-canvas bg-gradient-to-br from-slate-50 to-slate-100 dark:from-[#0f0f11] dark:to-[#1c1c1e]">
      <Card className="w-full max-w-lg mx-4 apple-glass rounded-[22px] shadow-lg border border-black/[0.06] dark:border-white/[0.09] bg-white/85 dark:bg-[#1c1c1e]/90 backdrop-blur-xl">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-red-100 dark:bg-red-950/50 rounded-full animate-pulse" />
              <AlertCircle className="relative h-16 w-16 text-red-500" />
            </div>
          </div>

          <h1 className="text-4xl font-bold text-[#1d1d1f] dark:text-white mb-2 tabular-nums">404</h1>

          <h2 className="text-xl font-semibold text-[#3a3a3c] dark:text-[#ebebf5] mb-4">
            Pagina nu a fost găsită
          </h2>

          <p className="text-[#636366] dark:text-[#98989d] mb-8 leading-relaxed text-sm">
            Ne pare rău, pagina pe care o căutați nu există.
            <br />
            Este posibil să fi fost mutată sau ștearsă.
          </p>

          <div
            id="not-found-button-group"
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Button
              onClick={handleGoHome}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-full font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Home className="w-4 h-4 mr-2" />
              Mergi la Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
