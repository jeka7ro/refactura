import React, { useState } from "react";
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
import { isTransmittedInDeadline } from "@/lib/spvDeadline";

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
      case "validat":
        return "rounded-full bg-green-100 text-green-800 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800";
      case "eroare":
        return "rounded-full bg-red-100 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800";
      case "in_procesare":
        return "rounded-full bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800";
      default:
        return "rounded-full bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
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
      <div className="p-3 sm:p-5 max-w-full space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Jurnal Sincronizări SPV ANAF</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Istoricul complet al facturilor trimise și primite din sistemul național e-Factura.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <Card className="rounded-2xl py-2.5 gap-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3.5 pb-0">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-[#636366] dark:text-[#98989d]">Facturi Trimise</CardTitle>
              <UploadCloud className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent className="px-3.5">
              <div className="text-lg font-bold tabular-nums leading-tight">{stats.trimise}</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl py-2.5 gap-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3.5 pb-0">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-[#636366] dark:text-[#98989d]">Facturi Primite</CardTitle>
              <DownloadCloud className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent className="px-3.5">
              <div className="text-lg font-bold tabular-nums leading-tight">{stats.primite}</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl py-2.5 gap-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3.5 pb-0">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-[#636366] dark:text-[#98989d]">Validări cu succes</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent className="px-3.5">
              <div className="text-lg font-bold tabular-nums leading-tight text-green-600 dark:text-green-400">{stats.validate}</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl py-2.5 gap-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3.5 pb-0">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-[#636366] dark:text-[#98989d]">Erori ANAF</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent className="px-3.5">
              <div className="text-lg font-bold tabular-nums leading-tight text-red-600 dark:text-red-400">{stats.erori}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-[22px]">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle>Istoric Tranzacții SPV</CardTitle>
                <CardDescription>Vizualizează statusul fiecărui pachet XML procesat</CardDescription>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger
                    data-filtered={filterType !== "all"}
                    className="apple-pill-control w-auto h-9 px-3.5 rounded-full"
                  >
                    <SelectValue placeholder="Toate Tipurile" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toate Tipurile</SelectItem>
                    <SelectItem value="trimisa">Trimise (Out)</SelectItem>
                    <SelectItem value="primita">Primite (In)</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger
                    data-filtered={filterStatus !== "all"}
                    className="apple-pill-control w-auto h-9 px-3.5 rounded-full"
                  >
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
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                Nu există înregistrări SPV care să corespundă filtrelor selectate.
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">Tip</TableHead>
                      <TableHead>Data Transmiterii</TableHead>
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
                        <TableCell className="whitespace-nowrap">
                          {(() => {
                            const inTermen = log.type === "trimisa" && (log as any).issueDate
                              ? isTransmittedInDeadline((log as any).issueDate, log.date)
                              : true;
                            return (
                              <div className={`text-xs tabular-nums whitespace-nowrap ${inTermen ? "text-emerald-600 dark:text-emerald-500" : "text-slate-800 dark:text-slate-200"}`}>
                                <span className="font-medium">
                                  {format(new Date(log.date), "dd MMM yyyy", { locale: ro })}
                                </span>
                                <span className={`ml-1.5 ${inTermen ? "text-emerald-600/80 dark:text-emerald-500/80" : "text-slate-500"}`}>
                                  {format(new Date(log.date), "HH:mm")}
                                </span>
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="rounded-full tabular-nums bg-slate-50 dark:bg-slate-800/80 dark:text-slate-200 dark:border-slate-700">
                            {log.spvIndex || "Fără Index"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          <div>{log.invoiceNumber}</div>
                          {(log as any).issueDate && (
                            <div className="text-[11px] tabular-nums text-slate-400 font-normal">
                              Emisă: {(log as any).issueDate}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[200px] truncate" title={log.partnerName}>
                            {log.partnerName}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {Number(log.total).toFixed(2)} {log.currency}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <Badge variant="outline" className={getStatusColor(log.spvStatus)}>
                              {log.spvStatus?.toUpperCase()}
                            </Badge>
                            {log.spvStatus === "eroare" && log.spvError && log.spvError.toLowerCase() !== "ok" && (
                              <span className="text-xs text-red-600 dark:text-red-400 max-w-[250px] line-clamp-2" title={log.spvError}>
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
