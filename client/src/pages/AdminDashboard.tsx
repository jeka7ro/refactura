import { useState } from "react";
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
} from "lucide-react";

interface Client {
  id: number;
  name: string;
  email: string;
  plan: "Basic" | "Pro" | "Enterprise";
  status: "active" | "inactive" | "cancelled";
  monthlyPrice: number;
  costCenters: number;
  createdAt: string;
  expiresAt: string;
}

const mockClients: Client[] = [
  {
    id: 1,
    name: "ConstructMaster SRL",
    email: "contact@constructmaster.ro",
    plan: "Pro",
    status: "active",
    monthlyPrice: 99,
    costCenters: 3,
    createdAt: "2025-01-15",
    expiresAt: "2026-07-15",
  },
  {
    id: 2,
    name: "TechFlow Solutions",
    email: "admin@techflow.ro",
    plan: "Enterprise",
    status: "active",
    monthlyPrice: 299,
    costCenters: 10,
    createdAt: "2024-06-01",
    expiresAt: "2026-06-01",
  },
  {
    id: 3,
    name: "EcoGreen Ltd",
    email: "info@ecogreen.ro",
    plan: "Basic",
    status: "inactive",
    monthlyPrice: 29,
    costCenters: 1,
    createdAt: "2025-03-10",
    expiresAt: "2026-03-10",
  },
];

export default function AdminDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showNewClient, setShowNewClient] = useState(false);

  const filteredClients = mockClients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeClients = mockClients.filter((c) => c.status === "active").length;
  const totalRevenue = mockClients
    .filter((c) => c.status === "active")
    .reduce((sum, c) => sum + c.monthlyPrice, 0);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "inactive":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case "cancelled":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case "inactive":
        return <Badge className="bg-yellow-100 text-yellow-800">Inactive</Badge>;
      case "cancelled":
        return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Manage clients and subscriptions</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Active Clients</p>
                <p className="text-3xl font-bold text-gray-900">{activeClients}</p>
              </div>
              <Users className="h-12 w-12 text-blue-600 opacity-20" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Monthly Revenue</p>
                <p className="text-3xl font-bold text-gray-900">${totalRevenue}</p>
              </div>
              <CreditCard className="h-12 w-12 text-green-600 opacity-20" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Clients</p>
                <p className="text-3xl font-bold text-gray-900">{mockClients.length}</p>
              </div>
              <TrendingUp className="h-12 w-12 text-purple-600 opacity-20" />
            </div>
          </Card>
        </div>

        {/* Clients Management */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Clients</h2>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Clients Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Client</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Plan</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Monthly</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Cost Centers</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Expires</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => (
                  <tr key={client.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{client.name}</p>
                        <p className="text-sm text-gray-500">{client.email}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <Badge variant="outline">{client.plan}</Badge>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(client.status)}
                        {getStatusBadge(client.status)}
                      </div>
                    </td>
                    <td className="py-4 px-4 font-medium text-gray-900">${client.monthlyPrice}</td>
                    <td className="py-4 px-4 text-gray-600">{client.costCenters}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Clock className="h-4 w-4" />
                        {new Date(client.expiresAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <button className="p-2 hover:bg-gray-100 rounded-lg">
                        <MoreVertical className="h-4 w-4 text-gray-500" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredClients.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No clients found</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
