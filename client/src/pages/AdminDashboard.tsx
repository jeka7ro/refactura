import { useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  CreditCard,
  TrendingUp,
  Plus,
  Search,
  MoreVertical,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: tenants = [], isLoading } = trpc.admin.tenants.useQuery();

  const filteredClients = tenants.filter(
    (client: any) =>
      (client.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.email || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeClients = tenants.filter(
    (c: any) => c.subscriptionStatus === "active"
  ).length;
  // Estimate revenue roughly if we don't join plans
  const totalRevenue = tenants
    .filter((c: any) => c.subscriptionStatus === "active")
    .reduce((sum: number, c: any) => sum + (c.subscriptionPlanId ? 99 : 29), 0);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case "inactive":
        return <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
      case "cancelled":
        return <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300 rounded-full">
            Activ
          </Badge>
        );
      case "inactive":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-300 rounded-full">
            Inactiv
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 rounded-full">
            Anulat
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen apple-canvas p-3 sm:p-5 max-w-full space-y-4">
      <div className="w-full space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap px-0.5">
          <div>
            <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
              Panou Administrare
            </h1>
            <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
              Gestionează clienții și abonamentele active
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLocation("/clienti")}
            className="apple-btn-prominent flex items-center justify-center gap-1.5 h-9 px-4 rounded-full text-white text-[13px] font-semibold transition-all shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Adaugă Client</span>
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 tabular-nums">
          <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                Clienți activi
              </span>
              <span className="w-7 h-7 rounded-[8px] bg-emerald-500/10 dark:bg-emerald-500/18 flex items-center justify-center shrink-0">
                <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              </span>
            </div>
            <span className="text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none">
              {activeClients}
            </span>
          </div>

          <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                Venit lunar estimat
              </span>
              <span className="w-7 h-7 rounded-[8px] bg-blue-500/10 dark:bg-blue-500/18 flex items-center justify-center shrink-0">
                <CreditCard className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              </span>
            </div>
            <span className="text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none">
              {totalRevenue.toLocaleString("ro-RO", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              EUR
            </span>
          </div>

          <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                Total clienți
              </span>
              <span className="w-7 h-7 rounded-[8px] bg-amber-500/10 dark:bg-amber-500/18 flex items-center justify-center shrink-0">
                <TrendingUp className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              </span>
            </div>
            <span className="text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none">
              {tenants.length}
            </span>
          </div>
        </div>

        {/* Unified Search Toolbar */}
        <div className="apple-surface px-3 py-2.5 flex items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-[320px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8e8e93] pointer-events-none" />
            <input
              type="text"
              placeholder="Caută clienți..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: 34, paddingRight: 14 }}
              className="apple-pill-control rounded-full w-full h-[34px] outline-none text-[13px] text-[#1d1d1f] dark:text-white placeholder:text-[#8e8e93] focus:bg-white dark:focus:bg-[#2c2c2e]"
            />
          </div>
          <span className="text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums shrink-0">
            {filteredClients.length} înregistrări
          </span>
        </div>

        {/* Clients Table */}
        <div className="apple-surface overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-[#6e6e73] dark:text-[#98989d] text-[13px]">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Se încarcă clienții...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
                  <tr>
                    <th className="text-left py-3 px-4 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                      Client
                    </th>
                    <th className="text-left py-3 px-4 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                      Abonament
                    </th>
                    <th className="text-left py-3 px-4 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                      Tarif lunar
                    </th>
                    <th className="text-left py-3 px-4 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                      Centre de cost
                    </th>
                    <th className="text-left py-3 px-4 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                      Expiră la
                    </th>
                    <th className="text-right py-3 px-4 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                      Acțiuni
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                  {filteredClients.map((client: any) => (
                    <tr
                      key={client.id}
                      className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                            {client.name}
                          </p>
                          <p className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d]">
                            {client.email || "—"}
                          </p>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant="outline" className="rounded-full tabular-nums">
                          {client.subscriptionPlanId
                            ? `Plan #${client.subscriptionPlanId}`
                            : "Standard"}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(client.subscriptionStatus || "active")}
                          {getStatusBadge(client.subscriptionStatus || "active")}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-medium tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {(client.subscriptionPlanId ? 99 : 29).toLocaleString(
                          "ro-RO",
                          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                        )}{" "}
                        EUR
                      </td>
                      <td className="py-3.5 px-4 text-[#6e6e73] dark:text-[#98989d]">
                        —
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                          <Clock className="h-3.5 w-3.5" />
                          {client.subscriptionEndDate
                            ? new Date(
                                client.subscriptionEndDate
                              ).toLocaleDateString("ro-RO")
                            : "Nedeterminat"}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setLocation("/super-admin")}
                          title="Configurează companie și module"
                          className="w-8 h-8 apple-btn-glass inline-flex items-center justify-center rounded-full transition-colors cursor-pointer"
                        >
                          <MoreVertical className="h-4 w-4 text-[#6e6e73] dark:text-[#98989d]" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!isLoading && filteredClients.length === 0 && (
            <div className="text-center py-10">
              <p className="text-[#6e6e73] dark:text-[#98989d] text-[13px]">
                Niciun client găsit
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
