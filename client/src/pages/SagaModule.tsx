import { useState, useMemo, useRef, useEffect, Fragment } from "react";
import { usePersistentRowsPerPage } from "@/hooks/usePersistentRowsPerPage";
import { Link } from "wouter";
import {
  Database,
  Plus,
  Upload,
  Download,
  Search,
  Trash2,
  Edit2,
  Check,
  X,
  Link2,
  History,
  Settings,
  Package,
  ArrowRight,
  FileText,
  Loader2,
  AlertCircle,
  ChevronDown,
  Warehouse,
  Users,
  ClipboardList,
  BarChart3,
  BookOpen,
  RefreshCw,
  Factory,
  ShoppingCart,
  Layers,
  FileSpreadsheet,
  Eye,
  FileCode,
  Hash,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ConfirmDeleteWrapper } from "@/components/ui/ConfirmModal";
import { encodeWindows1250Blob } from "@/lib/fileSave";

// ── Types ─────────────────────────────────────────────────────────────────────
type SagaPage =
  | "articole" | "gestiuni" | "furnizori" | "clienti" | "planConturi"
  | "intrari" | "intrariValuta" | "comenzi" | "retete"
  | "situatieStocuri" | "fiseArticole" | "registruInventar"
  | "articoleContabile"
  | "nomenclator" | "mapare" | "export" | "setari";

const SAGA_MENU = [
  {
    label: "Fișiere", items: [
      { id: "furnizori" as SagaPage, label: "Furnizori", icon: Users, shortcut: "ALT+1" },
      { id: "clienti" as SagaPage, label: "Clienți", icon: Users, shortcut: "ALT+2" },
      { id: "articole" as SagaPage, label: "Articole", icon: Package },
      { id: "gestiuni" as SagaPage, label: "Gestiuni", icon: Warehouse },
      { id: "planConturi" as SagaPage, label: "Plan conturi", icon: BookOpen },
      { id: "retete" as SagaPage, label: "Rețete (BOM)", icon: Layers },
    ],
  },
  {
    label: "Operații", items: [
      { id: "articoleContabile" as SagaPage, label: "Articole contabile", icon: FileText },
      { id: "intrari" as SagaPage, label: "Intrări", icon: Download, shortcut: "ALT+3" },
      { id: "intrariValuta" as SagaPage, label: "Intrări valută", icon: Download },
      { id: "comenzi" as SagaPage, label: "Comenzi / Producție", icon: Factory },
    ],
  },
  {
    label: "Situații", items: [
      { id: "situatieStocuri" as SagaPage, label: "Situație stocuri", icon: BarChart3 },
      { id: "fiseArticole" as SagaPage, label: "Fișe articole", icon: FileSpreadsheet },
      { id: "registruInventar" as SagaPage, label: "Registru inventar", icon: ClipboardList },
    ],
  },
  {
    label: "Diverse", items: [
      { id: "export" as SagaPage, label: "Export SAGA XML", icon: Download },
      { id: "mapare" as SagaPage, label: "Mapare articole", icon: Link2 },
    ],
  },
  {
    label: "Administrare", items: [
      { id: "setari" as SagaPage, label: "Setări modul", icon: Settings },
    ],
  },
];

const PAGE_TITLES: Record<SagaPage, string> = {
  articole: "ARTICOLE",
  gestiuni: "GESTIUNI",
  furnizori: "FURNIZORI",
  clienti: "CLIENȚI",
  planConturi: "PLAN CONTURI",
  intrari: "INTRĂRI",
  intrariValuta: "INTRĂRI VALUTĂ",
  comenzi: "COMENZI",
  retete: "REȚETE",
  situatieStocuri: "SITUAȚIE STOCURI",
  fiseArticole: "FIȘE ARTICOLE",
  registruInventar: "REGISTRU INVENTAR",
  articoleContabile: "ARTICOLE CONTABILE",
  nomenclator: "ARTICOLE",
  mapare: "MAPARE",
  export: "EXPORT SAGA",
  setari: "SETĂRI",
};

const CATEGORIES = [
  "Marfuri",
  "Materii prime",
  "Consumabile",
  "Materiale auxiliare",
  "Alte mat. consumabile",
  "Obiecte de inventar",
  "Ambalaje",
  "Semifabricate",
  "Produse finite",
  "Piese de schimb",
  "Combustibili",
  "Amenajari provizorii",
];

const MONTHS = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];

// ── Dropdown Menu Component ───────────────────────────────────────────────────
function MenuDropdown({ label, items, onSelect, activePage }: {
  label: string;
  items: { id: SagaPage; label: string; icon: any; shortcut?: string }[];
  onSelect: (id: SagaPage) => void;
  activePage: SagaPage;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={
          open
            ? { backgroundColor: "var(--tenant-theme-color, #0071e3)" }
            : undefined
        }
        className={`px-3 py-1.5 text-[13px] font-medium rounded-full transition-colors flex items-center gap-1 cursor-pointer ${
          open
            ? "text-white shadow-xs"
            : "text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
        }`}
      >
        {label}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] rounded-2xl shadow-xl z-50 min-w-[225px] py-1.5">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => { onSelect(item.id); setOpen(false); }}
              className={`apple-card-btn w-full flex items-center gap-3 px-4 py-2 text-[13px] transition-colors cursor-pointer ${
                activePage === item.id
                  ? "bg-[#0071e3]/10 dark:bg-[#0a84ff]/18 text-[#0071e3] dark:text-[#64d2ff] font-semibold"
                  : "text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-[#f2f2f7] dark:hover:bg-[#2c2c2e]"
              }`}
            >
              <item.icon className="w-4 h-4 text-[#0071e3] dark:text-[#0a84ff] shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.shortcut && (
                <span className="text-[11px] text-[#8e8e93] tabular-nums">{item.shortcut}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const PAGE_DISPLAY_TITLES: Record<SagaPage, string> = {
  articole: "Articole & Nomenclator",
  gestiuni: "Gestiuni",
  furnizori: "Furnizori SAGA",
  clienti: "Clienți SAGA",
  planConturi: "Plan de conturi",
  intrari: "Intrări (RON)",
  intrariValuta: "Intrări valută",
  comenzi: "Comenzi / Producție",
  retete: "Rețete (BOM)",
  situatieStocuri: "Situație stocuri",
  fiseArticole: "Fișe articole",
  registruInventar: "Registru inventar",
  articoleContabile: "Articole contabile",
  nomenclator: "Articole & Nomenclator",
  mapare: "Mapare articole",
  export: "Export SAGA (XML / ZIP)",
  setari: "Setări modul SAGA",
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function SagaModule() {
  const [activePage, setActivePage] = useState<SagaPage>("articole");

  return (
    <div className="flex-1 w-full flex flex-col h-full overflow-x-hidden">
      {/* SAGA Top Bar */}
      <div className="bg-white dark:bg-[#1c1c1e] border-b border-black/[0.06] dark:border-white/[0.08] px-3 sm:px-4 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 min-w-max py-1.5">
          {/* SAGA Logo */}
          <div className="flex items-center gap-2 pr-3 sm:pr-4 border-r border-black/[0.08] dark:border-white/[0.10] mr-1 sm:mr-2 shrink-0">
            <div className="w-7 h-7 shrink-0 bg-primary rounded-[8px] flex items-center justify-center">
              <span className="text-white font-bold text-xs">S</span>
            </div>
            <span className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] hidden sm:block">
              SAGA
            </span>
          </div>
          {/* Menu Items */}
          {SAGA_MENU.map((menu) => (
            <MenuDropdown
              key={menu.label}
              label={menu.label}
              items={menu.items}
              onSelect={setActivePage}
              activePage={activePage}
            />
          ))}

          {/* Quick Direct Sync Button */}
          <Link
            href="/saga-sync"
            className="apple-btn-glass ml-auto shrink-0 whitespace-nowrap h-8 px-3.5 text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5 shrink-0" />
            <span>Sincronizare nomenclator</span>
          </Link>

          {/* Quick Direct Export Button */}
          <button
            type="button"
            onClick={() => setActivePage("export")}
            className="apple-btn-prominent shrink-0 whitespace-nowrap h-8 px-3.5 text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Export SAGA (XML / ZIP)</span>
          </button>
        </div>
      </div>

      {/* Content Area with Vertical Label */}
      <div className="flex flex-1 overflow-hidden">
        {/* Vertical Page Label — SAGA style (neutral Apple obsidian/surface) */}
        <div className="bg-white dark:bg-[#1c1c1e] border-r border-black/[0.06] dark:border-white/[0.08] w-7 sm:w-8 flex items-center justify-center shrink-0">
          <span
            className="text-[#6e6e73] dark:text-[#98989d] text-[10.5px] font-semibold tracking-widest whitespace-nowrap"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            {PAGE_TITLES[activePage]}
          </span>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-3 sm:p-5 min-w-0">
          <div className="w-full space-y-4">
            <div className="min-w-0">
              <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
                {PAGE_DISPLAY_TITLES[activePage]}
              </h1>
            </div>
            {activePage === "articole" && <NomenclatorTab />}
            {activePage === "nomenclator" && <NomenclatorTab />}
            {activePage === "gestiuni" && <GestiuniTab />}
            {activePage === "furnizori" && <FurnizoriTab />}
            {activePage === "clienti" && <ClientiTab />}
            {activePage === "planConturi" && <PlanConturiTab />}
            {activePage === "retete" && <ReteteTab />}
            {activePage === "intrari" && <IntrariTab mode="ron" />}
            {activePage === "intrariValuta" && <IntrariTab mode="valuta" />}
            {activePage === "comenzi" && <ComenziTab />}
            {activePage === "articoleContabile" && <ArticoleContabileTab />}
            {activePage === "situatieStocuri" && <SituatieStocuriTab />}
            {activePage === "fiseArticole" && <FiseArticoleTab />}
            {activePage === "registruInventar" && <RegistruInventarTab />}
            {activePage === "mapare" && <MapareTab />}
            {activePage === "export" && <ExportTab />}
            {activePage === "setari" && <SetariTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab 1: Nomenclator ────────────────────────────────────────────────────────
function NomenclatorTab() {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentRowsPerPage("saga_nomenclator", 50);

  const { data: me } = trpc.auth.me.useQuery();
  const { data: articles = [], refetch, isLoading } = trpc.saga.articles.list.useQuery();
  const { data: nextCode } = trpc.saga.articles.nextCode.useQuery();
  const { data: planConturi = [] } = trpc.saga.planConturi.useQuery({ stockOnly: true });
  const createMut = trpc.saga.articles.create.useMutation({
    onSuccess: () => { refetch(); setShowAdd(false); toast.success("Articol adăugat!"); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.saga.articles.update.useMutation({
    onSuccess: () => { refetch(); setEditId(null); toast.success("Articol actualizat!"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.saga.articles.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Articol șters!"); },
    onError: (e) => toast.error(e.message),
  });
  const importMut = trpc.saga.articles.importFromFile.useMutation({
    onSuccess: (res) => {
      refetch();
      setShowImport(false);
      toast.success(`Import finalizat: ${res.imported} noi, ${res.updated} actualizate`);
    },
    onError: (e) => toast.error(e.message),
  });

  // Form state for new article
  const [form, setForm] = useState({
    code: "", name: "", unit: "buc", vatRate: 21,
    category: "Marfuri", accountingAccount: "371", sagaCode: "", barcode: "",
  });

  const filtered = useMemo(() => {
    if (!search) return articles;
    const s = search.toLowerCase();
    return articles.filter(
      (a: any) =>
        a.name.toLowerCase().includes(s) ||
        a.code.toLowerCase().includes(s) ||
        a.category?.toLowerCase().includes(s)
    );
  }, [articles, search]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedArticles = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  // Reset page to 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [search]);

  const [isImporting, setIsImporting] = useState(false);
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const toastId = toast.loading("Se importă articolele din SAGA...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tenantId", String(me?.tenantId || 1));

      const res = await fetch("/api/saga/import-articles", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Eroare la import");
      }

      const data = await res.json();
      toast.success(
        `Import finalizat: ${data.imported} articole noi, ${data.skipped} omise/existente (din total ${data.total}).`,
        { id: toastId }
      );
      refetch();
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setIsImporting(false);
      if (e.target) e.target.value = "";
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="apple-surface px-3 py-2.5 flex flex-wrap items-center gap-2">
        <div className="apple-pill-control relative flex items-center flex-1 min-w-[220px] px-3">
          <Search className="w-3.5 h-3.5 text-[#8e8e93] shrink-0 mr-2" />
          <input
            type="text"
            placeholder="Caută după cod, denumire sau categorie..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-0 bg-transparent text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => { setForm({ ...form, code: nextCode || "ART-0001" }); setShowAdd(true); }}
          className="apple-btn-prominent inline-flex items-center gap-1.5 h-8 px-4 text-[12.5px] font-semibold cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Adaugă articol
        </button>
        <Link
          href="/saga-sync"
          className="apple-btn-glass inline-flex items-center gap-1.5 h-8 px-3.5 text-[12.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Sincronizare asistată (Ghid 1-2-3)
        </Link>
        <label className="apple-btn-glass inline-flex items-center gap-1.5 h-8 px-3.5 text-[12.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer">
          <Upload className="w-3.5 h-3.5" />
          Import rapid
          <input type="file" accept=".xml,.csv,.txt,.dbf,.xlsx,.xls" className="hidden" onChange={handleFileImport} />
        </label>
      </div>

      {/* Add Dialog */}
      {showAdd && (
        <div className="apple-surface p-5 space-y-4">
          <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">Articol nou</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div>
              <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">Cod *</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none tabular-nums" />
            </div>
            <div className="col-span-2">
              <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">Denumire *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">U/M</label>
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">TVA %</label>
              <select value={form.vatRate} onChange={(e) => setForm({ ...form, vatRate: Number(e.target.value) })}
                className="w-full px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none cursor-pointer">
                <option value={21}>21%</option>
                <option value={11}>11%</option>
                <option value={19}>19%</option>
                <option value={9}>9%</option>
                <option value={5}>5%</option>
                <option value={0}>0%</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">Categorie</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none cursor-pointer">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">Cont contabil</label>
              <select value={form.accountingAccount} onChange={(e) => setForm({ ...form, accountingAccount: e.target.value })}
                className="w-full px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none cursor-pointer">
                {planConturi.map((c: any) => <option key={c.cod} value={c.cod}>{c.cod} — {c.denumire}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => createMut.mutate(form)}
              disabled={!form.code || !form.name || createMut.isPending}
              className="apple-btn-prominent px-4 h-9 disabled:opacity-50 text-[13px] font-semibold cursor-pointer"
            >
              {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvează"}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="apple-btn-glass px-4 h-9 text-[#1d1d1f] dark:text-[#f5f5f7] text-[13px] font-medium cursor-pointer"
            >
              Anulează
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="apple-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap table-auto">
            <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07] text-[#6e6e73] dark:text-[#98989d] text-[12px] font-medium">
              <tr>
                <th className="px-3 py-3 font-medium">Nr.</th>
                <th className="px-3 py-3 font-medium">Cod</th>
                <th className="px-3 py-3 font-medium">Denumire</th>
                <th className="px-3 py-3 text-center font-medium">U/M</th>
                <th className="px-3 py-3 text-center font-medium">TVA</th>
                <th className="px-3 py-3 font-medium">Categorie</th>
                <th className="px-3 py-3 font-medium">Cont</th>
                <th className="px-3 py-3 text-center font-medium">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06] text-[13px]">
              {isLoading ? (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-[#6e6e73] dark:text-[#98989d]">Se încarcă...</td></tr>
              ) : paginatedArticles.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-[#6e6e73] dark:text-[#98989d]">
                  {search ? "Niciun rezultat" : "Niciun articol în nomenclator. Adaugă manual sau importă din SAGA."}
                </td></tr>
              ) : (
                paginatedArticles.map((art: any, i: number) => (
                  <tr key={art.id} className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors">
                    <td className="px-3 py-3 text-[#8e8e93] text-[12px] font-medium tabular-nums">{(page - 1) * pageSize + i + 1}</td>
                    <td className="px-3 py-3 tabular-nums text-[12.5px] text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">{art.code}</td>
                    <td className="px-3 py-3 text-[#1d1d1f] dark:text-[#f5f5f7] font-medium max-w-[300px] truncate" title={art.name}>{art.name}</td>
                    <td className="px-3 py-3 text-center text-[#6e6e73] dark:text-[#98989d]">{art.unit}</td>
                    <td className="px-3 py-3 text-center text-[#6e6e73] dark:text-[#98989d] tabular-nums">{Number(art.vatRate)}%</td>
                    <td className="px-3 py-3">
                      <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#3a3a3c] dark:text-[#ebebf5]">
                        {art.category}
                      </span>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-[12.5px] text-[#6e6e73] dark:text-[#98989d]">{art.accountingAccount}</td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <ConfirmDeleteWrapper onConfirm={() => deleteMut.mutate({ id: art.id })} title="Ștergi articolul?">
                          {(openModal) => (
                            <button
                              type="button"
                              onClick={openModal}
                              className="p-1.5 text-[#8e8e93] hover:text-rose-500 rounded-full hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Șterge"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </ConfirmDeleteWrapper>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between flex-wrap gap-2 bg-[#fafafa] dark:bg-white/[0.02]">
            <div className="flex items-center gap-3 text-[12px] text-[#6e6e73] dark:text-[#98989d] flex-wrap">
              <div className="inline-flex items-center gap-2">
                <span>Rânduri pe pagină:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="apple-pill-control !h-7 px-2.5 text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] outline-none cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                  <option value={9999}>Toți</option>
                </select>
              </div>
              <span className="tabular-nums">
                Afișate {Math.min(filtered.length, (page - 1) * pageSize + 1)} – {Math.min(filtered.length, page * pageSize)} din {filtered.length} articole
              </span>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="apple-btn-glass px-3 h-8 text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-40 cursor-pointer"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="apple-btn-glass px-3 h-8 text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-40 cursor-pointer"
              >
                Următorul
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab 2: Mapare ─────────────────────────────────────────────────────────────
function MapareTab() {
  const { data: unmapped = [], refetch: refetchUnmapped } = trpc.saga.mappings.unmapped.useQuery();
  const { data: mappings = [], refetch: refetchMappings } = trpc.saga.mappings.list.useQuery();
  const { data: articles = [] } = trpc.saga.articles.list.useQuery();
  const createMut = trpc.saga.mappings.create.useMutation({
    onSuccess: () => { refetchUnmapped(); refetchMappings(); toast.success("Mapare salvată!"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.saga.mappings.delete.useMutation({
    onSuccess: () => { refetchMappings(); refetchUnmapped(); toast.success("Mapare ștearsă!"); },
    onError: (e) => toast.error(e.message),
  });

  const [selectedArticles, setSelectedArticles] = useState<Record<string, number>>({});

  return (
    <div className="space-y-4">
      {/* Unmapped Section */}
      <div className="apple-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <h3 className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
              Articole nemapate ({unmapped.length})
            </h3>
          </div>
          <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d]">
            Produse din NIR-uri care nu au corespondent în nomenclator
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07] text-[#6e6e73] dark:text-[#98989d] text-[12px] font-medium">
              <tr>
                <th className="px-4 py-3 font-medium">Denumire pe factură</th>
                <th className="px-4 py-3 font-medium">Furnizor</th>
                <th className="px-4 py-3 text-center font-medium">U/M</th>
                <th className="px-4 py-3 text-center font-medium">Apariții</th>
                <th className="px-4 py-3 font-medium">Asociază cu articol</th>
                <th className="px-4 py-3 text-center font-medium">Acțiune</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06] text-[13px]">
              {unmapped.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-[#6e6e73] dark:text-[#98989d]">
                  <div className="flex flex-col items-center gap-2">
                    <Check className="w-6 h-6 text-emerald-500" />
                    <span>Toate articolele sunt mapate!</span>
                  </div>
                </td></tr>
              ) : (
                unmapped.map((item: any, i: number) => {
                  const key = item.description;
                  return (
                    <tr key={i} className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035]">
                      <td className="px-4 py-3 text-[#1d1d1f] dark:text-[#f5f5f7] font-medium max-w-[300px] truncate">
                        {item.description}
                      </td>
                      <td className="px-4 py-3 text-[#6e6e73] dark:text-[#98989d] text-[12.5px]">{item.supplierName || "—"}</td>
                      <td className="px-4 py-3 text-center text-[#6e6e73] dark:text-[#98989d]">{item.unit}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-amber-500/12 text-amber-700 dark:bg-amber-500/18 dark:text-amber-300 tabular-nums">
                          ×{item.count}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={selectedArticles[key] || ""}
                          onChange={(e) => setSelectedArticles({ ...selectedArticles, [key]: Number(e.target.value) })}
                          className="w-full px-3 h-8 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[12.5px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none cursor-pointer"
                        >
                          <option value="">— Selectează articol —</option>
                          {articles.map((a: any) => (
                            <option key={a.id} value={a.id}>
                              {a.code} — {a.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (!selectedArticles[key]) return toast.error("Selectează un articol!");
                            createMut.mutate({
                              sagaArticleId: selectedArticles[key],
                              externalName: item.description,
                              supplierCUI: item.supplierCUI || undefined,
                            });
                          }}
                          disabled={!selectedArticles[key] || createMut.isPending}
                          className="apple-btn-prominent px-3.5 h-8 disabled:opacity-50 text-[12px] font-semibold cursor-pointer"
                        >
                          Salvează
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Existing Mappings */}
      <div className="apple-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-black/[0.05] dark:border-white/[0.07]">
          <h3 className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-2">
            <Link2 className="w-4 h-4 text-emerald-500" />
            Mapări existente ({mappings.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07] text-[#6e6e73] dark:text-[#98989d] text-[12px] font-medium">
              <tr>
                <th className="px-4 py-3 font-medium">Denumire furnizor</th>
                <th className="px-4 py-3 text-center font-medium"><ArrowRight className="w-3.5 h-3.5 inline" /></th>
                <th className="px-4 py-3 font-medium">Articol SAGA</th>
                <th className="px-4 py-3 font-medium">CUI furnizor</th>
                <th className="px-4 py-3 text-center font-medium">Acțiune</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06] text-[13px]">
              {mappings.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-[#6e6e73] dark:text-[#98989d]">Nicio mapare încă.</td></tr>
              ) : (
                mappings.map((m: any) => (
                  <tr key={m.id} className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035]">
                    <td className="px-4 py-3 text-[#1d1d1f] dark:text-[#f5f5f7] max-w-[300px] truncate">{m.externalName}</td>
                    <td className="px-4 py-3 text-center text-emerald-500"><ArrowRight className="w-4 h-4 inline" /></td>
                    <td className="px-4 py-3">
                      <span className="tabular-nums text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{m.articleCode}</span>
                      <span className="ml-2 text-[#6e6e73] dark:text-[#98989d]">{m.articleName}</span>
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">{m.supplierCUI || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <ConfirmDeleteWrapper onConfirm={() => deleteMut.mutate({ id: m.id })} title="Ștergi maparea?">
                        {(openModal) => (
                          <button
                            type="button"
                            onClick={openModal}
                            className="p-1.5 text-[#8e8e93] hover:text-rose-500 rounded-full hover:bg-rose-500/10 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </ConfirmDeleteWrapper>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tab 3: Export ──────────────────────────────────────────────────────────────
function ExportTab() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [activeChannel, setActiveChannel] = useState<"desktop" | "web">("desktop");

  // SAGA Web Cloud API Configuration
  const { data: webConfig, refetch: refetchWebConfig } = trpc.saga.getSagaWebConfig.useQuery();
  const [tokenInput, setTokenInput] = useState("");
  const [cuiInput, setCuiInput] = useState("");
  const [isEditingConfig, setIsEditingConfig] = useState(false);

  useEffect(() => {
    if (webConfig) {
      setTokenInput(webConfig.sagaWebToken || "");
      setCuiInput(webConfig.sagaWebCui || "");
    }
  }, [webConfig]);

  const saveConfigMut = trpc.saga.saveSagaWebConfig.useMutation({
    onSuccess: () => {
      toast.success("Configurația SAGA Web a fost salvată!");
      setIsEditingConfig(false);
      refetchWebConfig();
    },
    onError: (e) => toast.error("Eroare: " + e.message),
  });

  const pushWebMut = trpc.saga.pushToSagaWeb.useMutation({
    onSuccess: (res) => {
      toast.success(res.message || "Facturile au fost importate cu succes în SAGA Web!");
      refetchHistory();
      refetchWebConfig();
    },
    onError: (e) => toast.error("Eroare SAGA Web: " + e.message),
  });

  const exportFacturiMut = trpc.saga.export.useMutation({
    onSuccess: (data) => {
      const blob = encodeWindows1250Blob(data.xml);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename || `F_EXPORT_${month}_${year}.xml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`Fișierul ${data.filename} a fost descărcat!`);
      refetchHistory();
    },
    onError: (e) => toast.error("Eroare: " + e.message),
  });

  const exportArticoleMut = trpc.saga.exportArticole.useMutation({
    onSuccess: (data) => {
      const blob = encodeWindows1250Blob(data.xml);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`Fișierul ${data.filename} a fost descărcat!`);
    },
    onError: (e) => toast.error("Eroare: " + e.message),
  });

  const exportClientiMut = trpc.saga.exportClienti.useMutation({
    onSuccess: (data) => {
      const blob = encodeWindows1250Blob(data.xml);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`Fișierul ${data.filename} a fost descărcat!`);
    },
    onError: (e) => toast.error("Eroare: " + e.message),
  });

  const { data: me } = trpc.auth.me.useQuery();
  const currentTenantId = me?.tenantId || 1;

  const [exportingNirId, setExportingNirId] = useState<number | null>(null);
  const exportSingleNirMut = trpc.saga.exportNir.useMutation({
    onSuccess: (data) => {
      const blob = encodeWindows1250Blob(data.xml);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename || "FACTURI.XML";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`Fișierul ${data.filename} a fost descărcat pentru import în SAGA C!`);
      setExportingNirId(null);
    },
    onError: (e) => {
      toast.error("Eroare export: " + e.message);
      setExportingNirId(null);
    },
  });

  const [selectedNirIds, setSelectedNirIds] = useState<number[] | null>(null);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<number[] | null>(null);

  const { data: history = [], refetch: refetchHistory } = trpc.saga.exportHistory.useQuery();
  const { data: previewData, isLoading: isLoadingPreview } = trpc.saga.getExportPreview.useQuery({ month, year });

  // Sync selection when previewData changes
  useEffect(() => {
    if (previewData) {
      setSelectedNirIds(previewData.nirs ? previewData.nirs.map((n: any) => n.id) : []);
      setSelectedInvoiceIds(previewData.invoices ? previewData.invoices.map((inv: any) => inv.id) : []);
    }
  }, [previewData]);

  const toggleNir = (id: number) => {
    setSelectedNirIds((prev) => {
      const allIds = previewData?.nirs ? previewData.nirs.map((n: any) => n.id) : [];
      const current = prev ?? allIds;
      if (current.includes(id)) {
        return current.filter((x) => x !== id);
      } else {
        return [...current, id];
      }
    });
  };

  const toggleAllNirs = () => {
    const allIds = previewData?.nirs ? previewData.nirs.map((n: any) => n.id) : [];
    const current = selectedNirIds ?? allIds;
    if (current.length === allIds.length) {
      setSelectedNirIds([]);
    } else {
      setSelectedNirIds(allIds);
    }
  };

  const toggleInvoice = (id: number) => {
    setSelectedInvoiceIds((prev) => {
      const allIds = previewData?.invoices ? previewData.invoices.map((i: any) => i.id) : [];
      const current = prev ?? allIds;
      if (current.includes(id)) {
        return current.filter((x) => x !== id);
      } else {
        return [...current, id];
      }
    });
  };

  const toggleAllInvoices = () => {
    const allIds = previewData?.invoices ? previewData.invoices.map((i: any) => i.id) : [];
    const current = selectedInvoiceIds ?? allIds;
    if (current.length === allIds.length) {
      setSelectedInvoiceIds([]);
    } else {
      setSelectedInvoiceIds(allIds);
    }
  };

  const downloadZip = () => {
    let url = `/api/saga-sync?month=${month}&year=${year}&tenantId=${currentTenantId}`;
    if (selectedNirIds !== null) {
      url += `&nirIds=${selectedNirIds.join(",")}`;
    }
    if (selectedInvoiceIds !== null) {
      url += `&invoiceIds=${selectedInvoiceIds.join(",")}`;
    }
    window.location.href = url;
  };

  // Import Facturi Externe din SAGA
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const handleImportInvoices = async () => {
    if (!importFile) return;
    setIsImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("tenantId", String(currentTenantId));

      const res = await fetch("/api/saga/import-invoices", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportResult({ success: false, error: data.error || "Eroare la import." });
        toast.error(data.error || "Eroare la importul facturilor SAGA.");
        return;
      }
      setImportResult(data);
      toast.success(data.message || "Facturi externe importate cu succes!");
      refetchHistory();
    } catch (e: any) {
      setImportResult({ success: false, error: e.message || "Eroare conexiune." });
      toast.error("Eroare de conexiune la server.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Canal Selector: Desktop vs Web */}
      <div className="apple-surface px-3 py-2.5">
        <div className="apple-segmented max-w-full overflow-x-auto no-scrollbar">
          <button
            type="button"
            data-active={activeChannel === "desktop"}
            onClick={() => setActiveChannel("desktop")}
            className="apple-segmented-item px-4 shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>SAGA C (Desktop / Diverse &gt; Import date)</span>
          </button>
          <button
            type="button"
            data-active={activeChannel === "web"}
            onClick={() => setActiveChannel("web")}
            className="apple-segmented-item px-4 shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>SAGA Web (Sincronizare Automată Cloud API)</span>
          </button>
        </div>
      </div>

      {/* Selector Perioadă */}
      <div className="apple-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-black/[0.05] dark:border-white/[0.07]">
          <div>
            <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#0071e3] dark:text-[#0a84ff]" />
              Selectează perioada documentelor
            </h3>
            <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
              Se exportă automat atât facturile emise (Ieșiri), cât și recepțiile furnizori (Intrări / NIR).
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">
                Luna
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="apple-pill-control !h-9 px-3.5 text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] outline-none cursor-pointer"
              >
                <option value={0}>Tot Anul ({year}) — Toate Lunile</option>
                {MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">
                Anul
              </label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="apple-pill-control !h-9 px-3.5 text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] outline-none cursor-pointer tabular-nums"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* CANALUL 1: SAGA C DESKTOP */}
        {activeChannel === "desktop" && (
          <div className="pt-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Pachet ZIP Complet */}
              <div className="p-4 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.05] dark:border-white/[0.07] flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-[#0071e3] dark:text-[#64d2ff] mb-1">
                    Recomandat SAGA C
                  </div>
                  <h4 className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-1">
                    Pachet arhivă ZIP
                  </h4>
                  <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] mb-4">
                    Conține cele 3 fișiere standard SAGA C: F_...xml, CLI_...xml și ART_...xml.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadZip}
                  className="apple-btn-prominent w-full h-9 inline-flex items-center justify-center gap-1.5 px-3 text-[12px] font-semibold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descarcă Arhiva ZIP {selectedNirIds !== null || selectedInvoiceIds !== null ? `(${(selectedNirIds?.length || 0) + (selectedInvoiceIds?.length || 0)} doc.)` : ""}
                </button>
              </div>

              {/* Facturi XML */}
              <div className="p-4 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.05] dark:border-white/[0.07] flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">
                    Format &lt;Facturi&gt;
                  </div>
                  <h4 className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-1">
                    Doar Facturi XML
                  </h4>
                  <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] mb-4">
                    Fișierul standardizat F_CUI_Luna_An.xml (Ieșiri vânzări + Intrări furnizori).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => exportFacturiMut.mutate({
                    month,
                    year,
                    nirIds: selectedNirIds !== null ? selectedNirIds : undefined,
                    invoiceIds: selectedInvoiceIds !== null ? selectedInvoiceIds : undefined,
                  })}
                  disabled={exportFacturiMut.isPending}
                  className="apple-btn-glass w-full h-9 inline-flex items-center justify-center gap-1.5 px-3 text-[#1d1d1f] dark:text-[#f5f5f7] text-[12px] font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {exportFacturiMut.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileText className="w-3.5 h-3.5" />
                  )}
                  Descarcă Facturi.xml {selectedNirIds !== null || selectedInvoiceIds !== null ? `(${(selectedNirIds?.length || 0) + (selectedInvoiceIds?.length || 0)} doc.)` : ""}
                </button>
              </div>

              {/* Nomenclator Articole */}
              <div className="p-4 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.05] dark:border-white/[0.07] flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">
                    Format &lt;Articole&gt;
                  </div>
                  <h4 className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-1">
                    Articole (Nomenclator)
                  </h4>
                  <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] mb-4">
                    Fișierul ART_data.xml cu toate codurile de produs, UM și cote TVA.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => exportArticoleMut.mutate()}
                  disabled={exportArticoleMut.isPending}
                  className="apple-btn-glass w-full h-9 inline-flex items-center justify-center gap-1.5 px-3 text-[#1d1d1f] dark:text-[#f5f5f7] text-[12px] font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {exportArticoleMut.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Package className="w-3.5 h-3.5" />
                  )}
                  Descarcă Articole.xml
                </button>
              </div>

              {/* Nomenclator Clienți */}
              <div className="p-4 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.05] dark:border-white/[0.07] flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">
                    Format &lt;Clienti&gt;
                  </div>
                  <h4 className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-1">
                    Clienți (Nomenclator)
                  </h4>
                  <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] mb-4">
                    Fișierul CLI_data.xml cu lista partenerilor, CUI, RegCom și adrese.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => exportClientiMut.mutate()}
                  disabled={exportClientiMut.isPending}
                  className="apple-btn-glass w-full h-9 inline-flex items-center justify-center gap-1.5 px-3 text-[#1d1d1f] dark:text-[#f5f5f7] text-[12px] font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {exportClientiMut.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Users className="w-3.5 h-3.5" />
                  )}
                  Descarcă Clienți.xml
                </button>
              </div>
            </div>

            {/* Import Facturi Externe din SAGA Card */}
            <div className="p-5 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.05] dark:border-white/[0.07] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300">
                    Import SAGA
                  </span>
                  <h4 className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    Importă facturi externe generate în SAGA
                  </h4>
                </div>
                <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] max-w-2xl">
                  Încarcă fișierul XML (exportat din SAGA Diverse &gt; Export facturi) sau fișierul Excel (din Ieșiri valută). Facturile vor fi importate automat în secțiunea Facturi Emise cu status extern și curs BNR.
                </p>
                {importResult && (
                  <p className={`text-xs font-semibold ${importResult.success ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600"}`}>
                    {importResult.message || importResult.error}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <input
                  type="file"
                  id="saga-exporttab-import"
                  accept=".xml,.xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setImportFile(e.target.files[0]);
                      setImportResult(null);
                    }
                  }}
                />
                <label
                  htmlFor="saga-exporttab-import"
                  className="apple-btn-glass cursor-pointer inline-flex items-center gap-1.5 px-3.5 h-9 text-[#1d1d1f] dark:text-[#f5f5f7] text-[12px] font-medium"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{importFile ? importFile.name.slice(0, 20) + "..." : "Alege XML / Excel"}</span>
                </label>
                <button
                  type="button"
                  disabled={!importFile || isImporting}
                  onClick={handleImportInvoices}
                  className="apple-btn-prominent inline-flex items-center gap-1.5 px-4 h-9 text-[12px] font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Se importă...
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      Importă în aplicație
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* PREVIEW DOCUMENTELOR CE SE VOR EXPORTA */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-[14.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-2">
                    <Eye className="w-4 h-4 text-[#0071e3] dark:text-[#0a84ff]" />
                    Ce conține acest export ({month === 0 ? "Tot Anul" : MONTHS[month - 1]} {year})
                  </h4>
                  <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d]">
                    Verifică documentele împachetate în fișierul XML înainte de a-l importa în SAGA.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-1 rounded-full text-[11.5px] font-medium bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums">
                    {selectedInvoiceIds ? selectedInvoiceIds.length : (previewData?.invoices.length || 0)} / {previewData?.invoices.length || 0} Facturi emise (Ieșiri)
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[11.5px] font-medium bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300 tabular-nums">
                    {selectedNirIds ? selectedNirIds.length : (previewData?.nirs.length || 0)} / {previewData?.nirs.length || 0} Recepții NIR (Intrări)
                  </span>
                </div>
              </div>

              {/* Informare SAGA: "Deja au fost importate" */}
              <div className="p-3.5 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.05] dark:border-white/[0.07] text-[12px] text-[#3a3a3c] dark:text-[#ebebf5] space-y-1">
                <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-[#0071e3] dark:text-[#0a84ff]" />
                  De ce zice SAGA C: „Deja au fost importate”?
                </span>
                <p>
                  Dacă SAGA afișează acest mesaj la import, înseamnă că <strong>fișierul a fost citit cu succes</strong>, însă facturile sau NIR-urile din el există deja salvate în SAGA la <strong>Operații &gt; Intrări</strong> sau <strong>Operații &gt; Ieșiri</strong>!
                </p>
                <p className="text-[#6e6e73] dark:text-[#98989d]">
                  Pentru a forța re-importul și actualizarea lor în SAGA, bifează în fereastra din SAGA opțiunea <em>„Actualizare poziții existente”</em> sau verifică documentele direct în meniul Intrări/Ieșiri.
                </p>
              </div>

              {/* Tabele Documente */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 1. Facturi Vânzare (Ieșiri) */}
                <div className="apple-surface overflow-hidden">
                  <div className="px-4 py-3 bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between">
                    <span className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-1.5 tabular-nums">
                      <FileText className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />
                      Ieșiri — Facturi emise ({selectedInvoiceIds ? selectedInvoiceIds.length : (previewData?.invoices.length || 0)} / {previewData?.invoices.length || 0})
                    </span>
                    {(previewData?.invoices.length || 0) > 0 && (
                      <button
                        type="button"
                        onClick={toggleAllInvoices}
                        className="text-[11.5px] font-medium text-[#0071e3] dark:text-[#64d2ff] hover:underline cursor-pointer"
                      >
                        {(selectedInvoiceIds ?? []).length === (previewData?.invoices.length || 0) ? "Deselectează tot" : "Selectează tot"}
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                    {isLoadingPreview ? (
                      <div className="p-6 text-center text-[#6e6e73]"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>
                    ) : (previewData?.invoices.length || 0) === 0 ? (
                      <div className="p-6 text-center text-[12.5px] text-[#6e6e73] dark:text-[#98989d]">Nicio factură emisă în {month === 0 ? `anul ${year}` : `luna ${MONTHS[month - 1]}`}.</div>
                    ) : (
                      previewData?.invoices.map((inv) => {
                        const isSelected = (selectedInvoiceIds ?? []).includes(inv.id);
                        return (
                          <div
                            key={inv.id}
                            onClick={() => toggleInvoice(inv.id)}
                            className={`p-3 text-[12.5px] flex items-center justify-between hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] cursor-pointer transition-colors ${
                              isSelected ? "bg-[#0071e3]/[0.04] dark:bg-[#0a84ff]/[0.08]" : "opacity-65"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleInvoice(inv.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 rounded accent-[#0071e3] cursor-pointer shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums">{inv.number}</span>
                                  <span className="text-[#8e8e93] tabular-nums text-[11.5px]">{inv.issueDate}</span>
                                </div>
                                <div className="text-[#6e6e73] dark:text-[#98989d] truncate max-w-[200px]">
                                  {inv.clientName || "Client"} {inv.clientCui ? `(CUI: ${inv.clientCui})` : ""}
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-semibold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">{Number(inv.total).toFixed(2)} {inv.currency || "RON"}</span>
                              <div className="text-[10.5px] text-[#6e6e73] dark:text-[#98989d] font-medium">Ieșire SAGA</div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* 2. Recepții NIR (Intrări) */}
                <div className="apple-surface overflow-hidden">
                  <div className="px-4 py-3 bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between">
                    <span className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-1.5 tabular-nums">
                      <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Intrări — Recepții NIR ({selectedNirIds ? selectedNirIds.length : (previewData?.nirs.length || 0)} / {previewData?.nirs.length || 0})
                    </span>
                    {(previewData?.nirs.length || 0) > 0 && (
                      <button
                        type="button"
                        onClick={toggleAllNirs}
                        className="text-[11.5px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        {(selectedNirIds ?? []).length === (previewData?.nirs.length || 0) ? "Deselectează tot" : "Selectează tot"}
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                    {isLoadingPreview ? (
                      <div className="p-6 text-center text-[#6e6e73]"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>
                    ) : (previewData?.nirs.length || 0) === 0 ? (
                      <div className="p-6 text-center text-[12.5px] text-[#6e6e73] dark:text-[#98989d]">
                        Niciun NIR înregistrat în {month === 0 ? `anul ${year}` : `luna ${MONTHS[month - 1]}`}.
                        {(previewData?.totalAllNirs || 0) > 0 && (
                          <div className="text-[11.5px] text-amber-600 dark:text-amber-400 mt-1">
                            (Există {previewData?.totalAllNirs} NIR-uri în alte luni din sistem)
                          </div>
                        )}
                      </div>
                    ) : (
                      previewData?.nirs.map((n) => {
                        const isSelected = (selectedNirIds ?? []).includes(n.id);
                        return (
                          <div
                            key={n.id}
                            onClick={() => toggleNir(n.id)}
                            className={`p-3.5 text-[12.5px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] cursor-pointer transition-colors ${
                              isSelected ? "bg-emerald-500/[0.04] dark:bg-emerald-500/[0.08]" : "opacity-65"
                            }`}
                          >
                            <div className="flex items-start gap-3 w-full sm:w-auto min-w-0">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleNir(n.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 mt-0.5 rounded accent-emerald-600 cursor-pointer shrink-0"
                              />
                              <div className="space-y-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums">
                                    {n.nirNumber}
                                  </span>
                                  {n.invoiceNumber && (
                                    <span className="px-2 py-0.5 rounded-full text-[10.5px] tabular-nums bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#3a3a3c] dark:text-[#ebebf5]">
                                      Doc: {n.invoiceNumber}
                                    </span>
                                  )}
                                  {n.spvIndex ? (
                                    <span
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] tabular-nums font-semibold bg-[#0071e3]/10 text-[#0071e3] dark:bg-[#0a84ff]/18 dark:text-[#64d2ff]"
                                      title="ID Încărcare SPV / Index ANAF preluat automat din e-Factura"
                                    >
                                      <Hash className="w-3 h-3" />
                                      Index SPV: {n.spvIndex}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] text-[#8e8e93] bg-[#f2f2f7] dark:bg-[#2c2c2e]">
                                      Fără Index SPV
                                    </span>
                                  )}
                                </div>
                                <div className="text-[#1d1d1f] dark:text-[#f5f5f7] font-medium truncate max-w-xs sm:max-w-sm">
                                  {n.supplierName || "Furnizor"} {n.supplierCUI ? `(CUI: ${n.supplierCUI})` : ""}
                                </div>
                                <div className="text-[11px] text-[#6e6e73] dark:text-[#98989d] flex flex-wrap items-center gap-x-2">
                                  <span>Dată factură: <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">{n.issueDate || n.receiptDate}</strong></span>
                                  <span>•</span>
                                  <span>Recepție: {n.receiptDate}</span>
                                  <span>•</span>
                                  <span>Cont: <strong className="text-emerald-700 dark:text-emerald-400 tabular-nums">{n.accountingAccount || "371"}</strong></span>
                                </div>
                              </div>
                            </div>
                            <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto shrink-0 gap-1.5">
                              <div className="text-left sm:text-right">
                                <span className="font-semibold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] text-[13.5px]">{n.total} RON</span>
                                {(n as any).subtotal && (
                                  <div className="text-[10.5px] text-[#6e6e73] dark:text-[#98989d]">
                                    Fără TVA: <span className="tabular-nums">{(n as any).subtotal}</span> • TVA: <span className="tabular-nums">{(n as any).totalVat || "0.00"}</span>
                                  </div>
                                )}
                                <div className="text-[10.5px] text-emerald-600 dark:text-emerald-400 font-medium">Intrare SAGA</div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExportingNirId(n.id);
                                  exportSingleNirMut.mutate({ nirId: n.id });
                                }}
                                disabled={exportSingleNirMut.isPending && exportingNirId === n.id}
                                title="Descarcă doar acest NIR cu indexul SPV în format XML pentru SAGA C"
                                className="apple-btn-glass inline-flex items-center gap-1 px-2.5 h-7 text-[11px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-50 cursor-pointer"
                              >
                                {exportSingleNirMut.isPending && exportingNirId === n.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <FileCode className="w-3 h-3" />
                                )}
                                <span>Descarcă XML</span>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Ghid Import SAGA C Desktop */}
            <div className="p-4 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.05] dark:border-white/[0.07] text-[12px] text-[#3a3a3c] dark:text-[#ebebf5] space-y-1.5">
              <div className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                Cum imporți fișierele în SAGA C Desktop (clasic):
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[#6e6e73] dark:text-[#98989d] pl-1">
                <li>Deschide aplicația <strong>SAGA C</strong> pe calculator.</li>
                <li>Mergi în meniul <strong>Diverse &gt; Import date</strong>.</li>
                <li>Alege tabul <strong>Import date din fișiere XML</strong>.</li>
                <li>Dacă ai descărcat arhiva ZIP, dezarhiveaz-o într-un folder (sau selectează direct fișierul XML descărcat), apoi alege folderul în SAGA C și apasă <strong>Validare</strong>.</li>
                <li>SAGA C va aloca automat facturile la <strong>Ieșiri</strong> (cele emise de tine) și la <strong>Intrări</strong> (achizițiile de la furnizori).</li>
              </ol>
            </div>
          </div>
        )}

        {/* CANALUL 2: SAGA WEB CLOUD API */}
        {activeChannel === "web" && (
          <div className="pt-5 space-y-5">
            {/* Box Configurare Credențiale */}
            <div className="p-5 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.05] dark:border-white/[0.07] space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h4 className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-2">
                    <Settings className="w-4 h-4 text-[#0071e3] dark:text-[#0a84ff]" />
                    Configurare cheie API SAGA Web
                  </h4>
                  <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d]">
                    Cheia se generează în contul Saga Web din ecranul{" "}
                    <code className="font-sans tabular-nums bg-white dark:bg-[#1c1c1e] px-1.5 py-0.5 rounded text-[#1d1d1f] dark:text-[#f5f5f7]">
                      Administrare &gt; Utilizatori &gt; Integrare API
                    </code>.
                  </p>
                </div>
                {!isEditingConfig ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingConfig(true)}
                    className="apple-btn-glass px-3.5 h-8 text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                  >
                    Modifică
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        saveConfigMut.mutate({
                          sagaWebToken: tokenInput,
                          sagaWebCui: cuiInput,
                        });
                      }}
                      disabled={saveConfigMut.isPending}
                      className="apple-btn-prominent px-3.5 h-8 text-[12px] font-semibold cursor-pointer"
                    >
                      {saveConfigMut.isPending ? "Se salvează..." : "Salvează"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingConfig(false)}
                      className="apple-btn-glass px-3.5 h-8 text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                    >
                      Anulează
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                <div>
                  <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">
                    Cod fiscal firmă (CUI SAGA)
                  </label>
                  <input
                    type="text"
                    value={cuiInput}
                    onChange={(e) => setCuiInput(e.target.value)}
                    disabled={!isEditingConfig}
                    placeholder="Ex: 12345678"
                    className="w-full px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums disabled:opacity-75 outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">
                    Cheie de acces SAGA Web (Bearer Token)
                  </label>
                  <input
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    disabled={!isEditingConfig}
                    placeholder="Lipește aici tokenul generat din Saga Web..."
                    className="w-full px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums disabled:opacity-75 outline-none"
                  />
                </div>
              </div>

              {tokenInput && (
                <div className="text-[11.5px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  Token configurat activ. Sincronizarea automată gestionează și salvarea noului token la fiecare rotație (X-Saga-Refresh-Token).
                </div>
              )}
            </div>

            {/* Buton Trimitere Directă */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <button
                type="button"
                onClick={() =>
                  pushWebMut.mutate({
                    month,
                    year,
                    sagaToken: tokenInput,
                    sagaCui: cuiInput,
                  })
                }
                disabled={pushWebMut.isPending || !tokenInput}
                className="apple-btn-prominent inline-flex items-center gap-2 px-5 h-10 disabled:opacity-50 text-[13px] font-semibold cursor-pointer"
              >
                {pushWebMut.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Trimite Facturile în SAGA Web ({month === 0 ? "Tot Anul" : MONTHS[month - 1]} {year})
              </button>

              <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d]">
                După trimitere, fișierele apar imediat în Saga Web în meniul{" "}
                <strong>Diverse &gt; Import Date</strong>.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Istoric Exporturi */}
      <div className="apple-surface overflow-hidden">
        <div className="px-5 py-3.5 border-b border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between">
          <h3 className="text-[14.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-2">
            <History className="w-4 h-4 text-[#6e6e73] dark:text-[#98989d]" />
            Istoric operațiuni SAGA
          </h3>
          <span className="text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">{history.length} înregistrări</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07] text-[#6e6e73] dark:text-[#98989d] text-[12px] font-medium">
              <tr>
                <th className="px-5 py-3 font-medium">Nr.</th>
                <th className="px-5 py-3 font-medium">Perioadă</th>
                <th className="px-5 py-3 text-center font-medium">Data procesare</th>
                <th className="px-5 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06] text-[13px]">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-[#6e6e73] dark:text-[#98989d]">
                    Nicio operațiune de export înregistrată încă.
                  </td>
                </tr>
              ) : (
                history.map((h: any, i: number) => (
                  <tr key={h.id} className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035]">
                    <td className="px-5 py-3 text-[#8e8e93] tabular-nums text-[12px]">{i + 1}</td>
                    <td className="px-5 py-3 text-[#1d1d1f] dark:text-[#f5f5f7] font-medium">
                      {MONTHS[h.month - 1]} {h.year}
                    </td>
                    <td className="px-5 py-3 text-center text-[#6e6e73] dark:text-[#98989d] text-[12.5px] tabular-nums">
                      {new Date(h.createdAt).toLocaleString("ro-RO")}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300">
                        <Check className="w-3 h-3" /> Generat
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tab 4: Setări ─────────────────────────────────────────────────────────────
function SetariTab() {
  const utils = trpc.useUtils();
  const { data: currentTenant } = trpc.tenants.current.useQuery();
  const { data: planConturi = [] } = trpc.saga.planConturi.useQuery({ stockOnly: true });

  const [articlePrefix, setArticlePrefix] = useState("ART-");
  const [defaultGestiune, setDefaultGestiune] = useState("Gestiune principală");
  const [defaultAccount, setDefaultAccount] = useState("371");
  const [defaultVatRate, setDefaultVatRate] = useState("21");

  useEffect(() => {
    if (currentTenant?.settings) {
      try {
        const parsed =
          typeof currentTenant.settings === "string"
            ? JSON.parse(currentTenant.settings)
            : currentTenant.settings;
        if (parsed?.sagaConfig) {
          if (parsed.sagaConfig.articlePrefix !== undefined) {
            setArticlePrefix(parsed.sagaConfig.articlePrefix);
          }
          if (parsed.sagaConfig.defaultGestiune !== undefined) {
            setDefaultGestiune(parsed.sagaConfig.defaultGestiune);
          }
          if (parsed.sagaConfig.defaultAccount !== undefined) {
            setDefaultAccount(parsed.sagaConfig.defaultAccount);
          }
          if (parsed.sagaConfig.defaultVatRate !== undefined) {
            setDefaultVatRate(String(parsed.sagaConfig.defaultVatRate));
          }
        }
      } catch {}
    }
  }, [currentTenant?.settings]);

  const updateSettingsMut = trpc.tenants.updateSettings.useMutation({
    onSuccess: () => {
      utils.tenants.current.invalidate();
      toast.success("Setările SAGA au fost salvate.");
    },
    onError: (e) => toast.error(e.message || "Eroare la salvare."),
  });

  const handleSaveSagaSettings = () => {
    let parsed: Record<string, any> = {};
    try {
      if (currentTenant?.settings) {
        parsed = JSON.parse(String(currentTenant.settings));
      }
    } catch {}
    parsed.sagaConfig = {
      articlePrefix: articlePrefix.trim() || "ART-",
      defaultGestiune: defaultGestiune.trim() || "Gestiune principală",
      defaultAccount,
      defaultVatRate: Number(defaultVatRate) || 21,
    };
    updateSettingsMut.mutate({
      settings: JSON.stringify(parsed),
    });
  };

  return (
    <div className="apple-surface p-5 sm:p-6">
      <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-4 flex items-center gap-2">
        <Settings className="w-4 h-4 text-[#6e6e73] dark:text-[#98989d]" />
        Setări modul SAGA
      </h3>

      <div className="space-y-5 max-w-lg">
        <div>
          <label className="block text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">
            Prefix cod articol
          </label>
          <input
            type="text"
            value={articlePrefix}
            onChange={(e) => setArticlePrefix(e.target.value)}
            className="w-full px-3.5 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums outline-none"
          />
          <p className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] mt-1">
            Prefixul folosit la generarea automată a codurilor (ex: ART-0001)
          </p>
        </div>

        <div>
          <label className="block text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">
            Gestiune implicită
          </label>
          <input
            type="text"
            value={defaultGestiune}
            onChange={(e) => setDefaultGestiune(e.target.value)}
            className="w-full px-3.5 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
          />
        </div>

        <div>
          <label className="block text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">
            Cont contabil implicit
          </label>
          <select
            value={defaultAccount}
            onChange={(e) => setDefaultAccount(e.target.value)}
            className="w-full px-3.5 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums outline-none cursor-pointer"
          >
            {planConturi.map((c: any) => (
              <option key={c.cod} value={c.cod}>{c.cod} — {c.denumire}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">
            Cotă TVA implicită
          </label>
          <select
            value={defaultVatRate}
            onChange={(e) => setDefaultVatRate(e.target.value)}
            className="w-full px-3.5 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums outline-none cursor-pointer"
          >
            <option value="21">21%</option>
            <option value="11">11%</option>
            <option value="19">19%</option>
            <option value="9">9%</option>
            <option value="5">5%</option>
            <option value="0">0%</option>
          </select>
        </div>

        <div className="pt-1">
          <button
            type="button"
            onClick={handleSaveSagaSettings}
            disabled={updateSettingsMut.isPending}
            className="apple-btn-prominent h-9 px-5 disabled:opacity-50 text-[13px] font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            {updateSettingsMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvează setări
          </button>
        </div>
      </div>
    </div>
  );
}

// ── GESTIUNI TAB ──────────────────────────────────────────────────────────────
function GestiuniTab() {
  const utils = trpc.useUtils();
  const { data: gestiuni = [], isLoading } = trpc.saga.gestiuni.list.useQuery();
  const createMut = trpc.saga.gestiuni.create.useMutation({
    onSuccess: () => { utils.saga.gestiuni.list.invalidate(); toast.success("Gestiune adăugată"); setShowForm(false); },
    onError: (e) => toast.error(e.message || "Eroare la salvare."),
  });
  const deleteMut = trpc.saga.gestiuni.delete.useMutation({
    onSuccess: () => { utils.saga.gestiuni.list.invalidate(); toast.success("Gestiune ștearsă"); },
    onError: (e) => toast.error(e.message || "Eroare la salvare."),
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    cod: "", denumire: "", tipGestiune: "cantitativ-valorica", gestionar: "",
    analitic371: "", analitic607: "", analitic707: "", tvaImplicit: "21.00",
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="apple-surface px-3 py-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="apple-btn-prominent inline-flex items-center gap-1.5 h-8 px-4 text-[12.5px] font-semibold cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Adaugă gestiune
        </button>
        <span className="ml-auto text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums pr-1">{gestiuni.length} gestiuni</span>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="apple-surface p-4 sm:p-5 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input placeholder="Cod *" value={form.cod} onChange={e => setForm({...form, cod: e.target.value})}
              className="px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none" />
            <input placeholder="Denumire *" value={form.denumire} onChange={e => setForm({...form, denumire: e.target.value})}
              className="px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none col-span-2" />
            <select value={form.tipGestiune} onChange={e => setForm({...form, tipGestiune: e.target.value})}
              className="px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none cursor-pointer">
              <option value="cantitativ-valorica">Cantitativ-valorică</option>
              <option value="cantitativa">Cantitativă</option>
            </select>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input placeholder="Gestionar" value={form.gestionar} onChange={e => setForm({...form, gestionar: e.target.value})}
              className="px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none" />
            <input placeholder="Analitic 371" value={form.analitic371} onChange={e => setForm({...form, analitic371: e.target.value})}
              className="px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none tabular-nums" />
            <input placeholder="Analitic 607" value={form.analitic607} onChange={e => setForm({...form, analitic607: e.target.value})}
              className="px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none tabular-nums" />
            <input placeholder="Analitic 707" value={form.analitic707} onChange={e => setForm({...form, analitic707: e.target.value})}
              className="px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none tabular-nums" />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => createMut.mutate(form)}
              disabled={!form.cod || !form.denumire || createMut.isPending}
              className="apple-btn-prominent px-4 h-9 text-[12.5px] font-semibold disabled:opacity-50 cursor-pointer"
            >
              {createMut.isPending ? "Se salvează..." : "Salvează"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="apple-btn-glass px-4 h-9 text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-medium cursor-pointer"
            >
              Anulează
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="apple-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
              <tr>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Cod</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Denumire</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Tip</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Gestionar</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">371</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">607</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">707</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06] text-[13px]">
              {isLoading && <tr><td colSpan={8} className="px-4 py-8 text-center text-[#6e6e73]"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>}
              {gestiuni.map((g: any) => (
                <tr key={g.id} className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035]">
                  <td className="px-4 py-2.5 tabular-nums font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{g.cod}</td>
                  <td className="px-4 py-2.5 text-[#1d1d1f] dark:text-[#f5f5f7] font-medium">{g.denumire}</td>
                  <td className="px-4 py-2.5 text-[#6e6e73] dark:text-[#98989d]">{g.tipGestiune}</td>
                  <td className="px-4 py-2.5 text-[#6e6e73] dark:text-[#98989d]">{g.gestionar || "—"}</td>
                  <td className="px-4 py-2.5 text-[#6e6e73] dark:text-[#98989d] tabular-nums text-[12.5px]">{g.analitic371 || "—"}</td>
                  <td className="px-4 py-2.5 text-[#6e6e73] dark:text-[#98989d] tabular-nums text-[12.5px]">{g.analitic607 || "—"}</td>
                  <td className="px-4 py-2.5 text-[#6e6e73] dark:text-[#98989d] tabular-nums text-[12.5px]">{g.analitic707 || "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <ConfirmDeleteWrapper onConfirm={() => deleteMut.mutate({ id: g.id })} title="Ștergi gestiunea?">
                      {(openModal) => (
                        <button type="button" onClick={openModal} className="p-1.5 text-[#8e8e93] hover:text-rose-500 hover:bg-rose-500/10 rounded-full cursor-pointer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </ConfirmDeleteWrapper>
                  </td>
                </tr>
              ))}
              {!isLoading && gestiuni.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-[#6e6e73] dark:text-[#98989d]">Nicio gestiune. Apasă „Adaugă gestiune” pentru prima gestiune.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── FURNIZORI TAB ─────────────────────────────────────────────────────────────
function FurnizoriTab() {
  const utils = trpc.useUtils();
  const { data: me } = trpc.auth.me.useQuery();
  const { data: furnizori = [], isLoading } = trpc.saga.furnizori.list.useQuery();
  const createMut = trpc.saga.furnizori.create.useMutation({
    onSuccess: () => { utils.saga.furnizori.list.invalidate(); toast.success("Furnizor adăugat"); setShowForm(false); },
    onError: (e) => toast.error(e.message || "Eroare la salvare."),
  });
  const deleteMut = trpc.saga.furnizori.delete.useMutation({
    onSuccess: () => { utils.saga.furnizori.list.invalidate(); toast.success("Furnizor șters"); },
    onError: (e) => toast.error(e.message || "Eroare la salvare."),
  });

  const [showForm, setShowForm] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [form, setForm] = useState({
    cod: "", denumire: "", cui: "", regCom: "", adresa: "",
    judet: "", localitate: "", banca: "", contBanca: "",
    telefon: "", email: "", contFurnizor: "401",
  });

  const handleFurnizoriImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const toastId = toast.loading("Se importă furnizorii din SAGA...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tenantId", String(me?.tenantId || 1));

      const res = await fetch("/api/saga/import-furnizori", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Eroare la import furnizori");
      }

      const data = await res.json();
      utils.saga.furnizori.list.invalidate();
      toast.success(`Import finalizat: ${data.imported} noi, ${data.skipped} omise.`, { id: toastId });
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  const filtered = useMemo(() => {
    if (!searchQ) return furnizori;
    const q = searchQ.toLowerCase();
    return furnizori.filter((f: any) =>
      f.denumire?.toLowerCase().includes(q) || f.cui?.toLowerCase().includes(q) || f.cod?.toLowerCase().includes(q)
    );
  }, [furnizori, searchQ]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="apple-surface px-3 py-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="apple-btn-prominent inline-flex items-center gap-1.5 px-3.5 h-8 text-[12.5px] font-semibold cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Adaugă
        </button>

        <label className={`apple-btn-glass inline-flex items-center gap-1.5 px-3.5 h-8 text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-medium cursor-pointer ${isImporting ? "opacity-50 pointer-events-none" : ""}`}>
          <Upload className="w-3.5 h-3.5" /> Import din SAGA
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFurnizoriImport} disabled={isImporting} />
        </label>
        <div className="ml-auto flex items-center gap-2.5 flex-wrap">
          <div className="apple-pill-control relative flex items-center w-56 px-3">
            <Search className="w-3.5 h-3.5 text-[#8e8e93] shrink-0 mr-2" />
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Caută furnizor..."
              className="flex-1 min-w-0 bg-transparent text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none"
            />
          </div>
          <span className="text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums pr-1">{filtered.length} furnizori</span>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="apple-surface p-4 sm:p-5 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input placeholder="Cod *" value={form.cod} onChange={e => setForm({...form, cod: e.target.value})}
              className="px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none" />
            <input placeholder="Denumire *" value={form.denumire} onChange={e => setForm({...form, denumire: e.target.value})}
              className="px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none col-span-2" />
            <input placeholder="CUI" value={form.cui} onChange={e => setForm({...form, cui: e.target.value})}
              className="px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none tabular-nums" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input placeholder="Reg. Comerțului" value={form.regCom} onChange={e => setForm({...form, regCom: e.target.value})}
              className="px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none" />
            <input placeholder="Adresă" value={form.adresa} onChange={e => setForm({...form, adresa: e.target.value})}
              className="px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none col-span-2" />
            <input placeholder="Telefon" value={form.telefon} onChange={e => setForm({...form, telefon: e.target.value})}
              className="px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none tabular-nums" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
              className="px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none" />
            <input placeholder="Bancă" value={form.banca} onChange={e => setForm({...form, banca: e.target.value})}
              className="px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none" />
            <input placeholder="IBAN" value={form.contBanca} onChange={e => setForm({...form, contBanca: e.target.value})}
              className="px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none tabular-nums" />
            <input placeholder="Cont furnizor (401)" value={form.contFurnizor} onChange={e => setForm({...form, contFurnizor: e.target.value})}
              className="px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none tabular-nums" />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => createMut.mutate(form)}
              disabled={!form.cod || !form.denumire || createMut.isPending}
              className="apple-btn-prominent px-4 h-9 text-[12.5px] font-semibold disabled:opacity-50 cursor-pointer"
            >
              {createMut.isPending ? "Se salvează..." : "Salvează"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="apple-btn-glass px-4 h-9 text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-medium cursor-pointer"
            >
              Anulează
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="apple-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
              <tr>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Cod</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Denumire</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">CUI</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Adresă</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Telefon</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Cont</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06] text-[13px]">
              {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-[#6e6e73]"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>}
              {filtered.map((f: any) => (
                <tr key={f.id} className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035]">
                  <td className="px-4 py-2.5 tabular-nums font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{f.cod}</td>
                  <td className="px-4 py-2.5 text-[#1d1d1f] dark:text-[#f5f5f7] font-medium">{f.denumire}</td>
                  <td className="px-4 py-2.5 text-[#6e6e73] dark:text-[#98989d] tabular-nums">{f.cui || "—"}</td>
                  <td className="px-4 py-2.5 text-[#6e6e73] dark:text-[#98989d] text-[12.5px] max-w-[220px] truncate">{f.adresa || "—"}</td>
                  <td className="px-4 py-2.5 text-[#6e6e73] dark:text-[#98989d] tabular-nums">{f.telefon || "—"}</td>
                  <td className="px-4 py-2.5 text-[#6e6e73] dark:text-[#98989d] tabular-nums text-[12.5px]">{f.contFurnizor}</td>
                  <td className="px-4 py-2.5 text-right">
                    <ConfirmDeleteWrapper onConfirm={() => deleteMut.mutate({ id: f.id })} title="Ștergi furnizorul?">
                      {(openModal) => (
                        <button type="button" onClick={openModal} className="p-1.5 text-[#8e8e93] hover:text-rose-500 hover:bg-rose-500/10 rounded-full cursor-pointer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </ConfirmDeleteWrapper>
                  </td>
                </tr>
              ))}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-[#6e6e73] dark:text-[#98989d]">Niciun furnizor.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── CLIENȚI TAB ─────────────────────────────────────────────────────────────
function ClientiTab() {
  const utils = trpc.useUtils();
  const { data: me } = trpc.auth.me.useQuery();
  const { data: clients = [], isLoading } = trpc.clients.list.useQuery();
  const [searchQ, setSearchQ] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const handleClientiImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const toastId = toast.loading("Se importă clienții din SAGA (CLIENTI.xlsx)...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tenantId", String(me?.tenantId || 1));

      const res = await fetch("/api/saga/import-clienti", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Eroare la import clienți SAGA");
      }

      const data = await res.json();
      utils.clients.list.invalidate();
      utils.clients.searchPartners.invalidate();
      toast.success(
        `Import clienți finalizat: ${data.imported} noi, ${data.updated} actualizați cu cod SAGA.`,
        { id: toastId }
      );
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  const filtered = useMemo(() => {
    if (!searchQ) return clients;
    const q = searchQ.toLowerCase();
    return clients.filter((c: any) =>
      c.name?.toLowerCase().includes(q) ||
      c.cui?.toLowerCase().includes(q) ||
      c.sagaCode?.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q)
    );
  }, [clients, searchQ]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="apple-surface px-3 py-2.5 flex flex-wrap items-center gap-2">
        <label className={`apple-btn-prominent inline-flex items-center gap-1.5 px-4 h-8 text-[12.5px] font-semibold cursor-pointer ${isImporting ? "opacity-50 pointer-events-none" : ""}`}>
          <Upload className="w-3.5 h-3.5" /> Import clienți din SAGA (XLSX)
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleClientiImport} disabled={isImporting} />
        </label>
        <div className="ml-auto flex items-center gap-2.5 flex-wrap">
          <div className="apple-pill-control relative flex items-center w-64 px-3">
            <Search className="w-3.5 h-3.5 text-[#8e8e93] shrink-0 mr-2" />
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Caută client, CUI sau cod SAGA..."
              className="flex-1 min-w-0 bg-transparent text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none"
            />
          </div>
          <span className="text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums pr-1">{filtered.length} clienți</span>
        </div>
      </div>

      {/* Table */}
      <div className="apple-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
              <tr>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Cod SAGA</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Denumire client</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">CUI</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Reg. Com.</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Oraș / Adresă</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Telefon / Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06] text-[13px]">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#6e6e73]">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  </td>
                </tr>
              )}
              {filtered.map((c: any) => (
                <tr key={c.id} className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035]">
                  <td className="px-4 py-2.5 tabular-nums font-semibold">
                    {c.sagaCode ? (
                      <span className="px-2 py-0.5 rounded-full bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] text-[11.5px]">
                        {c.sagaCode}
                      </span>
                    ) : (
                      <span className="text-[#8e8e93] font-normal text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-[#1d1d1f] dark:text-[#f5f5f7] font-medium">{c.name}</td>
                  <td className="px-4 py-2.5 text-[#6e6e73] dark:text-[#98989d] tabular-nums text-[12.5px]">{c.cui || "—"}</td>
                  <td className="px-4 py-2.5 text-[#6e6e73] dark:text-[#98989d] text-[12.5px]">{c.regCom || "—"}</td>
                  <td className="px-4 py-2.5 text-[#6e6e73] dark:text-[#98989d] text-[12.5px] max-w-[220px] truncate">
                    {c.city ? `${c.city}${c.address ? `, ${c.address}` : ""}` : (c.address || "—")}
                  </td>
                  <td className="px-4 py-2.5 text-[#6e6e73] dark:text-[#98989d] text-[12.5px]">
                    {c.phone || c.email ? (
                      <div>
                        {c.phone && <div className="tabular-nums">{c.phone}</div>}
                        {c.email && <div className="text-[11.5px] text-[#8e8e93]">{c.email}</div>}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[#6e6e73] dark:text-[#98989d]">
                    Niciun client găsit.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── PLAN CONTURI TAB ──────────────────────────────────────────────────────────
function PlanConturiTab() {
  const [searchQ, setSearchQ] = useState("");
  const { data: conturi = [], isLoading } = trpc.saga.planConturi.useQuery(
    searchQ ? { query: searchQ } : undefined
  );

  return (
    <div className="space-y-4">
      <div className="apple-surface px-3 py-2.5 flex items-center gap-2">
        <div className="apple-pill-control relative flex items-center flex-1 max-w-md px-3">
          <Search className="w-3.5 h-3.5 text-[#8e8e93] shrink-0 mr-2" />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Caută cont (cod sau denumire)..."
            className="flex-1 min-w-0 bg-transparent text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none"
          />
        </div>
        <span className="ml-auto text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums pr-1">{conturi.length} conturi</span>
      </div>

      <div className="apple-surface overflow-hidden max-h-[600px] overflow-y-auto">
        <table className="w-full">
          <thead className="bg-[#fafafa] dark:bg-[#242426] border-b border-black/[0.05] dark:border-white/[0.07] sticky top-0 z-10">
            <tr>
              <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] w-24">Cod</th>
              <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Denumire</th>
              <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] w-20">Tip</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06] text-[13px]">
            {isLoading && <tr><td colSpan={3} className="px-4 py-8 text-center text-[#6e6e73]"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>}
            {conturi.map((c: any, i: number) => (
              <tr key={i} className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035]">
                <td className="px-4 py-2 tabular-nums font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px]">{c.cod}</td>
                <td className="px-4 py-2 text-[#1d1d1f] dark:text-[#f5f5f7]">{c.denumire}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    c.tip === "A"
                      ? "bg-[#0071e3]/10 text-[#0071e3] dark:bg-[#0a84ff]/18 dark:text-[#64d2ff]"
                      : "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300"
                  }`}>{c.tip === "A" ? "Activ" : "Pasiv"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── INTRĂRI TAB ───────────────────────────────────────────────────────────────
function IntrariTab({ mode = "ron" }: { mode?: "ron" | "valuta" }) {
  const utils = trpc.useUtils();
  const { data: allIntrari = [], isLoading } = trpc.saga.intrari.list.useQuery();
  const isValutaRow = (r: any) => !!r.valuta && r.valuta !== "RON" && r.valuta !== "LEI";
  const intrari = allIntrari.filter((r: any) => (mode === "valuta" ? isValutaRow(r) : !isValutaRow(r)));
  const createMut = trpc.saga.intrari.create.useMutation({
    onSuccess: () => { utils.saga.intrari.list.invalidate(); toast.success("Intrare creată"); setShowForm(false); },
    onError: (e) => toast.error(e.message || "Eroare la salvare."),
  });
  const deleteMut = trpc.saga.intrari.delete.useMutation({
    onSuccess: () => { utils.saga.intrari.list.invalidate(); toast.success("Intrare ștearsă"); },
    onError: (e) => toast.error(e.message || "Eroare la salvare."),
  });

  const [showForm, setShowForm] = useState(false);
  const [selectedIntrareId, setSelectedIntrareId] = useState<number | null>(null);

  const { data: intrareDetails, isLoading: isLoadingDetails } = trpc.saga.intrari.getById.useQuery(
    { id: selectedIntrareId! },
    { enabled: !!selectedIntrareId }
  );

  const [form, setForm] = useState({
    tip: "Factura", nrDoc: "", numeFurnizor: "", cuiFurnizor: "",
    data: new Date().toISOString().split("T")[0], scadent: "",
  });

  return (
    <div className="space-y-4">
      <div className="apple-surface px-3 py-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="apple-btn-prominent inline-flex items-center gap-1.5 px-4 h-8 text-[12.5px] font-semibold cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Intrare nouă
        </button>
        <span className="ml-auto text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums pr-1">{intrari.length} intrări</span>
      </div>

      {showForm && (
        <div className="apple-surface p-4 sm:p-5 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <select value={form.tip} onChange={e => setForm({...form, tip: e.target.value})}
              className="px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none cursor-pointer">
              <option value="Factura">Factură</option>
              <option value="Aviz">Aviz</option>
              <option value="Retur">Retur</option>
            </select>
            <input placeholder="Nr. document" value={form.nrDoc} onChange={e => setForm({...form, nrDoc: e.target.value})}
              className="px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none" />
            <input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})}
              className="px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none tabular-nums" />
            <input type="date" placeholder="Scadență" value={form.scadent} onChange={e => setForm({...form, scadent: e.target.value})}
              className="px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none tabular-nums" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <input placeholder="Furnizor" value={form.numeFurnizor} onChange={e => setForm({...form, numeFurnizor: e.target.value})}
              className="px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none col-span-2" />
            <input placeholder="CUI furnizor" value={form.cuiFurnizor} onChange={e => setForm({...form, cuiFurnizor: e.target.value})}
              className="px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none tabular-nums" />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => createMut.mutate(form)}
              disabled={!form.data || createMut.isPending}
              className="apple-btn-prominent px-4 h-9 text-[12.5px] font-semibold disabled:opacity-50 cursor-pointer"
            >
              {createMut.isPending ? "Se creează..." : "Creează intrare"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="apple-btn-glass px-4 h-9 text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-medium cursor-pointer"
            >
              Anulează
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="apple-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
              <tr>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Nr.</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Tip</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Nr. doc</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Data</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Furnizor</th>
                {mode === "valuta" && <th className="text-right px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Curs BNR</th>}
                <th className="text-right px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">{mode === "valuta" ? "Valoare (valută)" : "Valoare"}</th>
                <th className="text-right px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">{mode === "valuta" ? "TVA (valută)" : "TVA"}</th>
                <th className="text-right px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">{mode === "valuta" ? "Total (valută)" : "Total"}</th>
                {mode === "valuta" && <th className="text-right px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Total RON</th>}
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06] text-[13px]">
              {isLoading && <tr><td colSpan={mode === "valuta" ? 12 : 10} className="px-4 py-8 text-center text-[#6e6e73]"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>}
              {intrari.map((intr: any) => (
                <Fragment key={intr.id}>
                  <tr
                    onClick={() => setSelectedIntrareId(selectedIntrareId === intr.id ? null : intr.id)}
                    className={`hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] cursor-pointer transition-colors ${
                      selectedIntrareId === intr.id ? "bg-[#0071e3]/[0.05] dark:bg-[#0a84ff]/[0.10]" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 tabular-nums font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{intr.nrIntern}</td>
                    <td className="px-4 py-2.5 text-[#6e6e73] dark:text-[#98989d]">{intr.tip}</td>
                    <td className="px-4 py-2.5 text-[#1d1d1f] dark:text-[#f5f5f7] font-medium">{intr.nrDoc || "—"}</td>
                    <td className="px-4 py-2.5 text-[#6e6e73] dark:text-[#98989d] tabular-nums">{intr.data}</td>
                    <td className="px-4 py-2.5 text-[#1d1d1f] dark:text-[#f5f5f7]">{intr.numeFurnizor || "—"}</td>
                    {mode === "valuta" && <td className="px-4 py-2.5 text-right tabular-nums text-[#6e6e73] dark:text-[#98989d]">{Number(intr.curs || 1).toFixed(4)}</td>}
                    <td className="px-4 py-2.5 text-right tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">{Number(mode === "valuta" ? intr.valoareValuta || 0 : intr.valoare || 0).toFixed(2)}{mode === "valuta" ? ` ${intr.valuta}` : ""}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-[#6e6e73] dark:text-[#98989d]">{Number(mode === "valuta" ? intr.tvaValuta || 0 : intr.tva || 0).toFixed(2)}{mode === "valuta" ? ` ${intr.valuta}` : ""}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{Number(mode === "valuta" ? intr.totalValuta || 0 : intr.total || 0).toFixed(2)}{mode === "valuta" ? ` ${intr.valuta}` : ""}</td>
                    {mode === "valuta" && <td className="px-4 py-2.5 text-right tabular-nums text-[#6e6e73] dark:text-[#98989d]">{Number(intr.total || 0).toFixed(2)} RON</td>}
                    <td className="px-4 py-2.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                        intr.status === "validat" ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300" :
                        intr.status === "stornat" ? "bg-rose-500/10 text-rose-700 dark:bg-rose-500/18 dark:text-rose-300" :
                        "bg-amber-500/12 text-amber-700 dark:bg-amber-500/18 dark:text-amber-300"
                      }`}>{intr.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <ConfirmDeleteWrapper onConfirm={() => deleteMut.mutate({ id: intr.id })} title="Ștergi intrarea?">
                        {(openModal) => (
                          <button type="button" onClick={(e) => { e.stopPropagation(); openModal(); }} className="p-1.5 text-[#8e8e93] hover:text-rose-500 hover:bg-rose-500/10 rounded-full transition-colors cursor-pointer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </ConfirmDeleteWrapper>
                    </td>
                  </tr>

                  {/* Expandable Details Row */}
                  {selectedIntrareId === intr.id && (
                    <tr className="bg-[#fafafa] dark:bg-white/[0.02]">
                      <td colSpan={mode === "valuta" ? 12 : 10} className="p-0">
                        <div className="p-4 pl-6 border-l-4 border-[#0071e3]">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="text-[12px] font-semibold text-[#6e6e73] dark:text-[#98989d]">
                              Linii document (detalii recepție)
                            </div>
                            {isLoadingDetails && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8e8e93]" />}
                          </div>

                          <div className="apple-surface overflow-hidden">
                            <table className="w-full text-[12.5px]">
                              <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
                                <tr>
                                  <th className="px-3 py-2.5 text-left font-medium text-[#6e6e73] dark:text-[#98989d]">Denumire articol</th>
                                  <th className="px-3 py-2.5 text-left font-medium text-[#6e6e73] dark:text-[#98989d]">Cod</th>
                                  <th className="px-3 py-2.5 text-left font-medium text-[#6e6e73] dark:text-[#98989d]">Tip / Cont</th>
                                  <th className="px-3 py-2.5 text-center font-medium text-[#6e6e73] dark:text-[#98989d]">U/M</th>
                                  <th className="px-3 py-2.5 text-right font-medium text-[#6e6e73] dark:text-[#98989d]">Cantitate</th>
                                  <th className="px-3 py-2.5 text-right font-medium text-[#6e6e73] dark:text-[#98989d]">Preț unitar</th>
                                  <th className="px-3 py-2.5 text-center font-medium text-[#6e6e73] dark:text-[#98989d]">TVA %</th>
                                  <th className="px-3 py-2.5 text-right font-medium text-[#6e6e73] dark:text-[#98989d]">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                                {intrareDetails?.lines && intrareDetails.lines.length > 0 ? (
                                  intrareDetails.lines.map((line: any) => (
                                    <tr key={line.id} className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035]">
                                      <td className="px-3 py-2 font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">{line.denumire}</td>
                                      <td className="px-3 py-2 tabular-nums text-[#6e6e73] dark:text-[#98989d]">{line.cod || "—"}</td>
                                      <td className="px-3 py-2 text-[#6e6e73] dark:text-[#98989d]">{line.tip || "—"} {line.cont ? `/ ${line.cont}` : ""}</td>
                                      <td className="px-3 py-2 text-center text-[#6e6e73] dark:text-[#98989d]">{line.um || "BUC"}</td>
                                      <td className="px-3 py-2 text-right tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">{Number(line.cantitate || 0).toFixed(2)}</td>
                                      <td className="px-3 py-2 text-right tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">{Number(line.pretUnitar || 0).toFixed(2)}</td>
                                      <td className="px-3 py-2 text-center tabular-nums text-[#6e6e73] dark:text-[#98989d]">{line.tvaPercent}%</td>
                                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                                        {Number(line.total || (Number(line.cantitate || 0) * Number(line.pretUnitar || 0) * (1 + Number(line.tvaPercent || 0)/100))).toFixed(2)}
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={8} className="px-3 py-6 text-center text-[#6e6e73] dark:text-[#98989d] italic">
                                      {!isLoadingDetails ? "Această intrare nu are nicio linie de produse înregistrată." : "Se încarcă liniile..."}
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {!isLoading && intrari.length === 0 && (
                <tr><td colSpan={mode === "valuta" ? 12 : 10} className="px-4 py-10 text-center text-[#6e6e73] dark:text-[#98989d]">Nicio intrare.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── COMENZI / PRODUCȚIE TAB ───────────────────────────────────────────────────
function ComenziTab() {
  const utils = trpc.useUtils();
  const { data: comenzi = [], isLoading } = trpc.saga.comenzi.list.useQuery();
  const createMut = trpc.saga.comenzi.create.useMutation({
    onSuccess: () => { utils.saga.comenzi.list.invalidate(); toast.success("Comandă creată"); setShowForm(false); },
    onError: (e) => toast.error(e.message || "Eroare la salvare."),
  });
  const deleteMut = trpc.saga.comenzi.delete.useMutation({
    onSuccess: () => { utils.saga.comenzi.list.invalidate(); toast.success("Comandă ștearsă"); },
    onError: (e) => toast.error(e.message || "Eroare la salvare."),
  });

  const [showForm, setShowForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({
    tipComanda: "Productie", data: new Date().toISOString().split("T")[0],
    denumireClient: "", dataLivrarii: "", notes: "",
  });

  return (
    <div className="space-y-4">
      <div className="apple-surface px-3 py-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="apple-btn-prominent inline-flex items-center gap-1.5 px-4 h-8 text-[12.5px] font-semibold cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Comandă nouă
        </button>
        <span className="ml-auto text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums pr-1">{comenzi.length} comenzi</span>
      </div>

      {showForm && (
        <div className="apple-surface p-4 sm:p-5 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <select value={form.tipComanda} onChange={e => setForm({...form, tipComanda: e.target.value})}
              className="px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none cursor-pointer">
              <option value="Productie">Producție</option>
              <option value="Comanda">Comandă client</option>
            </select>
            <input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})}
              className="px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none tabular-nums" />
            <input placeholder="Client" value={form.denumireClient} onChange={e => setForm({...form, denumireClient: e.target.value})}
              className="px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none" />
            <input type="date" placeholder="Data livrării" value={form.dataLivrarii} onChange={e => setForm({...form, dataLivrarii: e.target.value})}
              className="px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none tabular-nums" />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => createMut.mutate(form)}
              disabled={!form.data || createMut.isPending}
              className="apple-btn-prominent px-4 h-9 text-[12.5px] font-semibold disabled:opacity-50 cursor-pointer"
            >
              {createMut.isPending ? "Se creează..." : "Creează comandă"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="apple-btn-glass px-4 h-9 text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-medium cursor-pointer"
            >
              Anulează
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="apple-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
              <tr>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Nr.</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Tip</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Data</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Client</th>
                <th className="text-right px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Valoare</th>
                <th className="text-right px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Total</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Livrare</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06] text-[13px]">
              {isLoading && <tr><td colSpan={9} className="px-4 py-8 text-center text-[#6e6e73]"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>}
              {comenzi.map((cmd: any) => (
                <tr key={cmd.id} className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035]">
                  <td className="px-4 py-2.5 tabular-nums font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{cmd.nrComanda}</td>
                  <td className="px-4 py-2.5 text-[#6e6e73] dark:text-[#98989d]">{cmd.tipComanda}</td>
                  <td className="px-4 py-2.5 text-[#6e6e73] dark:text-[#98989d] tabular-nums">{cmd.data}</td>
                  <td className="px-4 py-2.5 text-[#1d1d1f] dark:text-[#f5f5f7] font-medium">{cmd.denumireClient || "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[#6e6e73] dark:text-[#98989d]">{Number(cmd.valoare || 0).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{Number(cmd.total || 0).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-[#6e6e73] dark:text-[#98989d] tabular-nums">{cmd.dataLivrarii || "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                      cmd.status === "facturat" ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300" :
                      cmd.status === "productie" ? "bg-amber-500/12 text-amber-700 dark:bg-amber-500/18 dark:text-amber-300" :
                      cmd.status === "livrat" ? "bg-[#0071e3]/10 text-[#0071e3] dark:bg-[#0a84ff]/18 dark:text-[#64d2ff]" :
                      "bg-[#f2f2f7] text-[#6e6e73] dark:bg-[#2c2c2e] dark:text-[#98989d]"
                    }`}>{cmd.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {confirmDeleteId === cmd.id ? (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            deleteMut.mutate({ id: cmd.id });
                            setConfirmDeleteId(null);
                          }}
                          className="h-7 px-2.5 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs font-medium cursor-pointer"
                        >
                          Șterge
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="apple-btn-glass h-7 px-2.5 text-[#1d1d1f] dark:text-[#f5f5f7] text-xs font-medium cursor-pointer"
                        >
                          Nu
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(cmd.id)}
                        className="w-8 h-8 inline-flex items-center justify-center text-[#8e8e93] hover:text-rose-600 hover:bg-rose-500/10 rounded-full transition-colors cursor-pointer"
                        title="Șterge comanda"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!isLoading && comenzi.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-[#6e6e73] dark:text-[#98989d]">Nicio comandă de producție.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── REȚETE TAB ────────────────────────────────────────────────────────────────
function ReteteTab() {
  const utils = trpc.useUtils();
  const { data: retete = [], isLoading } = trpc.saga.retete.list.useQuery();
  const { data: articles = [] } = trpc.saga.articles.list.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [recipeForm, setRecipeForm] = useState({
    denumire: "",
    articolProdusId: "",
    cantitateRezultata: "1",
    um: "buc",
  });

  const createRetetaMut = (trpc.saga.retete as any).create?.useMutation?.({
    onSuccess: () => {
      utils.saga.retete.list.invalidate();
      toast.success("Rețetă creată cu succes.");
      setShowForm(false);
      setRecipeForm({ denumire: "", articolProdusId: "", cantitateRezultata: "1", um: "buc" });
    },
    onError: (e: any) => toast.error(e?.message || "Eroare la salvare."),
  });

  const handleCreateRecipe = () => {
    if (!recipeForm.denumire.trim()) {
      toast.error("Introduceți denumirea rețetei.");
      return;
    }
    if (createRetetaMut?.mutate) {
      createRetetaMut.mutate({
        denumire: recipeForm.denumire.trim(),
        articolProdusId: recipeForm.articolProdusId ? Number(recipeForm.articolProdusId) : undefined,
        cantitateRezultata: recipeForm.cantitateRezultata,
        um: recipeForm.um || "buc",
      });
    } else {
      toast.info("Funcția de salvare rețetă nu este disponibilă pe acest profil.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="apple-surface px-3 py-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="apple-btn-prominent inline-flex items-center gap-1.5 h-8 px-4 text-[12.5px] font-semibold cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Rețetă nouă
        </button>
        <span className="ml-auto text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums pr-1">{retete.length} rețete</span>
      </div>

      {showForm && (
        <div className="apple-surface p-4 sm:p-5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              placeholder="Denumire rețetă *"
              value={recipeForm.denumire}
              onChange={(e) => setRecipeForm({ ...recipeForm, denumire: e.target.value })}
              className="px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none md:col-span-2"
            />
            <select
              value={recipeForm.articolProdusId}
              onChange={(e) => setRecipeForm({ ...recipeForm, articolProdusId: e.target.value })}
              className="px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none cursor-pointer"
            >
              <option value="">— Produs finit asociat —</option>
              {(articles as any[]).map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                placeholder="Cant."
                value={recipeForm.cantitateRezultata}
                onChange={(e) => setRecipeForm({ ...recipeForm, cantitateRezultata: e.target.value })}
                className="w-24 px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] tabular-nums bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
              />
              <input
                placeholder="U/M"
                value={recipeForm.um}
                onChange={(e) => setRecipeForm({ ...recipeForm, um: e.target.value })}
                className="flex-1 min-w-0 px-3 h-9 border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreateRecipe}
              disabled={!recipeForm.denumire.trim() || createRetetaMut?.isPending}
              className="apple-btn-prominent h-9 px-4 disabled:opacity-50 text-[12.5px] font-semibold cursor-pointer"
            >
              {createRetetaMut?.isPending ? "Se salvează..." : "Salvează rețeta"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="apple-btn-glass h-9 px-4 text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-medium cursor-pointer"
            >
              Anulează
            </button>
          </div>
        </div>
      )}

      <div className="apple-surface p-6">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#6e6e73]" /></div>
        ) : retete.length === 0 ? (
          <div className="text-center py-12">
            <Layers className="w-10 h-10 text-[#8e8e93] opacity-40 mx-auto mb-3" />
            <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">Nicio rețetă definită</h3>
            <p className="text-[13px] text-[#6e6e73] dark:text-[#98989d] mt-1">
              O rețetă (BOM) definește ce materii prime intră într-un produs finit.<br />
              Ex: Fereastră 120x140 = 4.8m profil PVC + 1.68mp sticlă + garnitură + feronerie
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {retete.map((r: any) => (
              <div key={r.id} className="bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.05] dark:border-white/[0.07] rounded-2xl p-4">
                <h4 className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{r.denumire}</h4>
                <p className="text-xs text-[#6e6e73] dark:text-[#98989d] mt-1 tabular-nums">Produs ID: {r.articolProdusId}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ARTICOLE CONTABILE TAB ────────────────────────────────────────────────────
function ArticoleContabileTab() {
  const { data: articole = [], isLoading } = trpc.saga.articoleContabile.list.useQuery();

  return (
    <div className="space-y-4">
      <div className="apple-surface px-4 py-3 flex items-center gap-2">
        <span className="text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
          Articole contabile generate automat din operații
        </span>
        <span className="ml-auto text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">{articole.length} înregistrări</span>
      </div>

      <div className="apple-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
              <tr>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Data</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Nr. doc</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Cont debit</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Cont credit</th>
                <th className="text-right px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Suma</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Explicație</th>
                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Tip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06] text-[13px]">
              {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-[#6e6e73]"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>}
              {articole.map((a: any) => (
                <tr key={a.id} className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035]">
                  <td className="px-4 py-2.5 text-[#6e6e73] dark:text-[#98989d] tabular-nums">{a.data}</td>
                  <td className="px-4 py-2.5 text-[#1d1d1f] dark:text-[#f5f5f7] font-medium">{a.nrDocument || "—"}</td>
                  <td className="px-4 py-2.5 tabular-nums font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{a.contDebit}</td>
                  <td className="px-4 py-2.5 tabular-nums font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{a.contCredit}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{Number(a.suma).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-[#6e6e73] dark:text-[#98989d] text-[12.5px] max-w-[200px] truncate">{a.explicatie || "—"}</td>
                  <td className="px-4 py-2.5 text-[#6e6e73] dark:text-[#98989d]">{a.tip || "—"}</td>
                </tr>
              ))}
              {!isLoading && articole.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-[#6e6e73] dark:text-[#98989d]">Niciun articol contabil. Se generează automat la validarea intrărilor/ieșirilor.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── SITUAȚIE STOCURI TAB ──────────────────────────────────────────────────────
function SituatieStocuriTab() {
  return (
    <div className="apple-surface p-8">
      <div className="text-center py-10">
        <BarChart3 className="w-10 h-10 text-[#8e8e93] opacity-40 mx-auto mb-3" />
        <h3 className="text-[16px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">Situație stocuri</h3>
        <p className="text-[13px] text-[#6e6e73] dark:text-[#98989d] mt-1">
          Stocul curent per gestiune per articol.<br />
          Calculat din: Intrări − Ieșiri − Consumuri producție.
        </p>
        <p className="text-[12px] text-[#0071e3] dark:text-[#64d2ff] mt-4">Se va popula automat după adăugarea intrărilor și comenzilor.</p>
      </div>
    </div>
  );
}

// ── FIȘE ARTICOLE TAB ─────────────────────────────────────────────────────────
function FiseArticoleTab() {
  return (
    <div className="apple-surface p-8">
      <div className="text-center py-10">
        <FileSpreadsheet className="w-10 h-10 text-[#8e8e93] opacity-40 mx-auto mb-3" />
        <h3 className="text-[16px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">Fișe articole</h3>
        <p className="text-[13px] text-[#6e6e73] dark:text-[#98989d] mt-1">
          Fișa de magazie per articol — toate mișcările: intrări, ieșiri, consumuri.
        </p>
      </div>
    </div>
  );
}

// ── REGISTRU INVENTAR TAB ─────────────────────────────────────────────────────
function RegistruInventarTab() {
  return (
    <div className="apple-surface p-8">
      <div className="text-center py-10">
        <ClipboardList className="w-10 h-10 text-[#8e8e93] opacity-40 mx-auto mb-3" />
        <h3 className="text-[16px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">Registru inventar</h3>
        <p className="text-[13px] text-[#6e6e73] dark:text-[#98989d] mt-1">
          Registru inventar la o dată specificată — lista completă a stocurilor.
        </p>
      </div>
    </div>
  );
}

