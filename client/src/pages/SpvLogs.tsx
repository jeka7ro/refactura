import React, { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { DownloadCloud, UploadCloud, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SpvLogs() {
  const { data: logs, isLoading } = trpc.spvLogs.list.useQuery();
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filteredLogs = logs?.filter(log => {
    if (filterType !== "all" && log.type !== filterType) return false;
    if (filterStatus !== "all" && log.spvStatus !== filterStatus) return false;
    return true;
  });

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "validat": return "bg-green-100 text-green-800 border-green-200";
      case "eroare": return "bg-red-100 text-red-800 border-red-200";
      case "in_procesare": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default: return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  const stats = {
    trimise: logs?.filter(l => l.type === "trimisa").length || 0,
    primite: logs?.filter(l => l.type === "primita").length || 0,
    validate: logs?.filter(l => l.spvStatus === "validat").length || 0,
    erori: logs?.filter(l => l.spvStatus === "eroare").length || 0,
  };

  return (
    <>
      <div className="p-8 max-w-[1400px] mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Jurnal Sincronizări SPV ANAF</h1>
          <p className="text-slate-500 mt-1">
            Istoricul complet al facturilor trimise și primite din sistemul național e-Factura.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Facturi Trimise</CardTitle>
              <UploadCloud className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.trimise}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Facturi Primite</CardTitle>
              <DownloadCloud className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.primite}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Validari cu Succes</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.validate}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Erori ANAF</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.erori}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Istoric Tranzacții SPV</CardTitle>
                <CardDescription>Vizualizează statusul fiecărui pachet XML procesat</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Toate Tipurile" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toate Tipurile</SelectItem>
                    <SelectItem value="trimisa">Trimise (Out)</SelectItem>
                    <SelectItem value="primita">Primite (In)</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Toate Statusurile" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toate Statusurile</SelectItem>
                    <SelectItem value="validat">Validat</SelectItem>
                    <SelectItem value="eroare">Eroare</SelectItem>
                    <SelectItem value="in_procesare">În procesare</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : filteredLogs?.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                Nu există înregistrări SPV care să corespundă filtrelselectate.
              </div>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">Tip</TableHead>
                      <TableHead>Dată / Oră</TableHead>
                      <TableHead>Index SPV</TableHead>
                      <TableHead>Număr Factură</TableHead>
                      <TableHead>Partener</TableHead>
                      <TableHead className="text-right">Valoare</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs?.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-center">
                          {log.type === "trimisa" ? (
                            <UploadCloud className="h-5 w-5 text-blue-500 mx-auto" />
                          ) : (
                            <DownloadCloud className="h-5 w-5 text-purple-500 mx-auto" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {format(new Date(log.date), "dd MMM yyyy", { locale: ro })}
                          </div>
                          <div className="text-xs text-slate-500">
                            {format(new Date(log.date), "HH:mm:ss")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono bg-slate-50">
                            {log.spvIndex || "Fără Index"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {log.invoiceNumber}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[200px] truncate" title={log.partnerName}>
                            {log.partnerName}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {Number(log.total).toFixed(2)} {log.currency}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <Badge variant="outline" className={getStatusColor(log.spvStatus)}>
                              {log.spvStatus?.toUpperCase()}
                            </Badge>
                            {log.spvStatus === "eroare" && log.spvError && log.spvError.toLowerCase() !== "ok" && (
                              <span className="text-xs text-red-600 max-w-[250px] line-clamp-2" title={log.spvError}>
                                {log.spvError}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
