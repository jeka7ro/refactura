import { useState, useMemo, useRef, useEffect, Fragment } from "react";
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
  Factory,
  ShoppingCart,
  Layers,
  FileSpreadsheet,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ConfirmDeleteWrapper } from "@/components/ui/ConfirmModal";

// ── Types ─────────────────────────────────────────────────────────────────────
type SagaPage =
  | "articole" | "gestiuni" | "furnizori" | "planConturi"
  | "intrari" | "comenzi" | "retete"
  | "situatieStocuri" | "fiseArticole" | "registruInventar"
  | "articoleContabile"
  | "nomenclator" | "mapare" | "export" | "setari";

const SAGA_MENU = [
  {
    label: "Fișiere", items: [
      { id: "furnizori" as SagaPage, label: "Furnizori", icon: Users, shortcut: "ALT+1" },
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
  planConturi: "PLAN CONTURI",
  intrari: "INTRĂRI",
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
        onClick={() => setOpen(!open)}
        className={`px-3 py-1.5 text-sm font-medium rounded transition-colors flex items-center gap-1 ${
          open ? "bg-blue-600 text-white" : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        }`}
      >
        {label}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 min-w-[220px] py-1">
          {items.map((item, i) => (
            <button
              key={item.id}
              onClick={() => { onSelect(item.id); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                activePage === item.id
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <item.icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.shortcut && (
                <span className="text-xs text-slate-400">{item.shortcut}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SagaModule() {
  const [activePage, setActivePage] = useState<SagaPage>("articole");

  return (
    <div className="flex-1 w-full flex flex-col h-full">
      {/* SAGA Top Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4">
        <div className="flex items-center gap-1">
          {/* SAGA Logo */}
          <div className="flex items-center gap-2 pr-4 border-r border-slate-200 dark:border-slate-700 mr-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">S</span>
            </div>
            <span className="text-sm font-bold text-blue-700 dark:text-blue-400 hidden sm:block">SAGA</span>
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
        </div>
      </div>

      {/* Content Area with Vertical Label */}
      <div className="flex flex-1 overflow-hidden">
        {/* Vertical Page Label — SAGA style */}
        <div className="w-8 bg-blue-600 flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold tracking-widest whitespace-nowrap"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
            {PAGE_TITLES[activePage]}
          </span>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 lg:p-6 bg-slate-50 dark:bg-slate-950">
          <div className="max-w-7xl mx-auto">
            {activePage === "articole" && <NomenclatorTab />}
            {activePage === "nomenclator" && <NomenclatorTab />}
            {activePage === "gestiuni" && <GestiuniTab />}
            {activePage === "furnizori" && <FurnizoriTab />}
            {activePage === "planConturi" && <PlanConturiTab />}
            {activePage === "retete" && <ReteteTab />}
            {activePage === "intrari" && <IntrariTab />}
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
  const [pageSize, setPageSize] = useState(50);

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
    code: "", name: "", unit: "buc", vatRate: 19,
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
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Caută după cod, denumire sau categorie..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all dark:text-white"
          />
        </div>
        <button
          onClick={() => { setForm({ ...form, code: nextCode || "ART-0001" }); setShowAdd(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Adaugă Articol
        </button>
        <label className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer">
          <Upload className="w-4 h-4" />
          Import din SAGA
          <input type="file" accept=".xml,.csv,.txt,.dbf,.xlsx,.xls" className="hidden" onChange={handleFileImport} />
        </label>
      </div>

      {/* Add Dialog */}
      {showAdd && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-800/50 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Articol Nou</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Cod *</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-500 mb-1">Denumire *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">U/M</label>
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">TVA %</label>
              <select value={form.vatRate} onChange={(e) => setForm({ ...form, vatRate: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white">
                <option value={21}>21%</option>
                <option value={19}>19%</option>
                <option value={9}>9%</option>
                <option value={5}>5%</option>
                <option value={0}>0%</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Categorie</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Cont contabil</label>
              <select value={form.accountingAccount} onChange={(e) => setForm({ ...form, accountingAccount: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white">
                {planConturi.map((c: any) => <option key={c.cod} value={c.cod}>{c.cod} — {c.denumire}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => createMut.mutate(form)}
              disabled={!form.code || !form.name || createMut.isPending}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvează"}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm transition-colors">
              Anulează
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap table-auto min-w-[900px]">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="px-4 py-3">Nr.</th>
                <th className="px-4 py-3">Cod</th>
                <th className="px-4 py-3">Denumire</th>
                <th className="px-4 py-3 text-center">U/M</th>
                <th className="px-4 py-3 text-center">TVA</th>
                <th className="px-4 py-3">Categorie</th>
                <th className="px-4 py-3">Cont</th>
                <th className="px-4 py-3 text-center">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Se încarcă...</td></tr>
              ) : paginatedArticles.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  {search ? "Niciun rezultat" : "Niciun articol în nomenclator. Adaugă manual sau importă din SAGA."}
                </td></tr>
              ) : (
                paginatedArticles.map((art: any, i: number) => (
                  <tr key={art.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-slate-400">{(page - 1) * pageSize + i + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs text-emerald-700 dark:text-emerald-400 font-medium">{art.code}</td>
                    <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">{art.name}</td>
                    <td className="px-4 py-3 text-center text-slate-500">{art.unit}</td>
                    <td className="px-4 py-3 text-center text-slate-500">{Number(art.vatRate)}%</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        {art.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{art.accountingAccount}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <ConfirmDeleteWrapper onConfirm={() => deleteMut.mutate({ id: art.id })} title="Ștergi articolul?">
                          {(openModal) => (
                            <button
                              onClick={openModal}
                              className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <div>
                Rânduri pe pagină: 
                <select 
                  value={pageSize} 
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="ml-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                </select>
              </div>
              <span>
                Afișate {Math.min(filtered.length, (page - 1) * pageSize + 1)} - {Math.min(filtered.length, page * pageSize)} din {filtered.length} articole
              </span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
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
    <div className="space-y-6">
      {/* Unmapped Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
              Articole Nemapate ({unmapped.length})
            </h3>
          </div>
          <p className="text-xs text-slate-500">Produse din NIR-uri care nu au corespondent în nomenclator</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="px-4 py-3">Denumire pe Factură</th>
                <th className="px-4 py-3">Furnizor</th>
                <th className="px-4 py-3 text-center">U/M</th>
                <th className="px-4 py-3 text-center">Apariții</th>
                <th className="px-4 py-3">Asociază cu Articol</th>
                <th className="px-4 py-3 text-center">Acțiune</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {unmapped.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <Check className="w-6 h-6 text-green-500" />
                    <span>Toate articolele sunt mapate! 🎉</span>
                  </div>
                </td></tr>
              ) : (
                unmapped.map((item: any, i: number) => {
                  const key = item.description;
                  return (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-slate-900 dark:text-white font-medium max-w-[300px] truncate">
                        {item.description}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{item.supplierName || "—"}</td>
                      <td className="px-4 py-3 text-center text-slate-500">{item.unit}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          ×{item.count}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={selectedArticles[key] || ""}
                          onChange={(e) => setSelectedArticles({ ...selectedArticles, [key]: Number(e.target.value) })}
                          className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 dark:text-white"
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
                          onClick={() => {
                            if (!selectedArticles[key]) return toast.error("Selectează un articol!");
                            createMut.mutate({
                              sagaArticleId: selectedArticles[key],
                              externalName: item.description,
                              supplierCUI: item.supplierCUI || undefined,
                            });
                          }}
                          disabled={!selectedArticles[key] || createMut.isPending}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
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
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <Link2 className="w-4 h-4 text-emerald-500" />
            Mapări Existente ({mappings.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="px-4 py-3">Denumire Furnizor</th>
                <th className="px-4 py-3 text-center"><ArrowRight className="w-3 h-3 inline" /></th>
                <th className="px-4 py-3">Articol SAGA</th>
                <th className="px-4 py-3">CUI Furnizor</th>
                <th className="px-4 py-3 text-center">Acțiune</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {mappings.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Nicio mapare încă.</td></tr>
              ) : (
                mappings.map((m: any) => (
                  <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 max-w-[300px] truncate">{m.externalName}</td>
                    <td className="px-4 py-3 text-center text-emerald-500"><ArrowRight className="w-4 h-4 inline" /></td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-emerald-700 dark:text-emerald-400">{m.articleCode}</span>
                      <span className="ml-2 text-slate-600 dark:text-slate-400">{m.articleName}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{m.supplierCUI || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <ConfirmDeleteWrapper onConfirm={() => deleteMut.mutate({ id: m.id })} title="Ștergi maparea?">
                        {(openModal) => (
                          <button
                            onClick={openModal}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
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
      const blob = new Blob([data.xml], { type: "text/xml;charset=windows-1250" });
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
      const blob = new Blob([data.xml], { type: "text/xml;charset=windows-1250" });
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
      const blob = new Blob([data.xml], { type: "text/xml;charset=windows-1250" });
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

  const downloadZip = () => {
    window.location.href = `/api/saga-sync?month=${month}&year=${year}`;
  };

  const { data: history = [], refetch: refetchHistory } = trpc.saga.exportHistory.useQuery();

  return (
    <div className="space-y-6">
      {/* Canal Selector: Desktop vs Web */}
      <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveChannel("desktop")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm transition-all ${
            activeChannel === "desktop"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Download className="w-4 h-4" />
          <span>SAGA C (Desktop / Diverse &gt; Import date)</span>
        </button>
        <button
          onClick={() => setActiveChannel("web")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm transition-all ${
            activeChannel === "web"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>SAGA Web (Sincronizare Automată Cloud API)</span>
        </button>
      </div>

      {/* Selector Perioadă */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Selectează Perioada Documentelor
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Se exportă automat atât facturile emise (Ieșiri), cât și recepțiile furnizori (Intrări / NIR).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Luna
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 dark:text-white font-medium"
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Anul
              </label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 dark:text-white font-medium"
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
          <div className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Pachet ZIP Complet */}
              <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-1">
                    Recomandat SAGA C
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                    Pachet Arhivă ZIP
                  </h4>
                  <p className="text-xs text-slate-500 mb-4">
                    Conține fișierele sincronizate: Facturi (F_), Articole (ART_) și Clienți (CLI_).
                  </p>
                </div>
                <button
                  onClick={downloadZip}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descarcă Arhiva ZIP
                </button>
              </div>

              {/* Facturi XML */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Format &lt;Facturi&gt;
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                    Doar Facturi XML
                  </h4>
                  <p className="text-xs text-slate-500 mb-4">
                    Fișierul standardizat F_CUI_Luna_An.xml (Ieșiri vânzări + Intrări furnizori).
                  </p>
                </div>
                <button
                  onClick={() => exportFacturiMut.mutate({ month, year })}
                  disabled={exportFacturiMut.isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                >
                  {exportFacturiMut.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileText className="w-3.5 h-3.5" />
                  )}
                  Descarcă Facturi.xml
                </button>
              </div>

              {/* Nomenclator Articole */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Format &lt;Articole&gt;
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                    Articole (Nomenclator)
                  </h4>
                  <p className="text-xs text-slate-500 mb-4">
                    Fișierul ART_data.xml cu toate codurile de produs, UM și cote TVA.
                  </p>
                </div>
                <button
                  onClick={() => exportArticoleMut.mutate()}
                  disabled={exportArticoleMut.isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
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
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Format &lt;Clienti&gt;
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                    Clienți (Nomenclator)
                  </h4>
                  <p className="text-xs text-slate-500 mb-4">
                    Fișierul CLI_data.xml cu lista partenerilor, CUI, RegCom și adrese.
                  </p>
                </div>
                <button
                  onClick={() => exportClientiMut.mutate()}
                  disabled={exportClientiMut.isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
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

            {/* Ghid Import SAGA C Desktop */}
            <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                Cum imporți fișierele în SAGA C Desktop (clasic):
              </div>
              <ol className="list-decimal list-inside space-y-1 text-slate-700 dark:text-slate-300 pl-1">
                <li>Deschide aplicația <strong>SAGA C</strong> pe calculator.</li>
                <li>Mergi în meniul <strong>Diverse &gt; Import date</strong>.</li>
                <li>Alege tabul <strong>Import date din fișiere XML</strong>.</li>
                <li>Selectează fișierul XML sau ZIP descărcat de mai sus și apasă <strong>Validare</strong>.</li>
                <li>SAGA C va aloca automat facturile la <strong>Ieșiri</strong> (cele emise de tine) și la <strong>Intrări</strong> (achizițiile de la furnizori).</li>
              </ol>
            </div>
          </div>
        )}

        {/* CANALUL 2: SAGA WEB CLOUD API */}
        {activeChannel === "web" && (
          <div className="pt-6 space-y-6">
            {/* Box Configurare Credențiale */}
            <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Settings className="w-4 h-4 text-blue-600" />
                    Configurare Cheie API SAGA Web
                  </h4>
                  <p className="text-xs text-slate-500">
                    Cheia se generează în contul Saga Web din ecranul{" "}
                    <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-blue-700 dark:text-blue-300 font-mono">
                      Administrare &gt; Utilizatori &gt; Integrare API
                    </code>.
                  </p>
                </div>
                {!isEditingConfig ? (
                  <button
                    onClick={() => setIsEditingConfig(true)}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Modifică
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        saveConfigMut.mutate({
                          sagaWebToken: tokenInput,
                          sagaWebCui: cuiInput,
                        });
                      }}
                      disabled={saveConfigMut.isPending}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                    >
                      {saveConfigMut.isPending ? "Se salvează..." : "Salvează"}
                    </button>
                    <button
                      onClick={() => setIsEditingConfig(false)}
                      className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold"
                    >
                      Anulează
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Cod Fiscal Firmă (CUI SAGA)
                  </label>
                  <input
                    type="text"
                    value={cuiInput}
                    onChange={(e) => setCuiInput(e.target.value)}
                    disabled={!isEditingConfig}
                    placeholder="Ex: 42322117"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 dark:text-white font-mono disabled:opacity-75"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Cheie de Acces SAGA Web (Bearer Token)
                  </label>
                  <input
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    disabled={!isEditingConfig}
                    placeholder="Lipește aici tokenul generat din Saga Web..."
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 dark:text-white font-mono disabled:opacity-75"
                  />
                </div>
              </div>

              {tokenInput && (
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  Token configurat activ. Sincronizarea automată gestionează și salvarea noului token la fiecare rotație (X-Saga-Refresh-Token).
                </div>
              )}
            </div>

            {/* Buton Trimitere Directă */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={() =>
                  pushWebMut.mutate({
                    month,
                    year,
                    sagaToken: tokenInput,
                    sagaCui: cuiInput,
                  })
                }
                disabled={pushWebMut.isPending || !tokenInput}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-500/20 transition-all"
              >
                {pushWebMut.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Trimite Facturile în SAGA Web ({MONTHS[month - 1]} {year})
              </button>

              <p className="text-xs text-slate-500">
                După trimitere, fișierele apar imediat în Saga Web în meniul{" "}
                <strong>Diverse &gt; Import Date</strong>.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Istoric Exporturi */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            Istoric Operațiuni SAGA
          </h3>
          <span className="text-xs text-slate-400">{history.length} înregistrări</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="px-5 py-3">Nr.</th>
                <th className="px-5 py-3">Perioadă</th>
                <th className="px-5 py-3 text-center">Data Procesare</th>
                <th className="px-5 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-center text-slate-500">
                    Nicio operațiune de export înregistrată încă.
                  </td>
                </tr>
              ) : (
                history.map((h: any, i: number) => (
                  <tr key={h.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-5 py-3 text-slate-400 font-mono text-xs">{i + 1}</td>
                    <td className="px-5 py-3 text-slate-900 dark:text-white font-medium">
                      {MONTHS[h.month - 1]} {h.year}
                    </td>
                    <td className="px-5 py-3 text-center text-slate-500 text-xs">
                      {new Date(h.createdAt).toLocaleString("ro-RO")}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
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
  const { data: planConturi = [] } = trpc.saga.planConturi.useQuery({ stockOnly: true });
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
        <Settings className="w-4 h-4 text-slate-400" />
        Setări Modul SAGA
      </h3>

      <div className="space-y-6 max-w-lg">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Prefix cod articol
          </label>
          <input
            type="text"
            defaultValue="ART-"
            className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 dark:text-white"
          />
          <p className="text-xs text-slate-500 mt-1">
            Prefixul folosit la generarea automată a codurilor (ex: ART-0001)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Gestiune implicită
          </label>
          <input
            type="text"
            defaultValue="Gestiune principală"
            className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Cont contabil implicit
          </label>
          <select
            defaultValue="371"
            className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 dark:text-white"
          >
            {planConturi.map((c: any) => (
              <option key={c.cod} value={c.cod}>{c.cod} — {c.denumire}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Cotă TVA implicită
          </label>
          <select
            defaultValue="19"
            className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 dark:text-white"
          >
            <option value="21">21%</option>
            <option value="19">19%</option>
            <option value="9">9%</option>
            <option value="5">5%</option>
            <option value="0">0%</option>
          </select>
        </div>

        <div className="pt-2">
          <button
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Salvează Setări
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
  });
  const deleteMut = trpc.saga.gestiuni.delete.useMutation({
    onSuccess: () => { utils.saga.gestiuni.list.invalidate(); toast.success("Gestiune ștearsă"); },
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    cod: "", denumire: "", tipGestiune: "cantitativ-valorica", gestionar: "",
    analitic371: "", analitic607: "", analitic707: "", tvaImplicit: "19.00",
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Adaug
        </button>
        <span className="ml-auto text-xs text-slate-500">{gestiuni.length} gestiuni</span>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-blue-200 dark:border-blue-800 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input placeholder="Cod *" value={form.cod} onChange={e => setForm({...form, cod: e.target.value})}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
            <input placeholder="Denumire *" value={form.denumire} onChange={e => setForm({...form, denumire: e.target.value})}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white col-span-2" />
            <select value={form.tipGestiune} onChange={e => setForm({...form, tipGestiune: e.target.value})}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
              <option value="cantitativ-valorica">Cantitativ-valorică</option>
              <option value="cantitativa">Cantitativă</option>
            </select>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input placeholder="Gestionar" value={form.gestionar} onChange={e => setForm({...form, gestionar: e.target.value})}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
            <input placeholder="Analitic 371" value={form.analitic371} onChange={e => setForm({...form, analitic371: e.target.value})}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
            <input placeholder="Analitic 607" value={form.analitic607} onChange={e => setForm({...form, analitic607: e.target.value})}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
            <input placeholder="Analitic 707" value={form.analitic707} onChange={e => setForm({...form, analitic707: e.target.value})}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => createMut.mutate(form)}
              disabled={!form.cod || !form.denumire || createMut.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50">
              {createMut.isPending ? "Se salvează..." : "Salvează"}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm">
              Anulează
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Cod</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Denumire</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Tip</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Gestionar</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">371</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">607</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">707</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>}
            {gestiuni.map((g: any) => (
              <tr key={g.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="px-4 py-2 font-mono text-blue-600">{g.cod}</td>
                <td className="px-4 py-2 text-slate-900 dark:text-white">{g.denumire}</td>
                <td className="px-4 py-2 text-slate-500">{g.tipGestiune}</td>
                <td className="px-4 py-2 text-slate-500">{g.gestionar || "—"}</td>
                <td className="px-4 py-2 text-slate-500 font-mono text-xs">{g.analitic371 || "—"}</td>
                <td className="px-4 py-2 text-slate-500 font-mono text-xs">{g.analitic607 || "—"}</td>
                <td className="px-4 py-2 text-slate-500 font-mono text-xs">{g.analitic707 || "—"}</td>
                <td className="px-4 py-2">
                  <ConfirmDeleteWrapper onConfirm={() => deleteMut.mutate({ id: g.id })} title="Ștergi gestiunea?">
                    {(openModal) => (
                      <button onClick={openModal} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </ConfirmDeleteWrapper>
                </td>
              </tr>
            ))}
            {!isLoading && gestiuni.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Nicio gestiune. Apasă „Adaug" pentru prima gestiune.</td></tr>
            )}
          </tbody>
        </table>
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
  });
  const deleteMut = trpc.saga.furnizori.delete.useMutation({
    onSuccess: () => { utils.saga.furnizori.list.invalidate(); toast.success("Furnizor șters"); },
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
      e.target.value = ""; // reset file input
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
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Adaugă
        </button>
        
        <label className={`flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium cursor-pointer transition-colors ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}>
          <Upload className="w-4 h-4" /> Import din SAGA
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFurnizoriImport} disabled={isImporting} />
        </label>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
              placeholder="Caută furnizor..."
              className="pl-8 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white w-48" />
          </div>
          <span className="text-xs text-slate-500">{filtered.length} furnizori</span>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-blue-200 dark:border-blue-800 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input placeholder="Cod *" value={form.cod} onChange={e => setForm({...form, cod: e.target.value})}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
            <input placeholder="Denumire *" value={form.denumire} onChange={e => setForm({...form, denumire: e.target.value})}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white col-span-2" />
            <input placeholder="CUI" value={form.cui} onChange={e => setForm({...form, cui: e.target.value})}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input placeholder="Reg. Comerțului" value={form.regCom} onChange={e => setForm({...form, regCom: e.target.value})}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
            <input placeholder="Adresă" value={form.adresa} onChange={e => setForm({...form, adresa: e.target.value})}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white col-span-2" />
            <input placeholder="Telefon" value={form.telefon} onChange={e => setForm({...form, telefon: e.target.value})}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
            <input placeholder="Bancă" value={form.banca} onChange={e => setForm({...form, banca: e.target.value})}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
            <input placeholder="IBAN" value={form.contBanca} onChange={e => setForm({...form, contBanca: e.target.value})}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
            <input placeholder="Cont furnizor (401)" value={form.contFurnizor} onChange={e => setForm({...form, contFurnizor: e.target.value})}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => createMut.mutate(form)}
              disabled={!form.cod || !form.denumire || createMut.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50">
              {createMut.isPending ? "Se salvează..." : "Salvează"}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm">
              Anulează
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Cod</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Denumire</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">CUI</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Adresă</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Telefon</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Cont</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>}
            {filtered.map((f: any) => (
              <tr key={f.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="px-4 py-2 font-mono text-blue-600">{f.cod}</td>
                <td className="px-4 py-2 text-slate-900 dark:text-white font-medium">{f.denumire}</td>
                <td className="px-4 py-2 text-slate-500 font-mono">{f.cui || "—"}</td>
                <td className="px-4 py-2 text-slate-500 text-xs max-w-[200px] truncate">{f.adresa || "—"}</td>
                <td className="px-4 py-2 text-slate-500">{f.telefon || "—"}</td>
                <td className="px-4 py-2 text-slate-500 font-mono text-xs">{f.contFurnizor}</td>
                <td className="px-4 py-2">
                  <ConfirmDeleteWrapper onConfirm={() => deleteMut.mutate({ id: f.id })} title="Ștergi furnizorul?">
                    {(openModal) => (
                      <button onClick={openModal} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </ConfirmDeleteWrapper>
                </td>
              </tr>
            ))}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Niciun furnizor.</td></tr>
            )}
          </tbody>
        </table>
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
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
            placeholder="Caută cont (cod sau denumire)..."
            className="pl-8 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white w-full" />
        </div>
        <span className="text-xs text-slate-500">{conturi.length} conturi</span>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[600px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase w-24">Cod</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Denumire</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase w-16">Tip</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>}
            {conturi.map((c: any, i: number) => (
              <tr key={i} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="px-4 py-1.5 font-mono text-blue-600 text-xs">{c.cod}</td>
                <td className="px-4 py-1.5 text-slate-900 dark:text-white">{c.denumire}</td>
                <td className="px-4 py-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                    c.tip === "A" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
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
function IntrariTab() {
  const utils = trpc.useUtils();
  const { data: intrari = [], isLoading } = trpc.saga.intrari.list.useQuery();
  const createMut = trpc.saga.intrari.create.useMutation({
    onSuccess: () => { utils.saga.intrari.list.invalidate(); toast.success("Intrare creată"); setShowForm(false); },
  });
  const deleteMut = trpc.saga.intrari.delete.useMutation({
    onSuccess: () => { utils.saga.intrari.list.invalidate(); toast.success("Intrare ștearsă"); },
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
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Intrare nouă
        </button>
        <span className="ml-auto text-xs text-slate-500">{intrari.length} intrări</span>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-blue-200 dark:border-blue-800 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <select value={form.tip} onChange={e => setForm({...form, tip: e.target.value})}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
              <option value="Factura">Factură</option>
              <option value="Aviz">Aviz</option>
              <option value="Retur">Retur</option>
            </select>
            <input placeholder="Nr. document" value={form.nrDoc} onChange={e => setForm({...form, nrDoc: e.target.value})}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
            <input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
            <input type="date" placeholder="Scadență" value={form.scadent} onChange={e => setForm({...form, scadent: e.target.value})}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <input placeholder="Furnizor" value={form.numeFurnizor} onChange={e => setForm({...form, numeFurnizor: e.target.value})}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white col-span-2" />
            <input placeholder="CUI furnizor" value={form.cuiFurnizor} onChange={e => setForm({...form, cuiFurnizor: e.target.value})}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => createMut.mutate(form)}
              disabled={!form.data || createMut.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50">
              {createMut.isPending ? "Se creează..." : "Creează intrare"}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm">
              Anulează
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Nr.</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Tip</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Nr.Doc</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Data</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Furnizor</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Valoare</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">TVA</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Total</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Status</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>}
            {intrari.map((intr: any) => (
              <Fragment key={intr.id}>
                <tr
                  onClick={() => setSelectedIntrareId(selectedIntrareId === intr.id ? null : intr.id)}
                  className={`border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer ${
                    selectedIntrareId === intr.id ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
                  }`}
                >
                  <td className="px-4 py-2 font-mono text-blue-600">{intr.nrIntern}</td>
                  <td className="px-4 py-2 text-slate-500">{intr.tip}</td>
                  <td className="px-4 py-2 text-slate-900 dark:text-white font-medium">{intr.nrDoc || "—"}</td>
                  <td className="px-4 py-2 text-slate-500">{intr.data}</td>
                  <td className="px-4 py-2 text-slate-900 dark:text-white">{intr.numeFurnizor || "—"}</td>
                  <td className="px-4 py-2 text-right font-mono">{Number(intr.valoare || 0).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-mono text-slate-500">{Number(intr.tva || 0).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-mono font-bold text-slate-900 dark:text-white">{Number(intr.total || 0).toFixed(2)}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      intr.status === "validat" ? "bg-green-100 text-green-700" :
                      intr.status === "stornat" ? "bg-red-100 text-red-700" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>{intr.status}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <ConfirmDeleteWrapper onConfirm={() => deleteMut.mutate({ id: intr.id })} title="Ștergi intrarea?">
                      {(openModal) => (
                        <button onClick={(e) => { e.stopPropagation(); openModal(); }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </ConfirmDeleteWrapper>
                  </td>
                </tr>
                
                {/* Expandable Details Row */}
                {selectedIntrareId === intr.id && (
                  <tr className="bg-slate-50/80 dark:bg-slate-800/80 border-b-2 border-slate-200 dark:border-slate-700">
                    <td colSpan={10} className="p-0">
                      <div className="p-4 pl-8 border-l-4 border-blue-500 shadow-inner">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Linii document (Detalii Recepție)
                          </div>
                          {isLoadingDetails && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                        </div>
                        
                        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-slate-100 dark:bg-slate-800">
                              <tr>
                                <th className="px-3 py-2 text-left font-semibold text-slate-500">Denumire Articol</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-500">Cod</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-500">Tip / Cont</th>
                                <th className="px-3 py-2 text-center font-semibold text-slate-500">U/M</th>
                                <th className="px-3 py-2 text-right font-semibold text-slate-500">Cantitate</th>
                                <th className="px-3 py-2 text-right font-semibold text-slate-500">Preț Unitar</th>
                                <th className="px-3 py-2 text-center font-semibold text-slate-500">TVA %</th>
                                <th className="px-3 py-2 text-right font-semibold text-slate-500">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {intrareDetails?.lines && intrareDetails.lines.length > 0 ? (
                                intrareDetails.lines.map((line: any) => (
                                  <tr key={line.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <td className="px-3 py-2 font-medium">{line.denumire}</td>
                                    <td className="px-3 py-2 font-mono text-slate-500">{line.cod || "—"}</td>
                                    <td className="px-3 py-2 text-slate-500">{line.tip || "—"} {line.cont ? `/ ${line.cont}` : ""}</td>
                                    <td className="px-3 py-2 text-center">{line.um || "BUC"}</td>
                                    <td className="px-3 py-2 text-right font-mono">{Number(line.cantitate || 0).toFixed(2)}</td>
                                    <td className="px-3 py-2 text-right font-mono">{Number(line.pretUnitar || 0).toFixed(2)}</td>
                                    <td className="px-3 py-2 text-center font-mono">{line.tvaPercent}%</td>
                                    <td className="px-3 py-2 text-right font-mono font-semibold">
                                      {Number(line.total || (Number(line.cantitate || 0) * Number(line.pretUnitar || 0) * (1 + Number(line.tvaPercent || 0)/100))).toFixed(2)}
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={8} className="px-3 py-6 text-center text-slate-400 italic">
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
              <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">Nicio intrare.</td></tr>
            )}
          </tbody>
        </table>
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
  });
  const deleteMut = trpc.saga.comenzi.delete.useMutation({
    onSuccess: () => { utils.saga.comenzi.list.invalidate(); toast.success("Comandă ștearsă"); },
  });

  const [showForm, setShowForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({
    tipComanda: "Productie", data: new Date().toISOString().split("T")[0],
    denumireClient: "", dataLivrarii: "", notes: "",
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Comandă nouă
        </button>
        <span className="ml-auto text-xs text-slate-500">{comenzi.length} comenzi</span>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-blue-200 dark:border-blue-800 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <select value={form.tipComanda} onChange={e => setForm({...form, tipComanda: e.target.value})}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
              <option value="Productie">Producție</option>
              <option value="Comanda">Comandă client</option>
            </select>
            <input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
            <input placeholder="Client" value={form.denumireClient} onChange={e => setForm({...form, denumireClient: e.target.value})}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
            <input type="date" placeholder="Data livrării" value={form.dataLivrarii} onChange={e => setForm({...form, dataLivrarii: e.target.value})}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => createMut.mutate(form)}
              disabled={!form.data || createMut.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50">
              {createMut.isPending ? "Se creează..." : "Creează comandă"}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm">
              Anulează
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Nr.</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Tip</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Data</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Client</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Valoare</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Total</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Livrare</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Status</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>}
            {comenzi.map((cmd: any) => (
              <tr key={cmd.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="px-4 py-2 font-mono text-blue-600">{cmd.nrComanda}</td>
                <td className="px-4 py-2 text-slate-500">{cmd.tipComanda}</td>
                <td className="px-4 py-2 text-slate-500">{cmd.data}</td>
                <td className="px-4 py-2 text-slate-900 dark:text-white">{cmd.denumireClient || "—"}</td>
                <td className="px-4 py-2 text-right font-mono">{Number(cmd.valoare || 0).toFixed(2)}</td>
                <td className="px-4 py-2 text-right font-mono font-semibold">{Number(cmd.total || 0).toFixed(2)}</td>
                <td className="px-4 py-2 text-slate-500">{cmd.dataLivrarii || "—"}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    cmd.status === "facturat" ? "bg-green-100 text-green-700" :
                    cmd.status === "productie" ? "bg-orange-100 text-orange-700" :
                    cmd.status === "livrat" ? "bg-blue-100 text-blue-700" :
                    "bg-yellow-100 text-yellow-700"
                  }`}>{cmd.status}</span>
                </td>
                <td className="px-4 py-2 text-right">
                  {confirmDeleteId === cmd.id ? (
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => {
                          deleteMut.mutate({ id: cmd.id });
                          setConfirmDeleteId(null);
                        }}
                        className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                      >
                        Șterge
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-xs"
                      >
                        Nu
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(cmd.id)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded"
                      title="Șterge comanda"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!isLoading && comenzi.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">Nicio comandă de producție.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── REȚETE TAB ────────────────────────────────────────────────────────────────
function ReteteTab() {
  const { data: retete = [], isLoading } = trpc.saga.retete.list.useQuery();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Rețetă nouă
        </button>
        <span className="ml-auto text-xs text-slate-500">{retete.length} rețete</span>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : retete.length === 0 ? (
          <div className="text-center py-12">
            <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Nicio rețetă definită</h3>
            <p className="text-sm text-slate-400 mt-1">
              O rețetă (BOM) definește ce materii prime intră într-un produs finit.<br />
              Ex: Fereastră 120x140 = 4.8m profil PVC + 1.68mp sticlă + garnitură + feronerie
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {retete.map((r: any) => (
              <div key={r.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 dark:text-white">{r.denumire}</h4>
                <p className="text-xs text-slate-500 mt-1">Produs ID: {r.articolProdusId}</p>
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
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Articole contabile generate automat din operații
        </span>
        <span className="ml-auto text-xs text-slate-500">{articole.length} înregistrări</span>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Data</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Nr.Doc</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Cont Debit</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Cont Credit</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Suma</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Explicație</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Tip</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>}
            {articole.map((a: any) => (
              <tr key={a.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="px-4 py-2 text-slate-500">{a.data}</td>
                <td className="px-4 py-2 text-slate-900 dark:text-white">{a.nrDocument || "—"}</td>
                <td className="px-4 py-2 font-mono text-blue-600">{a.contDebit}</td>
                <td className="px-4 py-2 font-mono text-green-600">{a.contCredit}</td>
                <td className="px-4 py-2 text-right font-mono font-semibold">{Number(a.suma).toFixed(2)}</td>
                <td className="px-4 py-2 text-slate-500 text-xs max-w-[200px] truncate">{a.explicatie || "—"}</td>
                <td className="px-4 py-2 text-slate-500">{a.tip || "—"}</td>
              </tr>
            ))}
            {!isLoading && articole.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Niciun articol contabil. Se generează automat la validarea intrărilor/ieșirilor.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── SITUAȚIE STOCURI TAB ──────────────────────────────────────────────────────
function SituatieStocuriTab() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
      <div className="text-center py-12">
        <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Situație Stocuri</h3>
        <p className="text-sm text-slate-400 mt-1">
          Stocul curent per gestiune per articol.<br />
          Calculat din: Intrări − Ieșiri − Consumuri producție.
        </p>
        <p className="text-xs text-blue-500 mt-4">Se va popula automat după adăugarea intrărilor și comenzilor.</p>
      </div>
    </div>
  );
}

// ── FIȘE ARTICOLE TAB ─────────────────────────────────────────────────────────
function FiseArticoleTab() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
      <div className="text-center py-12">
        <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Fișe Articole</h3>
        <p className="text-sm text-slate-400 mt-1">
          Fișa de magazie per articol — toate mișcările: intrări, ieșiri, consumuri.
        </p>
      </div>
    </div>
  );
}

// ── REGISTRU INVENTAR TAB ─────────────────────────────────────────────────────
function RegistruInventarTab() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
      <div className="text-center py-12">
        <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Registru Inventar</h3>
        <p className="text-sm text-slate-400 mt-1">
          Registru inventar la o dată specificată — lista completă a stocurilor.
        </p>
      </div>
    </div>
  );
}

