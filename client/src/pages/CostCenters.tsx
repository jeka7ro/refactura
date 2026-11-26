import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { DataTable, DataTableColumn } from "@/components/DataTable";
import { MapPin, Edit2, Trash2, Plus, FileText, X, CheckCircle2, Building2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


function SupplierAutocomplete({ 
  value, 
  onChange, 
  suppliers, 
  conditionType 
}: { 
  value: string; 
  onChange: (val: string, supplier?: any) => void; 
  suppliers: any[];
  conditionType: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(conditionType === "PICKER" ? "" : (value || ""));
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conditionType !== "PICKER") setSearch(value || "");
  }, [value, conditionType]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = search.trim() === ""
    ? suppliers.slice(0, 50)
    : suppliers.filter(s => {
        const term = search.toLowerCase();
        return s.supplierName?.toLowerCase().includes(term) || s.supplierCUI?.toLowerCase().includes(term);
      });

  const placeholder = conditionType === "PICKER"
    ? "Caută după Denumire sau CUI — selectează pentru auto-completare..."
    : conditionType === "SUPPLIER_CUI"
    ? "Cauta CUI sau Nume furnizor..."
    : "Cauta Nume furnizor sau CUI...";

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        type="text"
        className="apple-input flex h-10 w-full px-3.5 py-2 text-[16px] sm:text-[13.5px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93]"
        placeholder={placeholder}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          if (conditionType !== "PICKER") onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div className="apple-surface absolute z-[9999] w-full mt-1.5 shadow-xl max-h-64 overflow-auto divide-y divide-black/[0.045] dark:divide-white/[0.06]">
          {suppliers.length === 0 && (
            <div className="px-3.5 py-3 text-[12.5px] text-[#8e8e93] text-center">Nu s-au găsit furnizori în arhivă</div>
          )}
          {filtered.map((s, idx) => (
            <div
              key={idx}
              className="px-3.5 py-2.5 text-[13px] hover:bg-[#f5f5f7] dark:hover:bg-white/[0.05] cursor-pointer flex justify-between items-center gap-2 transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                if (conditionType === "PICKER") {
                  setSearch("");
                  onChange("", s);
                } else {
                  const finalValue = conditionType === "SUPPLIER_CUI" ? (s.supplierCUI || "") : (s.supplierName || "");
                  setSearch(finalValue);
                  onChange(finalValue, s);
                }
                setOpen(false);
              }}
            >
              <span className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7] truncate">{s.supplierName || "-"}</span>
              <span className="text-[#6e6e73] dark:text-[#98989d] text-[11.5px] tabular-nums bg-[#f2f2f7] dark:bg-[#2c2c2e] px-2 py-0.5 rounded-full shrink-0">CUI: {s.supplierCUI || "-"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CostCenters() {
  const [, navigate] = useLocation();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    cui: "",
    email: "",
    phone: "",
    city: "",
    country: "",
    categoryId: null as number | null,
  });

  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const EMPTY_RULE = { costCenterId: 0, conditionValue: "", matchName: "", addressKeyword: "", lineKeyword: "" };
  const [ruleFormData, setRuleFormData] = useState({ ...EMPTY_RULE });

  const [invoicesModal, setInvoicesModal] = useState<{ open: boolean; center: any | null }>({
    open: false,
    center: null,
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  // Fetch cost centers
  const {
    data: costCenters = [],
    isLoading,
    refetch,
  } = trpc.costCenters.list.useQuery();

  // Fetch rules
  const {
    data: rules = [],
    isLoading: isLoadingRules,
    refetch: refetchRules,
  } = trpc.costCenters.listRules.useQuery();

  // Fetch categories nomenclator
  const { data: categories = [], refetch: refetchCategories } = trpc.costCenters.listCategories.useQuery();
  const createCategoryMut = trpc.costCenters.createCategory.useMutation({
    onSuccess: () => {
      refetchCategories();
      toast.success("Categoria a fost adăugată.");
    },
    onError: e => toast.error("Eroare la adăugarea categoriei: " + e.message),
  });
  const deleteCategoryMut = trpc.costCenters.deleteCategory.useMutation({
    onSuccess: () => {
      refetchCategories();
      toast.success("Categoria a fost ștearsă.");
    },
    onError: e => toast.error("Eroare la ștergerea categoriei: " + e.message),
  });
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#6366f1");
  const [showCatPanel, setShowCatPanel] = useState(false);

  // Create mutation
  const createMutation = trpc.costCenters.create.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Centrul de cost a fost adăugat.");
      setFormData({
        name: "",
        address: "",
        cui: "",
        email: "",
        phone: "",
        city: "",
        country: "",
        categoryId: null,
      });
      setShowForm(false);
    },
    onError: e => toast.error("Eroare la adăugarea centrului: " + e.message),
  });

  // Update mutation
  const updateMutation = trpc.costCenters.update.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Centrul de cost a fost actualizat.");
      setFormData({
        name: "",
        address: "",
        cui: "",
        email: "",
        phone: "",
        city: "",
        country: "",
        categoryId: null,
      });
      setEditingId(null);
      setShowForm(false);
    },
    onError: e => toast.error("Eroare la actualizarea centrului: " + e.message),
  });

  // Delete mutation
  const deleteMutation = trpc.costCenters.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Centrul de cost a fost șters.");
    },
    onError: e => toast.error("Eroare la ștergerea centrului: " + e.message),
  });

  // Rule mutations
  const { data: uniqueSuppliers = [] } = trpc.costCenters.getUniqueSuppliers.useQuery();
  const { data: centerInvoices = [], isLoading: isLoadingCenterInvoices } = trpc.costCenters.getInvoicesByCostCenter.useQuery(
    { costCenterId: invoicesModal.center?.id ?? 0 },
    { enabled: invoicesModal.open && !!invoicesModal.center }
  );

  const createRuleMutation = trpc.costCenters.createRule.useMutation({
    onSuccess: () => {
      refetchRules();
      toast.success("Regula de rutare a fost adăugată.");
      setRuleFormData({ ...EMPTY_RULE });
      setShowRuleForm(false);
    },
    onError: e => toast.error("Eroare la adăugarea regulii: " + e.message),
  });

  const updateRuleMutation = trpc.costCenters.updateRule.useMutation({
    onSuccess: () => {
      refetchRules();
      toast.success("Regula de rutare a fost actualizată.");
      setRuleFormData({ ...EMPTY_RULE });
      setEditingRuleId(null);
      setShowRuleForm(false);
    },
    onError: e => toast.error("Eroare la actualizarea regulii: " + e.message),
  });

  const deleteRuleMutation = trpc.costCenters.deleteRule.useMutation({
    onSuccess: () => {
      refetchRules();
      toast.success("Regula de rutare a fost ștearsă.");
    },
    onError: e => toast.error("Eroare la ștergerea regulii: " + e.message),
  });

  const recalculateMutation = trpc.costCenters.recalculateRules.useMutation({
    onSuccess: (data) => {
      toast.success(`S-au actualizat ${data.updated} facturi conform regulilor active.`);
      setConfirmDialog({
        isOpen: true,
        title: "Recalculare finalizată",
        description: `S-au actualizat ${data.updated} facturi conform regulilor active.`,
        onConfirm: () => {},
      });
      refetchRules();
    },
    onError: e => toast.error("Eroare la recalculare: " + e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleRuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleFormData.costCenterId) return;
    if (!ruleFormData.conditionValue.trim() && !ruleFormData.matchName.trim() && !ruleFormData.lineKeyword?.trim()) return;
    
    if (editingRuleId) {
      updateRuleMutation.mutate({ id: editingRuleId, ...ruleFormData });
    } else {
      createRuleMutation.mutate(ruleFormData);
    }
  };

  const handleRuleEdit = (rule: any) => {
    setRuleFormData({
      costCenterId: rule.costCenterId,
      conditionValue: rule.conditionValue || "",
      matchName: rule.matchName || "",
      addressKeyword: rule.addressKeyword || "",
      lineKeyword: rule.lineKeyword || "",
    });
    setEditingRuleId(rule.id);
    setShowRuleForm(true);
  };

  const handleEdit = (center: any) => {
    setFormData({
      name: center.name,
      address: center.address || "",
      cui: center.cui || "",
      email: center.email || "",
      phone: center.phone || "",
      city: center.city || "",
      country: center.country || "",
      categoryId: center.categoryId || null,
    });
    setEditingId(center.id);
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    setConfirmDialog({
      isOpen: true,
      title: "Ștergere Centru de Cost",
      description: "Sigur vrei să ștergi acest centru de cost? Această acțiune nu poate fi anulată.",
      onConfirm: () => {
        deleteMutation.mutate({ id });
      },
    });
  };

  const activeCount = costCenters.filter((c: any) => c.isActive).length;
  const citiesCount = new Set(costCenters.map((c: any) => c.city).filter(Boolean)).size;

  const columns: DataTableColumn<any>[] = [
    {
      key: "name",
      label: "Nume centru",
      sortable: true,
      render: (val: string) => (
        <span className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{val}</span>
      ),
    },
    {
      key: "city",
      label: "Oraș",
      sortable: true,
      render: (val: string) =>
        val ? (
          <span className="text-[#1d1d1f] dark:text-[#f5f5f7]">{val}</span>
        ) : (
          <span className="text-[#8e8e93]">—</span>
        ),
    },
    {
      key: "categoryId",
      label: "Categorie",
      sortable: true,
      render: (val: number) => {
        const cat = (categories as any[]).find((c) => c.id === val);
        if (!cat) return <span className="text-[#8e8e93] text-xs">—</span>;
        return (
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11.5px] font-medium text-white"
            style={{ backgroundColor: cat.color || "#6366f1" }}
          >
            {cat.name}
          </span>
        );
      },
    },
    {
      key: "address",
      label: "Adresă",
      sortable: true,
      render: (val: string) =>
        val ? (
          <span className="text-[#6e6e73] dark:text-[#98989d]">{val}</span>
        ) : (
          <span className="text-[#8e8e93]">—</span>
        ),
    },
    {
      key: "cui",
      label: "CUI",
      sortable: true,
      render: (val: string) =>
        val ? (
          <span className="tabular-nums text-[#6e6e73] dark:text-[#98989d]">{val}</span>
        ) : (
          <span className="text-[#8e8e93]">—</span>
        ),
    },
    {
      key: "email",
      label: "Email",
      sortable: true,
      render: (val: string) =>
        val ? (
          <span className="text-[#6e6e73] dark:text-[#98989d]">{val}</span>
        ) : (
          <span className="text-[#8e8e93]">—</span>
        ),
    },
    {
      key: "phone",
      label: "Telefon",
      sortable: true,
      render: (val: string) =>
        val ? (
          <span className="tabular-nums text-[#6e6e73] dark:text-[#98989d]">{val}</span>
        ) : (
          <span className="text-[#8e8e93]">—</span>
        ),
    },
  ];

  const ruleColumns: DataTableColumn<any>[] = [
    {
      key: "_index",
      label: "Nr. crt.",
      sortable: false,
      render: (val: number) => <span className="tabular-nums text-[#8e8e93]">{val}</span>,
    },
    {
      key: "conditionType",
      label: "Condiții active",
      sortable: false,
      render: (_val: any, row: any) => {
        const badges: { label: string; color: string }[] = [];
        if (row.conditionValue?.trim())
          badges.push({
            label: `CUI: ${row.conditionValue}`,
            color:
              "bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] border border-black/[0.06] dark:border-white/[0.08]",
          });
        if (row.matchName?.trim())
          badges.push({
            label: `Furnizor: ${row.matchName}`,
            color:
              "bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] border border-black/[0.06] dark:border-white/[0.08]",
          });
        if (row.addressKeyword?.trim())
          badges.push({
            label: `Adresă: ${row.addressKeyword}`,
            color: "bg-amber-500/12 text-amber-700 dark:text-amber-400 border border-amber-500/20",
          });
        if (row.lineKeyword?.trim())
          badges.push({
            label: `Linie: ${row.lineKeyword}`,
            color: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20",
          });
        if (badges.length === 0) return <span className="text-[#8e8e93] text-xs">—</span>;
        return (
          <div className="flex flex-wrap gap-1.5">
            {badges.map((b, i) => (
              <span key={i} className={`inline-block px-2.5 py-0.5 rounded-full text-[11.5px] font-medium tabular-nums ${b.color}`}>
                {b.label}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: "costCenterId",
      label: "Destinație",
      sortable: true,
      render: (val: any) => {
        const c = costCenters.find((x: any) => x.id === val);
        return <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{c ? c.name : val}</span>;
      },
    },
  ];

  const rulesDataWithIndex = rules.map((r: any, idx: number) => ({ ...r, _index: idx + 1 }));

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-4 overflow-x-hidden">
      <Tabs defaultValue="centers" className="w-full">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
          <TabsList className="h-9 p-1 rounded-full bg-[#e9e9ee] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06]">
            <TabsTrigger
              value="centers"
              className="rounded-full px-4 py-1 text-[12.5px] font-semibold text-[#6e6e73] dark:text-[#98989d] data-[state=active]:bg-[var(--tenant-theme-color,#007aff)] data-[state=active]:text-white data-[state=active]:shadow-xs transition-all"
            >
              Locații (Centre)
            </TabsTrigger>
            <TabsTrigger
              value="rules"
              className="rounded-full px-4 py-1 text-[12.5px] font-semibold text-[#6e6e73] dark:text-[#98989d] data-[state=active]:bg-[var(--tenant-theme-color,#007aff)] data-[state=active]:text-white data-[state=active]:shadow-xs transition-all"
            >
              Reguli de Rutare
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="centers" className="space-y-4 m-0">
          {/* Header */}
          <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
                Centre de Cost
              </h1>
              <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums">
                {costCenters.length} centre configurate · {activeCount} active
              </p>
            </div>
            <button
              onClick={() => {
                setEditingId(null);
                setFormData({
                  name: "",
                  address: "",
                  cui: "",
                  email: "",
                  phone: "",
                  city: "",
                  country: "",
                  categoryId: null,
                });
                setShowForm(!showForm);
              }}
              className="apple-btn-prominent flex items-center justify-center gap-1.5 h-9 px-4 rounded-full text-white text-[12.5px] font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              Adaugă Centru
            </button>
          </div>

          {/* KPI Cards Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                  Total centre de cost
                </span>
                <div className="w-7 h-7 rounded-[8px] bg-[#007aff]/10 dark:bg-[#0a84ff]/15 text-[#007aff] dark:text-[#0a84ff] flex items-center justify-center shrink-0">
                  <MapPin className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
                {costCenters.length}
              </div>
            </div>

            <div className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                  Centre active
                </span>
                <div className="w-7 h-7 rounded-[8px] bg-[#34c759]/12 dark:bg-[#30d158]/16 text-[#248a3d] dark:text-[#30d158] flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
                {activeCount}
              </div>
            </div>

            <div className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                  Orașe acoperite
                </span>
                <div className="w-7 h-7 rounded-[8px] bg-[#8e8e93]/12 dark:bg-white/[0.08] text-[#6e6e73] dark:text-[#98989d] flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
                {citiesCount}
              </div>
            </div>
          </div>

          {/* Form */}
          {showForm && (
            <div className="apple-surface p-5 sm:p-6 space-y-4">
              <h3 className="text-[16px] font-semibold tracking-[-0.015em] text-[#1d1d1f] dark:text-[#f5f5f7]">
                {editingId ? "Editează Centru" : "Adaugă Centru de Cost"}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <input
                    type="text"
                    placeholder="Nume Centru *"
                    value={formData.name}
                    onChange={e =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="apple-input w-full h-10 px-3.5 text-[16px] sm:text-[13.5px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93]"
                    autoComplete="organization"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Oraș"
                    value={formData.city}
                    onChange={e =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    className="apple-input w-full h-10 px-3.5 text-[16px] sm:text-[13.5px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93]"
                    autoComplete="address-level2"
                  />
                  <input
                    type="text"
                    placeholder="Adresă"
                    value={formData.address}
                    onChange={e =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    className="apple-input w-full h-10 px-3.5 text-[16px] sm:text-[13.5px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93]"
                    autoComplete="street-address"
                  />
                  <input
                    type="text"
                    placeholder="CUI"
                    value={formData.cui}
                    onChange={e =>
                      setFormData({ ...formData, cui: e.target.value })
                    }
                    className="apple-input w-full h-10 px-3.5 text-[16px] sm:text-[13.5px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] tabular-nums"
                    autoComplete="off"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={e =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="apple-input w-full h-10 px-3.5 text-[16px] sm:text-[13.5px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93]"
                    autoComplete="email"
                  />
                  <input
                    type="tel"
                    placeholder="Telefon"
                    value={formData.phone}
                    onChange={e =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="apple-input w-full h-10 px-3.5 text-[16px] sm:text-[13.5px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] tabular-nums"
                    autoComplete="tel"
                  />
                  {/* ── Categorie ─────────────────────────────── */}
                  <div className="space-y-2 md:col-span-2">
                    <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Categorie</label>
                    <div className="flex flex-wrap sm:flex-nowrap gap-2">
                      <select
                        value={formData.categoryId ?? ""}
                        onChange={e => setFormData({ ...formData, categoryId: e.target.value ? Number(e.target.value) : null })}
                        className="apple-input flex-1 min-w-0 h-10 px-3.5 text-[16px] sm:text-[13.5px] text-[#1d1d1f] dark:text-[#f5f5f7]"
                      >
                        <option value="">— Fără categorie —</option>
                        {(categories as any[]).map((cat: any) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowCatPanel(p => !p)}
                        className="apple-btn-glass flex items-center justify-center h-10 px-3.5 rounded-full text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] shrink-0"
                      >
                        {showCatPanel ? "Închide" : "+ Gestionează"}
                      </button>
                    </div>

                    {/* Categoria management — apare sub dropdown */}
                    {showCatPanel && (
                      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] overflow-hidden">
                        <div className="px-3.5 py-2.5 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center gap-2">
                          <span className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Nomenclator categorii</span>
                        </div>
                        {/* Existing categories */}
                        {(categories as any[]).length > 0 && (
                          <div className="px-3.5 py-2.5 flex flex-wrap gap-1.5 border-b border-black/[0.06] dark:border-white/[0.08]">
                            {(categories as any[]).map((cat: any) => (
                              <span
                                key={cat.id}
                                className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-0.5 rounded-full text-[11.5px] font-medium text-white"
                                style={{ backgroundColor: cat.color || "#6366f1" }}
                              >
                                {cat.name}
                                <button
                                  type="button"
                                  onClick={() => deleteCategoryMut.mutate({ id: cat.id })}
                                  className="w-4 h-4 rounded-full flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors leading-none text-xs"
                                  title="Șterge"
                                >×</button>
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Add new category */}
                        <div className="px-3.5 py-3 space-y-2.5">
                          <input
                            type="text"
                            placeholder="Denumire nouă (ex: Bar, Bucătărie, Curățenie)"
                            value={newCatName}
                            onChange={e => setNewCatName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter" && newCatName.trim()) {
                                e.preventDefault();
                                createCategoryMut.mutate({ name: newCatName.trim(), color: newCatColor });
                                setNewCatName("");
                              }
                            }}
                            className="apple-input w-full h-9 px-3 text-[16px] sm:text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93]"
                          />
                          {/* Color swatches */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[12px] text-[#6e6e73] dark:text-[#98989d] shrink-0">Culoare:</span>
                            <div className="flex gap-1.5 flex-wrap">
                              {["#6366f1","#0ea5e9","#10b981","#f59e0b","#ef4444","#ec4899","#8b5cf6","#06b6d4","#84cc16","#f97316"].map(color => (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() => setNewCatColor(color)}
                                  className="w-5 h-5 rounded-full transition-transform hover:scale-110 focus:outline-none"
                                  style={{
                                    backgroundColor: color,
                                    boxShadow: newCatColor === color ? `0 0 0 2px white, 0 0 0 3.5px ${color}` : "none",
                                    transform: newCatColor === color ? "scale(1.2)" : "scale(1)",
                                  }}
                                  title={color}
                                />
                              ))}
                            </div>
                            <button
                              type="button"
                              disabled={!newCatName.trim() || createCategoryMut.isPending}
                              onClick={() => {
                                if (newCatName.trim()) {
                                  createCategoryMut.mutate({ name: newCatName.trim(), color: newCatColor });
                                  setNewCatName("");
                                }
                              }}
                              className="apple-btn-prominent ml-auto h-8 px-3.5 text-[12px] font-semibold rounded-full text-white disabled:opacity-40"
                            >
                              {createCategoryMut.isPending ? "..." : "+ Adaugă"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    type="button"
                    className="apple-btn-glass h-9 px-4 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-semibold"
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                    }}
                  >
                    Anulează
                  </button>
                  <button
                    type="submit"
                    className="apple-btn-prominent h-9 px-4 rounded-full text-white text-[12.5px] font-semibold disabled:opacity-50"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {editingId ? "Actualizează" : "Adaugă"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Data Table */}
          <DataTable
            columns={columns}
            data={costCenters}
            rowKey="id"
            isLoading={isLoading}
            onRowClick={(row) => navigate(`/centre-cost/${row.id}`)}
            actions={row => (
              <div className="flex gap-1.5 justify-end">
                <button
                  onClick={() => setInvoicesModal({ open: true, center: row })}
                  className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white transition-colors"
                  title="Vezi Facturi"
                  aria-label="Vezi Facturi"
                >
                  <FileText className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleEdit(row)}
                  className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white transition-colors"
                  title="Editează"
                  aria-label="Editează"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(row.id)}
                  className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#6e6e73] dark:text-[#98989d] hover:text-[#ff3b30] dark:hover:text-[#ff453a] transition-colors"
                  title="Șterge"
                  aria-label="Șterge"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          />
        </TabsContent>

        <TabsContent value="rules" className="space-y-4 m-0">
          <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
                Reguli de Rutare SPV
              </h1>
              <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums">
                Total: {rules.length} reguli active de alocare automată
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  setConfirmDialog({
                    isOpen: true,
                    title: "Recalculare Facturi",
                    description: "Ești sigur că vrei să recalculezi facturile vechi pe baza regulilor actuale?",
                    onConfirm: () => {
                      recalculateMutation.mutate();
                    },
                  });
                }}
                disabled={recalculateMutation.isPending}
                className="apple-btn-glass flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-semibold disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${recalculateMutation.isPending ? "animate-spin" : ""}`} />
                Recalculează Facturile Vechi
              </button>
              <button
                onClick={() => {
                  setRuleFormData({ ...EMPTY_RULE });
                  setEditingRuleId(null);
                  setShowRuleForm(!showRuleForm);
                }}
                className="apple-btn-prominent flex items-center justify-center gap-1.5 h-9 px-4 rounded-full text-white text-[12.5px] font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                Adaugă Regulă
              </button>
            </div>
          </div>

          {showRuleForm && (
            <div className="apple-surface p-5 sm:p-6 space-y-4">
              <h3 className="text-[16px] font-semibold tracking-[-0.015em] text-[#1d1d1f] dark:text-[#f5f5f7]">
                {editingRuleId ? "Editează Regulă" : "Adaugă Regulă Nouă"}
              </h3>
              <form onSubmit={handleRuleSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1.5">
                    Caută furnizor din arhivă — selectează și se completează automat câmpurile de jos
                  </label>
                  <SupplierAutocomplete
                    value=""
                    onChange={(val: string, supplier?: any) => {
                      if (supplier) {
                        setRuleFormData({ ...ruleFormData, conditionValue: supplier.supplierCUI || "", matchName: supplier.supplierName || "" });
                      }
                    }}
                    suppliers={uniqueSuppliers}
                    conditionType="PICKER"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div>
                    <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1.5">CUI furnizor (opțional)</label>
                    <input
                      type="text"
                      placeholder="ex: RO12345678"
                      value={ruleFormData.conditionValue}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, conditionValue: e.target.value })}
                      className="apple-input flex h-10 w-full px-3.5 py-2 text-[16px] sm:text-[13.5px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1.5">Denumire furnizor (opțional)</label>
                    <input
                      type="text"
                      placeholder="ex: Orange, Metro"
                      value={ruleFormData.matchName}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, matchName: e.target.value })}
                      className="apple-input flex h-10 w-full px-3.5 py-2 text-[16px] sm:text-[13.5px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1.5">Punct de lucru / Localitate (opțional)</label>
                    <input
                      type="text"
                      placeholder="ex: Constanța, Militari"
                      value={ruleFormData.addressKeyword}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, addressKeyword: e.target.value })}
                      className="apple-input flex h-10 w-full px-3.5 py-2 text-[16px] sm:text-[13.5px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1.5">Cuvânt în liniile facturii (opțional)</label>
                    <input
                      type="text"
                      placeholder="ex: orez, sos, bere, curățenie"
                      value={(ruleFormData as any).lineKeyword || ""}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, lineKeyword: e.target.value } as any)}
                      className="apple-input flex h-10 w-full px-3.5 py-2 text-[16px] sm:text-[13.5px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93]"
                    />
                    <p className="text-[11px] text-[#8e8e93] mt-1">Se potrivește dacă cel puțin o linie din factură conține acest cuvânt.</p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1.5">Centru de cost destinație *</label>
                    <select
                      value={ruleFormData.costCenterId || ""}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, costCenterId: Number(e.target.value) })}
                      className="apple-input flex h-10 w-full px-3.5 py-2 text-[16px] sm:text-[13.5px] text-[#1d1d1f] dark:text-[#f5f5f7]"
                      required
                    >
                      <option value="" disabled>Selectează...</option>
                      {costCenters.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    className="apple-btn-glass h-9 px-4 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-semibold"
                    onClick={() => {
                      setShowRuleForm(false);
                      setEditingRuleId(null);
                      setRuleFormData({ ...EMPTY_RULE });
                    }}
                  >
                    Anulează
                  </button>
                  <button
                    type="submit"
                    className="apple-btn-prominent h-9 px-4 rounded-full text-white text-[12.5px] font-semibold disabled:opacity-50"
                    disabled={
                      createRuleMutation.isPending ||
                      updateRuleMutation.isPending ||
                      !ruleFormData.costCenterId ||
                      (!ruleFormData.conditionValue.trim() && !ruleFormData.matchName.trim() && !(ruleFormData as any).lineKeyword?.trim())
                    }
                  >
                    {editingRuleId ? "Actualizează" : "Adaugă Regulă"}
                  </button>
                </div>
              </form>
            </div>
          )}

          <DataTable
            columns={ruleColumns}
            data={rulesDataWithIndex}
            rowKey="id"
            isLoading={isLoadingRules}
            actions={row => (
              <div className="flex gap-1.5 justify-end">
                <button
                  onClick={() => handleRuleEdit(row)}
                  title="Editează regulă"
                  aria-label="Editează regulă"
                  className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    setConfirmDialog({
                      isOpen: true,
                      title: "Ștergere Regulă",
                      description: "Sigur vrei să ștergi această regulă?",
                      onConfirm: () => {
                        deleteRuleMutation.mutate({ id: row.id });
                      },
                    });
                  }}
                  title="Șterge regulă"
                  aria-label="Șterge regulă"
                  className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#6e6e73] dark:text-[#98989d] hover:text-[#ff3b30] dark:hover:text-[#ff453a] transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          />
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmDialog.isOpen} onOpenChange={(open) => !open && setConfirmDialog({ ...confirmDialog, isOpen: false })}>
        <AlertDialogContent className="apple-surface rounded-[22px] border border-black/[0.08] dark:border-white/[0.1]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#1d1d1f] dark:text-[#f5f5f7]">{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-[#6e6e73] dark:text-[#98989d]">{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Anulează</AlertDialogCancel>
            <AlertDialogAction className="apple-btn-prominent rounded-full text-white border-0" onClick={confirmDialog.onConfirm}>Confirmă</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invoices Modal for Cost Center */}
      {invoicesModal.open && invoicesModal.center && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm overscroll-contain p-0 sm:p-4"
          onClick={() => setInvoicesModal({ open: false, center: null })}
        >
          <div
            className="apple-surface w-full max-w-4xl max-h-[85vh] rounded-t-[22px] sm:rounded-[22px] shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-black/[0.05] dark:border-white/[0.07] bg-[#fafafa] dark:bg-white/[0.025]">
              <div className="min-w-0">
                <h2 className="text-[16px] font-semibold tracking-[-0.015em] text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-2 truncate">
                  <FileText className="w-4 h-4 text-[#6e6e73] dark:text-[#98989d] shrink-0" />
                  Facturi — {invoicesModal.center.name}
                </h2>
                <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums">
                  {isLoadingCenterInvoices ? "Se încarcă..." : `${centerInvoices.length} facturi alocate acestui centru`}
                </p>
              </div>
              <button
                onClick={() => setInvoicesModal({ open: false, center: null })}
                aria-label="Închide"
                className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-white transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Table */}
            <div className="overflow-auto flex-1 overscroll-contain">
              {isLoadingCenterInvoices ? (
                <div className="flex items-center justify-center py-16 text-[#8e8e93] text-[13px]">Se încarcă facturile...</div>
              ) : centerInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-[#8e8e93]">
                  <FileText className="w-10 h-10 opacity-30" />
                  <p className="text-[13.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">Nicio factură alocată acestui centru de cost.</p>
                  <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d]">Adaugă reguli de rutare și apasă „Recalculează Facturile Vechi".</p>
                </div>
              ) : (
                <table className="w-full text-[13px]">
                  <thead className="bg-[#fafafa] dark:bg-[#1c1c1e] sticky top-0 border-b border-black/[0.05] dark:border-white/[0.07]">
                    <tr>
                      <th className="px-4 py-3 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Nr.</th>
                      <th className="px-4 py-3 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Furnizor</th>
                      <th className="px-4 py-3 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">CUI</th>
                      <th className="px-4 py-3 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Nr. factură</th>
                      <th className="px-4 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Sumă</th>
                      <th className="px-4 py-3 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Dată</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                    {centerInvoices.map((inv: any, idx: number) => (
                      <tr key={inv.id} className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors">
                        <td className="px-4 py-3 tabular-nums text-[#8e8e93] text-[12.5px]">{idx + 1}</td>
                        <td className="px-4 py-3 font-medium text-[#1d1d1f] dark:text-[#f5f5f7] max-w-[200px] truncate">{inv.supplierName || "-"}</td>
                        <td className="px-4 py-3 tabular-nums text-[#6e6e73] dark:text-[#98989d] text-[12.5px]">{inv.supplierCUI || "-"}</td>
                        <td className="px-4 py-3 tabular-nums font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{inv.invoiceNumber}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                          {inv.total != null ? Number(inv.total).toLocaleString("ro-RO", { minimumFractionDigits: 2 }) : "-"}
                          <span className="text-[11.5px] text-[#8e8e93] ml-1">{inv.currency || "RON"}</span>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-[#6e6e73] dark:text-[#98989d] text-[12.5px]">{inv.issueDate ? String(inv.issueDate).slice(0, 10) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[#fafafa] dark:bg-[#1c1c1e] sticky bottom-0 border-t border-black/[0.06] dark:border-white/[0.08]">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-[12.5px] font-semibold text-[#6e6e73] dark:text-[#98989d] tabular-nums">
                        Total ({centerInvoices.length} facturi)
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {centerInvoices.reduce((sum: number, inv: any) => sum + (Number(inv.total) || 0), 0).toLocaleString("ro-RO", { minimumFractionDigits: 2 })}
                        <span className="text-[11.5px] text-[#8e8e93] ml-1">RON</span>
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
