import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Seed modules
const modulesData = [
  {
    slug: "refacturare",
    name: "Refacturare",
    description: "Importă facturi primite și emite automat re-facturi către clienți. Economisești ore de muncă manuală în fiecare lună.",
    icon: "FileOutput",
    color: "#3B82F6",
    isCombo: 0,
    comboModules: null,
    sortOrder: 1,
    isActive: 1,
  },
  {
    slug: "gestiune-costuri",
    name: "Gestiune Costuri",
    description: "Urmărește costurile pe centre de cost, generează rapoarte detaliate și ține evidența bugetelor în timp real.",
    icon: "BarChart3",
    color: "#8B5CF6",
    isCombo: 0,
    comboModules: null,
    sortOrder: 2,
    isActive: 1,
  },
  {
    slug: "combo",
    name: "Combo — Ambele Module",
    description: "Acces complet la Refacturare + Gestiune Costuri. Soluția completă pentru companii care vor să automatizeze tot fluxul financiar.",
    icon: "Layers",
    color: "#10B981",
    isCombo: 1,
    comboModules: JSON.stringify(["refacturare", "gestiune-costuri"]),
    sortOrder: 3,
    isActive: 1,
  },
];

for (const mod of modulesData) {
  // Check if exists
  const [rows] = await conn.execute("SELECT id FROM modules WHERE slug = ?", [mod.slug]);
  if (rows.length > 0) {
    console.log(`Module '${mod.slug}' already exists, skipping.`);
    continue;
  }
  await conn.execute(
    `INSERT INTO modules (slug, name, description, icon, color, isCombo, comboModules, sortOrder, isActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [mod.slug, mod.name, mod.description, mod.icon, mod.color, mod.isCombo, mod.comboModules, mod.sortOrder, mod.isActive]
  );
  console.log(`Inserted module '${mod.slug}'`);
}

// Get module IDs
const [modRows] = await conn.execute("SELECT id, slug FROM modules");
const modMap = {};
for (const row of modRows) modMap[row.slug] = row.id;

// Seed pricing
const pricingData = [
  // Refacturare
  { moduleSlug: "refacturare", currency: "RON", monthlyPrice: "149.00", yearlyPrice: "1490.00", trialDays: 7 },
  { moduleSlug: "refacturare", currency: "EUR", monthlyPrice: "29.00", yearlyPrice: "290.00", trialDays: 7 },
  // Gestiune Costuri
  { moduleSlug: "gestiune-costuri", currency: "RON", monthlyPrice: "199.00", yearlyPrice: "1990.00", trialDays: 7 },
  { moduleSlug: "gestiune-costuri", currency: "EUR", monthlyPrice: "39.00", yearlyPrice: "390.00", trialDays: 7 },
  // Combo
  { moduleSlug: "combo", currency: "RON", monthlyPrice: "299.00", yearlyPrice: "2990.00", trialDays: 7 },
  { moduleSlug: "combo", currency: "EUR", monthlyPrice: "59.00", yearlyPrice: "590.00", trialDays: 7 },
];

for (const p of pricingData) {
  const moduleId = modMap[p.moduleSlug];
  if (!moduleId) { console.log(`Module ${p.moduleSlug} not found`); continue; }
  const [rows] = await conn.execute(
    "SELECT id FROM modulePricing WHERE moduleId = ? AND currency = ?",
    [moduleId, p.currency]
  );
  if (rows.length > 0) {
    console.log(`Pricing for '${p.moduleSlug}' (${p.currency}) already exists, skipping.`);
    continue;
  }
  await conn.execute(
    `INSERT INTO modulePricing (moduleId, currency, monthlyPrice, yearlyPrice, trialDays, isActive) VALUES (?, ?, ?, ?, ?, 1)`,
    [moduleId, p.currency, p.monthlyPrice, p.yearlyPrice, p.trialDays]
  );
  console.log(`Inserted pricing for '${p.moduleSlug}' (${p.currency})`);
}

await conn.end();
console.log("Seed complete.");
