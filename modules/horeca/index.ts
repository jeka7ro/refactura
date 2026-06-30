/**
 * HORECA Module — Index & Metadata
 *
 * Utilizare în server/routers.ts:
 *   import { horecaRouter } from "../modules/horeca";
 *   export const appRouter = router({ ..., horeca: horecaRouter });
 *
 * Utilizare în server/db.ts:
 *   import { runHorecaMigrations } from "../modules/horeca";
 *   await runHorecaMigrations(db);
 */
export { horecaRouter } from "./router";
export { runHorecaMigrations } from "./migrations";

export const HORECA_MODULE_META = {
  slug: "horeca",
  name: "Smart HORECA",
  description:
    "Management complet pentru restaurante, baruri, cafenele. Meniu cu rețete și food cost, comenzi, mese, delivery agregat (Glovo, Wolt, Bolt, Tazz).",
  icon: "UtensilsCrossed",
  color: "orange",
  version: "1.0.0",
} as const;
