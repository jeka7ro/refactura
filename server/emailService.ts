import { Readable } from "stream";
import { getDb } from "./db";
import { generateReInvoicePDF } from "./pdf";
import { translateProductDescription } from "./invoiceTranslator";

const THEME_MAP: Record<string, string> = {
  blue: "#2563eb",
  teal: "#0d9488",
  green: "#16a34a",
  rose: "#e11d48",
  violet: "#7c3aed",
  navy: "#003366",
};

/**
 * Converts a Node.js Readable stream into a Buffer
 */
export function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", err => reject(err));
  });
}

/**
 * Builds the PDF Buffer and metadata for an emitted invoice by ID
 */
export async function generateEmittedInvoicePdfBuffer(invoiceId: number): Promise<{
  buffer: Buffer;
  filename: string;
  invoice: any;
  tenant: any;
}> {
  const db = await getDb();
  if (!db) {
    throw new Error("Baza de date nu este disponibilă");
  }

  const { emittedInvoices, emittedInvoiceLines, tenants, clients } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");

  const [inv] = await db
    .select()
    .from(emittedInvoices)
    .where(eq(emittedInvoices.id, invoiceId));

  if (!inv) {
    throw new Error(`Factura cu ID-ul ${invoiceId} nu a fost găsită`);
  }

  let clientRecord: any = null;
  if (inv.clientId) {
    const [c] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, inv.clientId));
    clientRecord = c;
  }

  const lines = await db
    .select()
    .from(emittedInvoiceLines)
    .where(eq(emittedInvoiceLines.emittedInvoiceId, invoiceId));

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, inv.tenantId));

  let settings: any = {};
  try {
    settings = JSON.parse(tenant?.settings || "{}");
  } catch {}

  const rawNum = (inv.number || `FACT-${invoiceId}`).trim();
  const rawSer = (inv.series || "").trim();
  const cleanDisplayNum = rawNum.toUpperCase().startsWith(rawSer.toUpperCase())
    ? rawNum
    : `${rawSer} ${rawNum}`.trim();
  const filename = `${rawNum.toUpperCase().startsWith(rawSer.toUpperCase()) ? rawNum : (rawSer ? `${rawSer}-${rawNum}` : rawNum)}.pdf`;

  const logoBase64 = settings.logoBase64 || undefined;
  const logoHasBackground = Boolean(settings.logoHasBackground);
  const logoBgColor = settings.logoBgColor || "#0f172a";
  const themeColor = settings.themeColor || (settings.theme && THEME_MAP[settings.theme]) || "#2563eb";

  let targetIBAN = (inv as any).companyIBAN || "";
  let targetBank = (inv as any).companyBank || "";

  if (!targetIBAN) {
    if (settings.bankAccounts && Array.isArray(settings.bankAccounts)) {
      const matchingAcc = settings.bankAccounts.find(
        (a: any) => a.currency?.toUpperCase() === (inv.currency || "RON").toUpperCase()
      );
      if (matchingAcc && matchingAcc.iban) {
        targetIBAN = matchingAcc.iban;
        targetBank = matchingAcc.bank || "";
      }
    }
    if (!targetIBAN && (inv.currency || "").toUpperCase() === "EUR" && settings.ibanEur) {
      targetIBAN = settings.ibanEur;
      targetBank = settings.bankEur || "";
    }
    if (!targetIBAN) {
      targetIBAN = settings.iban || "";
      targetBank = settings.bank || "";
    }
  }

  const isForeign = Boolean(
    (inv.clientCountry && inv.clientCountry !== "RO") ||
    (inv.clientCUI && !inv.clientCUI.startsWith("RO") && /^[A-Z]{2}/.test(inv.clientCUI)) ||
    (inv.currency && inv.currency !== "RON" && inv.currency !== "LEI")
  );

  const translatedLines = await Promise.all(
    lines.map(async l => ({
      description: l.description || "",
      translatedDescription: isForeign
        ? await translateProductDescription(l.description || "")
        : undefined,
      quantity: parseFloat(l.quantity || "1"),
      unitPrice: parseFloat(l.unitPrice || "0"),
      unit: l.unit || "buc",
      vatRate:
        l.vatRate !== undefined &&
        l.vatRate !== null &&
        String(l.vatRate).trim() !== ""
          ? parseFloat(String(l.vatRate))
          : 21,
      total: parseFloat(l.total || "0"),
    }))
  );

  const pdfStream = generateReInvoicePDF({
    number: cleanDisplayNum,
    date: inv.issueDate || new Date().toISOString().split("T")[0],
    dueDate: inv.dueDate || "",
    clientName: inv.clientName || clientRecord?.name || "",
    clientCUI: inv.clientCUI || clientRecord?.cui || "",
    clientAddress: inv.clientAddress || clientRecord?.address || "",
    clientCity: inv.clientCity || clientRecord?.city || "",
    clientCounty: clientRecord?.county || "",
    clientCountry: inv.clientCountry || clientRecord?.country || "",
    clientEmail: inv.clientEmail || clientRecord?.email || "",
    clientPhone: inv.clientPhone || clientRecord?.phone || "",
    companyName: tenant?.name || "",
    companyCUI: tenant?.cui || "",
    companyAddress: tenant?.address || "",
    companyCity: settings.city || "",
    companyCounty: settings.county || "",
    companyCountry: settings.country || "RO",
    companyEmail: tenant?.email || "",
    companyPhone: tenant?.phone || "",
    companyIBAN: targetIBAN,
    companyBank: targetBank,
    logoBase64,
    logoHasBackground,
    logoBgColor,
    themeColor,
    template: settings.invoiceTemplate === "modern" ? "classic" : (settings.invoiceTemplate || "classic"),
    lines: translatedLines,
    subtotal: parseFloat(inv.subtotal || "0"),
    totalVAT: parseFloat(inv.totalVAT || "0"),
    total: parseFloat(inv.total || "0"),
    currency: inv.currency || "RON",
    notes: inv.notes || undefined,
    spvIndex: inv.spvIndex || undefined,
  });

  const buffer = await streamToBuffer(pdfStream);
  return {
    buffer,
    filename,
    invoice: inv,
    tenant,
    tenantLogoBase64: settings.logoBase64 || undefined,
    representativeName: extractRepresentativeName(inv.notes),
  };
}

/**
 * Extracts representative or delegat name from invoice notes if present (e.g. "Delegat: Ion Popescu" or "Reprezentant: Ion Popescu")
 */
export function extractRepresentativeName(notes?: string | null): string | undefined {
  if (!notes) return undefined;
  const match = notes.match(/(?:delegat|reprezentant|persoan[aă] de contact)\s*:\s*([^\n\r(]+)/i);
  if (match && match[1]) {
    const raw = match[1].trim();
    if (raw && !/\b(s\.?r\.?l\.?|s\.?a\.?|p\.?f\.?a\.?|i\.?i\.?|i\.?f\.?|gmbh|ltd|llc|inc|corp)\b/i.test(raw)) {
      return raw;
    }
  }
  return undefined;
}

export interface SendInvoiceEmailParams {
  toEmail: string;
  toName?: string;
  representativeName?: string;
  invoiceNumber: string;
  invoiceDate?: string;
  dueDate?: string;
  total: number | string;
  currency?: string;
  pdfBuffer: Buffer;
  filename: string;
  companyName?: string;
  companyEmail?: string;
  companyIBAN?: string;
  companyBank?: string;
  tenantLogoBase64?: string;
}

/**
 * Sends an invoice PDF via Brevo (Sendinblue) transactional email API
 */
export async function sendInvoiceEmail(params: SendInvoiceEmailParams): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const apiKey = process.env.BREVO_API_KEY || "";
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "jeka7ro@gmail.com";
  const senderName = params.companyName || process.env.BREVO_SENDER_NAME || "TRADE INVEST NETWORK";

  if (!apiKey) {
    return { success: false, error: "Cheia API Brevo lipsește (BREVO_API_KEY)" };
  }

  if (!params.toEmail || !params.toEmail.includes("@")) {
    return { success: false, error: "Adresa de email a destinatarului este invalidă" };
  }

  const subject = `Factura fiscală ${params.invoiceNumber} - ${senderName}`;

  const formattedTotal = typeof params.total === "number"
    ? params.total.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : params.total;

  const cleanTenantLogo = params.tenantLogoBase64
    ? params.tenantLogoBase64.replace(/^data:image\/[a-z]+;base64,/, "").trim()
    : undefined;

  // Regula strictă: Dacă are numele reprezentantului, punem numele acestuia.
  // Dacă NU are numele reprezentantului, nu punem numele nimănui (nici firmă, nici client). Doar "Bună ziua," și textul.
  const repName = params.representativeName?.trim();
  const validRep = repName && !/\b(s\.?r\.?l\.?|s\.?a\.?|p\.?f\.?a\.?|i\.?i\.?|i\.?f\.?|gmbh|ltd|llc|inc|corp)\b/i.test(repName);

  const greeting = validRep
    ? `Bună ziua <strong>${repName}</strong>,`
    : `Bună ziua,`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #0f172a; padding: 26px 32px; color: #ffffff; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; color: #ffffff; }
    .header p { margin: 6px 0 0 0; font-size: 13px; color: #94a3b8; }
    .content { padding: 32px; font-size: 14px; line-height: 1.6; color: #334155; }
    .badge { display: inline-block; padding: 4px 10px; background: #eff6ff; color: #1d4ed8; font-weight: 600; font-size: 12px; border-radius: 6px; margin-bottom: 16px; }
    .card { background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; padding: 18px 20px; margin: 20px 0; }
    .card-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; font-size: 13px; }
    .card-row:last-child { border-bottom: none; font-weight: 700; font-size: 15px; color: #0f172a; padding-top: 10px; }
    .label { color: #64748b; }
    .value { font-weight: 600; color: #0f172a; text-align: right; }
    .footer { padding: 20px 32px; background: #f1f5f9; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    .attachment-notice { margin-top: 20px; padding: 12px 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; color: #166534; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Top Branding Bar with FacturaSPV logo & link to facturaspv.ro -->
    <div style="background-color: #ffffff; padding: 18px 28px; border-bottom: 1px solid #e2e8f0; text-align: center;">
      <a href="https://facturaspv.ro" target="_blank" style="text-decoration: none; display: inline-block;">
        <img src="https://facturaspv.ro/logo_spv.png" alt="Factura SPV" style="height: 38px; width: auto; max-width: 220px; display: block; border: 0; margin: 0 auto;" />
      </a>
    </div>

    <!-- Dark Banner with Tenant Logo and Tenant Name -->
    <div class="header">
      ${cleanTenantLogo ? `
      <div style="margin-bottom: 14px; text-align: center;">
        <img src="cid:tenant-logo.png" alt="${senderName}" style="max-height: 55px; max-width: 200px; display: inline-block; object-fit: contain;" />
      </div>
      ` : ""}
      <h1>${senderName}</h1>
      <p>Notificare emitere factură fiscală</p>
    </div>

    <div class="content">
      <div class="badge">Factură nouă emisă</div>
      <p>${greeting}</p>
      <p>Vă transmitem atașat în format PDF factura fiscală seria și numărul <strong>${params.invoiceNumber}</strong>.</p>
      
      <div class="card">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Număr factură:</td>
            <td style="padding: 6px 0; font-weight: 600; text-align: right; color: #0f172a; font-size: 13px;">${params.invoiceNumber}</td>
          </tr>
          ${params.invoiceDate ? `<tr>
            <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Data emiterii:</td>
            <td style="padding: 6px 0; font-weight: 600; text-align: right; color: #0f172a; font-size: 13px;">${params.invoiceDate}</td>
          </tr>` : ""}
          ${params.dueDate ? `<tr>
            <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Data scadenței:</td>
            <td style="padding: 6px 0; font-weight: 600; text-align: right; color: #0f172a; font-size: 13px;">${params.dueDate}</td>
          </tr>` : ""}
          ${params.companyIBAN ? `<tr>
            <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Cont IBAN:</td>
            <td style="padding: 6px 0; font-weight: 600; text-align: right; color: #0f172a; font-size: 13px;">${params.companyIBAN} ${params.companyBank ? `(${params.companyBank})` : ""}</td>
          </tr>` : ""}
          <tr style="border-top: 1px solid #cbd5e1;">
            <td style="padding: 10px 0 4px 0; font-weight: 700; font-size: 15px; color: #0f172a;">Total de plată:</td>
            <td style="padding: 10px 0 4px 0; font-weight: 800; font-size: 16px; text-align: right; color: #2563eb;">${formattedTotal} ${params.currency || "RON"}</td>
          </tr>
        </table>
      </div>

      <div class="attachment-notice">
        📎 <strong>Fișier atașat:</strong> Documentul fiscal complet se regăsește în atașamentul acestui email (<em>${params.filename}</em>).
      </div>

      <p style="margin-top: 24px; font-size: 13px; color: #64748b;">
        Vă mulțumim pentru colaborare!<br>
        Echipa <strong>${senderName}</strong>
      </p>
    </div>

    <!-- Footer with facturaspv.ro link -->
    <div class="footer">
      <p style="margin: 0 0 6px 0;">
        <a href="https://facturaspv.ro" target="_blank" style="color: #2563eb; text-decoration: none; font-weight: 600;">
          facturaspv.ro
        </a>
      </p>
      <div style="font-size: 12px; color: #64748b; line-height: 1.5;">
        Acest mesaj a fost generat automat prin sistemul de facturare electronică <strong>FacturaSPV</strong>.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  try {
    const attachments: Array<{ name: string; content: string }> = [
      {
        name: params.filename,
        content: params.pdfBuffer.toString("base64"),
      },
    ];

    if (cleanTenantLogo) {
      attachments.push({
        name: "tenant-logo.png",
        content: cleanTenantLogo,
      });
    }

    const payload = {
      sender: {
        name: senderName,
        email: senderEmail,
      },
      to: [
        {
          email: params.toEmail.trim(),
          name: params.toName?.trim() || params.toEmail.trim(),
        },
      ],
      replyTo: params.companyEmail ? { email: params.companyEmail.trim(), name: senderName } : undefined,
      subject,
      htmlContent,
      attachment: attachments,
    };

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errMsg = data?.message || `Brevo API HTTP ${res.status}: ${res.statusText}`;
      console.error("[EmailService] Brevo send error:", errMsg, data);
      return { success: false, error: errMsg };
    }

    console.log("[EmailService] Email sent successfully via Brevo to:", params.toEmail, "messageId:", data?.messageId);
    return { success: true, messageId: data?.messageId };
  } catch (err: any) {
    console.error("[EmailService] Exception sending email:", err);
    return { success: false, error: err.message || "Eroare necunoscută la trimiterea emailului" };
  }
}
