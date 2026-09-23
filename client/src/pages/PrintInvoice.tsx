import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatCurrency, formatDate } from "@/lib/store";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo } from "react";

export default function PrintInvoice() {
  const { id } = useParams<{ id: string }>();
  const { data: invoice, isLoading } = trpc.emittedInvoice.getById.useQuery(
    { id: Number(id) },
    { enabled: !!id }
  );
  const { data: currentTenantObj } = trpc.tenants.current.useQuery();
  const { data: tenantsData = [] } = trpc.tenants.list.useQuery();
  const tenant = currentTenantObj || (tenantsData as any[])[0]?.tenants || (tenantsData as any[])[0];
  const settings = useMemo(() => {
    try {
      return JSON.parse(tenant?.settings || "{}");
    } catch {
      return {};
    }
  }, [tenant]);

  const totalDueColor = useMemo(() => {
    const THEME_COLORS: Record<string, string> = {
      blue: "#2563eb",
      teal: "#0d9488",
      green: "#16a34a",
      rose: "#e11d48",
      violet: "#7c3aed",
      navy: "#003366",
    };
    return (
      settings.themeColor ||
      (settings.theme && THEME_COLORS[settings.theme]) ||
      "#2563eb"
    );
  }, [settings]);

  const isForeign = useMemo(() => {
    const country = (invoice?.clientCountry || "").trim().toUpperCase();
    if (country && country !== "RO") return true;
    const cui = (invoice?.clientCUI || "").trim().toUpperCase();
    if (cui && !cui.startsWith("RO") && /^[A-Z]{2}/.test(cui)) return true;
    const curr = (invoice?.currency || "").trim().toUpperCase();
    if (curr && curr !== "RON" && curr !== "LEI") return true;
    return false;
  }, [invoice]);

  useEffect(() => {
    if (invoice && tenant && !window.location.search.includes("view=1")) {
      setTimeout(() => window.print(), 500);
    }
  }, [invoice, tenant]);

  if (isLoading)
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
      </div>
    );
  if (!invoice)
    return (
      <div className="p-8 text-center text-red-500 font-bold">
        Factura nu a fost găsită.
      </div>
    );

  return (
    <div
      className="bg-white p-8 max-w-[800px] mx-auto text-black"
      style={{ minHeight: "100vh" }}
    >
      <div className="flex justify-between items-start border-b border-gray-200 pb-8 mb-8">
        <div>
          {settings.logoBase64 ? (
            settings.logoHasBackground ? (
              <div
                className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-xl mb-4 shadow-sm border"
                style={{
                  backgroundColor: settings.logoBgColor || "#0f172a",
                  borderColor: settings.logoBgColor || "#0f172a",
                }}
              >
                <img
                  src={settings.logoBase64}
                  alt="Logo"
                  className="h-9 w-auto object-contain"
                />
              </div>
            ) : (
              <div className="inline-flex items-center mb-4">
                <img
                  src={settings.logoBase64}
                  alt="Logo"
                  className="h-10 w-auto max-w-[160px] object-contain"
                />
              </div>
            )
          ) : (
            <h1 className="text-2xl font-black mb-4">{tenant?.name}</h1>
          )}
          <div className="text-sm text-gray-600 leading-relaxed">
            <p>
              <strong>CUI:</strong> {tenant?.cui}
            </p>
            {settings.regCom && (
              <p>
                <strong>Reg. Com:</strong> {settings.regCom}
              </p>
            )}
            {settings.address && (
              <p>
                <strong>Adresă:</strong> {settings.address}
                {settings.city ? `, ${settings.city}` : ""}
              </p>
            )}
            {settings.iban && (
              <p>
                <strong>IBAN:</strong> {settings.iban}
              </p>
            )}
            {settings.bank && (
              <p>
                <strong>Bancă:</strong> {settings.bank}
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-black text-gray-800 mb-2">
            {isForeign ? "FACTURĂ / INVOICE" : "FACTURĂ"}
          </h2>
          <div className="text-sm text-gray-600">
            <p>
              <strong>{isForeign ? "Serie / Număr (Series / No):" : "Serie / Număr:"}</strong> {(invoice.number || "").toUpperCase().startsWith((invoice.series || "").toUpperCase()) ? invoice.number : `${invoice.series} ${invoice.number}`.trim()}
            </p>
            <p>
              <strong>{isForeign ? "Data emiterii / Issue date:" : "Data emiterii:"}</strong> {formatDate(invoice.issueDate)}
            </p>
            {invoice.dueDate && (
              <p>
                <strong>{isForeign ? "Scadență / Due date:" : "Scadență:"}</strong> {formatDate(invoice.dueDate)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-sm font-bold text-gray-400 uppercase mb-2">
          {isForeign ? "Client / Customer" : "Client"}
        </h3>
        <h4 className="text-lg font-bold">{invoice.clientName}</h4>
        <div className="text-sm text-gray-600">
          <p>
            <strong>{isForeign ? "CIF / VAT ID:" : "CUI:"}</strong> {invoice.clientCUI}
          </p>
          {invoice.clientRegCom && (
            <p>
              <strong>{isForeign ? "Reg. Com. / Trade Reg.:" : "Reg. Com.:"}</strong> {invoice.clientRegCom}
            </p>
          )}
          {invoice.clientAddress && (
            <p>
              <strong>{isForeign ? "Adresă / Address:" : "Adresă:"}</strong> {invoice.clientAddress}
            </p>
          )}
        </div>
      </div>

      <table className="w-full text-left mb-8 border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-800 text-sm">
            <th className="py-2">{isForeign ? "Nr. / No." : "Nr."}</th>
            <th className="py-2">{isForeign ? "Denumire / Description" : "Denumire produse / servicii"}</th>
            <th className="py-2">{isForeign ? "U.M. / Unit" : "U.M."}</th>
            <th className="py-2 text-right">{isForeign ? "Cant. / Qty" : "Cant."}</th>
            <th className="py-2 text-right">{isForeign ? "Preț unitar / Unit price" : "Preț unitar"}</th>
            <th className="py-2 text-right">{isForeign ? "Valoare / Amount" : "Valoare"}</th>
            <th className="py-2 text-right">{isForeign ? "TVA / VAT" : "TVA"}</th>
          </tr>
        </thead>
        <tbody className="text-sm border-b border-gray-200">
          {invoice.lines?.map((line: any, idx: number) => (
            <tr key={idx} className="border-b border-gray-100 last:border-0">
              <td className="py-3 text-gray-500">{idx + 1}</td>
              <td className="py-3 font-medium">
                <div>{line.description}</div>
                {isForeign &&
                  line.translatedDescription &&
                  line.translatedDescription.trim() &&
                  line.translatedDescription.trim().toLowerCase() !==
                    line.description.trim().toLowerCase() && (
                    <div className="text-xs text-slate-500 font-normal mt-0.5">
                      {line.translatedDescription}
                    </div>
                  )}
              </td>
              <td className="py-3 text-gray-500">{line.unit}</td>
              <td className="py-3 text-right">{line.quantity}</td>
              <td className="py-3 text-right">
                {formatCurrency(
                  parseFloat(String(line.unitPrice)),
                  invoice.currency as any
                )}
              </td>
              <td className="py-3 text-right">
                {formatCurrency(
                  parseFloat(String(line.totalAmount)),
                  invoice.currency as any
                )}
              </td>
              <td className="py-3 text-right">{line.vatRate}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end mb-12">
        <div className="w-64">
          <div className="flex justify-between py-2 text-sm border-b border-gray-200">
            <span className="text-gray-600">{isForeign ? "Subtotal (excl. VAT)" : "Subtotal"}</span>
            <span className="font-bold">
              {formatCurrency(
                parseFloat(String(invoice.subtotal)),
                invoice.currency as any
              )}
            </span>
          </div>
          <div className="flex justify-between py-2 text-sm border-b border-gray-200">
            <span className="text-gray-600">{isForeign ? "Total TVA / Total VAT" : "Total TVA"}</span>
            <span className="font-bold">
              {formatCurrency(
                parseFloat(String(invoice.totalVAT)),
                invoice.currency as any
              )}
            </span>
          </div>
          <div
            className="flex justify-between py-2.5 px-3 text-base font-black text-white rounded-lg shadow-sm mt-2"
            style={{ backgroundColor: totalDueColor }}
          >
            <span>{isForeign ? "TOTAL DE PLATĂ / TOTAL DUE:" : "TOTAL DE PLATĂ:"}</span>
            <span>
              {formatCurrency(
                parseFloat(String(invoice.total)),
                invoice.currency as any
              )}
            </span>
          </div>
        </div>
      </div>

      {invoice.notes && (
        <div className="text-sm text-gray-500 border-t border-gray-200 pt-4">
          <strong>{isForeign ? "Mențiuni / Notes:" : "Mențiuni:"}</strong> {invoice.notes}
        </div>
      )}
    </div>
  );
}
