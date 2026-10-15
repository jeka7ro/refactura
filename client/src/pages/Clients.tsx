import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableColumn } from "@/components/DataTable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Edit2,
  Trash2,
  Plus,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  Filter,
  Globe,
  Tag,
  FileSignature,
} from "lucide-react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { toast } from "sonner";

export default function Clients() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [mutationError, setMutationError] = useState("");
  const [filterType, setFilterType] = useState<"all" | "client" | "supplier">("all");
  const [filterRegime, setFilterRegime] = useState<"all" | "intern" | "extern">("all");

  const [formData, setFormData] = useState({
    name: "",
    cui: "",
    sagaCode: "",
    address: "",
    city: "",
    country: "",
    email: "",
    phone: "",
    currency: "RON",
    regCom: "",
    tva: false,
    isSupplier: 0,
  });

  // Fetch clients
  const {
    data: clients = [],
    isLoading,
    refetch,
  } = trpc.clients.list.useQuery();

  // Create mutation
  const createMutation = trpc.clients.create.useMutation({
    onSuccess: () => {
      refetch();
      setFormData({
        name: "",
        cui: "",
        sagaCode: "",
        address: "",
        city: "",
        country: "",
        email: "",
        phone: "",
        currency: "RON",
        regCom: "",
        tva: false,
        isSupplier: 0,
      });
      setShowForm(false);
      toast.success("Partener adăugat cu succes.");
    },
    onError: (err) => {
      setMutationError("Eroare creare: " + err.message);
    }
  });

  // Update mutation
  const updateMutation = trpc.clients.update.useMutation({
    onSuccess: () => {
      refetch();
      setFormData({
        name: "",
        cui: "",
        sagaCode: "",
        address: "",
        city: "",
        country: "",
        email: "",
        phone: "",
        currency: "RON",
        regCom: "",
        tva: false,
        isSupplier: 0,
      });
      setEditingId(null);
      setShowForm(false);
      toast.success("Partener actualizat cu succes.");
    },
    onError: (err) => {
      setMutationError("Eroare la actualizare: " + err.message);
    }
  });

  // Delete mutation
  const deleteMutation = trpc.clients.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Partener șters.");
    },
    onError: (err) => {
      toast.error("Eroare la ștergere: " + err.message);
    }
  });

  const handleEdit = (client: any) => {
    setFormData({
      name: client.name,
      cui: client.cui || "",
      sagaCode: client.sagaCode || "",
      address: client.address || "",
      city: client.city || "",
      country: client.country || "",
      email: client.email || "",
      phone: client.phone || "",
      currency: client.currency || "RON",
      regCom: client.regCom || "",
      tva: !!client.tva,
      isSupplier: client.isSupplier ?? 0,
    });
    setEditingId(client.id);
    setShowForm(true);
  };

  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const handleDelete = (id: number) => {
    setDeleteTarget(id);
  };

  // KPIs
  const counts = useMemo(() => {
    let total = clients.length;
    let suppliers = 0;
    let clientsCount = 0;
    let externals = 0;
    let internals = 0;

    for (const c of clients) {
      if (c.isSupplier === 1) suppliers++;
      else clientsCount++;

      const isExt =
        (c.currency || "").toUpperCase() === "EUR" ||
        (c.country && c.country.toUpperCase() !== "RO");
      if (isExt) externals++;
      else internals++;
    }

    return { total, suppliers, clientsCount, externals, internals };
  }, [clients]);

  // Processed and filtered partners
  const processedClients = useMemo(() => {
    return clients
      .map((c: any) => {
        const isExt =
          (c.currency || "").toUpperCase() === "EUR" ||
          (c.country && c.country.toUpperCase() !== "RO");
        return {
          ...c,
          regime: isExt ? "EXTERN" : "INTERN",
          typeLabel: c.isSupplier === 1 ? "FURNIZOR" : "CLIENT",
        };
      })
      .filter((c: any) => {
        if (filterType === "client" && c.isSupplier === 1) return false;
        if (filterType === "supplier" && c.isSupplier !== 1) return false;

        if (filterRegime === "intern" && c.regime !== "INTERN") return false;
        if (filterRegime === "extern" && c.regime !== "EXTERN") return false;

        return true;
      });
  }, [clients, filterType, filterRegime]);

  const columns: DataTableColumn<any>[] = [
    {
      key: "type",
      label: "TIP",
      sortable: true,
      render: (_: any, row: any) => (
        <div className="whitespace-nowrap">
          {row.isSupplier === 1 ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-bold uppercase tracking-wider">
              Furnizor
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] font-bold uppercase tracking-wider">
              Client
            </span>
          )}
        </div>
      ),
    },
    {
      key: "regime",
      label: "REGIM",
      sortable: true,
      render: (val: string) => (
        <div className="whitespace-nowrap">
          {val === "EXTERN" ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold uppercase tracking-wider">
              Extern
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-[10px] font-semibold uppercase tracking-wider">
              Intern
            </span>
          )}
        </div>
      ),
    },
    {
      key: "name",
      label: "NUME PARTENER",
      sortable: true,
      render: (val: string, row: any) => (
        <Link
          href={`/client/${row.id}`}
          className="font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
        >
          {val}
        </Link>
      ),
    },
    {
      key: "cui",
      label: "CUI / CIF",
      sortable: true,
      render: (val: string) =>
        val ? (
          <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">
            {val}
          </span>
        ) : (
          <span className="text-slate-400 text-xs">-</span>
        ),
    },
    {
      key: "sagaCode",
      label: "COD SAGA",
      sortable: true,
      render: (val: string) =>
        val ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-mono font-bold">
            {val}
          </span>
        ) : (
          <span className="text-slate-400 text-xs">-</span>
        ),
    },
    {
      key: "city",
      label: "ORAȘ",
      sortable: true,
      render: (val: string) => val || "-",
    },
    {
      key: "currency",
      label: "ȚARĂ / MONEDĂ",
      sortable: true,
      render: (_: any, row: any) => {
        const countryCode = (row.country || "RO").trim().toUpperCase();
        const flagCode = countryCode.toLowerCase();
        const currency = (row.currency || (countryCode === "RO" ? "RON" : "EUR")).trim().toUpperCase();
        const isEur = currency === "EUR";
        const symbol = isEur ? "€" : currency === "USD" ? "$" : currency === "GBP" ? "£" : "RON";

        return (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <div className="w-5 h-5 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xs shrink-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800">
              <img
                src={`https://flagcdn.com/w40/${flagCode}.png`}
                alt={countryCode}
                title={`Țară: ${countryCode}`}
                className="w-full h-full object-cover rounded-full"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                }}
              />
            </div>
            <span
              className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                isEur
                  ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
              }`}
            >
              {symbol}
            </span>
          </div>
        );
      },
    },
    {
      key: "phone",
      label: "TELEFON",
      sortable: true,
      render: (val: string) => val || "-",
    },
    {
      key: "email",
      label: "EMAIL",
      sortable: true,
      render: (val: string) => val || "-",
    },
  ];

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-3">
      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="Ștergere Partener"
        message="Această acțiune este ireversibilă. Ești sigur că vrei să ștergi acest partener?"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget !== null) deleteMutation.mutate({ id: deleteTarget });
          setDeleteTarget(null);
        }}
      />

      {/* Header + KPI — ascunse când formularul e deschis */}
      {!showForm && (
        <>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Parteneri (Clienți & Furnizori)
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Total: <strong>{counts.total}</strong> parteneri ({counts.clientsCount} clienți, {counts.suppliers} furnizori)
              </p>
            </div>
            <button
              onClick={() => {
                setEditingId(null);
                setFormData({
                  name: "",
                  cui: "",
                  sagaCode: "",
                  address: "",
                  city: "",
                  country: "",
                  email: "",
                  phone: "",
                  currency: "RON",
                  regCom: "",
                  tva: false,
                  isSupplier: 0,
                });
                setShowForm(true);
              }}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Partener nou
            </button>
          </div>

          {mutationError && !showForm && (
            <div className="p-3 mb-4 rounded bg-red-50 text-red-600 border border-red-200 text-sm">
              <AlertCircle className="w-4 h-4 inline mr-2" />
              {mutationError}
            </div>
          )}

          {/* KPI Cards (Grid uniform, rotunjite 2xl, interactive ca filtre exact ca pe Facturi) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4 pb-2">
            {/* TOTAL */}
            <div
              className={`bg-white dark:bg-slate-900 rounded-2xl border p-3 sm:p-4 flex items-center justify-between h-20 shadow-sm transition-all hover:shadow-md cursor-pointer ${
                filterType === "all" && filterRegime === "all"
                  ? "border-blue-500/60 ring-1 ring-blue-500/20"
                  : "border-slate-200 dark:border-slate-800"
              }`}
              onClick={() => {
                setFilterType("all");
                setFilterRegime("all");
              }}
            >
              <div>
                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 truncate">
                  Total Parteneri
                </p>
                <p className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white leading-none">
                  {counts.total}
                </p>
              </div>
            </div>

            {/* CLIENȚI */}
            <div
              className={`bg-white dark:bg-slate-900 rounded-2xl border p-3 sm:p-4 flex items-center justify-between h-20 shadow-sm transition-all hover:shadow-md cursor-pointer ${
                filterType === "client" && filterRegime === "all"
                  ? "border-blue-500/60 ring-1 ring-blue-500/20"
                  : "border-slate-200 dark:border-slate-800"
              }`}
              onClick={() => {
                setFilterType(filterType === "client" ? "all" : "client");
                setFilterRegime("all");
              }}
            >
              <div>
                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 truncate">
                  Clienți
                </p>
                <p className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 leading-none">
                  {counts.clientsCount}
                </p>
              </div>
            </div>

            {/* FURNIZORI */}
            <div
              className={`bg-white dark:bg-slate-900 rounded-2xl border p-3 sm:p-4 flex items-center justify-between h-20 shadow-sm transition-all hover:shadow-md cursor-pointer ${
                filterType === "supplier" && filterRegime === "all"
                  ? "border-amber-500/60 ring-1 ring-amber-500/20"
                  : "border-slate-200 dark:border-slate-800"
              }`}
              onClick={() => {
                setFilterType(filterType === "supplier" ? "all" : "supplier");
                setFilterRegime("all");
              }}
            >
              <div>
                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 truncate">
                  Furnizori
                </p>
                <p className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 leading-none">
                  {counts.suppliers}
                </p>
              </div>
            </div>

            {/* EXTERNI (EUR) */}
            <div
              className={`bg-white dark:bg-slate-900 rounded-2xl border p-3 sm:p-4 flex items-center justify-between h-20 shadow-sm transition-all hover:shadow-md cursor-pointer ${
                filterRegime === "extern"
                  ? "border-indigo-500/60 ring-1 ring-indigo-500/20"
                  : "border-slate-200 dark:border-slate-800"
              }`}
              onClick={() => {
                setFilterRegime(filterRegime === "extern" ? "all" : "extern");
                setFilterType("all");
              }}
            >
              <div>
                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 truncate">
                  Externi (EUR)
                </p>
                <p className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 leading-none">
                  {counts.externals}
                </p>
              </div>
            </div>

            {/* INTERNI (RON) */}
            <div
              className={`bg-white dark:bg-slate-900 rounded-2xl border p-3 sm:p-4 flex items-center justify-between h-20 shadow-sm transition-all hover:shadow-md cursor-pointer ${
                filterRegime === "intern"
                  ? "border-slate-500/60 ring-1 ring-slate-500/20"
                  : "border-slate-200 dark:border-slate-800"
              }`}
              onClick={() => {
                setFilterRegime(filterRegime === "intern" ? "all" : "intern");
                setFilterType("all");
              }}
            >
              <div>
                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 truncate">
                  Interni (RON)
                </p>
                <p className="text-xl sm:text-2xl font-black text-slate-700 dark:text-slate-300 leading-none">
                  {counts.internals}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Titlu compact când form e deschis */}
      {showForm && (
        <div className="flex items-center justify-between">
          <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
            {editingId ? "Editare Partener" : "Adăugare Partener Nou"}
          </h1>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="space-y-3">
          {mutationError && (
            <div className="p-3 rounded bg-red-50 text-red-600 border border-red-200 text-sm">
              <AlertCircle className="w-4 h-4 inline mr-2" />
              {mutationError}
            </div>
          )}
          <ClientForm
            key={editingId ?? "new"}
            editingId={editingId}
            initial={formData}
            onSubmit={data => {
              setMutationError("");
              if (editingId) {
                updateMutation.mutate({ id: editingId, ...data });
              } else {
                createMutation.mutate(data);
              }
            }}
            onCancel={() => {
              setShowForm(false);
              setEditingId(null);
              setMutationError("");
            }}
            isPending={createMutation.isPending || updateMutation.isPending}
          />
        </div>
      )}

      {/* Tabel */}
      {!showForm && (
        <DataTable
          columns={columns}
          data={processedClients}
          rowKey="id"
          isLoading={isLoading}
          headerContent={
            <div className="flex items-center gap-2 flex-wrap">
              {/* Filtru TIP: Client / Furnizor */}
              <div className="w-[155px] sm:w-[175px] flex-shrink-0">
                <Select
                  value={filterType}
                  onValueChange={val => setFilterType(val as any)}
                >
                  <SelectTrigger
                    className={`h-8 w-full rounded-full text-xs font-bold border ${
                      filterType !== "all"
                        ? "border-blue-500 bg-blue-50/70 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-700"
                        : "border-slate-200 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                    } hover:bg-slate-50 focus:ring-2 focus:ring-blue-500 shadow-none flex items-center gap-1.5 px-3`}
                  >
                    <Tag className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                    <SelectValue placeholder="Tip partener" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tip: Toți ({counts.total})</SelectItem>
                    <SelectItem value="client">Clienți ({counts.clientsCount})</SelectItem>
                    <SelectItem value="supplier">Furnizori ({counts.suppliers})</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtru REGIM: Intern / Extern */}
              <div className="w-[165px] sm:w-[190px] flex-shrink-0">
                <Select
                  value={filterRegime}
                  onValueChange={val => setFilterRegime(val as any)}
                >
                  <SelectTrigger
                    className={`h-8 w-full rounded-full text-xs font-bold border ${
                      filterRegime !== "all"
                        ? "border-indigo-500 bg-indigo-50/70 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-700"
                        : "border-slate-200 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                    } hover:bg-slate-50 focus:ring-2 focus:ring-indigo-500 shadow-none flex items-center gap-1.5 px-3`}
                  >
                    <Globe className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                    <SelectValue placeholder="Regim" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Regim: Toate ({counts.total})</SelectItem>
                    <SelectItem value="intern">Interni (RON - {counts.internals})</SelectItem>
                    <SelectItem value="extern">Externi (EUR - {counts.externals})</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reset buton */}
              {(filterType !== "all" || filterRegime !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterType("all");
                    setFilterRegime("all");
                  }}
                  className="h-8 px-2.5 rounded-full text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Resetează
                </button>
              )}
            </div>
          }
          actions={row => (
            <div className="flex gap-1 justify-end">
              <Link
                href={`/contracte/new?partnerId=${row.id}&mode=upload`}
                title="Încarcă contract semnat pentru acest partener"
                className="w-6 h-6 rounded border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 text-purple-700 dark:text-purple-300 transition-colors flex items-center justify-center"
              >
                <FileSignature className="w-3 h-3" />
              </Link>
              <Link
                href={`/client/${row.id}`}
                title="Vizualizare detalii partener"
                className="w-6 h-6 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors flex items-center justify-center"
              >
                <Eye className="w-3 h-3" />
              </Link>
              <button
                type="button"
                onClick={() => handleEdit(row)}
                title="Editare partener"
                className="w-6 h-6 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors flex items-center justify-center"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(row.id)}
                title="Ștergere partener"
                className="w-6 h-6 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors flex items-center justify-center"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        />
      )}
    </div>
  );
}

// ── Formular Partener cu ANAF auto-fill ──────────────────────────────
type ClientFormData = {
  name: string;
  cui: string;
  sagaCode?: string;
  address: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  currency: string;
  regCom: string;
  tva: boolean;
  isSupplier: number;
};

function ClientForm({
  editingId,
  initial,
  onSubmit,
  onCancel,
  isPending,
}: {
  editingId: number | null;
  initial: ClientFormData;
  onSubmit: (data: ClientFormData) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [data, setData] = useState<ClientFormData>({
    ...initial,
    sagaCode: initial.sagaCode || "",
    regCom: (initial as any).regCom || "",
    tva: (initial as any).tva ?? false,
    isSupplier: initial.isSupplier ?? 0,
  });
  const [cuiLoading, setCuiLoading] = useState(false);
  const [cuiError, setCuiError] = useState("");
  const [cuiFilled, setCuiFilled] = useState(false);

  const set = (k: keyof ClientFormData, v: any) =>
    setData(p => ({ ...p, [k]: v }));

  const lookupCui = async () => {
    const rawCui = data.cui.trim().replace(/\s/g, "");
    if (!rawCui || rawCui.length < 2) return;
    setCuiLoading(true);
    setCuiError("");
    setCuiFilled(false);
    try {
      const euMatch = rawCui.match(/^([A-Za-z]{2})(.*)$/);
      const isEuForeign = euMatch && euMatch[1].toUpperCase() !== "RO";

      if (isEuForeign) {
        const res = await fetch(`/api/vies/${encodeURIComponent(rawCui)}`);
        const d = await res.json().catch(() => ({}));
        if (!res.ok || !d.valid) {
          setCuiError(d.error || `Codul ${rawCui} nu a fost găsit în VIES.`);
          return;
        }
        setData(prev => ({
          ...prev,
          name: d.denumire || prev.name,
          address: d.adresa || prev.address,
          city: d.oras || prev.city,
          country: d.country || euMatch[1].toUpperCase(),
          cui: d.cui || rawCui.toUpperCase(),
          currency: "EUR",
          tva: true,
        }));
        setCuiFilled(true);
        toast.success(`Operator validat în VIES (${d.country}): ${d.denumire}`);
        return;
      }

      const cui = rawCui.replace(/^RO/i, "");
      const res = await fetch(`/api/anaf/${cui}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setCuiError(err.error || "CUI negăsit în ANAF.");
        return;
      }
      const d = await res.json();
      const resolvedCui = d.cif || d.cui || (d.tva ? `RO${cui}` : cui);
      setData(prev => ({
        ...prev,
        cui: resolvedCui,
        name: d.denumire || prev.name,
        address: d.adresa || prev.address,
        city: d.judet || prev.city,
        country: prev.country || "RO",
        regCom: d.nrRegCom || prev.regCom,
        tva: d.tva ? true : false,
      }));
      setCuiFilled(true);
    } catch {
      setCuiError("Eroare conexiune la server.");
    } finally {
      setCuiLoading(false);
    }
  };

  const inp =
    "w-full px-3 h-10 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all";
  const lbl =
    "block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5";

  return (
    <div className="p-6 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-5">
      <h3 className="text-base font-bold text-slate-900 dark:text-white">
        {editingId ? "Editează Partener" : "Partener Nou"}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tip Partener: Client vs Furnizor */}
        <div className="md:col-span-2">
          <label className={lbl}>Tip Partener</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => set("isSupplier", 0)}
              className={`h-10 px-3 rounded-lg border text-xs font-bold uppercase tracking-wider transition-all ${
                data.isSupplier === 0
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 shadow-sm"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              Client (Vânzări / Facturi)
            </button>
            <button
              type="button"
              onClick={() => set("isSupplier", 1)}
              className={`h-10 px-3 rounded-lg border text-xs font-bold uppercase tracking-wider transition-all ${
                data.isSupplier === 1
                  ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 shadow-sm"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              Furnizor (Achiziții / NIR)
            </button>
          </div>
        </div>

        {/* CUI cu auto-fill */}
        <div>
          <label className={lbl}>CUI / CIF</label>
          <div className="flex gap-2">
            <input
              className={inp + " flex-1 font-mono"}
              placeholder="CIF / CUI"
              value={data.cui}
              onChange={e => {
                set("cui", e.target.value);
                setCuiError("");
                setCuiFilled(false);
              }}
              onKeyDown={e =>
                e.key === "Enter" && (e.preventDefault(), lookupCui())
              }
            />
            <button
              type="button"
              onClick={lookupCui}
              disabled={cuiLoading || !data.cui}
              className="flex items-center gap-1.5 px-3 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition-colors flex-shrink-0"
            >
              {cuiLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              {cuiLoading ? "Caută..." : "Auto-fill"}
            </button>
          </div>
          {cuiError && (
            <div className="flex items-center gap-1 mt-1.5 text-xs text-red-500">
              <AlertCircle className="w-3 h-3" /> {cuiError}
            </div>
          )}
          {cuiFilled && (
            <div className="flex items-center gap-1 mt-1.5 text-xs text-green-600">
              <CheckCircle2 className="w-3 h-3" /> Date completate automat
            </div>
          )}
        </div>

        {/* Nume */}
        <div>
          <label className={lbl}>Denumire firmă / Nume *</label>
          <input
            className={inp}
            placeholder="Denumire partener"
            required
            value={data.name}
            onChange={e => set("name", e.target.value)}
          />
        </div>

        {/* Cod SAGA + Reg. Com. */}
        <div>
          <label className={lbl}>Cod SAGA (Partener)</label>
          <input
            className={inp + " font-mono"}
            placeholder="ex: 00001 sau 01209"
            value={data.sagaCode || ""}
            onChange={e => set("sagaCode", e.target.value)}
          />
        </div>
        <div>
          <label className={lbl}>Nr. Reg. Comerț (J..)</label>
          <input
            className={inp}
            placeholder="Nr. Reg. Comerț"
            value={data.regCom}
            onChange={e => set("regCom", e.target.value)}
          />
        </div>

        {/* Status TVA */}
        <div className="md:col-span-2">
          <label className={lbl}>Status TVA</label>
          <button
            type="button"
            onClick={() => setData(p => ({ ...p, tva: !p.tva }))}
            className={`w-full h-10 px-3 rounded-lg border text-sm font-semibold flex items-center gap-2 transition-all ${
              data.tva
                ? "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-400"
                : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${data.tva ? "bg-green-500" : "bg-slate-400"}`}
            />
            {data.tva ? "Plătitor TVA" : "Neplătitor TVA"}
          </button>
        </div>

        {/* Adresă */}
        <div className="md:col-span-2">
          <label className={lbl}>Adresă</label>
          <input
            className={inp}
            placeholder="Str. Exemplu nr. 1"
            value={data.address}
            onChange={e => set("address", e.target.value)}
          />
        </div>

        {/* Oraș + Țară + Monedă */}
        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={lbl}>Județ / Oraș</label>
            <input
              className={inp}
              placeholder="București"
              value={data.city}
              onChange={e => set("city", e.target.value)}
            />
          </div>
          <div>
            <label className={lbl}>Țară</label>
            <input
              className={inp}
              placeholder="România"
              value={data.country}
              onChange={e => set("country", e.target.value)}
            />
          </div>
          <div>
            <label className={lbl}>Monedă (Regim)</label>
            <select
              className={inp}
              value={data.currency}
              onChange={e => set("currency", e.target.value)}
            >
              <option value="RON">RON — Intern (România)</option>
              <option value="EUR">EUR — Extern (Export / UE)</option>
              <option value="USD">USD — Extern (Valută)</option>
            </select>
          </div>
        </div>

        {/* Email + Telefon */}
        <div>
          <label className={lbl}>Email</label>
          <input
            className={inp}
            type="email"
            autoComplete="email"
            placeholder="office@firma.ro"
            value={data.email}
            onChange={e => set("email", e.target.value)}
          />
        </div>
        <div>
          <label className={lbl}>Telefon</label>
          <input
            className={inp}
            type="tel"
            autoComplete="tel"
            placeholder="+40 21 123 4567"
            value={data.phone}
            onChange={e => set("phone", e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-700">
        <Button type="button" variant="outline" onClick={onCancel}>
          Anulează
        </Button>
        <Button
          type="button"
          disabled={isPending || !data.name.trim()}
          onClick={() => onSubmit(data)}
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          {editingId ? "Actualizează partener" : "Adaugă partener"}
        </Button>
      </div>
    </div>
  );
}
