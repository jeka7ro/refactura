import "dotenv/config";
import xlsx from "xlsx";
import { getDb } from "../server/db";
import { clients } from "../drizzle/schema";
import { sagaFurnizori } from "../modules/saga/schema";
import { eq, and, sql } from "drizzle-orm";

const cleanStr = (v: any): string => {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  return s === "-/-/-" ? "" : s;
};

const cleanCui = (v: any): string => {
  if (!v) return "";
  let s = String(v).trim().toUpperCase().replace(/\s+/g, "");
  return s === "-/-/-" ? "" : s;
};

const normalizeCuiMatch = (v: any): string => {
  if (!v) return "";
  return String(v).trim().toUpperCase().replace(/\s+/g, "").replace(/^RO/i, "");
};

async function main() {
  console.log("=== START SAGA PARTNERS IMPORT (OCTOBER 2026) ===");
  const db = await getDb();
  if (!db) {
    console.error("Database connection failed!");
    process.exit(1);
  }

  const readFile = (xlsx as any).readFile || (xlsx as any).default?.readFile;
  const sheetToJson = (xlsx as any).utils?.sheet_to_json || (xlsx as any).default?.utils?.sheet_to_json;

  // 1. Read Clients Excel
  const clientsFile = "./XLS-1510-132739.XLS";
  const wbClients = readFile(clientsFile);
  const clientsData = sheetToJson(wbClients.Sheets[wbClients.SheetNames[0]]) as any[];
  console.log(`Read ${clientsData.length} client rows from ${clientsFile}`);

  // 2. Read Suppliers Excel
  const suppliersFile = "./XLS-1510-133328.XLS";
  const wbSuppliers = readFile(suppliersFile);
  const suppliersData = sheetToJson(wbSuppliers.Sheets[wbSuppliers.SheetNames[0]]) as any[];
  console.log(`Read ${suppliersData.length} supplier rows from ${suppliersFile}`);

  const TARGET_TENANT_ID = 4; // WOOD GLASS SRL (RoWood)

  // -------------------------------------------------------------
  // A. PROCESS CLIENȚI (isSupplier = 0)
  // -------------------------------------------------------------
  console.log(`\n--- Processing Clienți for Tenant ${TARGET_TENANT_ID} ---`);
  const [existingClientsRaw] = await db.execute(
    sql`SELECT id, name, cui, sagaCode, country, currency FROM clients WHERE tenantId = ${TARGET_TENANT_ID} AND isSupplier = 0`
  );
  const existingClients = existingClientsRaw as any[];
  console.log(`Found ${existingClients.length} existing clients in DB.`);

  // Build maps: exact sagaCode map, and unclaimed pool for records without sagaCode
  const clientByExactCode = new Map<string, any>();
  const unclaimedClientsWithoutCode: any[] = [];

  for (const ec of existingClients) {
    if (ec.sagaCode) {
      clientByExactCode.set(cleanStr(ec.sagaCode), ec);
    } else {
      unclaimedClientsWithoutCode.push(ec);
    }
  }

  let clientsUpdated = 0;
  let clientsInserted = 0;

  for (const row of clientsData) {
    const code = cleanStr(row.cod);
    const name = cleanStr(row.denumire);
    const cui = cleanCui(row.cod_fiscal);
    const normCui = normalizeCuiMatch(row.cod_fiscal);
    const regCom = cleanStr(row.reg_com);
    const address = cleanStr(row.adresa);
    const city = cleanStr(row.localitate) || cleanStr(row.judet);
    const country = cleanStr(row.tara).toUpperCase() || "RO";
    const currency = country !== "RO" ? "EUR" : "RON";
    const phone = cleanStr(row.tel);
    const email = cleanStr(row.email);

    // 1. First priority: match exact sagaCode
    let match = code ? clientByExactCode.get(code) : null;

    // 2. Second priority: if not matched by code, match an unassigned record without sagaCode
    if (!match && unclaimedClientsWithoutCode.length > 0) {
      const idx = unclaimedClientsWithoutCode.findIndex(u => {
        const uNormCui = normalizeCuiMatch(u.cui);
        if (normCui && uNormCui && normCui === uNormCui) return true;
        if (name && cleanStr(u.name).toLowerCase() === name.toLowerCase()) return true;
        return false;
      });
      if (idx !== -1) {
        match = unclaimedClientsWithoutCode.splice(idx, 1)[0];
      }
    }

    if (match) {
      await db.update(clients).set({
        name: name || match.name,
        cui: cui || match.cui,
        sagaCode: code || match.sagaCode,
        regCom: regCom || match.regCom,
        address: address || match.address,
        city: city || match.city,
        country: country || match.country,
        currency: currency || match.currency,
        phone: phone || match.phone,
        email: email || match.email,
        isActive: 1,
      }).where(eq(clients.id, match.id));
      clientsUpdated++;
    } else {
      await db.insert(clients).values({
        tenantId: TARGET_TENANT_ID,
        name: name || `Client ${code}`,
        cui: cui || "",
        sagaCode: code || null,
        regCom: regCom || "",
        address: address || "",
        city: city || "",
        country: country || "RO",
        currency: currency || "RON",
        phone: phone || "",
        email: email || "",
        isSupplier: 0,
        isActive: 1,
        totalInvoiced: "0.00",
        invoiceCount: 0,
        reInvoiceCount: 0,
      });
      clientsInserted++;
    }
  }
  console.log(`Clienți completed: ${clientsUpdated} updated, ${clientsInserted} inserted.`);

  // -------------------------------------------------------------
  // B. PROCESS FURNIZORI (isSupplier = 1)
  // -------------------------------------------------------------
  console.log(`\n--- Processing Furnizori for Tenant ${TARGET_TENANT_ID} ---`);
  const [existingSuppliersRaw] = await db.execute(
    sql`SELECT id, name, cui, sagaCode, country, currency FROM clients WHERE tenantId = ${TARGET_TENANT_ID} AND isSupplier = 1`
  );
  const existingSuppliers = existingSuppliersRaw as any[];
  console.log(`Found ${existingSuppliers.length} existing suppliers in DB.`);

  const supplierByExactCode = new Map<string, any>();
  const unclaimedSuppliersWithoutCode: any[] = [];

  for (const es of existingSuppliers) {
    if (es.sagaCode) {
      supplierByExactCode.set(cleanStr(es.sagaCode), es);
    } else {
      unclaimedSuppliersWithoutCode.push(es);
    }
  }

  let suppliersUpdated = 0;
  let suppliersInserted = 0;

  for (const row of suppliersData) {
    const code = cleanStr(row.cod);
    const name = cleanStr(row.denumire);
    const cui = cleanCui(row.cod_fiscal);
    const normCui = normalizeCuiMatch(row.cod_fiscal);
    const regCom = cleanStr(row.reg_com);
    const address = cleanStr(row.adresa);
    const city = cleanStr(row.localitate) || cleanStr(row.judet);
    const country = cleanStr(row.tara).toUpperCase() || "RO";
    const tipTert = cleanStr(row.tip_tert).toUpperCase();
    const currency = (country !== "RO" || tipTert === "E") ? "EUR" : "RON";
    const phone = cleanStr(row.tel);
    const email = cleanStr(row.email);
    const tva = row.is_tva ? 1 : 0;

    let match = code ? supplierByExactCode.get(code) : null;

    if (!match && unclaimedSuppliersWithoutCode.length > 0) {
      const idx = unclaimedSuppliersWithoutCode.findIndex(u => {
        const uNormCui = normalizeCuiMatch(u.cui);
        if (normCui && uNormCui && normCui === uNormCui) return true;
        if (name && cleanStr(u.name).toLowerCase() === name.toLowerCase()) return true;
        return false;
      });
      if (idx !== -1) {
        match = unclaimedSuppliersWithoutCode.splice(idx, 1)[0];
      }
    }

    if (match) {
      await db.update(clients).set({
        name: name || match.name,
        cui: cui || match.cui,
        sagaCode: code || match.sagaCode,
        regCom: regCom || match.regCom,
        address: address || match.address,
        city: city || match.city,
        country: country || match.country,
        currency: currency || match.currency,
        phone: phone || match.phone,
        email: email || match.email,
        tva: tva,
        isActive: 1,
      }).where(eq(clients.id, match.id));
      suppliersUpdated++;
    } else {
      await db.insert(clients).values({
        tenantId: TARGET_TENANT_ID,
        name: name || `Furnizor ${code}`,
        cui: cui || "",
        sagaCode: code || null,
        regCom: regCom || "",
        address: address || "",
        city: city || "",
        country: country || "RO",
        currency: currency || "RON",
        phone: phone || "",
        email: email || "",
        tva: tva,
        isSupplier: 1,
        isActive: 1,
        totalInvoiced: "0.00",
        invoiceCount: 0,
        reInvoiceCount: 0,
      });
      suppliersInserted++;
    }
  }
  console.log(`Furnizori completed: ${suppliersUpdated} updated, ${suppliersInserted} inserted.`);

  // -------------------------------------------------------------
  // C. POPULATE SAGA FURNIZORI TABLE (Tenant 4)
  // -------------------------------------------------------------
  console.log(`\n--- Syncing sagaFurnizori table for Tenant ${TARGET_TENANT_ID} ---`);
  const [existingSagaFurnizoriRaw] = await db.execute(
    sql`SELECT id, cod FROM sagaFurnizori WHERE tenantId = ${TARGET_TENANT_ID}`
  );
  const existingSagaCodes = new Set((existingSagaFurnizoriRaw as any[]).map(r => cleanStr(r.cod)));

  let sagaUpdated = 0;
  let sagaInserted = 0;

  for (const row of suppliersData) {
    const code = cleanStr(row.cod);
    const name = cleanStr(row.denumire);
    const cui = cleanCui(row.cod_fiscal);
    const regCom = cleanStr(row.reg_com);
    const address = cleanStr(row.adresa);
    const judet = cleanStr(row.judet);
    const localitate = cleanStr(row.localitate);
    const banca = cleanStr(row.banca);
    const contBanca = cleanStr(row.cont_banca);
    const phone = cleanStr(row.tel);
    const email = cleanStr(row.email);
    const analitic = cleanStr(row.analitic) || "401";

    if (existingSagaCodes.has(code)) {
      await db.update(sagaFurnizori).set({
        denumire: name,
        cui: cui || null,
        regCom: regCom || null,
        adresa: address || null,
        judet: judet || null,
        localitate: localitate || null,
        banca: banca || null,
        contBanca: contBanca || null,
        telefon: phone || null,
        email: email || null,
        contFurnizor: analitic,
        isActive: 1,
      }).where(and(eq(sagaFurnizori.tenantId, TARGET_TENANT_ID), eq(sagaFurnizori.cod, code)));
      sagaUpdated++;
    } else {
      await db.insert(sagaFurnizori).values({
        tenantId: TARGET_TENANT_ID,
        cod: code,
        denumire: name,
        cui: cui || null,
        regCom: regCom || null,
        adresa: address || null,
        judet: judet || null,
        localitate: localitate || null,
        banca: banca || null,
        contBanca: contBanca || null,
        telefon: phone || null,
        email: email || null,
        contFurnizor: analitic,
        isActive: 1,
      });
      sagaInserted++;
    }
  }
  console.log(`sagaFurnizori sync completed: ${sagaUpdated} updated, ${sagaInserted} inserted.`);

  // -------------------------------------------------------------
  // D. FINAL VERIFICATION & COUNTS
  // -------------------------------------------------------------
  console.log(`\n=== FINAL COUNTS FOR TENANT ${TARGET_TENANT_ID} ===`);
  const [cCount] = await db.select({ count: sql`count(*)` }).from(clients).where(eq(clients.tenantId, TARGET_TENANT_ID));
  const [cClients] = await db.select({ count: sql`count(*)` }).from(clients).where(sql`${clients.tenantId} = ${TARGET_TENANT_ID} AND ${clients.isSupplier} = 0`);
  const [cSuppliers] = await db.select({ count: sql`count(*)` }).from(clients).where(sql`${clients.tenantId} = ${TARGET_TENANT_ID} AND ${clients.isSupplier} = 1`);
  const [cIntern] = await db.select({ count: sql`count(*)` }).from(clients).where(sql`${clients.tenantId} = ${TARGET_TENANT_ID} AND (${clients.country} = 'RO' OR ${clients.country} IS NULL) AND (${clients.currency} = 'RON' OR ${clients.currency} IS NULL)`);
  const [cExtern] = await db.select({ count: sql`count(*)` }).from(clients).where(sql`${clients.tenantId} = ${TARGET_TENANT_ID} AND (${clients.country} != 'RO' OR ${clients.currency} = 'EUR')`);
  const [cSagaF] = await db.select({ count: sql`count(*)` }).from(sagaFurnizori).where(eq(sagaFurnizori.tenantId, TARGET_TENANT_ID));

  console.log(`Total Partners in clients table: ${cCount.count}`);
  console.log(`- Clienți: ${cClients.count}`);
  console.log(`- Furnizori: ${cSuppliers.count}`);
  console.log(`- Regim Intern (RON): ${cIntern.count}`);
  console.log(`- Regim Extern (EUR): ${cExtern.count}`);
  console.log(`Total Furnizori in sagaFurnizori table: ${cSagaF.count}`);

  process.exit(0);
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
