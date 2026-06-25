import { useRoute } from "wouter";
import { Loader2, ArrowLeft, Printer, Download, PackageOpen } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/store";
import { Link } from "wouter";

export default function BonConsumDetail() {
  const [, params] = useRoute("/bonuri-consum/:id");
  const id = Number(params?.id);

  const { data: bon, isLoading } = trpc.bonuriConsum.getById.useQuery({ id }, { enabled: !!id });

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-amber-600" /></div>;
  if (!bon) return <div className="p-8 text-center text-slate-500">Bonul de consum nu a fost găsit.</div>;

  return (
    <div className="p-4 md:p-6 max-w-full space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/bonuri-consum">
          <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <PackageOpen className="w-5 h-5 text-amber-600" />
            Bon de Consum: {bon.bon.number}
          </h1>
          <p className="text-sm text-slate-500">Gestiune: {bon.bon.gestiune || "—"}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <a href={`/api/pdf/bon-consum/${bon.bon.id}?download=1`} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 h-9 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition-colors">
            <Download className="w-4 h-4" /> Descarcă PDF
          </a>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-left">
              <th className="px-4 py-3 font-bold text-slate-500">Denumire Material</th>
              <th className="px-4 py-3 font-bold text-slate-500 text-right">Cantitate</th>
              <th className="px-4 py-3 font-bold text-slate-500 text-right">Preț Unitar</th>
              <th className="px-4 py-3 font-bold text-slate-500 text-right">Valoare</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {bon.lines.map((l: any, i: number) => (
              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">{l.description}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-right">{l.quantity}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-right">{l.unitPrice}</td>
                <td className="px-4 py-3 text-slate-900 dark:text-white text-right font-bold">{l.total} RON</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
