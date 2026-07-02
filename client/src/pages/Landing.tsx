import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  FileOutput,
  BarChart3,
  Layers,
  CheckCircle2,
  ArrowRight,
  X,
  Shield,
  Clock,
  TrendingUp,
  FileText,
  Users,
  Building2,
  Menu,
  Settings,
  Store,
  MonitorSmartphone,
  ChefHat,
} from "lucide-react";

const APP_SCREENSHOTS = {
  dashboard: "/manus-storage/app-dashboard_521153d6.png",
  invoices: "/manus-storage/app-invoices_c6b7aa10.png",
  reinvoices: "/manus-storage/app-reinvoices_f148ca9a.png",
  archive: "/manus-storage/app-archive_0136509c.png",
};

const DOMAIN_IMAGES = {
  construction: "/images/industry_construction_1781868258037.png",
  restaurant: "/images/industry_restaurant_1781868269002.png",
  office: "/images/industry_office_1781868278831.png",
};

const LOGO_URL = "/logo.png";

const ICON_MAP: Record<string, any> = {
  FileOutput,
  BarChart3,
  Layers,
  FileText,
  TrendingUp,
  Users,
  Building2,
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  RON: "RON",
  EUR: "€",
  USD: "$",
};

export default function Landing() {
  const [, setLocation] = useLocation();
  const [showModal, setShowModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [activeCurrency, setActiveCurrency] = useState("RON");
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const { data: modulesWithPricing = [] } =
    trpc.public.modulesWithPricing.useQuery();

  const trackVisit = trpc.public.trackVisit.useMutation();
  useEffect(() => {
    trackVisit.mutate({ path: "/", referrer: document.referrer });
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const availableCurrencies = Array.from(
    new Set(
      (modulesWithPricing as any[]).flatMap((m: any) =>
        m.pricing.map((p: any) => p.currency)
      )
    )
  );

  const getPriceForModule = (mod: any, currency: string) => {
    return mod.pricing.find((p: any) => p.currency === currency);
  };

  const openTrial = (mod?: any) => {
    setSelectedPlan(mod || null);
    setShowModal(true);
  };

  const appTabs = [
    {
      label: "Dashboard",
      img: APP_SCREENSHOTS.dashboard,
      desc: "Vizualizare completă: facturi, re-facturi și evoluție.",
    },
    {
      label: "Facturi Primite",
      img: APP_SCREENSHOTS.invoices,
      desc: "Toate facturile furnizorilor centralizate.",
    },
    {
      label: "Re-Facturi",
      img: APP_SCREENSHOTS.reinvoices,
      desc: "Generare re-facturi cu adaos comercial personalizat.",
    },
    {
      label: "Arhivă",
      img: APP_SCREENSHOTS.archive,
      desc: "Arhivă digitală securizată.",
    },
  ];

  const domains = [
    {
      title: "Fast Food & Quick Service",
      img: DOMAIN_IMAGES.restaurant,
      desc: "Preia comenzi rapid cu Smart Kiosk, KDS pentru bucătărie și Meniu QR la masă.",
    },
    {
      title: "Cloud Kitchen & Livrări",
      img: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=1000",
      desc: "Gestionează toate comenzile din Glovo, Tazz și Wolt dintr-un singur ecran unificat.",
    },
    {
      title: "Restaurante A la Carte",
      img: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1000",
      desc: "Evidența stocurilor, preluarea comenzilor cu POS-ul și descărcarea NIR-urilor din e-Factura.",
    },
  ];

  // Parallax setup for Hero
  const { scrollY } = useScroll();
  const yHeroBg = useTransform(scrollY, [0, 1000], [0, 300]);
  const opacityHero = useTransform(scrollY, [0, 500], [1, 0]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-200">
      {/* Navbar (Glassmorphism) */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/80 backdrop-blur-md shadow-sm border-b border-white/20" : "bg-transparent"}`}
      >
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <div className="flex items-center justify-center gap-2">
              <img
                src="/favicon.png"
                alt="Icon"
                className="h-8 w-8 flex-shrink-0"
              />
              <div className="flex flex-col pt-1 w-fit">
                <span
                  className="text-2xl font-black leading-none text-[#1e3a8a] tracking-tight"
                  style={{ fontFamily: "Inter, sans-serif" }}
                >
                  GetApp
                </span>
                <span className="text-[9px] font-black leading-none text-[#ef4444] uppercase mt-0.5 w-full tracking-[0.1em]">
                  SMART HORECA
                </span>
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-10 text-sm font-medium text-slate-600">
            <a
              href="#features"
              className="hover:text-blue-600 transition-colors"
            >
              Funcționalități
            </a>
            <a
              href="#domains"
              className="hover:text-blue-600 transition-colors"
            >
              Domenii
            </a>
            <a
              href="#pricing"
              className="hover:text-blue-600 transition-colors"
            >
              Prețuri
            </a>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => setLocation("/login")}
              className="hidden md:flex font-semibold hover:bg-slate-100/50"
            >
              Autentificare
            </Button>
            <Button
              onClick={() => openTrial()}
              className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-6 shadow-xl shadow-slate-900/20 transition-all active:scale-95"
            >
              Încearcă Gratuit
            </Button>
            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              {mobileMenu ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
        {mobileMenu && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden bg-white/95 backdrop-blur-xl border-b border-slate-100 px-6 py-6 flex flex-col gap-4 shadow-2xl"
          >
            <a
              href="#features"
              onClick={() => setMobileMenu(false)}
              className="text-lg font-medium"
            >
              Funcționalități
            </a>
            <a
              href="#domains"
              onClick={() => setMobileMenu(false)}
              className="text-lg font-medium"
            >
              Domenii
            </a>
            <a
              href="#pricing"
              onClick={() => setMobileMenu(false)}
              className="text-lg font-medium"
            >
              Prețuri
            </a>
            <hr className="border-slate-100 my-2" />
            <button
              onClick={() => setLocation("/login")}
              className="text-lg font-medium text-left"
            >
              Autentificare
            </button>
          </motion.div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-10 lg:pt-28 lg:pb-16 overflow-hidden flex items-center">
        {/* Animated Background Elements */}
        <motion.div
          style={{ y: yHeroBg, opacity: opacityHero }}
          className="absolute inset-0 -z-10 pointer-events-none"
        >
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-400/20 rounded-full blur-[120px] mix-blend-multiply opacity-70 animate-pulse" />
          <div className="absolute bottom-0 left-[-200px] w-[600px] h-[600px] bg-indigo-400/20 rounded-full blur-[100px] mix-blend-multiply opacity-60" />
          <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-cyan-300/20 rounded-full blur-[80px] mix-blend-multiply" />
        </motion.div>

        <div className="max-w-5xl mx-auto px-6 flex flex-col items-center text-center w-full relative z-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-3xl"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm border border-white/50 rounded-full text-sm font-semibold text-blue-700 mb-8 shadow-sm"
            >
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              Ecosistemul complet pentru HoReCa & Retail
            </motion.div>
            <h1 className="text-5xl lg:text-7xl font-extrabold text-slate-900 leading-[1.1] mb-8 tracking-tight">
              Gestionezi și vinzi.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                Mai inteligent.
              </span>
            </h1>
            <p className="text-xl text-slate-600 mb-10 leading-relaxed font-light">
              De la Smart Kiosk și Meniu QR, până la integrarea cu SPV e-Factura, stocuri, KDS și agreatorul de livrări. Ai tot controlul într-o singură aplicație.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button
                onClick={() => openTrial()}
                size="lg"
                className="h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white px-8 text-base font-semibold shadow-xl shadow-blue-600/30 transition-transform hover:scale-105"
              >
                Încearcă gratuit <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
            <div className="mt-8 mb-6 flex items-center justify-center gap-8 text-sm font-medium text-slate-500">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" /> Abonament
                lunar, anulezi oricând
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-500" /> Securitate SSL
              </div>
            </div>
          </motion.div>

          <div className="w-full max-w-7xl mt-4 mb-10 relative z-30 px-4 flex flex-col lg:flex-row gap-6 lg:h-[520px]">
            {/* Mockup - mare pe stanga, aceeasi inaltime */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.3 }}
              className="w-full lg:flex-[3] relative z-20 min-w-0 h-[450px] lg:h-full overflow-hidden rounded-lg"
            >
              <HeroMockup />
            </motion.div>

            {/* 3 carduri stivuite vertical pe dreapta - aceeasi inaltime totala */}
            <div className="w-full lg:flex-[2] flex flex-col gap-6 lg:gap-3 min-w-0 h-auto lg:h-[520px] shrink-0">
              {domains.map((domain, i) => (
                <motion.div
                  key={domain.title}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.15 }}
                  className="group relative rounded-lg overflow-hidden bg-slate-900 shadow-2xl hover:-translate-x-1 transition-transform duration-300 cursor-pointer h-[250px] lg:h-auto lg:flex-1"
                >
                  <div className="absolute inset-0">
                    <img
                      src={domain.img}
                      alt={domain.title}
                      className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700 ease-out"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/65" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <h3 className="text-xl font-black text-white drop-shadow-lg leading-tight">
                      {domain.title}
                    </h3>
                    <p className="text-white/80 text-sm mt-1 leading-snug line-clamp-2 drop-shadow">
                      {domain.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trusted By Section */}
      <section className="py-10 border-b border-slate-100 bg-white flex flex-col items-center">
        <p className="text-sm font-bold text-slate-400 mb-8 uppercase tracking-widest">Branduri de top care folosesc ecosistemul nostru</p>
        <div className="flex items-center justify-center flex-wrap gap-8 md:gap-16 opacity-60 hover:opacity-100 grayscale hover:grayscale-0 transition-all duration-500 max-w-5xl mx-auto px-6">
           <img src="https://placehold.co/200x80/ffffff/000000?text=SmashMe" alt="SmashMe" className="h-10 lg:h-12 object-contain rounded" />
           <img src="https://placehold.co/200x80/ffffff/000000?text=Crunch" alt="Crunch" className="h-8 lg:h-10 object-contain rounded" />
           <img src="https://placehold.co/200x80/ffffff/000000?text=Roll+Master" alt="Roll Master" className="h-10 lg:h-12 object-contain rounded" />
           <img src="https://placehold.co/200x80/ffffff/000000?text=Love+Sushi" alt="Love Sushi" className="h-10 lg:h-12 object-contain rounded" />
           <img src="https://placehold.co/200x80/ffffff/000000?text=Poki-Woki" alt="Poki-Woki" className="h-12 lg:h-14 object-contain rounded" />
        </div>
      </section>

      {/* Features Grid */}
      <section
        id="features"
        className="py-16 md:py-24 bg-slate-50 border-t border-slate-100"
      >
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-8"
          >
            {[
              {
                icon: Store,
                title: "POS & Smart Kiosk",
                desc: "Preluare comenzi la casă, ecrane Kiosk pentru auto-comandă și Meniuri QR digitale pentru o experiență perfectă la masă.",
              },
              {
                icon: MonitorSmartphone,
                title: "Agregator Delivery",
                desc: "Toate comenzile din Glovo, Tazz și Wolt integrate direct în POS-ul tău. Gestionezi meniurile dintr-un singur loc.",
              },
              {
                icon: FileOutput,
                title: "Gestiune & e-Factura",
                desc: "Sincronizare SPV ANAF. Transformă facturile de marfă automat în NIR-uri și actualizează stocurile fără să introduci manual date.",
              },
              {
                icon: BarChart3,
                title: "Rapoarte & AI",
                desc: "Rapoarte de vânzări detaliate, performanța angajaților, alerte de stoc și inteligență artificială pentru predicția vânzărilor.",
              },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-3xl p-10 border border-slate-100 shadow-xl shadow-slate-100/50 hover:-translate-y-2 transition-transform duration-300"
              >
                <div className="w-14 h-14 rounded-lg bg-blue-50 flex items-center justify-center mb-6">
                  <f.icon className="w-7 h-7 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">
                  {f.title}
                </h3>
                <p className="text-slate-600 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        className="py-16 md:py-24 bg-slate-50 border-t border-slate-100"
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 mb-6">
              Alege pachetul potrivit afacerii tale.
            </h2>
            <p className="text-xl text-slate-600 leading-relaxed">
              Planuri flexibile care cresc odată cu tine. Fără surprize ascunse.
            </p>
          </div>

          <div className="flex justify-center mb-12">
            {availableCurrencies.length > 1 && (
              <div className="inline-flex p-1.5 bg-slate-100 rounded-lg">
                {availableCurrencies.map(c => (
                  <button
                    key={c}
                    onClick={() => setActiveCurrency(c)}
                    className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                      activeCurrency === c
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 justify-center pt-8">
            {!modulesWithPricing || modulesWithPricing.length === 0
              ? [
                  {
                    id: 1,
                    name: "Modul 1: Re-facturare",
                    description: "Pentru automatizarea re-facturărilor",
                    icon: FileOutput,
                    pricing: [
                      { monthlyPrice: "49", currency: "EUR", trialDays: 7 },
                    ],
                  },
                  {
                    id: 2,
                    name: "Modul 2: Centre de Cost",
                    description:
                      "Gestionare Centre de Cost / Punct de Lucru / Locație",
                    icon: Building2,
                    pricing: [
                      { monthlyPrice: "79", currency: "EUR", trialDays: 7 },
                    ],
                  },
                  {
                    id: 3,
                    name: "Combo (Recomandat)",
                    description: "Acces complet la toate funcțiile",
                    icon: Layers,
                    isCombo: 1,
                    pricing: [
                      { monthlyPrice: "99", currency: "EUR", trialDays: 7 },
                    ],
                  },
                ].map((mod, i) => {
                  const priceObj = mod.pricing[0];
                  return (
                    <PricingCard
                      key={mod.id}
                      mod={{ ...mod, icon: mod.icon }}
                      price={Number(priceObj.monthlyPrice).toLocaleString(
                        "ro-RO"
                      )}
                      currency={priceObj.currency}
                      symbol={
                        CURRENCY_SYMBOLS[priceObj.currency] || priceObj.currency
                      }
                      trialDays={priceObj.trialDays}
                      onTrial={() => openTrial(mod)}
                      highlighted={!!mod.isCombo}
                    />
                  );
                })
              : (modulesWithPricing as any[]).map((mod, i) => {
                  const priceObj =
                    getPriceForModule(mod, activeCurrency) || mod.pricing[0];
                  if (!priceObj) return null;
                  return (
                    <PricingCard
                      key={mod.id}
                      mod={{ ...mod, icon: ICON_MAP[mod.icon] || Layers }}
                      price={Number(priceObj.monthlyPrice).toLocaleString(
                        "ro-RO"
                      )}
                      currency={priceObj.currency}
                      symbol={
                        CURRENCY_SYMBOLS[priceObj.currency] || priceObj.currency
                      }
                      trialDays={priceObj.trialDays || 7}
                      onTrial={() => openTrial(mod)}
                      highlighted={!!mod.isCombo}
                    />
                  );
                })}
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section className="py-32 bg-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-4xl lg:text-6xl font-bold text-white mb-8 tracking-tight">
            Pregătit să facturezi corect?
          </h2>
          <p className="text-xl text-slate-300 mb-12 font-light">
            Transformă haosul facturilor într-un proces curat, automat și
            precis. Primele 7 zile sunt din partea noastră.
          </p>
          <Button
            onClick={() => openTrial()}
            size="lg"
            className="h-16 rounded-full bg-blue-600 hover:bg-blue-500 text-white px-10 text-lg font-bold shadow-2xl shadow-blue-500/50"
          >
            Începe Trial-ul Acum <ArrowRight className="w-6 h-6 ml-3" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center gap-2">
              <img
                src="/favicon.png"
                alt="Icon"
                className="h-7 w-7 flex-shrink-0"
              />
              <div className="flex flex-col pt-1 w-fit">
                <span
                  className="text-xl font-black leading-none text-[#1e3a8a] tracking-tight"
                  style={{ fontFamily: "Inter, sans-serif" }}
                >
                  GetApp
                </span>
                <span className="text-[8px] font-black leading-none text-[#ef4444] uppercase mt-0.5 w-full tracking-[0.1em]">
                  SMART HORECA
                </span>
              </div>
            </div>
          </div>
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} Refactura.ro — Construit cu pasiune
            pentru antreprenori.
          </p>
          <div className="flex gap-8 text-sm font-medium text-slate-500">
            <a href="#" className="hover:text-blue-600">
              Termeni & Condiții
            </a>
            <a href="#" className="hover:text-blue-600">
              Privacy Policy
            </a>
          </div>
        </div>
      </footer>

      {/* Trial Modal */}
      {showModal && (
        <TrialModal
          selectedPlan={selectedPlan}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            setLocation("/register");
          }}
        />
      )}
    </div>
  );
}

// ─── Pricing Card ─────────────────────────────────────────────────────────────
function PricingCard({
  mod,
  price,
  currency,
  symbol,
  trialDays,
  onTrial,
  highlighted,
}: any) {
  const IconComp = mod.icon;
  const features = (() => {
    try {
      return JSON.parse(mod.features || "[]");
    } catch {
      return [];
    }
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`relative rounded-[2.5rem] p-10 flex flex-col transition-all duration-300 ${highlighted ? "bg-slate-900 text-white shadow-2xl shadow-blue-900/40 -translate-y-4 border border-slate-800" : "bg-white border border-slate-100 shadow-xl shadow-slate-100/60 hover:-translate-y-2"}`}
    >
      {highlighted && (
        <>
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 blur-[80px] rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-600/20 blur-[80px] rounded-full pointer-events-none" />
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider shadow-lg shadow-blue-500/30">
              Alegerea Premium
            </span>
          </div>
        </>
      )}
      <div className="mb-8 relative z-10">
        <div
          className={`w-16 h-16 rounded-lg flex items-center justify-center mb-6 ${highlighted ? "bg-white/10" : "bg-blue-50"}`}
        >
          <IconComp
            className={`w-8 h-8 ${highlighted ? "text-blue-400" : "text-blue-600"}`}
          />
        </div>
        <h3 className="font-extrabold text-2xl mb-3">{mod.name}</h3>
        <p
          className={`text-sm leading-relaxed ${highlighted ? "text-slate-400" : "text-slate-500"}`}
        >
          {mod.description}
        </p>
      </div>

      <div className="mb-10">
        <div className="flex items-start gap-1">
          <span className="text-6xl font-black tracking-tight">{price}</span>
          <span className="text-xl font-bold mt-2">{symbol}</span>
        </div>
        <p
          className={`text-sm mt-3 ${highlighted ? "text-slate-400" : "text-slate-500"}`}
        >
          /lună + TVA · {trialDays} zile gratis
        </p>
      </div>

      <ul className="space-y-4 mb-10 flex-1">
        {features.map((f: string) => (
          <li
            key={f}
            className={`flex items-start gap-3 text-sm font-medium ${highlighted ? "text-slate-300" : "text-slate-600"}`}
          >
            <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" /> {f}
          </li>
        ))}
      </ul>

      <Button
        onClick={onTrial}
        className={`w-full h-14 rounded-lg text-base font-bold ${highlighted ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-900"}`}
      >
        Începe {trialDays} zile gratuit
      </Button>
    </motion.div>
  );
}

// ─── Trial Modal ──────────────────────────────────────────────────────────────
function TrialModal({ selectedPlan, onClose, onSuccess }: any) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const submitLead = trpc.public.submitLead.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: e => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    submitLead.mutate({
      ...form,
      planId: selectedPlan?.id,
      source: "landing-trial",
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-10 z-10"
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5 text-slate-500" />
        </button>

        {submitted ? (
          <div className="text-center py-8">
            <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <h3 className="text-3xl font-extrabold text-slate-900 mb-4">
              Felicitări!
            </h3>
            <p className="text-slate-500 mb-8 leading-relaxed">
              Cererea ta a fost înregistrată. Un membru al echipei te va
              contacta în curând pentru activarea contului.
            </p>
            <Button
              onClick={onClose}
              className="w-full h-14 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-base font-bold"
            >
              Închide
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h3 className="text-3xl font-extrabold text-slate-900 mb-3">
                {selectedPlan ? selectedPlan.name : "Trial Gratuit"}
              </h3>
              <p className="text-slate-500">
                Introdu datele pentru a începe testarea.
              </p>
            </div>
            <form
              onSubmit={handleSubmit}
              className="space-y-5"
              autoComplete="on"
            >
              <div>
                <input
                  id="trial-name"
                  name="name"
                  autoComplete="name"
                  required
                  type="text"
                  placeholder="Nume complet"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-5 py-4 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                />
              </div>
              <div>
                <input
                  id="trial-email"
                  name="email"
                  autoComplete="email"
                  required
                  type="email"
                  placeholder="Email de companie"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full px-5 py-4 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                />
              </div>
              <div>
                <input
                  id="trial-phone"
                  name="phone"
                  autoComplete="tel"
                  type="tel"
                  placeholder="Telefon"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-5 py-4 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                />
              </div>
              <div>
                <input
                  id="trial-company"
                  name="company"
                  autoComplete="organization"
                  type="text"
                  placeholder="Companie"
                  value={form.company}
                  onChange={e => setForm({ ...form, company: e.target.value })}
                  className="w-full px-5 py-4 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                />
              </div>
              {error && (
                <p className="text-red-500 text-sm font-medium">{error}</p>
              )}
              <Button
                type="submit"
                disabled={submitLead.isPending}
                className="w-full h-14 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-base font-bold shadow-lg shadow-blue-500/30 mt-4"
              >
                {submitLead.isPending ? "Se procesează..." : "Solicită Trial"}
              </Button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}

// ─── Highly Detailed Code-Based App Mockup ───────────────────────────────────────
function HeroMockup() {
  const [activeTab, setActiveTab] = useState(1);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTab(prev => (prev + 1) % 3);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full h-full rounded-lg overflow-hidden shadow-2xl border border-slate-800 bg-slate-50 flex flex-col">
      {/* macOS Style Window Controls */}
      <div className="h-9 bg-slate-900 flex items-center px-4 gap-2 flex-shrink-0">
        <div className="w-3 h-3 rounded-full bg-red-500" />
        <div className="w-3 h-3 rounded-full bg-yellow-500" />
        <div className="w-3 h-3 rounded-full bg-green-500" />
        <div className="ml-4 text-xs font-medium text-slate-400">
          app.smartinvoice.ro
        </div>
      </div>

      {/* App Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="hidden sm:flex w-44 bg-slate-900 border-r border-slate-800 p-3 flex-col gap-1 flex-shrink-0">
          <div className="flex items-center mb-4 cursor-pointer">
            <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-white/10 flex items-center justify-center gap-1.5">
              <img
                src="/favicon.png"
                alt="Icon"
                className="h-5 w-5 flex-shrink-0"
              />
              <div className="flex flex-col pt-0.5 w-fit">
                <span
                  className="text-[14px] font-black leading-none text-[#1e3a8a] tracking-tight"
                  style={{ fontFamily: "Inter, sans-serif" }}
                >
                  GetApp
                </span>
                <span className="text-[6px] font-black leading-none text-[#ef4444] uppercase mt-0.5 w-full flex justify-between">
                  <span>R</span>
                  <span>E</span>
                  <span>F</span>
                  <span>A</span>
                  <span>C</span>
                  <span>T</span>
                  <span>U</span>
                  <span>R</span>
                  <span>A</span>
                </span>
              </div>
            </div>
          </div>
          <div
            className={`flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${activeTab === 0 ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
          >
            <BarChart3 className="w-3.5 h-3.5" /> Dashboard
          </div>
          <div
            className={`flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${activeTab === 1 ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
          >
            <FileText className="w-3.5 h-3.5" /> Re-Facturare
          </div>
          <div
            className={`flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${activeTab === 2 ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
          >
            <Building2 className="w-3.5 h-3.5" /> Centre de Cost
          </div>
          <div className="mt-auto flex items-center gap-2 px-2 py-2 rounded-lg text-slate-400 text-xs font-medium">
            <Settings className="w-3.5 h-3.5" /> Setări
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 bg-slate-50 relative overflow-hidden">
          {/* TAB 1: Dashboard */}
          <motion.div
            initial={false}
            animate={{
              opacity: activeTab === 0 ? 1 : 0,
              x: activeTab === 0 ? 0 : 30,
            }}
            className="absolute inset-0 p-4 flex flex-col gap-3 overflow-y-auto"
            style={{ zIndex: activeTab === 0 ? 10 : 0 }}
          >
            <h3 className="text-base font-bold text-slate-900">
              Dashboard Financiar
            </h3>
            <div className="flex flex-col sm:grid sm:grid-cols-3 gap-3">
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col">
                <div className="text-[10px] text-slate-500 mb-1">
                  Încasări luna curentă
                </div>
                <div className="text-base font-black text-slate-900">
                  124.500 RON
                </div>
                <div className="text-[10px] text-green-500 mt-1 font-medium flex items-center gap-1">
                  <TrendingUp className="w-2.5 h-2.5" /> +12%
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col">
                <div className="text-[10px] text-slate-500 mb-1">
                  Facturi neîncasate
                </div>
                <div className="text-base font-black text-orange-500">
                  32.100 RON
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-medium">
                  14 facturi active
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col">
                <div className="text-[10px] text-slate-500 mb-1">
                  Profit Net (Adaos)
                </div>
                <div className="text-base font-black text-blue-600">
                  45.200 RON
                </div>
                <div className="text-[10px] text-green-500 mt-1 font-medium flex items-center gap-1">
                  <TrendingUp className="w-2.5 h-2.5" /> +8%
                </div>
              </div>
            </div>
            <div className="min-h-[150px] flex-1 bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col">
              <div className="text-xs font-bold text-slate-800 mb-3">
                Evoluție Venituri vs. Cheltuieli
              </div>
              <div className="flex-1 flex items-end justify-between gap-1 px-1">
                {[40, 60, 45, 80, 65, 90, 100].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 flex flex-col justify-end items-center gap-1 h-full"
                  >
                    <div className="w-full flex gap-0.5 items-end justify-center h-full">
                      <div
                        className="flex-1 bg-blue-500 rounded-t-sm"
                        style={{ height: `${h}%` }}
                      />
                      <div
                        className="flex-1 bg-slate-200 rounded-t-sm"
                        style={{ height: `${h * 0.6}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-slate-400">L{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* TAB 2: Re-Facturare */}
          <motion.div
            initial={false}
            animate={{
              opacity: activeTab === 1 ? 1 : 0,
              x: activeTab === 1 ? 0 : 30,
            }}
            className="absolute inset-0 p-4 flex flex-col overflow-y-auto"
            style={{ zIndex: activeTab === 1 ? 10 : 0 }}
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                Automatizare Re-facturare
              </h3>
              <div className="bg-blue-600 text-white text-[10px] px-3 py-1.5 rounded-lg font-bold flex items-center gap-1">
                Sincronizare SPV <ArrowRight className="w-3 h-3" />
              </div>
            </div>
            <div className="flex flex-col gap-4 flex-1 pb-4">
              {[
                {
                  f: "Dedeman SRL",
                  item: "Materiale construcții SPV",
                  vIn: 4500,
                  margin: 15,
                  c: "Proiect Rezidențial",
                },
                {
                  f: "Arabesque",
                  item: "Ciment și oțel fasonat",
                  vIn: 12200,
                  margin: 20,
                  c: "Șantier Nord",
                },
              ].map((row, i) => (
                <div
                  key={i}
                  className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between relative overflow-hidden gap-3"
                >
                  <div className="flex flex-col gap-0.5 w-full sm:w-1/3">
                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block"></span>
                      Furnizor (SPV)
                    </div>
                    <div className="font-bold text-slate-900 text-sm">
                      {row.f}
                    </div>
                    <div className="text-xs text-slate-500">{row.item}</div>
                    <div className="text-sm font-black text-slate-700 mt-1">
                      {row.vIn.toLocaleString("ro-RO")} RON
                    </div>
                  </div>
                  <div className="flex flex-row sm:flex-col items-center gap-2 w-full sm:w-auto bg-slate-50 sm:bg-transparent p-2 sm:p-0 rounded-lg">
                    <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-black">
                      +{row.margin}% Adaos
                    </div>
                    <div className="hidden sm:block w-16 h-0.5 bg-slate-200 relative rounded-full">
                      <motion.div
                        initial={{ left: 0, opacity: 0 }}
                        animate={{ left: "100%", opacity: [0, 1, 0] }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                        className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-blue-500 rounded-full"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5 w-full sm:w-1/3 text-left sm:text-right border-t sm:border-t-0 border-slate-100 pt-2 sm:pt-0">
                    <div className="text-[9px] text-green-500 font-bold uppercase tracking-wider flex items-center sm:justify-end gap-1">
                      Client Final{" "}
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
                    </div>
                    <div className="font-bold text-slate-900 text-sm">
                      {row.c}
                    </div>
                    <div className="text-xs text-slate-500">
                      Generare automată
                    </div>
                    <div className="text-sm font-black text-green-600 mt-1">
                      {(row.vIn * (1 + row.margin / 100)).toLocaleString(
                        "ro-RO"
                      )}{" "}
                      RON
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* TAB 3: Centre de Cost */}
          <motion.div
            initial={false}
            animate={{
              opacity: activeTab === 2 ? 1 : 0,
              x: activeTab === 2 ? 0 : 30,
            }}
            className="absolute inset-0 p-4 flex flex-col bg-slate-50 overflow-y-auto"
            style={{ zIndex: activeTab === 2 ? 10 : 0 }}
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                Performanță Centre de Cost
              </h3>
              <div className="bg-slate-900 text-white text-[10px] px-3 py-1.5 rounded-lg font-bold flex items-center gap-1">
                <BarChart3 className="w-3 h-3 text-blue-400" /> Raport Global
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 flex-1 pb-4">
              <div className="flex-1 bg-white rounded-lg border border-slate-200 shadow-sm p-4 flex flex-col min-h-[200px]">
                <div className="text-[9px] font-black text-blue-600 uppercase tracking-wider mb-0.5">
                  PROIECT ACTIV
                </div>
                <div className="text-sm font-black text-slate-900 mb-3">
                  Șantier Nord
                </div>
                <div className="mb-3">
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-slate-500">Buget Consumat</span>
                    <span className="font-bold">345k / 450k RON</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full w-[76%]"></div>
                  </div>
                </div>
                <div className="flex-1 flex flex-col gap-2 mt-2">
                  {[
                    { c: "Materiale", v: "185.000", color: "bg-blue-500" },
                    { c: "Echipamente", v: "95.000", color: "bg-indigo-400" },
                    { c: "Utilități", v: "65.000", color: "bg-slate-300" },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`w-2 h-2 rounded-full ${item.color}`}
                        ></div>
                        <span className="text-slate-600">{item.c}</span>
                      </div>
                      <span className="font-bold text-slate-800">{item.v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-1 bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg border border-slate-700 shadow-sm p-4 flex flex-col text-white min-h-[220px]">
                <div className="text-[9px] font-black text-purple-400 uppercase tracking-wider mb-0.5">
                  PROIECT ÎN DERULARE
                </div>
                <div className="text-sm font-black mb-3">Rezidențial Sud</div>
                <div className="flex-1 flex items-center justify-center py-4">
                  <div className="relative flex items-center justify-center">
                    <svg className="w-20 h-20 -rotate-90">
                      <circle
                        cx="40"
                        cy="40"
                        r="34"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        className="text-slate-700"
                      />
                      <circle
                        cx="40"
                        cy="40"
                        r="34"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray="213"
                        strokeDashoffset="89"
                        className="text-purple-500"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-xl font-black">58%</span>
                      <span className="text-[8px] text-slate-400 uppercase tracking-widest">
                        Marjă
                      </span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-3 mt-auto">
                  <div>
                    <div className="text-[9px] text-slate-400 uppercase mb-0.5">
                      Venituri
                    </div>
                    <div className="text-xs font-bold text-green-400">
                      890.000 RON
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-400 uppercase mb-0.5">
                      Costuri
                    </div>
                    <div className="text-xs font-bold text-red-400">
                      375.000 RON
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
