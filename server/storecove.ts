import { ReInvoice, ReInvoiceLine, Client, Tenant } from "../drizzle/schema";

export interface StorecoveInvoiceMappingProps {
  invoice: ReInvoice;
  lines: ReInvoiceLine[];
  tenant: Tenant; // The sender (your company)
  client: Client; // The receiver (customer)
}

/**
 * Maps our internal smart invoice model to the Storecove JSON format 
 * for sending a document to the Peppol network (Belgium).
 * 
 * Based on Peppol BIS Billing 3.0 / Storecove API structure.
 */
export function mapToStorecoveInvoice(props: StorecoveInvoiceMappingProps) {
  const { invoice, lines, tenant, client } = props;

  // Format dates: typically YYYY-MM-DD
  const issueDate = invoice.issueDate.split("T")[0] || invoice.issueDate;
  const dueDate = invoice.dueDate ? invoice.dueDate.split("T")[0] : issueDate;

  // In Belgium, the company ID must be the KBO (BCE) number.
  // Example KBO format: 0123456789 or 0123.456.789
  const senderKbo = tenant.cui || ""; 
  const receiverKbo = client.cui || "";

  return {
    documentType: "invoice",
    document: {
      invoice: {
        invoiceNumber: invoice.number,
        issueDate: issueDate,
        dueDate: dueDate,
        documentCurrencyCode: invoice.currency || "EUR",
        
        accountingSupplierParty: {
          party: {
            companyName: tenant.name,
            address: {
              country: "BE", // Belgian sender
            },
            partyLegalEntity: {
              companyId: senderKbo 
            },
            contact: {
              email: tenant.email,
              telephone: tenant.phone || undefined
            }
          }
        },

        accountingCustomerParty: {
          party: {
            companyName: client.name,
            address: {
              city: client.city || undefined,
              country: client.country || "BE"
            },
            partyLegalEntity: {
              companyId: receiverKbo // Client's KBO
            },
            contact: {
              email: client.email || undefined,
              telephone: client.phone || undefined
            }
          }
        },

        invoiceLines: lines.map((line, index) => {
          return {
            id: String(index + 1),
            invoicedQuantity: Number(line.quantity),
            lineExtensionAmount: Number(line.total),
            item: {
              name: line.description,
              classifiedTaxCategory: {
                id: "S", // S = Standard rate
                percent: Number(line.vatRate || 21), // Standard BE VAT is 21%
                taxScheme: { id: "VAT" }
              }
            },
            price: {
              priceAmount: Number(line.unitPrice),
              baseQuantity: 1
            }
          };
        }),
        
        // Peppol usually requires explicitly defined tax subtotals
        taxSubtotals: [
          {
            taxableAmount: Number(invoice.subtotal),
            taxAmount: Number(invoice.totalVAT),
            taxCategory: {
              id: "S",
              percent: lines.length > 0 ? Number(lines[0].vatRate || 21) : 21,
              taxScheme: { id: "VAT" }
            }
          }
        ],
        
        // Total amounts
        amountIncludingTax: Number(invoice.total),
        amountIncludingVat: Number(invoice.total)
      }
    }
  };
}

/**
 * Service to send an invoice to Storecove Peppol Network.
 */
export async function sendInvoiceToStorecove(apiKey: string, invoicePayload: any) {
  const response = await fetch("https://api.storecove.com/api/v2/document_submissions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({
      // We send it to a routing destination, in this case identified by KBO on Peppol
      routing: {
        network: "peppol",
        scheme: "iso6523-actorid-upis", 
        // 0208 is the scheme ID for Belgian KBO
        id: `0208:${invoicePayload.document.invoice.accountingCustomerParty.party.partyLegalEntity.companyId}`
      },
      ...invoicePayload
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Storecove API Error: ${response.status} - ${errorBody}`);
  }

  return await response.json();
}
