import { sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";

/**
 * SAGA Module — Safe Migrations
 * Rulat la pornirea serverului via runSagaMigrations()
 * CREATE TABLE IF NOT EXISTS — nu distruge nimic dacă tabelul există deja.
 */
export async function runSagaMigrations(db: MySql2Database<any>) {
  console.log("[SAGA] Running migrations...");
  try {
    // ── Articole ──
    await db.execute(sql`CREATE TABLE IF NOT EXISTS sagaArticles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenantId INT NOT NULL,
      code VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      unit VARCHAR(20) DEFAULT 'buc',
      vatRate DECIMAL(5,2) DEFAULT 19.00,
      category VARCHAR(100) DEFAULT 'Marfuri',
      accountingAccount VARCHAR(20) DEFAULT '371',
      sagaCode VARCHAR(50),
      barcode VARCHAR(50),
      isActive INT DEFAULT 1,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_saga_tenant (tenantId),
      INDEX idx_saga_code (tenantId, code),
      INDEX idx_saga_name (tenantId, name(100))
    )`);

    // ── Mapare Articole ──
    await db.execute(sql`CREATE TABLE IF NOT EXISTS sagaArticleMappings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenantId INT NOT NULL,
      sagaArticleId INT NOT NULL,
      supplierCUI VARCHAR(20),
      externalName VARCHAR(512) NOT NULL,
      confidence DECIMAL(5,2) DEFAULT 100.00,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_mapping_tenant (tenantId),
      INDEX idx_mapping_article (sagaArticleId),
      INDEX idx_mapping_external (tenantId, externalName(200))
    )`);

    // ── Export History ──
    await db.execute(sql`CREATE TABLE IF NOT EXISTS sagaExportHistory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenantId INT NOT NULL,
      month INT NOT NULL,
      year INT NOT NULL,
      articlesCount INT DEFAULT 0,
      entriesCount INT DEFAULT 0,
      exitsCount INT DEFAULT 0,
      bonuriCount INT DEFAULT 0,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_export_tenant (tenantId)
    )`);

    // ── Gestiuni ──
    await db.execute(sql`CREATE TABLE IF NOT EXISTS sagaGestiuni (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenantId INT NOT NULL,
      cod VARCHAR(20) NOT NULL,
      denumire VARCHAR(255) NOT NULL,
      tipGestiune VARCHAR(50) DEFAULT 'cantitativ-valorica',
      gestionar VARCHAR(255),
      laPretVanzare INT DEFAULT 0,
      analitic371 VARCHAR(20),
      analitic378 VARCHAR(20),
      analitic4428 VARCHAR(20),
      analitic607 VARCHAR(20),
      analitic707 VARCHAR(20),
      tvaImplicit DECIMAL(5,2) DEFAULT 19.00,
      isActive INT DEFAULT 1,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_gestiuni_tenant (tenantId),
      UNIQUE INDEX idx_gestiuni_cod (tenantId, cod)
    )`);

    // ── Furnizori ──
    await db.execute(sql`CREATE TABLE IF NOT EXISTS sagaFurnizori (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenantId INT NOT NULL,
      cod VARCHAR(20) NOT NULL,
      denumire VARCHAR(255) NOT NULL,
      cui VARCHAR(20),
      regCom VARCHAR(50),
      adresa TEXT,
      judet VARCHAR(50),
      localitate VARCHAR(100),
      banca VARCHAR(255),
      contBanca VARCHAR(50),
      telefon VARCHAR(30),
      email VARCHAR(255),
      contFurnizor VARCHAR(20) DEFAULT '401',
      isActive INT DEFAULT 1,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_furnizori_tenant (tenantId),
      UNIQUE INDEX idx_furnizori_cod (tenantId, cod),
      INDEX idx_furnizori_cui (tenantId, cui)
    )`);

    // ── Intrări (Header) ──
    await db.execute(sql`CREATE TABLE IF NOT EXISTS sagaIntrari (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenantId INT NOT NULL,
      tip VARCHAR(20) DEFAULT 'Factura',
      nrIntern INT,
      nrDoc VARCHAR(50),
      codFurnizor VARCHAR(20),
      numeFurnizor VARCHAR(255),
      cuiFurnizor VARCHAR(20),
      tvaInclus INT DEFAULT 0,
      data VARCHAR(20) NOT NULL,
      scadent VARCHAR(20),
      valoare DECIMAL(12,2) DEFAULT 0,
      tva DECIMAL(12,2) DEFAULT 0,
      total DECIMAL(12,2) DEFAULT 0,
      neachitat DECIMAL(12,2) DEFAULT 0,
      idSPV VARCHAR(100),
      nirId INT,
      status VARCHAR(20) DEFAULT 'draft',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_intrari_tenant (tenantId),
      INDEX idx_intrari_data (tenantId, data),
      INDEX idx_intrari_furnizor (tenantId, codFurnizor)
    )`);

    // ── Intrări (Linii) ──
    await db.execute(sql`CREATE TABLE IF NOT EXISTS sagaIntrariLinii (
      id INT AUTO_INCREMENT PRIMARY KEY,
      intrareId INT NOT NULL,
      tip VARCHAR(30) DEFAULT 'Marfa',
      gestiuneId INT,
      articolId INT,
      cod VARCHAR(50),
      denumire VARCHAR(255) NOT NULL,
      um VARCHAR(20) DEFAULT 'buc',
      tvaPercent DECIMAL(5,2) DEFAULT 19.00,
      cantitate DECIMAL(12,3) DEFAULT 0,
      pretUnitar DECIMAL(12,4) DEFAULT 0,
      valoare DECIMAL(12,2) DEFAULT 0,
      tvaSuma DECIMAL(12,2) DEFAULT 0,
      total DECIMAL(12,2) DEFAULT 0,
      nedeductibil DECIMAL(12,2) DEFAULT 0,
      cont VARCHAR(20) DEFAULT '371',
      lineOrder INT DEFAULT 0,
      INDEX idx_intrari_linii_intrare (intrareId)
    )`);

    // ── Comenzi (Header) ──
    await db.execute(sql`CREATE TABLE IF NOT EXISTS sagaComenzi (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenantId INT NOT NULL,
      tipComanda VARCHAR(30) DEFAULT 'Productie',
      nrComanda INT,
      data VARCHAR(20) NOT NULL,
      codClient VARCHAR(20),
      denumireClient VARCHAR(255),
      adresaLivrare TEXT,
      valuta VARCHAR(3) DEFAULT 'RON',
      valoare DECIMAL(12,2) DEFAULT 0,
      total DECIMAL(12,2) DEFAULT 0,
      tva DECIMAL(12,2) DEFAULT 0,
      dataLivrarii VARCHAR(20),
      dataInchidere VARCHAR(20),
      status VARCHAR(20) DEFAULT 'draft',
      notes TEXT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_comenzi_tenant (tenantId),
      INDEX idx_comenzi_data (tenantId, data)
    )`);

    // ── Comenzi Linii (Produse finite) ──
    await db.execute(sql`CREATE TABLE IF NOT EXISTS sagaComenziLinii (
      id INT AUTO_INCREMENT PRIMARY KEY,
      comandaId INT NOT NULL,
      gestiuneId INT,
      articolId INT,
      cod VARCHAR(50),
      denumire VARCHAR(255) NOT NULL,
      um VARCHAR(20) DEFAULT 'buc',
      tvaPercent DECIMAL(5,2) DEFAULT 19.00,
      cantitate DECIMAL(12,3) DEFAULT 0,
      pretUnitar DECIMAL(12,4) DEFAULT 0,
      valoare DECIMAL(12,2) DEFAULT 0,
      total DECIMAL(12,2) DEFAULT 0,
      tvaSuma DECIMAL(12,2) DEFAULT 0,
      dataLivrarii VARCHAR(20),
      dataInchidere VARCHAR(20),
      lineOrder INT DEFAULT 0,
      INDEX idx_comenzi_linii_comanda (comandaId)
    )`);

    // ── Comenzi Consumuri (Materii prime) ──
    await db.execute(sql`CREATE TABLE IF NOT EXISTS sagaComenziConsumuri (
      id INT AUTO_INCREMENT PRIMARY KEY,
      comandaId INT NOT NULL,
      gestiuneDescarcareId INT,
      articolId INT,
      cod VARCHAR(50),
      denumire VARCHAR(255) NOT NULL,
      um VARCHAR(20) DEFAULT 'buc',
      tvaPercent DECIMAL(5,2) DEFAULT 19.00,
      cantitate DECIMAL(12,3) DEFAULT 0,
      pretUnitar DECIMAL(12,4) DEFAULT 0,
      valoare DECIMAL(12,2) DEFAULT 0,
      total DECIMAL(12,2) DEFAULT 0,
      tvaSuma DECIMAL(12,2) DEFAULT 0,
      lineOrder INT DEFAULT 0,
      INDEX idx_comenzi_consumuri_comanda (comandaId)
    )`);

    // ── Rețete (Header) ──
    await db.execute(sql`CREATE TABLE IF NOT EXISTS sagaRetete (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenantId INT NOT NULL,
      articolProdusId INT NOT NULL,
      denumire VARCHAR(255) NOT NULL,
      isActive INT DEFAULT 1,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_retete_tenant (tenantId),
      INDEX idx_retete_produs (articolProdusId)
    )`);

    // ── Rețete Linii (Materii prime per produs) ──
    await db.execute(sql`CREATE TABLE IF NOT EXISTS sagaReteteLinii (
      id INT AUTO_INCREMENT PRIMARY KEY,
      retetaId INT NOT NULL,
      articolMaterieId INT NOT NULL,
      cantitate DECIMAL(12,4) NOT NULL,
      um VARCHAR(20) DEFAULT 'buc',
      lineOrder INT DEFAULT 0,
      INDEX idx_retete_linii_reteta (retetaId)
    )`);

    // ── Articole Contabile ──
    await db.execute(sql`CREATE TABLE IF NOT EXISTS sagaArticoleContabile (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenantId INT NOT NULL,
      data VARCHAR(20) NOT NULL,
      nrDocument VARCHAR(50),
      contDebit VARCHAR(20) NOT NULL,
      contCredit VARCHAR(20) NOT NULL,
      suma DECIMAL(12,2) NOT NULL,
      valuta VARCHAR(3) DEFAULT 'RON',
      curs DECIMAL(12,4),
      sumaValuta DECIMAL(12,2),
      explicatie TEXT,
      tip VARCHAR(50),
      activitate VARCHAR(50),
      sourceType VARCHAR(20),
      sourceId INT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_artcont_tenant (tenantId),
      INDEX idx_artcont_data (tenantId, data),
      INDEX idx_artcont_source (sourceType, sourceId)
    )`);

    console.log("[SAGA] Migrations complete — 12 tables ready.");
  } catch (err: any) {
    console.error("[SAGA] Migration error:", err.message);
  }
}
