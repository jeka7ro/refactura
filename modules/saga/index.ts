/**
 * SAGA Module — Index & Metadata
 *
 * Utilizare în server/routers.ts:
 *   import { sagaRouter } from "../modules/saga";
 *   export const appRouter = router({ ..., saga: sagaRouter });
 *
 * Utilizare în server/db.ts:
 *   import { runSagaMigrations } from "../modules/saga";
 *   await runSagaMigrations(db);
 */
export { sagaRouter } from "./router";
export { runSagaMigrations } from "./migrations";

export const SAGA_MODULE_META = {
  slug: "saga",
  name: "SAGA Sync",
  description:
    "Nomenclator de articole compatibil SAGA, mapare automată a produselor din facturi, și export XML pentru import direct în programul SAGA.",
  icon: "Database",
  color: "emerald",
  version: "1.0.0",
} as const;
