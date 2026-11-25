import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../server/_core/trpc";
import { tenantOf } from "../../server/tenant";
import { z } from "zod";
import { getDb } from "../../server/db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  horecaLocations,
  horecaMenuCategories,
  horecaMenuItems,
  horecaRecipeLines,
  horecaTables,
  horecaOrders,
  horecaOrderLines,
  horecaDeliveryOrders,
  horecaModifierGroups,
  horecaModifiers,
  horecaShifts,
  horecaKioskSettings,
  horecaIngredients,
  horecaStockMovements,
} from "./schema";
import { bonuriConsum, bonuriConsumLines, products } from "../../drizzle/schema";


// ─────────────────────────────────────────────────────────────────────────────
//  Bridge-urile către Smart Kiosk / Syrve NU sunt separate pe firme (backend-ul de kiosk
//  are propriile locații și comenzi). De aceea sunt accesibile doar firmelor autorizate
//  explicit (HORECA_KIOSK_TENANT_IDS, implicit 1 și 9 = firma proprietară) sau superadmin.
// ─────────────────────────────────────────────────────────────────────────────
const KIOSK_ALLOWED_TENANTS = new Set(
  (process.env.HORECA_KIOSK_TENANT_IDS || "1,9")
    .split(",")
    .map(x => parseInt(x.trim(), 10))
    .filter(n => Number.isFinite(n))
);
const kioskProcedure = protectedProcedure.use(({ ctx, next }) => {
  const tid = ctx.user.tenantId;
  if (ctx.user.role !== "superadmin" && !(tid && KIOSK_ALLOWED_TENANTS.has(tid))) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Această firmă nu are acces la integrarea Smart Kiosk.",
    });
  }
  return next({ ctx });
});

// ─────────────────────────────────────────────────────────────────────────────
//  HORECA MODULE ROUTER
//  Importat în server/routers.ts ca: horeca: horecaRouter
// ─────────────────────────────────────────────────────────────────────────────

async function assertLocationOwned(db: any, locationId: number, tenantId: number) {
  const [loc] = await db
    .select({ id: horecaLocations.id })
    .from(horecaLocations)
    .where(
      and(
        eq(horecaLocations.id, locationId),
        eq(horecaLocations.tenantId, tenantId)
      )
    )
    .limit(1);
  if (!loc) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Locația nu a fost găsită sau nu aparține firmei curente.",
    });
  }
}

export const horecaRouter = router({
  // ── LOCATIONS ─────────────────────────────────────────────────────────────
  locations: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const tenantId = tenantOf(ctx);
      console.log("[Horeca locations.list] User:", ctx.user.id, "Tenant:", tenantId);
      const db = await getDb();
      if (!db) throw new Error("No DB");
      const locs = await db
        .select()
        .from(horecaLocations)
        .where(
          and(
            eq(horecaLocations.tenantId, tenantId),
            eq(horecaLocations.isActive, 1)
          )
        )
        .orderBy(horecaLocations.name);
      console.log("[Horeca locations.list] Found locs:", locs.length);
      return locs;
    }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          address: z.string().optional(),
          city: z.string().optional(),
          phone: z.string().optional(),
          type: z
            .enum([
              "restaurant",
              "bar",
              "cafenea",
              "fast_food",
              "pizzerie",
              "catering",
              "hotel",
            ])
            .default("restaurant"),
          currency: z.string().default("RON"),
          defaultVatFood: z.number().default(11),
          defaultVatAlcohol: z.number().default(21),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const [result] = await db.insert(horecaLocations).values({
          tenantId: tenantOf(ctx),
          ...input,
        });
        return { id: (result as any).insertId };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          address: z.string().optional(),
          city: z.string().optional(),
          phone: z.string().optional(),
          type: z
            .enum([
              "restaurant",
              "bar",
              "cafenea",
              "fast_food",
              "pizzerie",
              "catering",
              "hotel",
            ])
            .optional(),
          defaultVatFood: z.number().optional(),
          defaultVatAlcohol: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { id, ...rest } = input;
        await db
          .update(horecaLocations)
          .set(rest)
          .where(
            and(
              eq(horecaLocations.id, id),
              eq(horecaLocations.tenantId, tenantOf(ctx))
            )
          );
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        await db
          .update(horecaLocations)
          .set({ isActive: 0 })
          .where(
            and(
              eq(horecaLocations.id, input.id),
              eq(horecaLocations.tenantId, tenantOf(ctx))
            )
          );
        return { success: true };
      }),
  }),

  // ── INVENTORY ─────────────────────────────────────────────────────────────
  inventory: router({
    listIngredients: protectedProcedure
      .input(z.object({ locationId: z.union([z.number(), z.string()]).optional() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const conditions = [
          eq(horecaIngredients.tenantId, tenantOf(ctx)),
          eq(horecaIngredients.isActive, 1)
        ];
        const parsedLocId =
          input.locationId !== undefined && input.locationId !== ""
            ? Number(input.locationId)
            : NaN;
        if (Number.isFinite(parsedLocId) && parsedLocId > 0) {
          conditions.push(eq(horecaIngredients.locationId, parsedLocId));
        }
        return db
          .select()
          .from(horecaIngredients)
          .where(and(...conditions))
          .orderBy(horecaIngredients.name);
      }),

    upsertIngredient: protectedProcedure
      .input(
        z.object({
          id: z.number().optional(),
          locationId: z.number(),
          name: z.string().min(1),
          unit: z.string(),
          unitCost: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const tenantId = tenantOf(ctx);
        await assertLocationOwned(db, input.locationId, tenantId);
        if (input.id) {
          await db
            .update(horecaIngredients)
            .set({
              name: input.name,
              unit: input.unit,
              ...(input.unitCost !== undefined
                ? { unitCost: input.unitCost.toString() }
                : {}),
            })
            .where(
              and(
                eq(horecaIngredients.id, input.id),
                eq(horecaIngredients.tenantId, tenantId)
              )
            );
          return { id: input.id };
        } else {
          const [result] = await db.insert(horecaIngredients).values({
            tenantId,
            locationId: input.locationId,
            name: input.name,
            unit: input.unit,
            unitCost: input.unitCost?.toString() || "0.00",
            currentStock: "0.00",
          });
          return { id: (result as any).insertId };
        }
      }),

    addStock: protectedProcedure
      .input(
        z.object({
          ingredientId: z.number(),
          locationId: z.number(),
          quantity: z.number(),
          unitCost: z.number().optional(),
          reference: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const tenantId = tenantOf(ctx);
        await assertLocationOwned(db, input.locationId, tenantId);

        const [ownIng] = await db
          .select({ id: horecaIngredients.id })
          .from(horecaIngredients)
          .where(and(eq(horecaIngredients.id, input.ingredientId), eq(horecaIngredients.tenantId, tenantId)));
        if (!ownIng) throw new Error("Ingredientul nu a fost găsit");

        // 1. Insert movement
        await db.insert(horecaStockMovements).values({
          tenantId,
          locationId: input.locationId,
          ingredientId: input.ingredientId,
          type: "in",
          quantity: input.quantity.toString(),
          unitCost: input.unitCost?.toString(),
          reference: input.reference,
          notes: input.notes,
        });

        // 2. Update stock
        await db.execute(
          sql`UPDATE horecaIngredients SET currentStock = currentStock + ${input.quantity} WHERE id = ${input.ingredientId} AND tenantId = ${tenantId}`
        );

        return { success: true };
      }),
  }),

  // ── MENU ──────────────────────────────────────────────────────────────────
  menu: router({
    // Categories
    listCategories: protectedProcedure
      .input(z.object({ locationId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        return db
          .select()
          .from(horecaMenuCategories)
          .where(
            and(
              eq(horecaMenuCategories.tenantId, tenantOf(ctx)),
              eq(horecaMenuCategories.locationId, input.locationId),
              eq(horecaMenuCategories.isActive, 1)
            )
          )
          .orderBy(horecaMenuCategories.sortOrder, horecaMenuCategories.name);
      }),

    createCategory: protectedProcedure
      .input(
        z.object({
          locationId: z.number(),
          name: z.string().min(1),
          description: z.string().optional(),
          icon: z.string().optional(),
          color: z.string().optional(),
          sortOrder: z.number().default(0),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const tenantId = tenantOf(ctx);
        await assertLocationOwned(db, input.locationId, tenantId);
        const [r] = await db
          .insert(horecaMenuCategories)
          .values({ tenantId, ...input });
        return { id: (r as any).insertId };
      }),

    updateCategory: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          description: z.string().optional(),
          icon: z.string().optional(),
          color: z.string().optional(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { id, ...rest } = input;
        await db
          .update(horecaMenuCategories)
          .set(rest)
          .where(
            and(
              eq(horecaMenuCategories.id, id),
              eq(horecaMenuCategories.tenantId, tenantOf(ctx))
            )
          );
        return { success: true };
      }),

    deleteCategory: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        await db
          .update(horecaMenuCategories)
          .set({ isActive: 0 })
          .where(
            and(
              eq(horecaMenuCategories.id, input.id),
              eq(horecaMenuCategories.tenantId, tenantOf(ctx))
            )
          );
        return { success: true };
      }),

    // Items
    listItems: protectedProcedure
      .input(
        z.object({ locationId: z.number(), categoryId: z.number().optional() })
      )
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const conditions = [
          eq(horecaMenuItems.tenantId, tenantOf(ctx)),
          eq(horecaMenuItems.locationId, input.locationId),
          eq(horecaMenuItems.isActive, 1),
        ];
        if (input.categoryId)
          conditions.push(eq(horecaMenuItems.categoryId, input.categoryId));
        return db
          .select()
          .from(horecaMenuItems)
          .where(and(...conditions))
          .orderBy(horecaMenuItems.sortOrder, horecaMenuItems.name);
      }),

    createItem: protectedProcedure
      .input(
        z.object({
          locationId: z.number(),
          categoryId: z.number().optional(),
          name: z.string().min(1),
          description: z.string().optional(),
          sku: z.string().optional(),
          price: z.string(),
          vatRate: z.number().default(11),
          unit: z.string().default("portie"),
          isAvailableDelivery: z.number().default(1),
          isAvailableDineIn: z.number().default(1),
          isAvailableTakeaway: z.number().default(1),
          allergens: z.string().optional(),
          foodCostTarget: z.string().optional(),
          sortOrder: z.number().default(0),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const tenantId = tenantOf(ctx);
        await assertLocationOwned(db, input.locationId, tenantId);
        if (input.categoryId) {
          const [cat] = await db
            .select({ id: horecaMenuCategories.id })
            .from(horecaMenuCategories)
            .where(and(eq(horecaMenuCategories.id, input.categoryId), eq(horecaMenuCategories.tenantId, tenantId)))
            .limit(1);
          if (!cat) throw new TRPCError({ code: "FORBIDDEN", message: "Categoria nu aparține firmei curente." });
        }
        const [r] = await db
          .insert(horecaMenuItems)
          .values({ tenantId, ...input });
        return { id: (r as any).insertId };
      }),

    updateItem: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          description: z.string().optional(),
          price: z.string().optional(),
          vatRate: z.number().optional(),
          categoryId: z.number().optional(),
          isAvailableDelivery: z.number().optional(),
          isAvailableDineIn: z.number().optional(),
          isAvailableTakeaway: z.number().optional(),
          allergens: z.string().optional(),
          foodCostTarget: z.string().optional(),
          glovoId: z.string().optional(),
          woltId: z.string().optional(),
          boltId: z.string().optional(),
          tazzId: z.string().optional(),
          sortOrder: z.number().optional(),
          isActive: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const tenantId = tenantOf(ctx);
        const { id, ...rest } = input;
        if (rest.categoryId) {
          const [cat] = await db
            .select({ id: horecaMenuCategories.id })
            .from(horecaMenuCategories)
            .where(and(eq(horecaMenuCategories.id, rest.categoryId), eq(horecaMenuCategories.tenantId, tenantId)))
            .limit(1);
          if (!cat) throw new TRPCError({ code: "FORBIDDEN", message: "Categoria nu aparține firmei curente." });
        }
        await db
          .update(horecaMenuItems)
          .set(rest)
          .where(
            and(
              eq(horecaMenuItems.id, id),
              eq(horecaMenuItems.tenantId, tenantId)
            )
          );
        return { success: true };
      }),

    deleteItem: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        await db
          .update(horecaMenuItems)
          .set({ isActive: 0 })
          .where(
            and(
              eq(horecaMenuItems.id, input.id),
              eq(horecaMenuItems.tenantId, tenantOf(ctx))
            )
          );
        return { success: true };
      }),

    // Recipe
    getRecipe: protectedProcedure
      .input(z.object({ menuItemId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        return db
          .select()
          .from(horecaRecipeLines)
          .where(
            and(
              eq(horecaRecipeLines.menuItemId, input.menuItemId),
              eq(horecaRecipeLines.tenantId, tenantOf(ctx))
            )
          )
          .orderBy(horecaRecipeLines.sortOrder);
      }),

    upsertRecipe: protectedProcedure
      .input(
        z.object({
          menuItemId: z.number(),
          lines: z.array(
            z.object({
              id: z.number().optional(),
              ingredientId: z.number().optional().nullable(),
              ingredientName: z.string().min(1),
              productId: z.number().optional(),
              quantity: z.string(),
              unit: z.string(),
              unitCost: z.string().optional(),
              sortOrder: z.number().default(0),
            })
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const tenantId = tenantOf(ctx);
        const [ownItem] = await db
          .select({ id: horecaMenuItems.id })
          .from(horecaMenuItems)
          .where(
            and(
              eq(horecaMenuItems.id, input.menuItemId),
              eq(horecaMenuItems.tenantId, tenantId)
            )
          )
          .limit(1);
        if (!ownItem) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Produsul nu a fost găsit sau nu aparține firmei curente.",
          });
        }
        const ingredientIds = Array.from(
          new Set(
            input.lines
              .map(l => l.ingredientId)
              .filter((id): id is number => typeof id === "number" && id > 0)
          )
        );
        if (ingredientIds.length > 0) {
          const ownedIngs = await db
            .select({ id: horecaIngredients.id })
            .from(horecaIngredients)
            .where(
              and(
                inArray(horecaIngredients.id, ingredientIds),
                eq(horecaIngredients.tenantId, tenantId)
              )
            );
          if (ownedIngs.length !== ingredientIds.length) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Unul sau mai multe ingrediente nu aparțin firmei curente.",
            });
          }
        }
        const productIds = Array.from(
          new Set(
            input.lines
              .map(l => l.productId)
              .filter((id): id is number => typeof id === "number" && id > 0)
          )
        );
        if (productIds.length > 0) {
          const ownedProds = await db
            .select({ id: products.id })
            .from(products)
            .where(
              and(
                inArray(products.id, productIds),
                eq(products.tenantId, tenantId)
              )
            );
          if (ownedProds.length !== productIds.length) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Unul sau mai multe produse nu aparțin firmei curente.",
            });
          }
        }
        // Șterge vechile linii și reinserează
        await db
          .delete(horecaRecipeLines)
          .where(
            and(
              eq(horecaRecipeLines.menuItemId, input.menuItemId),
              eq(horecaRecipeLines.tenantId, tenantId)
            )
          );
        if (input.lines.length > 0) {
          await db.insert(horecaRecipeLines).values(
            input.lines.map(({ id: _id, ...lineData }) => ({
              ...lineData,
              ingredientId: lineData.ingredientId ?? null,
              menuItemId: input.menuItemId,
              tenantId,
            }))
          );
        }
        // Marchează produsul ca având rețetă
        await db
          .update(horecaMenuItems)
          .set({ hasRecipe: input.lines.length > 0 ? 1 : 0 })
          .where(
            and(
              eq(horecaMenuItems.id, input.menuItemId),
              eq(horecaMenuItems.tenantId, tenantId)
            )
          );
        return { success: true };
      }),

    calculateFoodCost: protectedProcedure
      .input(z.object({ menuItemId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const tenantId = tenantOf(ctx);
        const lines = await db
          .select()
          .from(horecaRecipeLines)
          .where(
            and(
              eq(horecaRecipeLines.menuItemId, input.menuItemId),
              eq(horecaRecipeLines.tenantId, tenantId)
            )
          );
        const [item] = await db
          .select()
          .from(horecaMenuItems)
          .where(
            and(
              eq(horecaMenuItems.id, input.menuItemId),
              eq(horecaMenuItems.tenantId, tenantId)
            )
          );
        const totalCost = lines.reduce(
          (sum, l) => sum + Number(l.quantity) * Number(l.unitCost || 0),
          0
        );
        const price = Number(item?.price || 0);
        const pct = price > 0 ? (totalCost / price) * 100 : 0;
        return {
          totalCost: totalCost.toFixed(4),
          price: price.toFixed(2),
          foodCostPct: pct.toFixed(1),
        };
      }),
  }),

  // ── TABLES ────────────────────────────────────────────────────────────────
  tables: router({
    list: protectedProcedure
      .input(z.object({ locationId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        return db
          .select()
          .from(horecaTables)
          .where(
            and(
              eq(horecaTables.tenantId, tenantOf(ctx)),
              eq(horecaTables.locationId, input.locationId),
              eq(horecaTables.isActive, 1)
            )
          )
          .orderBy(horecaTables.number);
      }),

    create: protectedProcedure
      .input(
        z.object({
          locationId: z.number(),
          number: z.string().min(1),
          capacity: z.number().default(4),
          zone: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const tenantId = tenantOf(ctx);
        await assertLocationOwned(db, input.locationId, tenantId);
        const [r] = await db
          .insert(horecaTables)
          .values({ tenantId, ...input });
        return { id: (r as any).insertId };
      }),

    updateStatus: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["free", "occupied", "reserved", "cleaning"]),
          currentOrderId: z.number().nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const tenantId = tenantOf(ctx);
        const { id, ...rest } = input;
        if (rest.currentOrderId) {
          const [ownOrd] = await db
            .select({ id: horecaOrders.id })
            .from(horecaOrders)
            .where(and(eq(horecaOrders.id, rest.currentOrderId), eq(horecaOrders.tenantId, tenantId)));
          if (!ownOrd) throw new Error("Comanda nu a fost găsită");
        }
        await db
          .update(horecaTables)
          .set(rest)
          .where(
            and(
              eq(horecaTables.id, id),
              eq(horecaTables.tenantId, tenantId)
            )
          );
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        await db
          .update(horecaTables)
          .set({ isActive: 0 })
          .where(
            and(
              eq(horecaTables.id, input.id),
              eq(horecaTables.tenantId, tenantOf(ctx))
            )
          );
        return { success: true };
      }),
  }),

  // ── ORDERS ────────────────────────────────────────────────────────────────
  orders: router({
    list: protectedProcedure
      .input(
        z.object({
          locationId: z.number(),
          status: z.string().optional(),
          type: z.string().optional(),
          date: z.string().optional(), // YYYY-MM-DD
        })
      )
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const conditions: any[] = [
          eq(horecaOrders.tenantId, tenantOf(ctx)),
          eq(horecaOrders.locationId, input.locationId),
        ];
        if (input.status) {
          conditions.push(eq(horecaOrders.status, input.status as any));
        }
        if (input.type) {
          conditions.push(eq(horecaOrders.type, input.type as any));
        }
        if (input.date) {
          conditions.push(sql`DATE(${horecaOrders.createdAt}) = ${input.date}`);
        }
        return db
          .select()
          .from(horecaOrders)
          .where(and(...conditions))
          .orderBy(desc(horecaOrders.createdAt))
          .limit(200);
      }),

    getWithLines: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const tenantId = tenantOf(ctx);
        const [order] = await db
          .select()
          .from(horecaOrders)
          .where(
            and(
              eq(horecaOrders.id, input.id),
              eq(horecaOrders.tenantId, tenantId)
            )
          );
        if (!order) throw new Error("Not found");
        const lines = await db
          .select()
          .from(horecaOrderLines)
          .where(and(eq(horecaOrderLines.orderId, input.id), eq(horecaOrderLines.tenantId, tenantId)))
          .orderBy(horecaOrderLines.createdAt);
        return { ...order, lines };
      }),

    create: protectedProcedure
      .input(
        z.object({
          locationId: z.number(),
          type: z.enum(["dine_in", "takeaway", "delivery"]).default("dine_in"),
          tableId: z.number().optional(),
          tableNumber: z.string().optional(),
          guestCount: z.number().default(1),
          staffName: z.string().optional(),
          notes: z.string().optional(),
          paymentMethod: z
            .enum(["cash", "card", "voucher", "online", "room_charge", "mixed"])
            .optional(),
          status: z
            .enum([
              "draft",
              "sent",
              "preparing",
              "ready",
              "served",
              "paid",
              "cancelled",
            ])
            .optional(),
          lines: z
            .array(
              z.object({
                menuItemId: z.number().optional(),
                name: z.string().min(1),
                quantity: z.union([z.string(), z.number()]),
                unitPrice: z.union([z.string(), z.number()]),
                vatRate: z.number().default(11),
                notes: z.string().optional(),
                modifiers: z.string().optional(),
                kitchenSection: z.string().optional(),
                foodCostUnit: z.string().optional(),
              })
            )
            .optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const tenantId = tenantOf(ctx);
        await assertLocationOwned(db, input.locationId, tenantId);
        if (input.tableId) {
          const [ownTable] = await db
            .select({ id: horecaTables.id })
            .from(horecaTables)
            .where(and(eq(horecaTables.id, input.tableId), eq(horecaTables.tenantId, tenantId)))
            .limit(1);
          if (!ownTable) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Masa selectată nu aparține firmei curente." });
          }
        }

        const { lines: inputLines, status: reqStatus, paymentMethod, ...orderBase } = input;
        if (inputLines && inputLines.length > 0) {
          const menuItemIds = Array.from(
            new Set(inputLines.map(l => l.menuItemId).filter((id): id is number => Boolean(id)))
          );
          if (menuItemIds.length > 0) {
            const ownedItems = await db
              .select({ id: horecaMenuItems.id })
              .from(horecaMenuItems)
              .where(and(inArray(horecaMenuItems.id, menuItemIds), eq(horecaMenuItems.tenantId, tenantId)));
            if (ownedItems.length !== menuItemIds.length) {
              throw new TRPCError({ code: "FORBIDDEN", message: "Unul sau mai multe produse nu aparțin firmei curente." });
            }
          }
        }

        // Generare număr comandă din sufixul numeric maxim
        const [maxOrd] = await db
          .select({
            m: sql<number>`COALESCE(MAX(CAST(SUBSTRING_INDEX(${horecaOrders.orderNumber}, '-', -1) AS UNSIGNED)), 0)`,
          })
          .from(horecaOrders)
          .where(eq(horecaOrders.tenantId, tenantId));
        const orderNumber = `CMD-${String((Number(maxOrd?.m) || 0) + 1).padStart(4, "0")}`;
        const finalStatus = reqStatus || "draft";
        const now = new Date();
        const [r] = await db.insert(horecaOrders).values({
          tenantId,
          orderNumber,
          ...orderBase,
          status: finalStatus,
          ...(paymentMethod ? { paymentMethod } : {}),
          ...(finalStatus === "paid" ? { paidAt: now, closedAt: now } : {}),
          ...(finalStatus === "cancelled" ? { closedAt: now } : {}),
        });
        const orderId = (r as any).insertId;

        if (inputLines && inputLines.length > 0) {
          let subtotal = 0;
          let totalVat = 0;
          const preparedLines = inputLines.map(l => {
            const qty = Number(l.quantity) || 0;
            const price = Number(l.unitPrice) || 0;
            const vatRate = l.vatRate ?? 11;
            const lineVat = parseFloat(((qty * price * vatRate) / (100 + vatRate)).toFixed(2));
            const lineTotal = parseFloat((qty * price).toFixed(2));
            subtotal += lineTotal;
            totalVat += lineVat;
            return {
              orderId,
              tenantId,
              menuItemId: l.menuItemId,
              name: l.name,
              quantity: String(l.quantity),
              unitPrice: String(l.unitPrice),
              vatRate,
              vatAmount: lineVat.toFixed(2),
              total: lineTotal.toFixed(2),
              foodCostUnit: l.foodCostUnit,
              modifiers: l.modifiers,
              notes: l.notes,
              kitchenSection: l.kitchenSection,
            };
          });
          await db.insert(horecaOrderLines).values(preparedLines);
          await db
            .update(horecaOrders)
            .set({
              subtotal: subtotal.toFixed(2),
              vatAmount: totalVat.toFixed(2),
              total: subtotal.toFixed(2),
            })
            .where(and(eq(horecaOrders.id, orderId), eq(horecaOrders.tenantId, tenantId)));
        }

        // Marchează masa ca ocupată (dacă comanda nu e deja plătită/anulată)
        if (input.tableId && finalStatus !== "paid" && finalStatus !== "cancelled") {
          await db
            .update(horecaTables)
            .set({ status: "occupied", currentOrderId: orderId })
            .where(
              and(
                eq(horecaTables.id, input.tableId),
                eq(horecaTables.tenantId, tenantId)
              )
            );
        }
        return { id: orderId, orderNumber };
      }),

    addLine: protectedProcedure
      .input(
        z.object({
          orderId: z.number(),
          menuItemId: z.number().optional(),
          name: z.string().min(1),
          quantity: z.string(),
          unitPrice: z.string(),
          vatRate: z.number().default(11),
          notes: z.string().optional(),
          modifiers: z.string().optional(),
          kitchenSection: z.string().optional(),
          foodCostUnit: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const tenantId = tenantOf(ctx);
        const [ownOrder] = await db
          .select({ id: horecaOrders.id, discount: horecaOrders.discount })
          .from(horecaOrders)
          .where(and(eq(horecaOrders.id, input.orderId), eq(horecaOrders.tenantId, tenantId)));
        if (!ownOrder) throw new Error("Order not found");
        if (input.menuItemId) {
          const [ownItem] = await db
            .select({ id: horecaMenuItems.id })
            .from(horecaMenuItems)
            .where(and(eq(horecaMenuItems.id, input.menuItemId), eq(horecaMenuItems.tenantId, tenantId)));
          if (!ownItem) throw new Error("Produsul nu a fost găsit");
        }
        const qty = Number(input.quantity);
        const price = Number(input.unitPrice);
        const vatRate = input.vatRate;
        const vatAmount = parseFloat(
          ((qty * price * vatRate) / (100 + vatRate)).toFixed(2)
        );
        const total = parseFloat((qty * price).toFixed(2));
        await db.insert(horecaOrderLines).values({
          orderId: input.orderId,
          tenantId,
          menuItemId: input.menuItemId,
          name: input.name,
          quantity: input.quantity,
          unitPrice: input.unitPrice,
          vatRate,
          vatAmount: vatAmount.toFixed(2),
          total: total.toFixed(2),
          foodCostUnit: input.foodCostUnit,
          modifiers: input.modifiers,
          notes: input.notes,
          kitchenSection: input.kitchenSection,
        });
        // Recalculează totalul comenzii (scăzând discountul)
        const lines = await db
          .select()
          .from(horecaOrderLines)
          .where(
            and(
              eq(horecaOrderLines.orderId, input.orderId),
              eq(horecaOrderLines.tenantId, tenantId),
              sql`${horecaOrderLines.status} != 'cancelled'`
            )
          );
        const subtotal = lines.reduce((s, l) => s + Number(l.total), 0);
        const totalVat = lines.reduce((s, l) => s + Number(l.vatAmount), 0);
        const discountVal = Number(ownOrder.discount || 0);
        const finalOrderTotal = Math.max(0, subtotal - discountVal);
        await db
          .update(horecaOrders)
          .set({
            subtotal: subtotal.toFixed(2),
            vatAmount: totalVat.toFixed(2),
            total: finalOrderTotal.toFixed(2),
          })
          .where(and(eq(horecaOrders.id, input.orderId), eq(horecaOrders.tenantId, tenantId)));
        return { success: true };
      }),

    updateStatus: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum([
            "draft",
            "sent",
            "preparing",
            "ready",
            "served",
            "paid",
            "cancelled",
          ]),
          paymentMethod: z
            .enum(["cash", "card", "voucher", "online", "room_charge", "mixed"])
            .optional(),
          tip: z.string().optional(),
          discount: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const tenantId = tenantOf(ctx);
        const { id, status, paymentMethod, tip, discount } = input;

        const [oldOrder] = await db
          .select()
          .from(horecaOrders)
          .where(
            and(
              eq(horecaOrders.id, id),
              eq(horecaOrders.tenantId, tenantId)
            )
          );
        if (!oldOrder) throw new Error("Order not found");

        const update: Record<string, any> = { status };
        if (paymentMethod) update.paymentMethod = paymentMethod;
        if (tip !== undefined) update.tip = tip;
        if (discount !== undefined) {
          update.discount = discount;
          const sub = Number(oldOrder.subtotal || 0);
          const disc = Number(discount || 0);
          update.total = Math.max(0, sub - disc).toFixed(2);
        } else if (Number(oldOrder.discount || 0) > 0) {
          const sub = Number(oldOrder.subtotal || 0);
          const disc = Number(oldOrder.discount || 0);
          update.total = Math.max(0, sub - disc).toFixed(2);
        }
        if (status === "paid") update.paidAt = new Date();
        if (status === "paid" || status === "cancelled")
          update.closedAt = new Date();

        await db
          .update(horecaOrders)
          .set(update)
          .where(
            and(
              eq(horecaOrders.id, id),
              eq(horecaOrders.tenantId, tenantId)
            )
          );

        // Eliberează masa dacă e plătit/anulat
        if (status === "paid" || status === "cancelled") {
          if (oldOrder.tableId) {
            await db
              .update(horecaTables)
              .set({ status: "free", currentOrderId: null })
              .where(
                and(
                  eq(horecaTables.id, oldOrder.tableId),
                  eq(horecaTables.tenantId, tenantId)
                )
              );
          }
        }

        // Auto-consumption of stock when paid (exclude cancelled lines)
        if (status === "paid" && oldOrder.status !== "paid" && !oldOrder.stockDeducted) {
          const lines = await db
            .select()
            .from(horecaOrderLines)
            .where(
              and(
                eq(horecaOrderLines.orderId, id),
                eq(horecaOrderLines.tenantId, tenantId),
                sql`${horecaOrderLines.status} != 'cancelled'`
              )
            );
          
          const ingredientsToConsume: any[] = [];
          const horecaStockUpdates: { ingredientId: number; qty: number; unitCost: number }[] = [];

          for (const line of lines) {
            if (line.menuItemId) {
              const recipeLines = await db
                .select()
                .from(horecaRecipeLines)
                .where(and(eq(horecaRecipeLines.menuItemId, line.menuItemId), eq(horecaRecipeLines.tenantId, tenantId)));
              for (const recipe of recipeLines) {
                const consumeQty = Number(recipe.quantity) * Number(line.quantity);
                const unitCost = Number(recipe.unitCost || 0);

                ingredientsToConsume.push({
                  materialCode: String(recipe.productId || ""),
                  description: recipe.ingredientName,
                  quantity: String(consumeQty),
                  unitPrice: String(unitCost),
                  total: String(consumeQty * unitCost),
                });

                if (recipe.ingredientId) {
                  horecaStockUpdates.push({
                    ingredientId: recipe.ingredientId,
                    qty: consumeQty,
                    unitCost: unitCost
                  });
                }
              }
            }
          }

          const rawOrderNum = String(oldOrder.orderNumber || id).trim();
          const cmdRef = rawOrderNum.toUpperCase().startsWith("CMD-")
            ? rawOrderNum
            : `CMD-${rawOrderNum}`;

          // 1. Generate Bon de Consum for ERP module (if global inventory is used)
          if (ingredientsToConsume.length > 0) {
            const [bc] = await db.insert(bonuriConsum).values({
              tenantId,
              number: `BC-${cmdRef}`,
              date: new Date(),
              gestiune: "Horeca",
              status: "final",
            });
            const bonId = (bc as any).insertId;

            await db.insert(bonuriConsumLines).values(
              ingredientsToConsume.map((ing, i) => ({
                bonId,
                ...ing,
                lineOrder: i,
              }))
            );
          }

          // 2. Real-time deduction from local Horeca Inventory
          for (const stockUpd of horecaStockUpdates) {
             await db.execute(sql`UPDATE horecaIngredients SET currentStock = currentStock - ${stockUpd.qty} WHERE id = ${stockUpd.ingredientId} AND tenantId = ${tenantId}`);
             await db.insert(horecaStockMovements).values({
               tenantId,
               locationId: oldOrder.locationId,
               ingredientId: stockUpd.ingredientId,
               type: "out",
               quantity: stockUpd.qty.toString(),
               unitCost: stockUpd.unitCost.toString(),
               reference: cmdRef,
             });
          }

          // 3. Mark order as stock deducted
          await db.update(horecaOrders).set({ stockDeducted: 1 }).where(and(eq(horecaOrders.id, id), eq(horecaOrders.tenantId, tenantId)));
        }

        return { success: true };
      }),

    cancel: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const tenantId = tenantOf(ctx);
        await db
          .update(horecaOrders)
          .set({ status: "cancelled", closedAt: new Date() })
          .where(
            and(
              eq(horecaOrders.id, input.id),
              eq(horecaOrders.tenantId, tenantId)
            )
          );
        const [order] = await db
          .select()
          .from(horecaOrders)
          .where(and(eq(horecaOrders.id, input.id), eq(horecaOrders.tenantId, tenantId)));
        if (order?.tableId) {
          await db
            .update(horecaTables)
            .set({ status: "free", currentOrderId: null })
            .where(
              and(
                eq(horecaTables.id, order.tableId),
                eq(horecaTables.tenantId, tenantId)
              )
            );
        }
        return { success: true };
      }),
  }),

  // ── DELIVERY ──────────────────────────────────────────────────────────────
  delivery: router({
    list: protectedProcedure
      .input(
        z.object({ locationId: z.number(), status: z.string().optional() })
      )
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const conditions: any[] = [
          eq(horecaDeliveryOrders.tenantId, tenantOf(ctx)),
          eq(horecaDeliveryOrders.locationId, input.locationId),
        ];
        if (input.status) {
          conditions.push(eq(horecaDeliveryOrders.status, input.status as any));
        }
        return db
          .select()
          .from(horecaDeliveryOrders)
          .where(and(...conditions))
          .orderBy(desc(horecaDeliveryOrders.createdAt))
          .limit(200);
      }),

    create: protectedProcedure
      .input(
        z.object({
          locationId: z.number(),
          platform: z.enum(["glovo", "wolt", "bolt_food", "tazz", "manual"]),
          externalId: z.string().optional(),
          customerName: z.string().optional(),
          customerPhone: z.string().optional(),
          deliveryAddress: z.string().optional(),
          subtotal: z.string(),
          commission: z.string().default("0"),
          commissionPct: z.string().default("0"),
          deliveryFee: z.string().default("0"),
          total: z.string(),
          notes: z.string().optional(),
          rawPayload: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const tenantId = tenantOf(ctx);
        await assertLocationOwned(db, input.locationId, tenantId);
        const [r] = await db
          .insert(horecaDeliveryOrders)
          .values({ tenantId, ...input });
        return { id: (r as any).insertId };
      }),

    updateStatus: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum([
            "new",
            "accepted",
            "preparing",
            "ready",
            "picked_up",
            "delivered",
            "cancelled",
            "rejected",
          ]),
          internalOrderId: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const tenantId = tenantOf(ctx);
        const { id, ...rest } = input;
        if (rest.internalOrderId) {
          const [ownOrd] = await db
            .select({ id: horecaOrders.id })
            .from(horecaOrders)
            .where(and(eq(horecaOrders.id, rest.internalOrderId), eq(horecaOrders.tenantId, tenantId)))
            .limit(1);
          if (!ownOrd) throw new TRPCError({ code: "FORBIDDEN", message: "Comanda internă nu aparține firmei curente." });
        }
        await db
          .update(horecaDeliveryOrders)
          .set(rest)
          .where(
            and(
              eq(horecaDeliveryOrders.id, id),
              eq(horecaDeliveryOrders.tenantId, tenantId)
            )
          );
        return { success: true };
      }),
  }),

  // ── SHIFTS (RAPORT Z) ─────────────────────────────────────────────────────
  shifts: router({
    getCurrent: protectedProcedure
      .input(z.object({ locationId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const [shift] = await db
          .select()
          .from(horecaShifts)
          .where(
            and(
              eq(horecaShifts.tenantId, tenantOf(ctx)),
              eq(horecaShifts.locationId, input.locationId),
              eq(horecaShifts.status, "open")
            )
          )
          .orderBy(desc(horecaShifts.id))
          .limit(1);
        return shift || null;
      }),

    openShift: protectedProcedure
      .input(
        z.object({ locationId: z.number(), startCash: z.number().default(0) })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const tenantId = tenantOf(ctx);
        await assertLocationOwned(db, input.locationId, tenantId);
        // Verifica daca exista deja o tura deschisa
        const existing = await db
          .select()
          .from(horecaShifts)
          .where(
            and(
              eq(horecaShifts.tenantId, tenantId),
              eq(horecaShifts.locationId, input.locationId),
              eq(horecaShifts.status, "open")
            )
          );
        if (existing.length > 0)
          throw new Error("Există deja o tură deschisă!");

        const [r] = await db.insert(horecaShifts).values({
          tenantId,
          locationId: input.locationId,
          startCash: String(input.startCash),
          openedBy: ctx.user.id,
          status: "open",
        });
        return { id: (r as any).insertId };
      }),

    closeShift: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          endCashActual: z.number(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const tenantId = tenantOf(ctx);

        const [shift] = await db
          .select()
          .from(horecaShifts)
          .where(
            and(eq(horecaShifts.id, input.id), eq(horecaShifts.status, "open"), eq(horecaShifts.tenantId, tenantId))
          );
        if (!shift)
          throw new Error("Tura nu a fost găsită sau este deja închisă!");

        // Calculam incasarile reale din orders de cand s-a deschis tura
        const orders = await db
          .select()
          .from(horecaOrders)
          .where(
            and(
              eq(horecaOrders.tenantId, tenantId),
              eq(horecaOrders.locationId, shift.locationId),
              eq(horecaOrders.status, "paid")
            )
          );

        // Filtram doar comenzile platite intre shift.openedAt si ACUM
        const openedTime = new Date(shift.openedAt).getTime();
        const now = Date.now();
        const shiftOrders = orders.filter(o => {
          if (!o.paidAt) return false;
          const pt = new Date(o.paidAt).getTime();
          return pt >= openedTime && pt <= now;
        });

        let totalCash = 0;
        let totalCard = 0;
        let totalDelivery = 0; // tazz/glovo pot fi pe canal separat, dar momentan din POS
        let totalTips = 0;
        let totalSales = 0;

        shiftOrders.forEach(o => {
          totalSales += Number(o.total);
          totalTips += Number(o.tip);
          if (o.paymentMethod === "cash") totalCash += Number(o.total);
          else if (o.paymentMethod === "card") totalCard += Number(o.total);
          // put in delivery bucket if it's an online payment / voucher / room_charge depending on business logic
          else totalDelivery += Number(o.total);
        });

        const expectedCash = Number(shift.startCash) + totalCash;
        const zData = JSON.stringify({
          ordersCount: shiftOrders.length,
          breakdown: { cash: totalCash, card: totalCard, other: totalDelivery },
        });

        await db
          .update(horecaShifts)
          .set({
            status: "closed",
            closedAt: new Date(),
            closedBy: ctx.user.id,
            endCashExpected: expectedCash.toFixed(2),
            endCashActual: input.endCashActual.toFixed(2),
            totalCard: totalCard.toFixed(2),
            totalDelivery: totalDelivery.toFixed(2),
            totalSales: totalSales.toFixed(2),
            totalTips: totalTips.toFixed(2),
            notes: input.notes,
            zReportData: zData,
          })
          .where(and(eq(horecaShifts.id, input.id), eq(horecaShifts.tenantId, tenantId)));

        return { success: true };
      }),

    list: protectedProcedure
      .input(z.object({ locationId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        return db
          .select()
          .from(horecaShifts)
          .where(
            and(
              eq(horecaShifts.tenantId, tenantOf(ctx)),
              eq(horecaShifts.locationId, input.locationId)
            )
          )
          .orderBy(desc(horecaShifts.id))
          .limit(30);
      }),
  }),

  // ── REPORTS ───────────────────────────────────────────────────────────────
  reports: router({
    dailySummary: protectedProcedure
      .input(z.object({ locationId: z.number(), date: z.string() })) // YYYY-MM-DD
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const allOrders = await db
          .select()
          .from(horecaOrders)
          .where(
            and(
              eq(horecaOrders.tenantId, tenantOf(ctx)),
              eq(horecaOrders.locationId, input.locationId)
            )
          );
        const dayOrders = allOrders.filter(o => {
          const d = o.createdAt
            ? new Date(o.createdAt).toISOString().slice(0, 10)
            : "";
          return d === input.date && o.status === "paid";
        });
        const totalRevenue = dayOrders.reduce((s, o) => s + Number(o.total), 0);
        const totalVat = dayOrders.reduce((s, o) => s + Number(o.vatAmount), 0);
        const totalTip = dayOrders.reduce((s, o) => s + Number(o.tip), 0);
        const byType = { dine_in: 0, takeaway: 0, delivery: 0 };
        dayOrders.forEach(o => {
          byType[o.type as keyof typeof byType] += Number(o.total);
        });
        return {
          date: input.date,
          ordersCount: dayOrders.length,
          totalRevenue: totalRevenue.toFixed(2),
          totalVat: totalVat.toFixed(2),
          totalTip: totalTip.toFixed(2),
          byType,
        };
      }),

    deliveryChannelReport: protectedProcedure
      .input(z.object({ locationId: z.number(), month: z.string() })) // YYYY-MM
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const all = await db
          .select()
          .from(horecaDeliveryOrders)
          .where(
            and(
              eq(horecaDeliveryOrders.tenantId, tenantOf(ctx)),
              eq(horecaDeliveryOrders.locationId, input.locationId)
            )
          );
        const inMonth = all.filter(o => {
          const m = o.createdAt
            ? new Date(o.createdAt).toISOString().slice(0, 7)
            : "";
          return m === input.month && o.status === "delivered";
        });
        const byPlatform: Record<
          string,
          { orders: number; revenue: number; commission: number }
        > = {};
        inMonth.forEach(o => {
          if (!byPlatform[o.platform])
            byPlatform[o.platform] = { orders: 0, revenue: 0, commission: 0 };
          byPlatform[o.platform].orders++;
          byPlatform[o.platform].revenue += Number(o.total || 0);
          byPlatform[o.platform].commission += Number(o.commission || 0);
        });
        return { month: input.month, byPlatform };
      }),
  }),

  // ── KIOSK SETTINGS ────────────────────────────────────────────────────────
  kioskSettings: router({
    get: protectedProcedure
      .input(z.object({ locationId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const tenantId = tenantOf(ctx);
        await assertLocationOwned(db, input.locationId, tenantId);
        const rows = await db
          .select()
          .from(horecaKioskSettings)
          .where(
            and(
              eq(horecaKioskSettings.tenantId, tenantId),
              eq(horecaKioskSettings.locationId, input.locationId)
            )
          )
          .limit(1);

        if (rows.length === 0) {
          // Return default mock if none exists
          return {
            locationId: input.locationId,
            bannerTopUrl: "",
            bannerBottomUrl: "",
            primaryColor: "#EE3B24",
            secondaryColor: "",
            activeBrands: "[]",
            promoConfig: "{}",
            advancedConfig: "{}",
          };
        }
        return rows[0];
      }),

    upsert: protectedProcedure
      .input(
        z.object({
          locationId: z.number(),
          bannerTopUrl: z.string().optional(),
          bannerBottomUrl: z.string().optional(),
          primaryColor: z.string().optional(),
          secondaryColor: z.string().optional(),
          activeBrands: z.string().optional(),
          promoConfig: z.string().optional(),
          advancedConfig: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const tenantId = tenantOf(ctx);
        await assertLocationOwned(db, input.locationId, tenantId);

        // Check if exists
        const existing = await db
          .select({ id: horecaKioskSettings.id })
          .from(horecaKioskSettings)
          .where(
            and(
              eq(horecaKioskSettings.tenantId, tenantId),
              eq(horecaKioskSettings.locationId, input.locationId)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(horecaKioskSettings)
            .set({
              ...input,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(horecaKioskSettings.id, existing[0].id),
                eq(horecaKioskSettings.tenantId, tenantId)
              )
            );
          return { success: true };
        } else {
          await db.insert(horecaKioskSettings).values({
            tenantId,
            ...input,
          });
          return { success: true };
        }
      }),
  }),

  // ── KIOSK BRIDGE — Proxy to Smart Kiosk backend (localhost:4000) ──
  kioskBridge: router({
    // List all locations from the external Smart Kiosk backend
    listLocations: kioskProcedure.query(async () => {
      try {
        const KIOSK_API =
          process.env.SMART_KIOSK_API_URL || "http://localhost:4000";
        const API_KEY = (process.env.SMART_KIOSK_API_KEY || "").trim();
        if (!API_KEY) return [];

        const resp = await fetch(`${KIOSK_API}/api/locations`, {
          headers: { "x-api-key": API_KEY },
          signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) return [];
        const data = await resp.json();
        return data.locations || [];
      } catch {
        return [];
      }
    }),

    // Get a single location's full data
    getLocation: kioskProcedure
      .input(z.object({ locationId: z.string() }))
      .query(async ({ input }) => {
        const KIOSK_API =
          process.env.SMART_KIOSK_API_URL || "http://localhost:4000";
        const API_KEY = (process.env.SMART_KIOSK_API_KEY || "").trim();
        if (!API_KEY) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "SMART_KIOSK_API_KEY nu este configurat.",
          });
        }

        const resp = await fetch(
          `${KIOSK_API}/api/locations/${encodeURIComponent(input.locationId)}`,
          {
            headers: { "x-api-key": API_KEY },
            signal: AbortSignal.timeout(8000),
          }
        );
        if (!resp.ok) throw new Error(`Location not found: ${resp.status}`);
        return resp.json();
      }),

    // Update location settings on Smart Kiosk backend
    updateLocation: kioskProcedure
      .input(
        z.object({
          locationId: z.string(),
          data: z.record(z.string(), z.any()), // free-form JSON — the entire location patch
        })
      )
      .mutation(async ({ input }) => {
        const KIOSK_API =
          process.env.SMART_KIOSK_API_URL || "http://localhost:4000";
        const adminEmail = (process.env.SMART_KIOSK_ADMIN_EMAIL || "").trim();
        const adminPassword = process.env.SMART_KIOSK_ADMIN_PASSWORD || "";
        if (!adminEmail || !adminPassword) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Credențialele SMART_KIOSK_ADMIN_EMAIL / SMART_KIOSK_ADMIN_PASSWORD nu sunt configurate.",
          });
        }

        // First login to get JWT
        const loginResp = await fetch(`${KIOSK_API}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: adminEmail,
            password: adminPassword,
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (!loginResp.ok) throw new Error("Smart Kiosk login failed");
        const { token } = await loginResp.json();

        const resp = await fetch(
          `${KIOSK_API}/api/locations/${encodeURIComponent(input.locationId)}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(input.data),
            signal: AbortSignal.timeout(8000),
          }
        );
        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`Update failed: ${resp.status} ${errText}`);
        }
        return resp.json();
      }),

    // Get promotions config from Smart Kiosk
    getPromotions: kioskProcedure.query(async () => {
      try {
        const KIOSK_API =
          process.env.SMART_KIOSK_API_URL || "http://localhost:4000";
        const API_KEY = (process.env.SMART_KIOSK_API_KEY || "").trim();
        if (!API_KEY) return {};

        const resp = await fetch(`${KIOSK_API}/api/promotions`, {
          headers: { "x-api-key": API_KEY },
          signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) return {};
        return resp.json();
      } catch {
        return {};
      }
    }),

    // Get kiosk screensaver configs
    getKioskConfigs: kioskProcedure.query(async () => {
      try {
        const KIOSK_API =
          process.env.SMART_KIOSK_API_URL || "http://localhost:4000";
        const API_KEY = (process.env.SMART_KIOSK_API_KEY || "").trim();
        if (!API_KEY) return { posters: {} };

        const resp = await fetch(`${KIOSK_API}/api/admin/kiosk-config`, {
          headers: { "x-api-key": API_KEY },
          signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) return { posters: {} };
        return resp.json();
      } catch {
        return { posters: {} };
      }
    }),

    // ── READ-ONLY: Menu from Syrve via Smart Kiosk ──
    getMenu: kioskProcedure
      .input(
        z.object({
          brandId: z.string().default("smashme"),
          locId: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        const KIOSK_API =
          process.env.SMART_KIOSK_API_URL || "http://localhost:4000";
        const API_KEY = (process.env.SMART_KIOSK_API_KEY || "").trim();
        if (!API_KEY) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "SMART_KIOSK_API_KEY nu este configurat.",
          });
        }

        let url = `${KIOSK_API}/api/menu?brandId=${encodeURIComponent(input.brandId)}`;
        if (input.locId) url += `&locId=${encodeURIComponent(input.locId)}`;

        const resp = await fetch(url, {
          headers: { "x-api-key": API_KEY },
          signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) throw new Error(`Menu fetch failed: ${resp.status}`);
        return resp.json();
      }),

    // ── READ-ONLY: Orders list from Smart Kiosk ──
    listOrders: kioskProcedure
      .input(
        z.object({
          status: z.string().optional(),
          brand: z.string().optional(),
          limit: z.number().default(50),
        })
      )
      .query(async ({ input }) => {
        const KIOSK_API =
          process.env.SMART_KIOSK_API_URL || "http://localhost:4000";
        const API_KEY = (process.env.SMART_KIOSK_API_KEY || "").trim();
        if (!API_KEY) return [];

        let url = `${KIOSK_API}/api/orders?limit=${encodeURIComponent(String(input.limit))}`;
        if (input.status) url += `&status=${encodeURIComponent(input.status)}`;
        if (input.brand) url += `&brand=${encodeURIComponent(input.brand)}`;

        const resp = await fetch(url, {
          headers: { "x-api-key": API_KEY },
          signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) throw new Error(`Orders fetch failed: ${resp.status}`);
        return resp.json();
      }),

    // ── READ-ONLY: Single order detail ──
    getOrder: kioskProcedure
      .input(z.object({ orderId: z.string() }))
      .query(async ({ input }) => {
        const KIOSK_API =
          process.env.SMART_KIOSK_API_URL || "http://localhost:4000";
        const API_KEY = (process.env.SMART_KIOSK_API_KEY || "").trim();
        if (!API_KEY) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "SMART_KIOSK_API_KEY nu este configurat.",
          });
        }

        const resp = await fetch(
          `${KIOSK_API}/api/orders/${encodeURIComponent(input.orderId)}`,
          {
            headers: { "x-api-key": API_KEY },
            signal: AbortSignal.timeout(8000),
          }
        );
        if (!resp.ok) throw new Error(`Order not found: ${resp.status}`);
        return resp.json();
      }),

    // ── READ-ONLY: Brands list ──
    listBrands: kioskProcedure.query(async () => {
      try {
        const KIOSK_API =
          process.env.SMART_KIOSK_API_URL || "http://localhost:4000";
        const API_KEY = (process.env.SMART_KIOSK_API_KEY || "").trim();
        if (!API_KEY) return { brands: [] };

        const resp = await fetch(`${KIOSK_API}/api/brands`, {
          headers: { "x-api-key": API_KEY },
          signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) return { brands: [] };
        return resp.json();
      } catch {
        return { brands: [] };
      }
    }),
  }),

  // ── AGGREGATOR BRIDGE — Proxy to Aggregator Monitor ──
  aggregatorBridge: router({
    listPlatformSales: kioskProcedure
      .input(z.object({ organizationId: z.string().optional() }).optional())
      .query(async ({ input }) => {
        if (!input?.organizationId) return [];

        const KEYS = (process.env.SYRVE_API_KEYS || "")
          .split(",")
          .map(k => k.trim())
          .filter(Boolean);
        if (KEYS.length === 0) return [];
        let validOrders: any[] = [];

        for (const apiKey of KEYS) {
          try {
            const tokenRes = await fetch(
              "https://api-eu.syrve.live/api/1/access_token",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ apiLogin: apiKey }),
                signal: AbortSignal.timeout(8000),
              }
            );
            if (!tokenRes.ok) continue;
            const tokenData = await tokenRes.json();
            if (!tokenData?.token) continue;

            const now = new Date();
            const start = new Date(now);
            start.setDate(now.getDate() - 3);
            const dFrom = start.toISOString().replace("T", " ").substring(0, 23);
            const dTo = now.toISOString().replace("T", " ").substring(0, 23);

            const res = await fetch(
              "https://api-eu.syrve.live/api/1/deliveries/by_delivery_date_and_status",
              {
                method: "POST",
                headers: {
                  Authorization: "Bearer " + tokenData.token,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  organizationIds: [input.organizationId],
                  deliveryDateFrom: dFrom,
                  deliveryDateTo: dTo,
                }),
                signal: AbortSignal.timeout(8000),
              }
            );
            if (!res.ok) continue;
            const data = await res.json();
            const orgOrders = data?.ordersByOrganizations?.[0]?.orders;
            if (Array.isArray(orgOrders)) {
              validOrders = orgOrders;
              break;
            }
          } catch {
            continue;
          }
        }

        return validOrders
          .filter((o: any) => Boolean(o?.order?.id))
          .map((o: any) => {
            const ord = o.order;
            const ordIdStr = String(ord.id);
            let platformName = "manual";
            const ot = ord.orderType?.name?.toLowerCase() || "";
            if (ot.includes("glovo")) platformName = "glovo";
            else if (ot.includes("bolt")) platformName = "bolt_food";
            else if (ot.includes("tazz")) platformName = "tazz";
            else if (ot.includes("wolt")) platformName = "wolt";

            return {
              id: ordIdStr,
              platform: platformName,
              order_id: ord.externalId || ordIdStr.split("-")[0],
              restaurant: {
                name: ord.customer?.name || ord.phone || "Client iiko",
              },
              brand: {
                name: ord.deliveryPoint?.address?.street?.name || "Adresa client",
              },
              total_amount: ord.sum,
              placed_at: o.creationInfo?.date || new Date().toISOString(),
            };
          });
      }),
  }),
});
