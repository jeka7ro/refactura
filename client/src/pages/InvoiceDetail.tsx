// InvoiceDetail — RefacturaRO
// View a single imported invoice with all lines

import { Link, useParams } from "wouter";
import { ArrowLeft, ArrowRight, FileText, Building2, Calendar, Hash, Globe } from "lucide-react";
import {
  mockInvoices,
  formatCurrency,
  formatDate,
  invoiceStatusLabels,
  invoiceStatusColors,
  sourceColors,
} from "@/lib/store";

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const invoice = mockInvoices.find((i) => i.id === id);

  if (!invoice) {
    return (
      <div className="p-8 text-center">
        <div className="text-slate-500">Factura nu a fost găsită.</div>
        <Link href="/facturi-primite">
          <button className="mt-4 px-5 h-10 rounded-full bg-blue-600 text-white text-sm font-bold">← Înapoi</button>
        </Link>
      </div>
    );
  }

  const subtotal = invoice.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const vat = invoice.lines.reduce((s, l) => s + l.quantity * l.unitPrice * (l.vatRate / 100), 0);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/facturi-primite">
            <button className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Factură {invoice.number}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Importată din {invoice.source} · {formatDate(invoice.importedAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-sm font-bold border ${invoiceStatusColors[invoice.status]}`}>
            {invoiceStatusLabels[invoice.status]}
          </span>
          <Link href={`/re-facturare/${invoice.id}`}>
            <button className="flex items-center gap-2 px-5 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all active:scale-[0.97]">
              Re-facturează
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Supplier Info */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Furnizor</span>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-slate-900 dark:text-white">{invoice.supplierName}</div>
            <div className="text-xs text-slate-500">CUI: {invoice.supplierCUI}</div>
          </div>
        </div>

        {/* Invoice Info */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Hash className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Detalii Factură</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Număr:</span>
              <span className="text-slate-900 dark:text-white">{invoice.number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Dată:</span>
              <span className="text-slate-900 dark:text-white">{formatDate(invoice.date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Scadență:</span>
              <span className="text-slate-900 dark:text-white">{formatDate(invoice.dueDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Sursă:</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${sourceColors[invoice.source]}`}>{invoice.source}</span>
            </div>
          </div>
        </div>

        {/* Totals */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Totaluri</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal:</span>
              <span className="text-slate-900 dark:text-white">{formatCurrency(subtotal, invoice.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">TVA (19%):</span>
              <span className="text-slate-900 dark:text-white">{formatCurrency(vat, invoice.currency)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-2 mt-2">
              <span className="text-slate-900 dark:text-white">Total:</span>
              <span className="text-blue-600">{formatCurrency(invoice.total, invoice.currency)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lines Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Linii Factură</h2>
          <p className="text-xs text-slate-500 mt-0.5">{invoice.lines.length} produse/servicii</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="text-left px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">#</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Descriere</th>
                <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Cant.</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">U.M.</th>
                <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Preț Unitar</th>
                <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">TVA</th>
                <th className="text-right px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {invoice.lines.map((line, idx) => (
                <tr key={line.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 text-xs text-slate-400">{idx + 1}</td>
                  <td className="px-4 py-4 text-sm text-slate-900 dark:text-white max-w-xs">{line.description}</td>
                  <td className="px-4 py-4 text-sm text-right text-slate-700 dark:text-slate-300">{line.quantity}</td>
                  <td className="px-4 py-4 text-sm text-slate-500">{line.unit}</td>
                  <td className="px-4 py-4 text-sm text-right text-slate-700 dark:text-slate-300">{formatCurrency(line.unitPrice, line.currency)}</td>
                  <td className="px-4 py-4 text-sm text-right text-slate-500">{line.vatRate}%</td>
                  <td className="px-6 py-4 text-sm text-right text-slate-900 dark:text-white">
                    {formatCurrency(line.quantity * line.unitPrice * (1 + line.vatRate / 100), line.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <td colSpan={5} />
                <td className="px-4 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Total cu TVA:</td>
                <td className="px-6 py-4 text-base text-blue-600 text-right">{formatCurrency(invoice.total, invoice.currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
