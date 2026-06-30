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
  const {
    data: costCenters = [],
    isLoading,
    refetch,
  } = trpc.costCenters.list.useQuery();

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
    <div className="p-3 sm:p-5 max-w-full space-y-3">
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
        actions={row => (
          <div className="flex gap-1 justify-end">
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
    </div>
  );
}
