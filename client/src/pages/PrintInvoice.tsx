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
  const { data: tenantsData = [] } = trpc.tenants.list.useQuery();
  const tenant = (tenantsData as any[])[0];
  const settings = useMemo(() => {
    try {
      return JSON.parse(tenant?.settings || "{}");
    } catch {
      return {};
    }
  }, [tenant]);

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
            <img
              src={settings.logoBase64}
              alt="Logo"
              className="h-16 w-auto mb-4"
            />
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
          <h2 className="text-3xl font-black text-gray-800 mb-2">FACTURĂ</h2>
          <div className="text-sm text-gray-600">
            <p>
              <strong>Serie / Număr:</strong> {invoice.series} {invoice.number}
            </p>
            <p>
              <strong>Data emiterii:</strong> {formatDate(invoice.issueDate)}
            </p>
            {invoice.dueDate && (
              <p>
                <strong>Scadență:</strong> {formatDate(invoice.dueDate)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-sm font-bold text-gray-400 uppercase mb-2">
          Client
        </h3>
        <h4 className="text-lg font-bold">{invoice.clientName}</h4>
        <div className="text-sm text-gray-600">
          <p>
            <strong>CUI:</strong> {invoice.clientCUI}
          </p>
          {invoice.clientRegCom && (
            <p>
              <strong>Reg. Com:</strong> {invoice.clientRegCom}
            </p>
          )}
          {invoice.clientAddress && (
            <p>
              <strong>Adresă:</strong> {invoice.clientAddress}
            </p>
          )}
        </div>
      </div>

      <table className="w-full text-left mb-8 border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-800 text-sm">
            <th className="py-2">Nr.</th>
            <th className="py-2">Denumire produse / servicii</th>
            <th className="py-2">U.M.</th>
            <th className="py-2 text-right">Cant.</th>
            <th className="py-2 text-right">Preț unitar</th>
            <th className="py-2 text-right">Valoare</th>
            <th className="py-2 text-right">TVA</th>
          </tr>
        </thead>
        <tbody className="text-sm border-b border-gray-200">
          {invoice.lines?.map((line: any, idx: number) => (
            <tr key={idx} className="border-b border-gray-100 last:border-0">
              <td className="py-3 text-gray-500">{idx + 1}</td>
              <td className="py-3 font-medium">{line.description}</td>
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
            <span className="text-gray-600">Subtotal</span>
            <span className="font-bold">
              {formatCurrency(
                parseFloat(String(invoice.subtotal)),
                invoice.currency as any
              )}
            </span>
          </div>
          <div className="flex justify-between py-2 text-sm border-b border-gray-200">
            <span className="text-gray-600">Total TVA</span>
            <span className="font-bold">
              {formatCurrency(
                parseFloat(String(invoice.totalVAT)),
                invoice.currency as any
              )}
            </span>
          </div>
          <div className="flex justify-between py-3 text-lg font-black border-b-2 border-gray-800">
            <span>Total</span>
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
          <strong>Mențiuni:</strong> {invoice.notes}
        </div>
      )}
    </div>
  );
}
