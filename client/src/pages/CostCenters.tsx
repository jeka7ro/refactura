import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableColumn } from "@/components/DataTable";
import { MapPin, Edit2, Trash2, Plus, FileText, X } from "lucide-react";
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
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
        <div className="absolute z-[9999] w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-xl max-h-64 overflow-auto">
          {suppliers.length === 0 && (
            <div className="px-3 py-3 text-sm text-slate-400 text-center">Nu s-au gasit furnizori in arhiva</div>
          )}
          {filtered.map((s, idx) => (
            <div
              key={idx}
              className="px-3 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center gap-2 border-b border-slate-100 dark:border-slate-800 last:border-0"
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
              <span className="font-medium text-slate-900 dark:text-slate-100 truncate">{s.supplierName || "-"}</span>
              <span className="text-slate-500 dark:text-slate-400 text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded shrink-0">CUI: {s.supplierCUI || "-"}</span>
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
  const createCategoryMut = trpc.costCenters.createCategory.useMutation({ onSuccess: () => refetchCategories() });
  const deleteCategoryMut = trpc.costCenters.deleteCategory.useMutation({ onSuccess: () => refetchCategories() });
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#6366f1");
  const [showCatPanel, setShowCatPanel] = useState(false);

  // Create mutation
  const createMutation = trpc.costCenters.create.useMutation({
    onSuccess: () => {
      refetch();
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
  });

  // Update mutation
  const updateMutation = trpc.costCenters.update.useMutation({
    onSuccess: () => {
      refetch();
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
  });

  // Delete mutation
  const deleteMutation = trpc.costCenters.delete.useMutation({
    onSuccess: () => {
      refetch();
    },
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
      setRuleFormData({ ...EMPTY_RULE });
      setShowRuleForm(false);
    }
  });

  const updateRuleMutation = trpc.costCenters.updateRule.useMutation({
    onSuccess: () => {
      refetchRules();
      setRuleFormData({ ...EMPTY_RULE });
      setEditingRuleId(null);
      setShowRuleForm(false);
    }
  });

  const deleteRuleMutation = trpc.costCenters.deleteRule.useMutation({
    onSuccess: () => refetchRules()
  });

  const recalculateMutation = trpc.costCenters.recalculateRules.useMutation({
    onSuccess: (data) => {
      setConfirmDialog({
        isOpen: true,
        title: "Recalculare finalizată",
        description: `S-au actualizat ${data.updated} facturi conform regulilor active.`,
        onConfirm: () => {},
      });
      refetchRules();
    }
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

  const columns: DataTableColumn<any>[] = [
    {
      key: "name",
      label: "NUME CENTRU",
      sortable: true,
    },
    {
      key: "city",
      label: "ORAȘ",
      sortable: true,
      render: (val: string) => val ? <span className="text-slate-700 dark:text-slate-300">{val}</span> : <span className="text-slate-400">—</span>,
    },
    {
      key: "categoryId",
      label: "CATEGORIE",
      sortable: true,
      render: (val: number) => {
        const cat = (categories as any[]).find((c) => c.id === val);
        if (!cat) return <span className="text-slate-400 text-xs">—</span>;
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: cat.color || "#6366f1" }}>
            {cat.name}
          </span>
        );
      },
    },
    {
      key: "address",
      label: "ADRESĂ",
      sortable: true,
    },
    {
      key: "cui",
      label: "CUI",
      sortable: true,
    },
    {
      key: "email",
      label: "EMAIL",
      sortable: true,
    },
    {
      key: "phone",
      label: "TELEFON",
      sortable: true,
    },
  ];

  const ruleColumns: DataTableColumn<any>[] = [
    {
      key: "_index",
      label: "Nr. Crt.",
      sortable: false,
    },
    {
      key: "conditionType",
      label: "TIP CONDIȚIE",
      sortable: true,
      render: (val) => val === "SUPPLIER_CUI" ? "CUI Furnizor" : "Nume Furnizor",
    },
    {
      key: "conditionValue",
      label: "VALOARE",
      sortable: true,
    },
    {
      key: "addressKeyword",
      label: "ADRESĂ (OPȚIONAL)",
      sortable: true,
      render: (val) => val ? val : "-",
    },
    {
      key: "costCenterId",
      label: "DESTINAȚIE",
      sortable: true,
      render: (val) => {
        const c = costCenters.find((x: any) => x.id === val);
        return c ? c.name : val;
      }
    }
  ];

  const rulesDataWithIndex = rules.map((r: any, idx: number) => ({ ...r, _index: idx + 1 }));

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-3">
      <Tabs defaultValue="centers" className="w-full">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
          <TabsList>
            <TabsTrigger value="centers">Locații (Centre)</TabsTrigger>
            <TabsTrigger value="rules">Reguli de Rutare</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="centers" className="space-y-4 m-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Centre de Cost
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Total: <strong>{costCenters.length}</strong> centre
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
                });
                setShowForm(!showForm);
              }}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Adaugă Centru
            </button>
          </div>

          {/* KPI pills */}
          <div className="flex flex-wrap gap-1.5">
            <span className="flex items-center gap-1.5 px-3 h-7 rounded-lg text-xs font-semibold border bg-blue-50 text-blue-700 border-blue-200">
              <MapPin className="w-3 h-3" /> Centre{" "}
              <strong>{costCenters.length}</strong>
            </span>
            <span className="flex items-center gap-1.5 px-3 h-7 rounded-lg text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
              Activ <strong>{activeCount}</strong>
            </span>
            <span className="flex items-center gap-1.5 px-3 h-7 rounded-lg text-xs font-semibold border bg-purple-50 text-purple-700 border-purple-200">
              Orașe{" "}
              <strong>
                {new Set(costCenters.map((c: any) => c.city).filter(Boolean)).size}
              </strong>
            </span>
          </div>

          {/* Form */}
          {showForm && (
            <div className="p-6 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {editingId ? "Editează Centru" : "Adaugă Centru de Cost"}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Nume Centru *"
                    value={formData.name}
                    onChange={e =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400"
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
                    className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400"
                    autoComplete="address-level2"
                  />
                  <input
                    type="text"
                    placeholder="Adresă"
                    value={formData.address}
                    onChange={e =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400"
                    autoComplete="street-address"
                  />
                  <input
                    type="text"
                    placeholder="CUI"
                    value={formData.cui}
                    onChange={e =>
                      setFormData({ ...formData, cui: e.target.value })
                    }
                    className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400"
                    autoComplete="off"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={e =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400"
                    autoComplete="email"
                  />
                  <input
                    type="tel"
                    placeholder="Telefon"
                    value={formData.phone}
                    onChange={e =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400"
                    autoComplete="tel"
                  />
                  {/* ── Categorie ─────────────────────────────── */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Categorie</label>
                    <div className="flex gap-2">
                      <select
                        value={formData.categoryId ?? ""}
                        onChange={e => setFormData({ ...formData, categoryId: e.target.value ? Number(e.target.value) : null })}
                        className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">— Fără categorie —</option>
                        {(categories as any[]).map((cat: any) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowCatPanel(p => !p)}
                        className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${showCatPanel ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                      >
                        {showCatPanel ? "✕ Închide" : "+ Gestionează"}
                      </button>
                    </div>

                    {/* Categoria management — apare sub dropdown */}
                    {showCatPanel && (
                      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 overflow-hidden">
                        <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Nomenclator categorii</span>
                        </div>
                        {/* Existing categories */}
                        {(categories as any[]).length > 0 && (
                          <div className="px-3 py-2 flex flex-wrap gap-1.5 border-b border-slate-200 dark:border-slate-700">
                            {(categories as any[]).map((cat: any) => (
                              <span
                                key={cat.id}
                                className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-lg text-xs font-medium text-white"
                                style={{ backgroundColor: cat.color || "#6366f1" }}
                              >
                                {cat.name}
                                <button
                                  type="button"
                                  onClick={() => deleteCategoryMut.mutate({ id: cat.id })}
                                  className="w-4 h-4 rounded flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors leading-none text-xs"
                                  title="Șterge"
                                >×</button>
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Add new category */}
                        <div className="px-3 py-2.5 space-y-2">
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
                            className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          {/* Color swatches */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 shrink-0">Culoare:</span>
                            <div className="flex gap-1.5 flex-wrap">
                              {["#6366f1","#0ea5e9","#10b981","#f59e0b","#ef4444","#ec4899","#8b5cf6","#06b6d4","#84cc16","#f97316"].map(color => (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() => setNewCatColor(color)}
                                  className="w-5 h-5 rounded-lg transition-transform hover:scale-110 focus:outline-none"
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
                              className="ml-auto px-3 py-1 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                            >
                              {createCategoryMut.isPending ? "..." : "+ Adaugă"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                    }}
                  >
                    Anulează
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {editingId ? "Actualizează" : "Adaugă"}
                  </Button>
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
              <div className="flex gap-1 justify-end">
                <button
                  onClick={() => setInvoicesModal({ open: true, center: row })}
                  className="w-6 h-6 rounded-lg border border-slate-200 bg-white hover:bg-purple-50 text-purple-600 transition-colors flex items-center justify-center"
                  title="Vezi Facturi"
                >
                  <FileText className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleEdit(row)}
                  className="w-6 h-6 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 text-blue-600 transition-colors flex items-center justify-center"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDelete(row.id)}
                  className="w-6 h-6 rounded-lg border border-slate-200 bg-white hover:bg-red-50 text-red-600 transition-colors flex items-center justify-center"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          />
        </TabsContent>

        <TabsContent value="rules" className="space-y-4 m-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Reguli de Rutare SPV
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Total: <strong>{rules.length}</strong> reguli (Afișează "Nr. Crt.", date și per pagină)
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setConfirmDialog({
                    isOpen: true,
                    title: "Recalculare Facturi",
                    description: "Ești sigur că vrei să reculezi facturile vechi pe baza regulilor actuale?",
                    onConfirm: () => {
                      recalculateMutation.mutate();
                    },
                  });
                }}
                disabled={recalculateMutation.isPending}
                className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
              >
                Recalculează Facturile Vechi
              </button>
              <button
                onClick={() => {
                  setRuleFormData({ costCenterId: 0, conditionType: "SUPPLIER_CUI", conditionValue: "", addressKeyword: "" });
                  setEditingRuleId(null);
                  setShowRuleForm(!showRuleForm);
                }}
                className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Adaugă Regulă
              </button>
            </div>
          </div>

          {showRuleForm && (
            <div className="p-6 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {editingRuleId ? "Editează Regulă" : "Adaugă Regulă Nouă"}
              </h3>
              <form onSubmit={handleRuleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Caută Furnizor din Arhivă — selectează și se completează automat câmpurile de jos
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">CUI Furnizor (opțional)</label>
                    <input type="text" placeholder="ex: RO12345678" value={ruleFormData.conditionValue}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, conditionValue: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Denumire Furnizor (opțional)</label>
                    <input type="text" placeholder="ex: Orange, Metro" value={ruleFormData.matchName}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, matchName: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Punct de Lucru / Localitate (opțional)</label>
                    <input type="text" placeholder="ex: Constanta, Militari" value={ruleFormData.addressKeyword}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, addressKeyword: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Cuvânt în liniile facturii (opțional)</label>
                    <input type="text" placeholder="ex: orez, sos, bere, curatenie" value={(ruleFormData as any).lineKeyword || ""}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, lineKeyword: e.target.value } as any)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                    <p className="text-xs text-slate-400 mt-0.5">Se potrivește dacă cel puțin o linie din factură conține acest cuvânt.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Centru de Cost Destinație *</label>
                    <select value={ruleFormData.costCenterId || ""} onChange={(e) => setRuleFormData({ ...ruleFormData, costCenterId: Number(e.target.value) })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" required>
                      <option value="" disabled>Selectează...</option>
                      {costCenters.map((c: any) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button type="button" variant="outline" onClick={() => { setShowRuleForm(false); setEditingRuleId(null); setRuleFormData({ ...EMPTY_RULE }); }}>Anulează</Button>
                  <Button type="submit" disabled={createRuleMutation.isPending || updateRuleMutation.isPending || !ruleFormData.costCenterId || (!ruleFormData.conditionValue.trim() && !ruleFormData.matchName.trim() && !(ruleFormData as any).lineKeyword?.trim())}>
                    {editingRuleId ? "Actualizează" : "Adaugă Regulă"}
                  </Button>
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
              <div className="flex gap-1 justify-end">
                <button
                  onClick={() => handleRuleEdit(row)}
                  className="w-6 h-6 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 text-blue-600 transition-colors flex items-center justify-center"
                >
                  <Edit2 className="w-3 h-3" />
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
                  className="w-6 h-6 rounded-lg border border-slate-200 bg-white hover:bg-red-50 text-red-600 transition-colors flex items-center justify-center"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          />
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmDialog.isOpen} onOpenChange={(open) => !open && setConfirmDialog({ ...confirmDialog, isOpen: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDialog.onConfirm}>Confirmă</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invoices Modal for Cost Center */}
      {invoicesModal.open && invoicesModal.center && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setInvoicesModal({ open: false, center: null })}>
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[85vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-600" />
                  Facturi — {invoicesModal.center.name}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isLoadingCenterInvoices ? "Se încarcă..." : `${centerInvoices.length} facturi alocate acestui centru`}
                </p>
              </div>
              <button onClick={() => setInvoicesModal({ open: false, center: null })} className="w-8 h-8 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Table */}
            <div className="overflow-auto flex-1">
              {isLoadingCenterInvoices ? (
                <div className="flex items-center justify-center py-16 text-slate-400">Se încarcă facturile...</div>
              ) : centerInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
                  <FileText className="w-10 h-10 opacity-30" />
                  <p className="text-sm">Nicio factură alocată acestui centru de cost.</p>
                  <p className="text-xs">Adaugă reguli de rutare și apasă „Recalculează Facturile Vechi".</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nr.</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Furnizor</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">CUI</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nr. Factură</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Sumă</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Dată</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {centerInvoices.map((inv: any, idx: number) => (
                      <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-2.5 text-slate-500 text-xs">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white max-w-[200px] truncate">{inv.supplierName || "-"}</td>
                        <td className="px-4 py-2.5 text-slate-500 text-xs">{inv.supplierCUI || "-"}</td>
                        <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{inv.invoiceNumber}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-900 dark:text-white">
                          {inv.total != null ? Number(inv.total).toLocaleString("ro-RO", { minimumFractionDigits: 2 }) : "-"}
                          <span className="text-xs text-slate-400 ml-1">{inv.currency || "RON"}</span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 text-xs">{inv.issueDate ? String(inv.issueDate).slice(0, 10) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-slate-800 sticky bottom-0 border-t border-slate-200 dark:border-slate-700">
                    <tr>
                      <td colSpan={4} className="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300">TOTAL ({centerInvoices.length} facturi)</td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-900 dark:text-white">
                        {centerInvoices.reduce((sum: number, inv: any) => sum + (Number(inv.total) || 0), 0).toLocaleString("ro-RO", { minimumFractionDigits: 2 })}
                        <span className="text-xs text-slate-400 ml-1">RON</span>
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
