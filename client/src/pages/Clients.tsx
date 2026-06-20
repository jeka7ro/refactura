import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableColumn } from "@/components/DataTable";
import { Building2, Edit2, Trash2, Plus, Search, Loader2, AlertCircle, CheckCircle2, Eye } from "lucide-react";

export default function Clients() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    cui: "",
    address: "",
    city: "",
    country: "",
    email: "",
    phone: "",
    currency: "RON",
    regCom: "",
    tva: false,
  });

  // Fetch clients
  const { data: clients = [], isLoading, refetch } = trpc.clients.list.useQuery();
  
  // Create mutation
  const createMutation = trpc.clients.create.useMutation({
    onSuccess: () => {
      refetch();
      setFormData({
        name: "", cui: "", address: "", city: "",
        country: "", email: "", phone: "", currency: "RON",
        regCom: "", tva: false,
      });
      setShowForm(false);
    },
  });

  // Update mutation
  const updateMutation = trpc.clients.update.useMutation({
    onSuccess: () => {
      refetch();
      setFormData({
        name: "", cui: "", address: "", city: "",
        country: "", email: "", phone: "", currency: "RON",
        regCom: "", tva: false,
      });
      setEditingId(null);
      setShowForm(false);
    },
  });

  // Delete mutation
  const deleteMutation = trpc.clients.delete.useMutation({
    onSuccess: () => {
      refetch();
    },
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

  const handleEdit = (client: any) => {
    setFormData({
      name: client.name,
      cui: client.cui || "",
      address: client.address || "",
      city: client.city || "",
      country: client.country || "",
      email: client.email || "",
      phone: client.phone || "",
      currency: client.currency || "RON",
      regCom: client.regCom || "",
      tva: client.tva ?? false,
    });
    setEditingId(client.id);
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Sigur vrei să ștergi acest client?")) {
      deleteMutation.mutate({ id });
    }
  };

  const columns: DataTableColumn<any>[] = [
    {
      key: "name",
      label: "NUME CLIENT",
      sortable: true,
      render: (val: string, row: any) => (
        <Link href={`/client/${row.id}`} className="font-semibold text-blue-600 hover:underline">
          {val}
        </Link>
      ),
    },
    {
      key: "cui",
      label: "CUI",
      sortable: true,
    },
    {
      key: "city",
      label: "ORAȘ",
      sortable: true,
    },
    {
      key: "address",
      label: "ADRESĂ",
      sortable: true,
      render: (val: string) => (
        <div className="truncate max-w-[200px]" title={val}>
          {val || "-"}
        </div>
      ),
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
    {
      key: "currency",
      label: "MONEDĂ",
      sortable: true,
      render: (value: string) => (
        <span className="inline-block px-2 py-1 rounded-full text-xs font-normal bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
          {value}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header + KPI Cards — ascunse când formularul e deschis */}
      {!showForm && (
        <>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Clienți</h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">Gestionează clienții și contactele lor</p>
            </div>
            <Button
              onClick={() => {
                setEditingId(null);
                setFormData({
                  name: "", cui: "", address: "", city: "",
                  country: "", email: "", phone: "", currency: "RON",
                  regCom: "", tva: false,
                });
                setShowForm(true);
              }}
              className="gap-2 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Client nou
            </Button>
          </div>

          {/* Micro KPI Headers */}
          <div className="flex items-center gap-3 mt-4 mb-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50/50 border border-blue-100/50 backdrop-blur-sm text-sm">
              <Building2 className="w-4 h-4 text-blue-500" />
              <span className="text-slate-600 font-medium">Total Clienți:</span>
              <span className="font-bold text-blue-700">{clients.length}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50/50 border border-purple-100/50 backdrop-blur-sm text-sm">
              <div className="w-4 h-4 rounded-md bg-purple-500/20 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
              </div>
              <span className="text-slate-600 font-medium">Orașe Unice:</span>
              <span className="font-bold text-purple-700">{new Set(clients.map((c: any) => c.city).filter(Boolean)).size}</span>
            </div>
          </div>
        </>
      )}

      {/* Titlu compact când form e deschis */}
      {showForm && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Clienți</h1>
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <ClientForm
          key={editingId ?? "new"}
          editingId={editingId}
          initial={formData}
          onSubmit={(data) => {
            if (editingId) {
              updateMutation.mutate({ id: editingId, ...data });
            } else {
              createMutation.mutate(data);
            }
          }}
          onCancel={() => { setShowForm(false); setEditingId(null); }}
          isPending={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Tabel */}
      {!showForm && (
        <div className="mt-4">
          <DataTable
            columns={columns}
            data={clients}
            rowKey="id"
            isLoading={isLoading}
            actions={(row) => (
              <div className="flex gap-2 justify-end">
                <Link href={`/client/${row.id}`} className="p-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/20 text-slate-600 dark:text-slate-400 transition-colors">
                  <Eye className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => handleEdit(row)}
                  className="p-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(row.id)}
                  className="p-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          />
        </div>
      )}

    </div>
  );
}

// ── Formular Client cu ANAF auto-fill ──────────────────────────────
type ClientFormData = {
  name: string; cui: string; address: string; city: string;
  country: string; email: string; phone: string; currency: string;
  regCom: string; tva: boolean;
};

function ClientForm({ editingId, initial, onSubmit, onCancel, isPending }: {
  editingId: number | null;
  initial: ClientFormData;
  onSubmit: (data: ClientFormData) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [data, setData] = useState<ClientFormData>({
    ...initial,
    regCom: (initial as any).regCom || "",
    tva: (initial as any).tva ?? false,
  });
  const [cuiLoading, setCuiLoading] = useState(false);
  const [cuiError, setCuiError] = useState("");
  const [cuiFilled, setCuiFilled] = useState(false);

  const set = (k: keyof ClientFormData, v: string) => setData(p => ({ ...p, [k]: v }));

  const lookupCui = async () => {
    const cui = data.cui.replace(/^RO/i, "").replace(/\s/g, "");
    if (!cui || cui.length < 2) return;
    setCuiLoading(true);
    setCuiError("");
    setCuiFilled(false);
    try {
      const res = await fetch(`/api/anaf/${cui}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setCuiError(err.error || "CUI negăsit în ANAF.");
        return;
      }
      const d = await res.json();
      setData(prev => ({
        ...prev,
        name: d.denumire || prev.name,
        address: d.adresa || prev.address,
        city: d.judet || prev.city,
        country: prev.country || "RO",
        regCom: d.nrRegCom || prev.regCom,
        tva: d.tva ?? prev.tva,
      }));
      setCuiFilled(true);
    } catch {
      setCuiError("Eroare conexiune la ANAF.");
    } finally {
      setCuiLoading(false);
    }
  };

  const inp = "w-full px-3 h-10 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all";
  const lbl = "block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5";

  return (
    <div className="p-6 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-5">
      <h3 className="text-base font-bold text-slate-900 dark:text-white">
        {editingId ? "Editează Client" : "Client Nou"}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CUI cu auto-fill — primul, că populează restul */}
        <div>
          <label className={lbl}>CUI / CIF</label>
          <div className="flex gap-2">
            <input
              className={inp + " flex-1"}
              placeholder="ex: RO42322117"
              value={data.cui}
              onChange={e => { set("cui", e.target.value); setCuiError(""); setCuiFilled(false); }}
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), lookupCui())}
            />
            <button
              type="button"
              onClick={lookupCui}
              disabled={cuiLoading || !data.cui}
              className="flex items-center gap-1.5 px-3 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition-colors flex-shrink-0"
            >
              {cuiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
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
              <CheckCircle2 className="w-3 h-3" /> Date completate din ANAF
            </div>
          )}
        </div>

        {/* Nume */}
        <div>
          <label className={lbl}>Denumire firmă *</label>
          <input className={inp} placeholder="ex: Dedeman SRL" required value={data.name} onChange={e => set("name", e.target.value)} />
        </div>

        {/* Reg. Com. + TVA */}
        <div>
          <label className={lbl}>Reg. Com. (J..)</label>
          <input className={inp} placeholder="ex: J40/1234/2020" value={data.regCom} onChange={e => set("regCom", e.target.value)} />
        </div>
        <div>
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
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${data.tva ? "bg-green-500" : "bg-slate-400"}`} />
            {data.tva ? "Plătitor TVA" : "Neplătitor TVA"}
          </button>
        </div>

        {/* Adresă */}
        <div className="md:col-span-2">
          <label className={lbl}>Adresă</label>
          <input className={inp} placeholder="Str. Exemplu nr. 1" value={data.address} onChange={e => set("address", e.target.value)} />
        </div>

        {/* Oraș + Țară + Monedă (pe același rând) */}
        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={lbl}>Județ / Oraș</label>
            <input className={inp} placeholder="București" value={data.city} onChange={e => set("city", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Țară</label>
            <input className={inp} placeholder="România" value={data.country} onChange={e => set("country", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Monedă</label>
            <select className={inp} value={data.currency} onChange={e => set("currency", e.target.value)}>
              <option value="RON">RON — Leu românesc</option>
              <option value="EUR">EUR — Euro</option>
              <option value="USD">USD — Dolar</option>
            </select>
          </div>
        </div>

        {/* Email + Telefon */}
        <div>
          <label className={lbl}>Email</label>
          <input className={inp} type="email" autoComplete="email" placeholder="office@firma.ro" value={data.email} onChange={e => set("email", e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Telefon</label>
          <input className={inp} type="tel" autoComplete="tel" placeholder="+40 21 123 4567" value={data.phone} onChange={e => set("phone", e.target.value)} />
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-700">
        <Button type="button" variant="outline" onClick={onCancel}>Anulează</Button>
        <Button
          type="button"
          disabled={isPending || !data.name.trim()}
          onClick={() => onSubmit(data)}
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          {editingId ? "Actualizează" : "Adaugă client"}
        </Button>
      </div>
    </div>
  );
}
