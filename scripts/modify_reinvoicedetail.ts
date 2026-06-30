import fs from "fs";
let content = fs.readFileSync("client/src/pages/ReInvoiceDetail.tsx", "utf8");

// Change component name
content = content.replace(
  /export default function InvoiceDetail\(\) \{/g,
  "export default function ReInvoiceDetail() {"
);

// Change route back link
content = content.replace(/\/facturi-primite/g, "/re-facturi");

// Change tRPC hook
content = content.replace(
  /trpc\.invoiceArchive\.getById/g,
  "trpc.reinvoice.getById"
);

// Change fields
content = content.replace(/invoice\.invoiceNumber/g, "invoice.number");
content = content.replace(
  /invoice\.supplierName/g,
  "invoice.sourceSupplierName"
);
content = content.replace(/invoice\.supplierCUI/g, "invoice.clientCUI"); // Actually we display client details instead of supplier details
content = content.replace(/Sursă/g, "Factură Sursă");
content = content.replace(/invoice\.source/g, "invoice.sourceInvoiceNumber");

// Change the PDF view route
content = content.replace(
  /const isSpv = invoice\.source === "spv_anaf";\n\s*const pdfUrl = isSpv \? `\/api\/pdf\/archive\/\${invoiceId}` : invoice\.fileUrl;/g,
  "const hasPdf = true;\n        const pdfUrl = `/api/pdf/reinvoice/${invoiceId}`;"
);

// The fileUrl blocks
content = content.replace(
  /\{invoice\.fileUrl && invoice\.fileUrl !== "spv_import" && \([\s\S]*?\}\) \(\)\}/g,
  `{/* Determine PDF URL for the download link */}
            <div className="flex justify-between">
              <span className="text-slate-500">Fișier:</span>
              <a href={\`/api/pdf/reinvoice/\${invoiceId}\`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">
                Deschide PDF
              </a>
            </div>`
);

// Change Vizualizare Factura title
content = content.replace(
  /Vizualizare Factură PDF/g,
  "Vizualizare Re-Factură PDF"
);

fs.writeFileSync("client/src/pages/ReInvoiceDetail.tsx", content);
