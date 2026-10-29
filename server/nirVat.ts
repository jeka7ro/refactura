import { and, eq } from "drizzle-orm";
import * as schema from "../drizzle/schema";

/**
 * Detectează dacă o factură din arhivă (SPV) este cu TAXARE INVERSĂ (categoria UBL "AE")
 * și are TVA total 0. În acest caz, NIR-ul NU trebuie să calculeze TVA, indiferent de
 * cota TVA a articolului din nomenclator.
 */
export function isReverseChargeInvoice(inv: { rawXml?: string | null; totalVAT?: any } | null | undefined): boolean {
  if (!inv) return false;
  const vat = parseFloat(String(inv.totalVAT ?? "0"));
  if (!isNaN(vat) && Math.abs(vat) > 0.0001) return false;
  const xml = String(inv.rawXml || "");
  if (!xml) return false;
  return /<(?:cbc:)?ID>\s*AE\s*<\/(?:cbc:)?ID>/.test(xml);
}

export async function isReverseChargeArchiveId(
  db: any,
  tenantId: number,
  invoiceArchiveId: number | null | undefined
): Promise<boolean> {
  if (!invoiceArchiveId) return false;
  const [inv] = await db
    .select({ rawXml: schema.invoiceArchive.rawXml, totalVAT: schema.invoiceArchive.totalVAT })
    .from(schema.invoiceArchive)
    .where(and(eq(schema.invoiceArchive.id, invoiceArchiveId), eq(schema.invoiceArchive.tenantId, tenantId)));
  return isReverseChargeInvoice(inv);
}

