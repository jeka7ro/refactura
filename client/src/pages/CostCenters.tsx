import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableColumn } from "@/components/DataTable";
import { MapPin, Edit2, Trash2, Plus } from "lucide-react";

export default function CostCenters() {
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
  });

  // Fetch cost centers
  const { data: costCenters = [], isLoading, refetch } = trpc.costCenters.list.useQuery();
  
  // Create mutation
  const createMutation = trpc.costCenters.create.useMutation({
    onSuccess: () => {
      refetch();
      setFormData({ name: "", address: "", cui: "", email: "", phone: "", city: "", country: "" });
      setShowForm(false);
    },
  });

  // Update mutation
  const updateMutation = trpc.costCenters.update.useMutation({
    onSuccess: () => {
      refetch();
      setFormData({ name: "", address: "", cui: "", email: "", phone: "", city: "", country: "" });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...formData });
    } else {
      createMutation.mutate(formData);
    }
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
    });
    setEditingId(center.id);
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Sigur vrei să ștergi acest centru de cost?")) {
      deleteMutation.mutate({ id });
    }
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Centre de Cost</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">Gestionează locații și departamente separate</p>
        </div>
        <Button
          onClick={() => {
            setEditingId(null);
            setFormData({ name: "", address: "", cui: "", email: "", phone: "", city: "", country: "" });
            setShowForm(!showForm);
          }}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Adaugă Centru
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Total Centre</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{costCenters.length}</p>
            </div>
            <MapPin className="w-8 h-8 text-blue-400 opacity-50" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Activ</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">{activeCount}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Orașe</p>
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-2">
                {new Set(costCenters.map((c: any) => c.city)).size}
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30" />
          </div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="p-6 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {editingId ? "Editează Centru" : "Adaugă Centru de Cost"}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Nume Centru *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400"
                autoComplete="organization"
                required
              />
              <input
                type="text"
                placeholder="Oraș"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400"
                autoComplete="address-level2"
              />
              <input
                type="text"
                placeholder="Adresă"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400"
                autoComplete="street-address"
              />
              <input
                type="text"
                placeholder="CUI"
                value={formData.cui}
                onChange={(e) => setFormData({ ...formData, cui: e.target.value })}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400"
                autoComplete="off"
              />
              <input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400"
                autoComplete="email"
              />
              <input
                type="tel"
                placeholder="Telefon"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400"
                autoComplete="tel"
              />
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
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingId ? "Actualizează" : "Adaugă"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Data Table */}
      {isLoading ? (
        <div className="p-8 text-center text-slate-500">Încarcă...</div>
      ) : costCenters.length === 0 ? (
        <div className="p-8 text-center text-slate-500">Nu ai centre de cost. Adaugă unul pentru a începe.</div>
      ) : (
        <DataTable
          columns={columns}
          data={costCenters}
          rowKey="id"
          actions={(row) => (
            <div className="flex gap-2 justify-end">
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
      )}
    </div>
  );
}
