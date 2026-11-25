/**
 * Oblio API Sync — facturi EMISE (invoice/list) + descărcare e-Factura XML
 * Auth: email + API Secret → Bearer token → fetch invoices → save to invoiceArchive
 *
 * NOTĂ: Oblio API nu expune facturile PRIMITE (de la furnizori).
 * Facturile primite se importă manual din SPV → pagina Integrări → Import XML e-Factura.
 */
import { createInvoiceArchiveEntry, getDb } from "./db";
import { integrations, invoiceArchive, clients, emittedInvoices } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

const OBLIO_TOKEN_URL = "https://www.oblio.eu/api/authorize/token";
const OBLIO_INVOICE_LIST_URL = "https://www.oblio.eu/api/docs/invoice/list";

const cachedTokens = new Map<string, { token: string; expiresAt: number }>();

async function getOblioToken(tenantId: number, email: string, secret: string): Promise<string> {
  if (!email || !secret) {
    throw new Error("OBLIO_EMAIL sau OBLIO_API_SECRET lipsesc din DB");
  }

  const cacheKey = `${tenantId}:${email}`;
  const cached = cachedTokens.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt - 60_000) {
    return cached.token;
  }

  const res = await fetch(OBLIO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: email,
      client_secret: secret,
      grant_type: "client_credentials",
    }).toString(),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Oblio auth failed: ${res.status} ${txt}`);
  }

  const data = await res.json();
  const entry = {
    token: data.access_token,
    expiresAt: Date.now() + (parseInt(data.expires_in) || 3600) * 1000,
  };
  cachedTokens.set(cacheKey, entry);

  return entry.token;
}

export async function syncOblioInvoices(tenantId: number): Promise<{
  imported: number;
  skipped: number;
  clientsImported: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;
  let clientsImported = 0;

  try {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const [oblioIntg] = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.tenantId, tenantId),
          eq(integrations.provider, "oblio")
        )
      );

    if (!oblioIntg || oblioIntg.status !== "active" || !oblioIntg.apiSecret) {
      throw new Error(
        "Integrarea Oblio nu este configurată sau este dezactivată"
      );
    }

    let parsed: any = {};
    try {
      parsed = JSON.parse(oblioIntg.apiSecret);
    } catch {}

    const email = parsed.email;
    const secret = parsed.apiSecret || parsed.secret;
    const cif = parsed.cif;

    if (!cif) throw new Error("CIF firmă lipsește din configurarea Oblio");

    const token = await getOblioToken(tenantId, email, secret);
    console.log("[Oblio] Token obtained OK");

    let offset = 0;
    const limit = 50;
    let hasMore = true;

    while (hasMore) {
      const res = await fetch(
        `${OBLIO_INVOICE_LIST_URL}?cif=${cif}&limit=${limit}&offset=${offset}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Oblio list failed: ${res.status} ${txt}`);
      }

      const data = await res.json();
      const invoices = data.data || [];

      console.log(
        `[Oblio] Fetched ${invoices.length} invoices (offset=${offset})`
      );

      if (invoices.length < limit) {
        hasMore = false;
      }

      for (const inv of invoices) {
        try {
          const invoiceNumber = `${inv.seriesName}-${inv.number}`;
          const cleanOblioNum = invoiceNumber
            .replace(/[^A-Za-z0-9]/g, "")
            .toUpperCase()
            .replace(/^0+/, "");
          const cleanOblioCui = String(inv.client?.cif || "")
            .replace(/^RO/i, "")
            .replace(/[^A-Za-z0-9]/g, "")
            .toUpperCase();

          // Verificăm atât în invoiceArchive (inclusiv cele deja aduse din SPV ANAF pe direction='out'),
          // cât și în emittedInvoices, pentru a nu dubla facturile emise între Oblio și SPV!
          const [existing] = await db
            .select({ id: invoiceArchive.id })
            .from(invoiceArchive)
            .where(
              and(
                eq(invoiceArchive.tenantId, tenantId),
                eq(invoiceArchive.direction, "out"),
                sql`TRIM(LEADING '0' FROM UPPER(REPLACE(REPLACE(REPLACE(REPLACE(${invoiceArchive.invoiceNumber}, '-', ''), ' ', ''), '/', ''), '.', ''))) = ${cleanOblioNum}`,
                cleanOblioCui
                  ? sql`REPLACE(REPLACE(UPPER(TRIM(COALESCE(${invoiceArchive.supplierCUI}, ''))), 'RO', ''), ' ', '') = ${cleanOblioCui}`
                  : eq(invoiceArchive.invoiceNumber, invoiceNumber)
              )
            );

          if (existing) {
            skipped++;
            continue;
          }

          const [existingEmitted] = await db
            .select({ id: emittedInvoices.id })
            .from(emittedInvoices)
            .where(
              and(
                eq(emittedInvoices.tenantId, tenantId),
                sql`TRIM(LEADING '0' FROM UPPER(REPLACE(REPLACE(REPLACE(REPLACE(${emittedInvoices.number}, '-', ''), ' ', ''), '/', ''), '.', ''))) = ${cleanOblioNum}`
              )
            );

          if (existingEmitted) {
            skipped++;
            continue;
          }

          if (inv.draft === "1") {
            skipped++;
            continue;
          }

          // ── Auto-import client into clients table ──
          if (inv.client?.name && inv.client.name.trim()) {
            try {
              const clientCui = inv.client.cif || "";
              let clientExists = false;
              if (clientCui) {
                const [existingClient] = await db
                  .select({ id: clients.id })
                  .from(clients)
                  .where(
                    and(
                      eq(clients.tenantId, tenantId),
                      eq(clients.cui, clientCui)
                    )
                  );
                clientExists = !!existingClient;
              }

              if (!clientExists) {
                await db.insert(clients).values({
                  tenantId,
                  name: inv.client.name,
                  cui: clientCui || null,
                  address: inv.client.address || null,
                  city: inv.client.city || null,
                  country: "RO",
                  email: inv.client.email || null,
                  phone: inv.client.phone || null,
                  currency: inv.currency || "RON",
                  tva: inv.client.vatPayer === "1" ? 1 : 0,
                  isActive: 1,
                });
                clientsImported++;
                console.log(`[Oblio] New client added: ${inv.client.name}`);
              }
            } catch (e: any) {
              console.warn(
                `[Oblio] Could not upsert client ${inv.client.name}: ${e.message}`
              );
            }
          }

          const totalRaw = parseFloat(inv.total || "0");
          const isStorno = inv.storno === "1" || totalRaw < 0;
          const isCanceled = inv.canceled === "1";
          const total = isStorno ? -Math.abs(totalRaw) : Math.abs(totalRaw);

          const explicitVatRaw = inv.totalVat ?? inv.vat ?? inv.tva;
          let computedVat = 0;
          if (explicitVatRaw !== undefined && explicitVatRaw !== null && String(explicitVatRaw).trim() !== "") {
            const parsedVat = parseFloat(String(explicitVatRaw)) || 0;
            computedVat = parsedVat === 0 ? 0 : (isStorno ? -Math.abs(parsedVat) : Math.abs(parsedVat));
          } else if (Array.isArray(inv.products) && inv.products.length > 0) {
            const sumLineVat = inv.products.reduce((acc: number, p: any) => {
              const pVat = parseFloat(String(p.vat ?? p.vatAmount ?? "0")) || 0;
              return acc + pVat;
            }, 0);
            computedVat = sumLineVat === 0 ? 0 : (isStorno ? -Math.abs(sumLineVat) : Math.abs(sumLineVat));
          }

          await createInvoiceArchiveEntry({
            tenantId,
            source: "oblio",
            direction: "out",
            fileType: "pdf",
            fileName: `Oblio_${invoiceNumber}.pdf`,
            fileUrl: inv.link || undefined,
            invoiceNumber,
            supplierName: inv.client?.name || "",
            supplierCUI: inv.client?.cif || "",
            issueDate: inv.issueDate || "",
            dueDate: inv.dueDate || "",
            total: String(total),
            totalVAT: String(Math.round(computedVat * 100) / 100),
            currency: inv.currency || "RON",
            status: isCanceled ? "archived" : "pending",
            notes: [
              `Oblio ID: ${inv.id}`,
              isStorno ? "STORNO" : "",
              isCanceled ? "ANULATĂ" : "",
              inv.collected === "1" ? "Încasată" : "",
            ]
              .filter(Boolean)
              .join(" | "),
          });

          imported++;
        } catch (e: any) {
          errors.push(`${inv.seriesName}-${inv.number}: ${e.message}`);
        }
      }

      offset += limit;
      if (invoices.length === 0) hasMore = false;
    }

    // Update integration status in DB
    const [existing] = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.tenantId, tenantId),
          eq(integrations.provider, "oblio")
        )
      );

    if (existing) {
      await db
        .update(integrations)
        .set({
          status: "active",
          lastSyncAt: new Date(),
          syncCount: (existing.syncCount || 0) + imported,
        })
        .where(eq(integrations.id, existing.id));
    } else {
      await db.insert(integrations).values({
        tenantId,
        provider: "oblio",
        status: "active",
        lastSyncAt: new Date(),
        syncCount: imported,
      });
    }

    console.log(
      `[Oblio] Sync complete: imported=${imported}, skipped=${skipped}, clients=${clientsImported}, errors=${errors.length}`
    );
  } catch (e: any) {
    errors.push(e.message);
    console.error("[Oblio] Sync error:", e.message);
  }

  return { imported, skipped, clientsImported, errors };
}
