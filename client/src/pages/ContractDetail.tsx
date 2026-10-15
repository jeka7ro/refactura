import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Download,
  Printer,
  History,
  Plus,
  Clock,
  Building2,
  FileText,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Send,
  Edit,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function ContractDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const id = parseInt(params.id || "0");

  const {
    data: contract,
    isLoading,
    refetch,
  } = trpc.contracts.getById.useQuery({ id }, { enabled: !isNaN(id) && id > 0 });

  // Add Log state
  const [showAddLogModal, setShowAddLogModal] = useState(false);
  const [logActionType, setLogActionType] = useState("modificare_termeni");
  const [logExplanation, setLogExplanation] = useState("");
  const [logError, setLogError] = useState("");

  const addLogMutation = trpc.contracts.addLog.useMutation({
    onSuccess: () => {
      setShowAddLogModal(false);
      setLogExplanation("");
      setLogError("");
      refetch();
    },
    onError: (err) => {
      setLogError("Eroare la adăugarea notei: " + err.message);
    },
  });

  const pdfUrl = `/api/pdf/contract/${id}`;

  const getTypeLabel = (type?: string) => {
    switch (type) {
      case "act_aditional":
        return "Act Adițional";
      case "pv_receptie":
        return "Proces Verbal Recepție";
      case "anexa":
        return "Anexă Tehnică";
      default:
        return "Contract Cadru";
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "activ":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            Activ
          </span>
        );
      case "draft":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full">
            <span className="h-2 w-2 rounded-full bg-amber-500"></span>
            În Redactare
          </span>
        );
      case "expirat":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full">
            <span className="h-2 w-2 rounded-full bg-rose-500"></span>
            Expirat
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-500/10 px-3 py-1 rounded-full">
            Reziliat
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        <p className="text-sm font-medium">Se încarcă documentul...</p>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-12 text-center">
        <FileText className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Documentul nu a fost găsit</h2>
        <p className="text-sm text-slate-500 mt-1">Este posibil ca documentul să fi fost șters sau ID-ul este invalid.</p>
        <Button asChild className="mt-4 rounded-xl">
          <Link href="/contracte">Înapoi la Bibliotecă</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="h-9 w-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600"
          >
            <Link href="/contracte">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
                {getTypeLabel(contract.type)} {contract.number}
              </h1>
              {getStatusBadge(contract.status)}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {contract.title} | Data încheierii: <strong>{contract.date}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddLogModal(true)}
            className="rounded-xl border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-medium"
          >
            <History className="h-4 w-4 mr-1.5" />
            Adaugă Notă în Jurnal
          </Button>

          <Button
            variant="outline"
            size="sm"
            asChild
            className="rounded-xl border-slate-300 dark:border-slate-700"
          >
            <Link href={`/contracte/new?parentContractId=${contract.id}&type=act_aditional`}>
              <Plus className="h-4 w-4 mr-1.5 text-primary" />
              Act Adițional Nou
            </Link>
          </Button>

          <Button
            variant="outline"
            size="sm"
            asChild
            className="rounded-xl border-slate-300 dark:border-slate-700"
          >
            <a href={`${pdfUrl}?download=1`} download>
              <Download className="h-4 w-4 mr-1.5 text-emerald-600" />
              Descarcă PDF
            </a>
          </Button>

          <Button
            variant="outline"
            size="sm"
            asChild
            className="rounded-xl border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-700 dark:text-blue-300"
          >
            <a href={`${pdfUrl}?download=1&format=word`} download>
              <FileText className="h-4 w-4 mr-1.5 text-blue-600" />
              Descarcă Word (.docx)
            </a>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const iframe = document.getElementById("pdf-frame") as HTMLIFrameElement;
              if (iframe?.contentWindow) {
                iframe.contentWindow.print();
              } else {
                window.open(pdfUrl, "_blank");
              }
            }}
            className="rounded-xl border-slate-300 dark:border-slate-700"
          >
            <Printer className="h-4 w-4 mr-1.5" />
            Tipărește
          </Button>
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: PDF Viewer (Identic cu facturile) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-900 overflow-hidden shadow-md">
            <div className="bg-slate-800/80 px-4 py-2.5 flex items-center justify-between text-xs text-slate-300 border-b border-slate-700">
              <span className="font-semibold flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-primary" />
                Previzualizare PDF Oficial (Format A4)
              </span>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:text-white flex items-center gap-1 transition-colors"
              >
                Deschide în tab nou
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <iframe
              id="pdf-frame"
              src={`${pdfUrl}#view=FitH`}
              className="w-full h-[850px] border-0 bg-white"
              title={`PDF Contract ${contract.number}`}
            />
          </div>
        </div>

        {/* Right Column: Partener, Detalii, Acte Aditionale & Jurnal */}
        <div className="lg:col-span-4 space-y-5">
          {/* Card Partener */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-primary" />
              Partener Contractual
            </h3>

            <div>
              <div className="font-extrabold text-base text-slate-900 dark:text-white">
                {contract.partnerName || "Nespecificat"}
              </div>
              <div className="text-xs text-slate-500 mt-1 space-y-1">
                {contract.partnerCui && (
                  <div>
                    CUI / CIF: <strong className="text-slate-800 dark:text-slate-200">{contract.partnerCui}</strong>
                  </div>
                )}
                {contract.partnerSagaCode && (
                  <div>
                    Cod SAGA: <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-slate-700 dark:text-slate-300">{contract.partnerSagaCode}</span>
                  </div>
                )}
                {contract.partnerAddress && (
                  <div>
                    Adresă: <span>{contract.partnerAddress}, {contract.partnerCity}</span>
                  </div>
                )}
                {contract.partnerPhone && <div>Tel: <span>{contract.partnerPhone}</span></div>}
                {contract.partnerEmail && <div>Email: <span>{contract.partnerEmail}</span></div>}
              </div>
            </div>

            {contract.partnerId && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full rounded-xl text-xs mt-2"
              >
                <Link href={`/clienti?search=${encodeURIComponent(contract.partnerCui || contract.partnerName || "")}`}>
                  Deschide Fișa Partenerului
                </Link>
              </Button>
            )}
          </div>

          {/* Acte Aditionale Legate */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <RefreshCw className="h-4 w-4 text-purple-600" />
                Acte Adiționale ({contract.addendums?.length || 0})
              </h3>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-7 text-xs text-primary p-0 hover:bg-transparent"
              >
                <Link href={`/contracte/new?parentContractId=${contract.id}&type=act_aditional`}>
                  + Adaugă
                </Link>
              </Button>
            </div>

            {(!contract.addendums || contract.addendums.length === 0) ? (
              <p className="text-xs text-slate-400 italic">
                Nu există acte adiționale emise pentru acest contract.
              </p>
            ) : (
              <div className="space-y-2">
                {contract.addendums.map((a: any) => (
                  <Link
                    key={a.id}
                    href={`/contracte/${a.id}`}
                    className="block p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-800 bg-slate-50/50 dark:bg-slate-900/30 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-purple-700 dark:text-purple-300">
                        {a.number}
                      </span>
                      <span className="text-[11px] text-slate-400">{a.date}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-1">
                      {a.title}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Panou Jurnal Modificari & Explicatii (Audit Trail) */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <History className="h-4 w-4 text-purple-600" />
                Jurnal Modificări & Explicații
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {contract.logs?.length || 0} evenimente
              </span>
            </div>

            {(!contract.logs || contract.logs.length === 0) ? (
              <p className="text-xs text-slate-400 italic">
                Nicio modificare înregistrată.
              </p>
            ) : (
              <div className="relative pl-5 space-y-3.5 border-l-2 border-slate-200 dark:border-slate-800 mt-2">
                {contract.logs.map((l: any) => (
                  <div key={l.id} className="relative">
                    <div className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-purple-600 border-2 border-white dark:border-slate-900"></div>
                    <div>
                      <div className="flex items-center justify-between gap-1 text-[11px]">
                        <span className="font-bold text-purple-700 dark:text-purple-300 uppercase">
                          {l.actionType.replace("_", " ")}
                        </span>
                        <span className="text-slate-400 font-mono">
                          {new Date(l.createdAt).toLocaleDateString("ro-RO", {
                            day: "2-digit",
                            month: "short",
                            year: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 dark:text-slate-200 mt-1 font-medium bg-slate-50 dark:bg-slate-900/60 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                        {l.explanation}
                      </p>
                      <div className="text-[10px] text-slate-400 mt-1">
                        Autor: {l.userName || "Utilizator"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Adaugare Nota Jurnal */}
      <Dialog open={showAddLogModal} onOpenChange={setShowAddLogModal}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <History className="h-5 w-5 text-purple-600" />
              Adaugă Notă / Solicitare în Jurnal
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Notează orice solicitare, modificare de termen sau acord verbal cu privire la contractul {contract.number}.
            </DialogDescription>
          </DialogHeader>

          {logError && (
            <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
              {logError}
            </div>
          )}

          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tip Eveniment:
              </label>
              <Select value={logActionType} onValueChange={setLogActionType}>
                <SelectTrigger className="rounded-xl text-xs h-9 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl text-xs">
                  <SelectItem value="modificare_termeni">Modificare Termen Plată / Livrare</SelectItem>
                  <SelectItem value="modificare_pret">Actualizare Preț / Suplimentare Valoare</SelectItem>
                  <SelectItem value="prelungire">Prelungire Valabilitate</SelectItem>
                  <SelectItem value="act_aditional">Act Adițional Nou Încheiat</SelectItem>
                  <SelectItem value="notificare">Convorbire / Notificare Client</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Explicație / Justificare Obligatorie:
              </label>
              <textarea
                value={logExplanation}
                onChange={(e) => setLogExplanation(e.target.value)}
                rows={3}
                placeholder="Ex: Clientul a solicitat amânarea termenului de livrare cu 10 zile din cauza întârzierii șantierului..."
                className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-card p-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddLogModal(false)}
              className="rounded-xl"
            >
              Anulează
            </Button>
            <Button
              size="sm"
              disabled={!logExplanation.trim() || addLogMutation.isPending}
              onClick={() => {
                addLogMutation.mutate({
                  contractId: contract.id,
                  actionType: logActionType,
                  explanation: logExplanation,
                });
              }}
              className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white"
            >
              {addLogMutation.isPending ? "Se salvează..." : "Salvează Eveniment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
