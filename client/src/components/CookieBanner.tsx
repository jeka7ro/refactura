import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Verificăm dacă utilizatorul a setat deja preferința
    const consent = localStorage.getItem("cookie_consent");
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookie_consent", "accepted");
    setIsVisible(false);
    // Aici ai putea inițializa Google Analytics, Meta Pixel etc.
  };

  const handleReject = () => {
    localStorage.setItem("cookie_consent", "rejected");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] sm:p-6">
      <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex gap-4 items-start">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-full shrink-0">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">
              Confidențialitatea ta este importantă pentru noi
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Folosim cookie-uri pentru a-ți oferi cea mai bună experiență pe site-ul nostru, pentru a analiza traficul și pentru a personaliza conținutul. Apăsând "Acceptă", ești de acord cu utilizarea cookie-urilor conform{" "}
              <a href="/gdpr" className="text-blue-600 hover:underline">
                Politicii noastre de Confidențialitate
              </a>
              .
            </p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto shrink-0">
          <Button variant="outline" className="flex-1 sm:flex-none" onClick={handleReject}>
            Refuză
          </Button>
          <Button className="flex-1 sm:flex-none" onClick={handleAccept}>
            Acceptă Toate
          </Button>
        </div>
      </div>
    </div>
  );
}
