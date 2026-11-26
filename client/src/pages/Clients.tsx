import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Link, useSearch } from "wouter";
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
  Globe,
  Tag,
  FileSignature,
  Users,
  Package,
  MapPin,
  X,
} from "lucide-react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { toast } from "sonner";

export default function Clients() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [mutationError, setMutationError] = useState("");
  const [filterType, setFilterType] = useState<"all" | "client" | "supplier">("all");
  const [filterRegime, setFilterRegime] = useState<"all" | "intern" | "extern">("all");
  const [filterCountry, setFilterCountry] = useState<string>("all");
  const searchString = useSearch();
  const urlSearch = useMemo(
    () => new URLSearchParams(searchString.replace(/^\?/, "")).get("search") || "",
    [searchString]
  );

  // Active tenant and switcher
  const utils = trpc.useUtils();
  const { data: currentTenant } = trpc.tenants.current.useQuery();
  const { data: tenantsList = [] } = trpc.tenants.list.useQuery();
  const switchTenantMutation = trpc.tenants.switchTenant.useMutation({
    onSuccess: (data) => {
      if (data?.token) {
        localStorage.setItem("authToken", data.token);
      }
      try {
        sessionStorage.clear();
      } catch {}
      toast.success("Compania activă a fost schimbată.");
      window.location.reload();
    },
    onError: (err) => {
      toast.error("Eroare schimbare companie: " + err.message);
    }
  });

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

  const COUNTRY_INFO: Record<string, { ro: string; keywords: string }> = {
    RO: { ro: "România", keywords: "romania ro" },
    HU: { ro: "Ungaria", keywords: "hungary magyarorszag ungaria hu" },
    FR: { ro: "Franța", keywords: "franta france fr" },
    NL: { ro: "Olanda", keywords: "netherlands nederland olanda nl" },
    DE: { ro: "Germania", keywords: "germany deutschland germania de" },
    BE: { ro: "Belgia", keywords: "belgium belgique belgia be" },
    IT: { ro: "Italia", keywords: "italy italia it" },
    MD: { ro: "Moldova", keywords: "republica moldova md" },
    GB: { ro: "Marea Britanie", keywords: "uk united kingdom england anglia gb" },
    PL: { ro: "Polonia", keywords: "poland polska polonia pl" },
    IE: { ro: "Irlanda", keywords: "ireland irlanda ie" },
    US: { ro: "Statele Unite", keywords: "sua usa united states us" },
    BG: { ro: "Bulgaria", keywords: "bulgaria bg" },
    LU: { ro: "Luxemburg", keywords: "luxembourg luxemburg lu" },
    AT: { ro: "Austria", keywords: "osterreich austria at" },
    GR: { ro: "Grecia", keywords: "greece grecia gr" },
    ES: { ro: "Spania", keywords: "spain espana spania es" },
    TR: { ro: "Turcia", keywords: "turkey turcia tr" },
    SI: { ro: "Slovenia", keywords: "slovenia si" },
    CN: { ro: "China", keywords: "china cn" },
    CZ: { ro: "Cehia", keywords: "czech czechia cehia cz" },
    SK: { ro: "Slovacia", keywords: "slovakia slovacia sk" },
    PT: { ro: "Portugalia", keywords: "portugal portugalia pt" },
    AM: { ro: "Armenia", keywords: "armenia am" },
    IL: { ro: "Israel", keywords: "israel il" },
    MU: { ro: "Mauritius", keywords: "mauritius mu" },
    NO: { ro: "Norvegia", keywords: "norway norvegia no" },
    EE: { ro: "Estonia", keywords: "estonia ee" },
    ML: { ro: "Mali", keywords: "mali ml" },
    HK: { ro: "Hong Kong", keywords: "hong kong hk" },
  };

  // Processed and filtered partners
  const processedClients = useMemo(() => {
    return clients
      .map((c: any) => {
        const countryCode = (c.country || "RO").trim().toUpperCase();
        const info = COUNTRY_INFO[countryCode] || { ro: countryCode, keywords: countryCode.toLowerCase() };
        const isExt =
          (c.currency || "").toUpperCase() === "EUR" ||
          countryCode !== "RO";
        return {
          ...c,
          country: countryCode,
          countryLabel: info.ro,
          countryName: `${info.ro} ${info.keywords}`,
          regime: isExt ? "EXTERN" : "INTERN",
          typeLabel: c.isSupplier === 1 ? "FURNIZOR" : "CLIENT",
        };
      })
      .filter((c: any) => {
        if (filterType === "client" && c.isSupplier === 1) return false;
        if (filterType === "supplier" && c.isSupplier !== 1) return false;

        if (filterRegime === "intern" && c.regime !== "INTERN") return false;
        if (filterRegime === "extern" && c.regime !== "EXTERN") return false;

        if (filterCountry !== "all" && c.country !== filterCountry) return false;

        return true;
      });
  }, [clients, filterType, filterRegime, filterCountry]);

  // Country counts
  const countryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of clients) {
      const code = (c.country || "RO").trim().toUpperCase();
      map.set(code, (map.get(code) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [clients]);

  const columns: DataTableColumn<any>[] = [
    {
      key: "type",
      label: "Tip",
      sortable: true,
      render: (_: any, row: any) => (
        <div className="whitespace-nowrap">
          {row.isSupplier === 1 ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-amber-500/12 text-amber-700 dark:bg-amber-500/18 dark:text-amber-300 text-[11px] font-medium leading-none">
              Furnizor
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300 text-[11px] font-medium leading-none">
              Client
            </span>
          )}
        </div>
      ),
    },
    {
      key: "regime",
      label: "Regim",
      sortable: true,
      render: (val: string) => (
        <div className="whitespace-nowrap">
          {val === "EXTERN" ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#0071e3]/10 text-[#0071e3] dark:bg-[#0a84ff]/18 dark:text-[#64d2ff] text-[11px] font-medium leading-none">
              Extern
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d] text-[11px] font-medium leading-none">
              Intern
            </span>
          )}
        </div>
      ),
    },
    {
      key: "name",
      label: "Nume partener",
      sortable: true,
      render: (val: string, row: any) => (
        <Link
          href={`/client/${row.id}`}
          className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] hover:underline whitespace-nowrap"
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
          <span className="tabular-nums text-[13px] text-[#1d1d1f] dark:text-[#ebebf5] font-medium">
            {val}
          </span>
        ) : (
          <span className="text-[#8e8e93] text-xs">—</span>
        ),
    },
    {
      key: "sagaCode",
      label: "Cod SAGA",
      sortable: true,
      render: (val: string) =>
        val ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#3a3a3c] dark:text-[#ebebf5] text-[11px] tabular-nums font-medium leading-none">
            {val}
          </span>
        ) : (
          <span className="text-[#8e8e93] text-xs">—</span>
        ),
    },
    {
      key: "city",
      label: "Oraș",
      sortable: true,
      render: (val: string) => (
        <span className="text-[13px] text-[#6e6e73] dark:text-[#98989d]">
          {val || "—"}
        </span>
      ),
    },
    {
      key: "currency",
      label: "Țară & Monedă",
      sortable: true,
      render: (_: any, row: any) => {
        const countryCode = (row.country || "RO").trim().toUpperCase();
        const flagCode = countryCode.toLowerCase();
        const currency = (row.currency || (countryCode === "RO" ? "RON" : "EUR")).trim().toUpperCase();
        const isEur = currency === "EUR";
        const symbol = isEur ? "€" : currency === "USD" ? "$" : currency === "GBP" ? "£" : "RON";

        return (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <div className="w-5 h-5 rounded-full overflow-hidden border border-black/[0.08] dark:border-white/[0.12] shrink-0 flex items-center justify-center bg-[#f2f2f7] dark:bg-[#2c2c2e]">
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
            <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#ebebf5] leading-none">
              {symbol}
            </span>
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-4 overflow-x-hidden">
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
          <div className="flex items-center justify-between gap-3 flex-wrap px-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
                  Parteneri
                </h1>
                <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums">
                  Clienți și furnizori ·{" "}
                  <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
                    {counts.total}
                  </strong>{" "}
                  parteneri ({counts.clientsCount} clienți, {counts.suppliers} furnizori)
                </p>
              </div>

              {tenantsList.length > 1 && (
                <Select
                  value={String(currentTenant?.id || 1)}
                  onValueChange={(val) =>
                    switchTenantMutation.mutate({ tenantId: Number(val) })
                  }
                >
                  <SelectTrigger className="apple-pill-control h-[34px] w-auto shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3">
                    <Building2 className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d] shrink-0" />
                    <SelectValue placeholder="Companie" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenantsList.map((t: any) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <button
              type="button"
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
              className="apple-btn-prominent flex items-center justify-center gap-1.5 px-4 h-9 rounded-full text-white text-[12.5px] font-semibold transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Partener nou</span>
            </button>
          </div>

          {mutationError && !showForm && (
            <div className="p-3 rounded-2xl bg-[#ff3b30]/10 text-[#ff3b30] dark:text-[#ff6961] border border-[#ff3b30]/25 text-sm">
              <AlertCircle className="w-4 h-4 inline mr-2" />
              {mutationError}
            </div>
          )}

          {/* KPI Cards — Clean Rectangular 16px Apple Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {/* TOTAL */}
            <div
              role="button"
              tabIndex={0}
              className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5 transition-all hover:shadow-[0_6px_20px_-6px_rgba(15,23,42,0.08)] cursor-pointer select-none"
              onClick={() => {
                setFilterType("all");
                setFilterRegime("all");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setFilterType("all");
                  setFilterRegime("all");
                }
              }}
            >
              <div className="flex items-center justify-between gap-2 w-full">
                <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                  Total parteneri
                </span>
                <span className="w-7 h-7 rounded-[8px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
                  <Users className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />
                </span>
              </div>
              <span className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
                {counts.total}
              </span>
            </div>

            {/* CLIENȚI */}
            <div
              role="button"
              tabIndex={0}
              className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5 transition-all hover:shadow-[0_6px_20px_-6px_rgba(15,23,42,0.08)] cursor-pointer select-none"
              onClick={() => {
                setFilterType(filterType === "client" ? "all" : "client");
                setFilterRegime("all");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setFilterType(filterType === "client" ? "all" : "client");
                  setFilterRegime("all");
                }
              }}
            >
              <div className="flex items-center justify-between gap-2 w-full">
                <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                  Clienți
                </span>
                <span className="w-7 h-7 rounded-[8px] bg-[#eefbf3] dark:bg-emerald-500/18 flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </span>
              </div>
              <span className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
                {counts.clientsCount}
              </span>
            </div>

            {/* FURNIZORI */}
            <div
              role="button"
              tabIndex={0}
              className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5 transition-all hover:shadow-[0_6px_20px_-6px_rgba(15,23,42,0.08)] cursor-pointer select-none"
              onClick={() => {
                setFilterType(filterType === "supplier" ? "all" : "supplier");
                setFilterRegime("all");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setFilterType(filterType === "supplier" ? "all" : "supplier");
                  setFilterRegime("all");
                }
              }}
            >
              <div className="flex items-center justify-between gap-2 w-full">
                <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                  Furnizori
                </span>
                <span className="w-7 h-7 rounded-[8px] bg-[#fff6eb] dark:bg-amber-500/18 flex items-center justify-center shrink-0">
                  <Package className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                </span>
              </div>
              <span className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
                {counts.suppliers}
              </span>
            </div>

            {/* EXTERNI (EUR) */}
            <div
              role="button"
              tabIndex={0}
              className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5 transition-all hover:shadow-[0_6px_20px_-6px_rgba(15,23,42,0.08)] cursor-pointer select-none"
              onClick={() => {
                setFilterRegime(filterRegime === "extern" ? "all" : "extern");
                setFilterType("all");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setFilterRegime(filterRegime === "extern" ? "all" : "extern");
                  setFilterType("all");
                }
              }}
            >
              <div className="flex items-center justify-between gap-2 w-full">
                <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                  Externi (EUR)
                </span>
                <span className="w-7 h-7 rounded-[8px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
                  <Globe className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />
                </span>
              </div>
              <span className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
                {counts.externals}
              </span>
            </div>

            {/* INTERNI (RON) */}
            <div
              role="button"
              tabIndex={0}
              className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5 transition-all hover:shadow-[0_6px_20px_-6px_rgba(15,23,42,0.08)] cursor-pointer select-none col-span-2 sm:col-span-1"
              onClick={() => {
                setFilterRegime(filterRegime === "intern" ? "all" : "intern");
                setFilterType("all");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setFilterRegime(filterRegime === "intern" ? "all" : "intern");
                  setFilterType("all");
                }
              }}
            >
              <div className="flex items-center justify-between gap-2 w-full">
                <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                  Interni (RON)
                </span>
                <span className="w-7 h-7 rounded-[8px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
                  <MapPin className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d]" />
                </span>
              </div>
              <span className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
                {counts.internals}
              </span>
            </div>
          </div>
        </>
      )}

      {/* Titlu compact când form e deschis */}
      {showForm && (
        <div className="flex items-center justify-between px-0.5">
          <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
            {editingId ? "Editare Partener" : "Adăugare Partener Nou"}
          </h1>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="space-y-3">
          {mutationError && (
            <div className="p-3 rounded-2xl bg-[#ff3b30]/10 text-[#ff3b30] dark:text-[#ff6961] border border-[#ff3b30]/25 text-sm">
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
          initialSearch={urlSearch}
          headerContent={
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Filtru TIP: Client / Furnizor */}
              <Select
                value={filterType}
                onValueChange={val => setFilterType(val as any)}
              >
                <SelectTrigger
                  data-filtered={filterType !== "all"}
                  className="apple-pill-control h-[34px] w-auto shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3"
                >
                  <Tag className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d] shrink-0" />
                  <SelectValue placeholder="Tip partener" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tip: Toți ({counts.total})</SelectItem>
                  <SelectItem value="client">Clienți ({counts.clientsCount})</SelectItem>
                  <SelectItem value="supplier">Furnizori ({counts.suppliers})</SelectItem>
                </SelectContent>
              </Select>

              {/* Filtru REGIM: Intern / Extern */}
              <Select
                value={filterRegime}
                onValueChange={val => setFilterRegime(val as any)}
              >
                <SelectTrigger
                  data-filtered={filterRegime !== "all"}
                  className="apple-pill-control h-[34px] w-auto shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3"
                >
                  <Globe className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d] shrink-0" />
                  <SelectValue placeholder="Regim" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Regim: Toate ({counts.total})</SelectItem>
                  <SelectItem value="intern">Interni (RON · {counts.internals})</SelectItem>
                  <SelectItem value="extern">Externi (EUR · {counts.externals})</SelectItem>
                </SelectContent>
              </Select>

              {/* Filtru ȚARĂ */}
              <Select
                value={filterCountry}
                onValueChange={val => setFilterCountry(val)}
              >
                <SelectTrigger
                  data-filtered={filterCountry !== "all"}
                  className="apple-pill-control h-[34px] w-auto shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3"
                >
                  <Globe className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d] shrink-0" />
                  <SelectValue placeholder="Țară" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">Toate țările ({counts.total})</SelectItem>
                  {countryCounts.map(([code, cnt]) => {
                    const flag = code.toLowerCase();
                    const name = COUNTRY_INFO[code]?.ro || code;
                    return (
                      <SelectItem key={code} value={code}>
                        <div className="flex items-center gap-2">
                          <img
                            src={`https://flagcdn.com/w20/${flag}.png`}
                            alt={code}
                            className="w-4 h-3 rounded-[2px] object-cover inline-block shrink-0"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = "none";
                            }}
                          />
                          <span>{name} ({cnt})</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {/* Reset buton */}
              {(filterType !== "all" || filterRegime !== "all" || filterCountry !== "all") && (
                <button
                  type="button"
                  title="Elimină filtrele"
                  aria-label="Elimină filtrele"
                  onClick={() => {
                    setFilterType("all");
                    setFilterRegime("all");
                    setFilterCountry("all");
                  }}
                  className="apple-pill-control w-[34px] h-[34px] shrink-0 flex items-center justify-center text-[#6e6e73] hover:text-[#1d1d1f] dark:text-[#98989d] dark:hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          }
          searchFields={[
            "country",
            "countryName",
            "cui",
            "sagaCode",
            "name",
            "city",
            "address",
            "phone",
            "email",
          ]}
          actions={row => (
            <div className="flex gap-1.5 justify-end">
              <Link
                href={`/contracte/new?partnerId=${row.id}&mode=upload`}
                title="Încarcă contract semnat pentru acest partener"
                aria-label="Încarcă contract semnat"
                className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white transition-all"
              >
                <FileSignature className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => handleEdit(row)}
                title="Editare partener"
                aria-label="Editare partener"
                className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white transition-all cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(row.id)}
                title="Ștergere partener"
                aria-label="Ștergere partener"
                className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#ff3b30] dark:hover:text-[#ff453a] transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
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
    "apple-input w-full px-3.5 h-10 text-[13.5px] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none";
  const lbl =
    "block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1.5";

  return (
    <div className="apple-surface p-5 sm:p-6 space-y-5">
      <h3 className="text-[16px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
        {editingId ? "Editează partener" : "Partener nou"}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tip Partener: Client vs Furnizor */}
        <div className="md:col-span-2">
          <label className={lbl}>Tip partener</label>
          <div className="apple-segmented w-full grid grid-cols-2">
            <button
              type="button"
              data-active={data.isSupplier === 0}
              onClick={() => set("isSupplier", 0)}
              className="apple-segmented-item !h-9 text-xs font-semibold"
            >
              Client (Vânzări / Facturi)
            </button>
            <button
              type="button"
              data-active={data.isSupplier === 1}
              onClick={() => set("isSupplier", 1)}
              className="apple-segmented-item !h-9 text-xs font-semibold"
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
              className={inp + " flex-1 tabular-nums"}
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
              className="apple-btn-prominent flex items-center gap-1.5 px-4 h-10 rounded-full disabled:opacity-50 text-white text-[12.5px] font-semibold shrink-0 cursor-pointer"
            >
              {cuiLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              <span>{cuiLoading ? "Caută..." : "Auto-fill"}</span>
            </button>
          </div>
          {cuiError && (
            <div className="flex items-center gap-1 mt-1.5 text-xs text-[#ff3b30] dark:text-[#ff453a]">
              <AlertCircle className="w-3 h-3" /> {cuiError}
            </div>
          )}
          {cuiFilled && (
            <div className="flex items-center gap-1 mt-1.5 text-xs text-emerald-600 dark:text-emerald-400">
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
          <label className={lbl}>Cod SAGA (partener)</label>
          <input
            className={inp + " tabular-nums"}
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
            className={`w-full h-10 px-4 rounded-full text-[13px] font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              data.tva
                ? "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300"
                : "bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d]"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${data.tva ? "bg-emerald-500" : "bg-[#8e8e93]"}`}
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
            <label className={lbl}>Monedă (regim)</label>
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

      <div className="flex gap-2 justify-end pt-3 border-t border-black/[0.06] dark:border-white/[0.08]">
        <button
          type="button"
          className="apple-btn-glass px-4 h-9 rounded-full text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
          onClick={onCancel}
        >
          Anulează
        </button>
        <button
          type="button"
          className="apple-btn-prominent flex items-center gap-1.5 px-5 h-9 rounded-full text-white text-[12.5px] font-semibold disabled:opacity-50 cursor-pointer"
          disabled={isPending || !data.name.trim()}
          onClick={() => onSubmit(data)}
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          <span>{editingId ? "Actualizează partener" : "Adaugă partener"}</span>
        </button>
      </div>
    </div>
  );
}
