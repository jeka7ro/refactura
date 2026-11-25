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
    <div className="p-3 sm:p-5 max-w-full space-y-6">
      <div className="w-full">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Panou Administrare
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Gestionează clienții și abonamentele active
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 rounded-[22px] bg-white/96 dark:bg-[#1c1c1e] border-black/[0.06] dark:border-white/[0.09]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                  Clienți Activi
                </p>
                <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
                  {activeClients}
                </p>
              </div>
              <Users className="h-12 w-12 text-blue-600 opacity-20" />
            </div>
          </Card>

          <Card className="p-6 rounded-[22px] bg-white/96 dark:bg-[#1c1c1e] border-black/[0.06] dark:border-white/[0.09]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                  Venit Lunar Estimat
                </p>
                <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
                  {totalRevenue.toLocaleString("ro-RO", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  EUR
                </p>
              </div>
              <CreditCard className="h-12 w-12 text-green-600 opacity-20" />
            </div>
          </Card>

          <Card className="p-6 rounded-[22px] bg-white/96 dark:bg-[#1c1c1e] border-black/[0.06] dark:border-white/[0.09]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                  Total Clienți
                </p>
                <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
                  {tenants.length}
                </p>
              </div>
              <TrendingUp className="h-12 w-12 text-purple-600 opacity-20" />
            </div>
          </Card>
        </div>

        {/* Clients Management */}
        <Card className="p-6 rounded-[22px] bg-white/96 dark:bg-[#1c1c1e] border-black/[0.06] dark:border-white/[0.09]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Clienți
            </h2>
            <Button
              onClick={() => setLocation("/clienti")}
              className="rounded-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adaugă Client
            </Button>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Caută clienți..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 rounded-full"
              />
            </div>
          </div>

          {/* Clients Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Se încarcă clienții...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                      Client
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                      Abonament
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                      Tarif Lunar
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                      Centre de Cost
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                      Expiră la
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                      Acțiuni
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client: any) => (
                    <tr
                      key={client.id}
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">
                            {client.name}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {client.email || "—"}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Badge variant="outline" className="rounded-full tabular-nums">
                          {client.subscriptionPlanId
                            ? `Plan #${client.subscriptionPlanId}`
                            : "Standard"}
                        </Badge>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(client.subscriptionStatus || "active")}
                          {getStatusBadge(client.subscriptionStatus || "active")}
                        </div>
                      </td>
                      <td className="py-4 px-4 font-medium tabular-nums text-slate-900 dark:text-white">
                        {(client.subscriptionPlanId ? 99 : 29).toLocaleString(
                          "ro-RO",
                          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                        )}{" "}
                        EUR
                      </td>
                      <td className="py-4 px-4 text-slate-600 dark:text-slate-400">
                        —
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 tabular-nums text-slate-600 dark:text-slate-400">
                          <Clock className="h-4 w-4" />
                          {client.subscriptionEndDate
                            ? new Date(
                                client.subscriptionEndDate
                              ).toLocaleDateString("ro-RO")
                            : "Nedeterminat"}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <button
                          onClick={() => setLocation("/super-admin")}
                          title="Configurează companie și module"
                          className="w-8 h-8 inline-flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                        >
                          <MoreVertical className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!isLoading && filteredClients.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-500 dark:text-slate-400">
                Niciun client găsit
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
