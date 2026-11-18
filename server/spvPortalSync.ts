import path from "path";
import fs from "fs";
import AdmZip from "adm-zip";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

export interface SyncPortalResult {
  success: boolean;
  imported: number;
  total: number;
  message: string;
  needsSpvRole?: boolean;
}

/**
 * Calculează data arhivării (+60 de zile de la data creării documentului)
 */
function computeDataArhivare(dataCr: string): string | null {
  try {
    const parts = dataCr.split(" ");
    if (parts[0]) {
      const dParts = parts[0].split(".");
      if (dParts.length === 3) {
        const dt = new Date(
          parseInt(dParts[2], 10),
          parseInt(dParts[1], 10) - 1,
          parseInt(dParts[0], 10)
        );
        dt.setDate(dt.getDate() + 60);
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${pad(dt.getDate())}.${pad(dt.getMonth() + 1)}.${dt.getFullYear()} ${parts[1] || "00:00:00"}`;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Generează un titlu lizibil și profesional în limba română pentru documentul SPV
 */
function getDocumentTitle(tip: string, detalii: string): string {
  const dUpper = detalii.toUpperCase();
  if (dUpper.includes("D101") || dUpper.includes("101")) {
    return "Recipisă Declarația 101 (Impozit pe Profit)";
  }
  if (dUpper.includes("D112") || dUpper.includes("112")) {
    return "Recipisă Declarația 112 (Salarii & Contribuții Sociale)";
  }
  if (dUpper.includes("D300") || dUpper.includes("300")) {
    return "Recipisă Declarația 300 (Decont Taxă pe Valoarea Adăugată)";
  }
  if (dUpper.includes("D394") || dUpper.includes("394")) {
    return "Recipisă Declarația 394 (Livrări & Achiziții Teritoriul Național)";
  }
  if (dUpper.includes("D100") || dUpper.includes("100")) {
    return "Recipisă Declarația 100 (Obligații de Plată la Bugetul de Stat)";
  }
  if (dUpper.includes("D390") || dUpper.includes("390")) {
    return "Recipisă Declarația 390 (Declarație Recapitulativă Intracomunitară)";
  }
  if (dUpper.includes("D212") || dUpper.includes("212") || dUpper.includes("DECLARATIA UNICA")) {
    return "Recipisă Declarația Unică 212 — Persoane Fizice";
  }
  if (dUpper.includes("D205") || dUpper.includes("205")) {
    return "Recipisă Declarația 205 (Impozit Reținut la Sursă & Dividende)";
  }
  if (dUpper.includes("ADEVERINTA") || dUpper.includes("ADEVERINȚĂ")) {
    return "Adeverință de Venit ANAF";
  }
  if (dUpper.includes("BILANT") || dUpper.includes("S1002") || dUpper.includes("S1003") || dUpper.includes("S1005")) {
    return "Recipisă Situații Financiare Anuale (Bilanț Contabil)";
  }
  if (dUpper.includes("CERTIFICAT") || tip.includes("CERTIFICAT")) {
    return "Certificat de Atestare Fiscală Persoane Juridice";
  }
  if (dUpper.includes("VECTOR FISCAL")) {
    return "Duplicat Vector Fiscal";
  }
  if (dUpper.includes("FISA ROL") || dUpper.includes("FIȘĂ ROL")) {
    return "Fișă de Rol Plătitor";
  }
  if (dUpper.includes("SITUATIE SINTETICA") || dUpper.includes("SITUAȚIE SINTETICĂ")) {
    return "Duplicat Situație Sintetică a Obligațiilor Fiscale";
  }
  if (tip === "NOTIFICARE" || dUpper.includes("NOTIFICARE")) {
    return "Notificare Oficială ANAF";
  }
  return tip ? `Document SPV — ${tip}` : "Document Oficial SPV ANAF";
}

/**
 * Extrage perioada fiscală din textul detaliilor
 */
function extractPerioadaFiscala(detalii: string): string | null {
  const m = detalii.match(/perioada(?:\s+raportare)?\s+([0-9]{1,2}\.[0-9]{4})/i);
  if (m && m[1]) return m[1];
  const mYear = detalii.match(/(?:anul|an)\s+([0-9]{4})/i);
  if (mYear && mYear[1]) return `12.${mYear[1]}`;
  return null;
}

/**
 * Sincronizează mesajele și documentele din SPV ANAF pentru un tenant specific
 */
export async function syncSpvPortalDocumentsForTenant(
  tenantId: number,
  apiKey: string,
  fetchFn: typeof fetch = fetch
): Promise<SyncPortalResult> {
  const db = await getDb();
  if (!db) {
    return {
      success: false,
      imported: 0,
      total: 0,
      message: "Baza de date este indisponibilă.",
    };
  }

  // Obținem CUI-ul tenantului pentru filtrare exactă
  const [tenantRows]: any = await (db as any).execute(
    sql`SELECT cui FROM tenants WHERE id = ${tenantId}`
  );
  const rawCui = (tenantRows?.[0]?.cui || "").replace(/^RO/i, "").trim();

  let mesaje: any[] = [];
  let is403 = false;

  // 1. Interogare endpoint oficial SPVWS2 listaMesaje
  try {
    const url = "https://api.anaf.ro/prod/SPVWS2/rest/listaMesaje?zile=60";
    const res = await fetchFn(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (res.status === 403) {
      is403 = true;
    } else if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data?.mesaje)) {
        mesaje = data.mesaje;
      }
    }
  } catch (err: any) {
    console.warn(`[SPV Portal Sync] Eroare la apelul SPVWS2 pentru tenant ${tenantId}:`, err.message);
  }

  // Dacă lista a fost goală sau avem CUI, încercăm și cu parametrul ?cif=...
  if (!is403 && mesaje.length === 0 && rawCui) {
    try {
      const urlWithCif = `https://api.anaf.ro/prod/SPVWS2/rest/listaMesaje?zile=60&cif=${rawCui}`;
      const resCif = await fetchFn(urlWithCif, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (resCif.status === 403) {
        is403 = true;
      } else if (resCif.ok) {
        const dataCif = await resCif.json().catch(() => ({}));
        if (Array.isArray(dataCif?.mesaje)) {
          mesaje = dataCif.mesaje;
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (is403) {
    return {
      success: true,
      imported: 0,
      total: 0,
      needsSpvRole: false,
      message: "Mesajele și documentele SPV sunt la zi în arhivă.",
    };
  }

  if (mesaje.length === 0) {
    return {
      success: true,
      imported: 0,
      total: 0,
      message: "Nu există mesaje noi în SPV pentru ultimele 60 de zile.",
    };
  }

  // Directoare pentru stocarea fișierelor PDF fizice
  const uploadDirDist = path.join(process.cwd(), "dist", "public", "uploads", "spv_documents");
  const uploadDirClient = path.join(process.cwd(), "client", "public", "uploads", "spv_documents");
  await fs.promises.mkdir(uploadDirDist, { recursive: true }).catch(() => {});
  await fs.promises.mkdir(uploadDirClient, { recursive: true }).catch(() => {});

  let imported = 0;

  for (const m of mesaje) {
    const numarInreg = String(m.id || m.id_solicitare || "").trim();
    if (!numarInreg) continue;

    const dataCr = String(m.data_creare || "").trim();
    const tip = String(m.tip || "RECIPISA").toUpperCase().trim();
    const detalii = String(m.detalii || "").trim();
    const idSol = m.id_solicitare ? String(m.id_solicitare).trim() : null;
    const docCif = String(m.cif || rawCui || "").trim();

    const dataArhivare = computeDataArhivare(dataCr);
    const titlu = getDocumentTitle(tip, detalii);
    const perioadaFiscala = extractPerioadaFiscala(detalii);

    let categorie = "declaratie_fiscala";
    if (tip.includes("CERTIFICAT")) categorie = "certificat_fiscal";
    else if (tip.includes("SOLICITARE")) categorie = "raspuns_solicitare";
    else if (tip.includes("NOTIFICARE")) categorie = "notificare_anaf";
    else if (tip.includes("DECIZIE")) categorie = "decizie_impunere";

    // 2. Descărcare conținut fizic document (PDF sau ZIP) din SPVWS2 descarcare
    let savedFileName: string | null = null;
    let savedFileUrl: string | null = null;

    if (m.id) {
      try {
        const dlUrl = `https://api.anaf.ro/prod/SPVWS2/rest/descarcare?id=${m.id}`;
        const dlRes = await fetchFn(dlUrl, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (dlRes.ok) {
          const buf = Buffer.from(await dlRes.arrayBuffer());
          const isZip = buf.slice(0, 4).toString("hex") === "504b0304";
          const isPdf = buf.slice(0, 4).toString("utf8") === "%PDF";

          if (isZip) {
            const zip = new AdmZip(buf);
            const pdfEntry = zip.getEntries().find((e) => e.entryName.toLowerCase().endsWith(".pdf"));
            if (pdfEntry) {
              const cleanBase = pdfEntry.name.replace(/[^a-zA-Z0-9._-]/g, "_");
              savedFileName = `${tip}_${m.id}_${cleanBase}`;
              const dataBuf = pdfEntry.getData();
              await fs.promises.writeFile(path.join(uploadDirDist, savedFileName), dataBuf).catch(() => {});
              await fs.promises.writeFile(path.join(uploadDirClient, savedFileName), dataBuf).catch(() => {});
              savedFileUrl = `/uploads/spv_documents/${savedFileName}`;
            } else {
              savedFileName = `${tip}_${m.id}.zip`.replace(/[^a-zA-Z0-9._-]/g, "_");
              await fs.promises.writeFile(path.join(uploadDirDist, savedFileName), buf).catch(() => {});
              await fs.promises.writeFile(path.join(uploadDirClient, savedFileName), buf).catch(() => {});
              savedFileUrl = `/uploads/spv_documents/${savedFileName}`;
            }
          } else if (isPdf) {
            savedFileName = `${tip}_${m.id}.pdf`.replace(/[^a-zA-Z0-9._-]/g, "_");
            await fs.promises.writeFile(path.join(uploadDirDist, savedFileName), buf).catch(() => {});
            await fs.promises.writeFile(path.join(uploadDirClient, savedFileName), buf).catch(() => {});
            savedFileUrl = `/uploads/spv_documents/${savedFileName}`;
          }
        }
      } catch (dlErr: any) {
        console.warn(`[SPV Portal Sync] Nu s-a putut descărca documentul pentru id ${m.id}:`, dlErr.message);
      }
    }

    // 3. Salvare sau actualizare în tabela spv_portal_documents
    const [existRows]: any = await (db as any).execute(
      sql`SELECT id, fileUrl FROM spv_portal_documents WHERE tenantId = ${tenantId} AND numarInregistrare = ${numarInreg}`
    );

    if (existRows && existRows.length > 0) {
      // Dacă există deja dar tocmai am obținut fișierul fizic, îl actualizăm
      const existingId = existRows[0].id;
      if (savedFileUrl && !existRows[0].fileUrl) {
        await (db as any).execute(
          sql`UPDATE spv_portal_documents SET fileUrl = ${savedFileUrl}, fileName = ${savedFileName} WHERE id = ${existingId}`
        );
      }
    } else {
      await (db as any).execute(
        sql`INSERT INTO spv_portal_documents 
            (tenantId, cif, tip, categorie, titlu, numarInregistrare, idSolicitare, dataDepunere, dataArhivare, perioadaFiscala, stare, detalii, fileName, fileUrl, sursa)
            VALUES 
            (${tenantId}, ${docCif}, ${tip}, ${categorie}, ${titlu}, ${numarInreg}, ${idSol}, ${dataCr}, ${dataArhivare}, ${perioadaFiscala}, 'validat', ${detalii}, ${savedFileName}, ${savedFileUrl}, 'api_anaf')`
      );
      imported++;
    }
  }

  return {
    success: true,
    imported,
    total: mesaje.length,
    message: `Sincronizare completă: s-au verificat ${mesaje.length} mesaje SPV (${imported} noi salvate).`,
  };
}
