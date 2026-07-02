import { router, protectedProcedure } from "../../server/_core/trpc";
import { z } from "zod";
import { getDb } from "../../server/db";
import { eq, and, desc, sql } from "drizzle-orm";
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
import { bonuriConsum, bonuriConsumLines } from "../../drizzle/schema";

// ─────────────────────────────────────────────────────────────────────────────
//  HORECA MODULE ROUTER
//  Importat în server/routers.ts ca: horeca: horecaRouter
// ─────────────────────────────────────────────────────────────────────────────

export const horecaRouter = router({
  // ── LOCATIONS ─────────────────────────────────────────────────────────────
  locations: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      console.log("[Horeca locations.list] User:", ctx.user.id, "Tenant:", ctx.user.tenantId);
      const db = await getDb();
      if (!db) throw new Error("No DB");
      const locs = await db
        .select()
        .from(horecaLocations)
        .where(
          and(
            eq(horecaLocations.tenantId, ctx.user.tenantId!),
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
          defaultVatFood: z.number().default(9),
          defaultVatAlcohol: z.number().default(19),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const [result] = await db.insert(horecaLocations).values({
          tenantId: ctx.user.tenantId!,
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
              eq(horecaLocations.tenantId, ctx.user.tenantId!)
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
              eq(horecaLocations.tenantId, ctx.user.tenantId!)
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
          eq(horecaIngredients.tenantId, ctx.user.tenantId!),
          eq(horecaIngredients.isActive, 1)
        ];
        if (input.locationId) {
          conditions.push(eq(horecaIngredients.locationId, input.locationId));
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
        if (input.id) {
          await db
            .update(horecaIngredients)
            .set({
              name: input.name,
              unit: input.unit,
              unitCost: input.unitCost?.toString() || "0.00",
            })
            .where(
              and(
                eq(horecaIngredients.id, input.id),
                eq(horecaIngredients.tenantId, ctx.user.tenantId!)
              )
            );
          return { id: input.id };
        } else {
          const [result] = await db.insert(horecaIngredients).values({
            tenantId: ctx.user.tenantId!,
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

        // 1. Insert movement
        await db.insert(horecaStockMovements).values({
          tenantId: ctx.user.tenantId!,
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
          sql`UPDATE horecaIngredients SET currentStock = currentStock + ${input.quantity} WHERE id = ${input.ingredientId} AND tenantId = ${ctx.user.tenantId!}`
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
              eq(horecaMenuCategories.tenantId, ctx.user.tenantId!),
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
        const [r] = await db
          .insert(horecaMenuCategories)
          .values({ tenantId: ctx.user.tenantId!, ...input });
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
              eq(horecaMenuCategories.tenantId, ctx.user.tenantId!)
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
              eq(horecaMenuCategories.tenantId, ctx.user.tenantId!)
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
          eq(horecaMenuItems.tenantId, ctx.user.tenantId!),
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
          vatRate: z.number().default(9),
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
        const [r] = await db
          .insert(horecaMenuItems)
          .values({ tenantId: ctx.user.tenantId!, ...input });
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
        const { id, ...rest } = input;
        await db
          .update(horecaMenuItems)
          .set(rest)
          .where(
            and(
              eq(horecaMenuItems.id, id),
              eq(horecaMenuItems.tenantId, ctx.user.tenantId!)
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
              eq(horecaMenuItems.tenantId, ctx.user.tenantId!)
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
              eq(horecaRecipeLines.tenantId, ctx.user.tenantId!)
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
        // Șterge vechile linii și reinserează
        await db
          .delete(horecaRecipeLines)
          .where(
            and(
              eq(horecaRecipeLines.menuItemId, input.menuItemId),
              eq(horecaRecipeLines.tenantId, ctx.user.tenantId!)
            )
          );
        if (input.lines.length > 0) {
          await db.insert(horecaRecipeLines).values(
            input.lines.map(l => ({
              ...l,
              ingredientId: l.ingredientId ?? null,
              menuItemId: input.menuItemId,
              tenantId: ctx.user.tenantId!,
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
              eq(horecaMenuItems.tenantId, ctx.user.tenantId!)
            )
          );
        return { success: true };
      }),

    calculateFoodCost: protectedProcedure
      .input(z.object({ menuItemId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const lines = await db
          .select()
          .from(horecaRecipeLines)
          .where(
            and(
              eq(horecaRecipeLines.menuItemId, input.menuItemId),
              eq(horecaRecipeLines.tenantId, ctx.user.tenantId!)
            )
          );
        const [item] = await db
          .select()
          .from(horecaMenuItems)
          .where(
            and(
              eq(horecaMenuItems.id, input.menuItemId),
              eq(horecaMenuItems.tenantId, ctx.user.tenantId!)
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
              eq(horecaTables.tenantId, ctx.user.tenantId!),
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
        const [r] = await db
          .insert(horecaTables)
          .values({ tenantId: ctx.user.tenantId!, ...input });
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
        const { id, ...rest } = input;
        await db
          .update(horecaTables)
          .set(rest)
          .where(
            and(
              eq(horecaTables.id, id),
              eq(horecaTables.tenantId, ctx.user.tenantId!)
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
              eq(horecaTables.tenantId, ctx.user.tenantId!)
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
        const rows = await db
          .select()
          .from(horecaOrders)
          .where(
            and(
              eq(horecaOrders.tenantId, ctx.user.tenantId!),
              eq(horecaOrders.locationId, input.locationId)
            )
          )
          .orderBy(desc(horecaOrders.createdAt))
          .limit(200);
        return rows.filter(r => {
          if (input.status && r.status !== input.status) return false;
          if (input.type && r.type !== input.type) return false;
          if (input.date) {
            const d = r.createdAt
              ? new Date(r.createdAt).toISOString().slice(0, 10)
              : "";
            if (d !== input.date) return false;
          }
          return true;
        });
      }),

    getWithLines: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const [order] = await db
          .select()
          .from(horecaOrders)
          .where(
            and(
              eq(horecaOrders.id, input.id),
              eq(horecaOrders.tenantId, ctx.user.tenantId!)
            )
          );
        if (!order) throw new Error("Not found");
        const lines = await db
          .select()
          .from(horecaOrderLines)
          .where(eq(horecaOrderLines.orderId, input.id))
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
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        // Generare număr comandă
        const [cnt] = await db
          .select({ c: sql<number>`COUNT(*)` })
          .from(horecaOrders)
          .where(eq(horecaOrders.tenantId, ctx.user.tenantId!));
        const orderNumber = `CMD-${String((Number(cnt?.c) || 0) + 1).padStart(4, "0")}`;
        const [r] = await db.insert(horecaOrders).values({
          tenantId: ctx.user.tenantId!,
          orderNumber,
          ...input,
        });
        const orderId = (r as any).insertId;
        // Marchează masa ca ocupată
        if (input.tableId) {
          await db
            .update(horecaTables)
            .set({ status: "occupied", currentOrderId: orderId })
            .where(
              and(
                eq(horecaTables.id, input.tableId),
                eq(horecaTables.tenantId, ctx.user.tenantId!)
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
          vatRate: z.number().default(9),
          notes: z.string().optional(),
          modifiers: z.string().optional(),
          kitchenSection: z.string().optional(),
          foodCostUnit: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const qty = Number(input.quantity);
        const price = Number(input.unitPrice);
        const vatRate = input.vatRate;
        const vatAmount = parseFloat(
          ((qty * price * vatRate) / (100 + vatRate)).toFixed(2)
        );
        const total = parseFloat((qty * price).toFixed(2));
        await db.insert(horecaOrderLines).values({
          orderId: input.orderId,
          tenantId: ctx.user.tenantId!,
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
        // Recalculează totalul comenzii
        const lines = await db
          .select()
          .from(horecaOrderLines)
          .where(
            and(
              eq(horecaOrderLines.orderId, input.orderId),
              sql`status != 'cancelled'`
            )
          );
        const subtotal = lines.reduce((s, l) => s + Number(l.total), 0);
        const totalVat = lines.reduce((s, l) => s + Number(l.vatAmount), 0);
        await db
          .update(horecaOrders)
          .set({
            subtotal: subtotal.toFixed(2),
            vatAmount: totalVat.toFixed(2),
            total: subtotal.toFixed(2),
          })
          .where(eq(horecaOrders.id, input.orderId));
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
        const { id, status, paymentMethod, tip, discount } = input;

        const [oldOrder] = await db
          .select()
          .from(horecaOrders)
          .where(
            and(
              eq(horecaOrders.id, id),
              eq(horecaOrders.tenantId, ctx.user.tenantId!)
            )
          );
        if (!oldOrder) throw new Error("Order not found");

        const update: Record<string, any> = { status };
        if (paymentMethod) update.paymentMethod = paymentMethod;
        if (tip) update.tip = tip;
        if (discount) update.discount = discount;
        if (status === "paid") update.paidAt = new Date();
        if (status === "paid" || status === "cancelled")
          update.closedAt = new Date();

        await db
          .update(horecaOrders)
          .set(update)
          .where(
            and(
              eq(horecaOrders.id, id),
              eq(horecaOrders.tenantId, ctx.user.tenantId!)
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
                  eq(horecaTables.tenantId, ctx.user.tenantId!)
                )
              );
          }
        }

        // Auto-consumption of stock when paid
        if (status === "paid" && oldOrder.status !== "paid" && !oldOrder.stockDeducted) {
          const lines = await db
            .select()
            .from(horecaOrderLines)
            .where(eq(horecaOrderLines.orderId, id));
          
          const ingredientsToConsume: any[] = [];
          const horecaStockUpdates: { ingredientId: number; qty: number; unitCost: number }[] = [];

          for (const line of lines) {
            if (line.menuItemId) {
              const recipeLines = await db
                .select()
                .from(horecaRecipeLines)
                .where(eq(horecaRecipeLines.menuItemId, line.menuItemId));
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

          // 1. Generate Bon de Consum for ERP module (if global inventory is used)
          if (ingredientsToConsume.length > 0) {
            const [bc] = await db.insert(bonuriConsum).values({
              tenantId: ctx.user.tenantId!,
              number: `BC-CMD-${oldOrder.orderNumber}`,
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
             await db.execute(sql`UPDATE horecaIngredients SET currentStock = currentStock - ${stockUpd.qty} WHERE id = ${stockUpd.ingredientId}`);
             await db.insert(horecaStockMovements).values({
               tenantId: ctx.user.tenantId!,
               locationId: oldOrder.locationId,
               ingredientId: stockUpd.ingredientId,
               type: "out",
               quantity: stockUpd.qty.toString(),
               unitCost: stockUpd.unitCost.toString(),
               reference: `CMD-${oldOrder.orderNumber}`,
             });
          }

          // 3. Mark order as stock deducted
          await db.update(horecaOrders).set({ stockDeducted: 1 }).where(eq(horecaOrders.id, id));
        }

        return { success: true };
      }),

    cancel: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        await db
          .update(horecaOrders)
          .set({ status: "cancelled", closedAt: new Date() })
          .where(
            and(
              eq(horecaOrders.id, input.id),
              eq(horecaOrders.tenantId, ctx.user.tenantId!)
            )
          );
        const [order] = await db
          .select()
          .from(horecaOrders)
          .where(eq(horecaOrders.id, input.id));
        if (order?.tableId) {
          await db
            .update(horecaTables)
            .set({ status: "free", currentOrderId: null })
            .where(
              and(
                eq(horecaTables.id, order.tableId),
                eq(horecaTables.tenantId, ctx.user.tenantId!)
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
        const rows = await db
          .select()
          .from(horecaDeliveryOrders)
          .where(
            and(
              eq(horecaDeliveryOrders.tenantId, ctx.user.tenantId!),
              eq(horecaDeliveryOrders.locationId, input.locationId)
            )
          )
          .orderBy(desc(horecaDeliveryOrders.createdAt))
          .limit(200);
        if (input.status) return rows.filter(r => r.status === input.status);
        return rows;
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
        const [r] = await db
          .insert(horecaDeliveryOrders)
          .values({ tenantId: ctx.user.tenantId!, ...input });
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
        const { id, ...rest } = input;
        await db
          .update(horecaDeliveryOrders)
          .set(rest)
          .where(
            and(
              eq(horecaDeliveryOrders.id, id),
              eq(horecaDeliveryOrders.tenantId, ctx.user.tenantId!)
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
              eq(horecaShifts.tenantId, ctx.user.tenantId!),
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
        // Verifica daca exista deja o tura deschisa
        const existing = await db
          .select()
          .from(horecaShifts)
          .where(
            and(
              eq(horecaShifts.tenantId, ctx.user.tenantId!),
              eq(horecaShifts.locationId, input.locationId),
              eq(horecaShifts.status, "open")
            )
          );
        if (existing.length > 0)
          throw new Error("Există deja o tură deschisă!");

        const [r] = await db.insert(horecaShifts).values({
          tenantId: ctx.user.tenantId!,
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

        const [shift] = await db
          .select()
          .from(horecaShifts)
          .where(
            and(eq(horecaShifts.id, input.id), eq(horecaShifts.status, "open"))
          );
        if (!shift)
          throw new Error("Tura nu a fost găsită sau este deja închisă!");

        // Calculam incasarile reale din orders de cand s-a deschis tura
        const orders = await db
          .select()
          .from(horecaOrders)
          .where(
            and(
              eq(horecaOrders.tenantId, ctx.user.tenantId!),
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
          .where(eq(horecaShifts.id, input.id));

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
              eq(horecaShifts.tenantId, ctx.user.tenantId!),
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
              eq(horecaOrders.tenantId, ctx.user.tenantId!),
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
              eq(horecaDeliveryOrders.tenantId, ctx.user.tenantId!),
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
        const rows = await db
          .select()
          .from(horecaKioskSettings)
          .where(
            and(
              eq(horecaKioskSettings.tenantId, ctx.user.tenantId!),
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

        // Check if exists
        const existing = await db
          .select({ id: horecaKioskSettings.id })
          .from(horecaKioskSettings)
          .where(
            and(
              eq(horecaKioskSettings.tenantId, ctx.user.tenantId!),
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
            .where(eq(horecaKioskSettings.id, existing[0].id));
          return { success: true };
        } else {
          await db.insert(horecaKioskSettings).values({
            tenantId: ctx.user.tenantId!,
            ...input,
          });
          return { success: true };
        }
      }),
  }),

  // ── KIOSK BRIDGE — Proxy to Smart Kiosk backend (localhost:4000) for testing ──
  kioskBridge: router({
    // List all locations from the external Smart Kiosk backend
    listLocations: protectedProcedure.query(async () => {
      const KIOSK_API =
        process.env.SMART_KIOSK_API_URL || "http://localhost:4000";
      const API_KEY = process.env.SMART_KIOSK_API_KEY || "sk-live-2024-secure";

      const resp = await fetch(`${KIOSK_API}/api/locations`, {
        headers: { "x-api-key": API_KEY },
      });
      if (!resp.ok) throw new Error(`Smart Kiosk API error: ${resp.status}`);
      const data = await resp.json();
      return data.locations || [];
    }),

    // Get a single location's full data
    getLocation: protectedProcedure
      .input(z.object({ locationId: z.string() }))
      .query(async ({ input }) => {
        const KIOSK_API =
          process.env.SMART_KIOSK_API_URL || "http://localhost:4000";
        const API_KEY =
          process.env.SMART_KIOSK_API_KEY || "sk-live-2024-secure";

        const resp = await fetch(
          `${KIOSK_API}/api/locations/${input.locationId}`,
          {
            headers: { "x-api-key": API_KEY },
          }
        );
        if (!resp.ok) throw new Error(`Location not found: ${resp.status}`);
        return resp.json();
      }),

    // Update location settings on Smart Kiosk backend
    updateLocation: protectedProcedure
      .input(
        z.object({
          locationId: z.string(),
          data: z.record(z.string(), z.any()), // free-form JSON — the entire location patch
        })
      )
      .mutation(async ({ input }) => {
        const KIOSK_API =
          process.env.SMART_KIOSK_API_URL || "http://localhost:4000";
        const API_KEY =
          process.env.SMART_KIOSK_API_KEY || "sk-live-2024-secure";

        // First login to get JWT
        const loginResp = await fetch(`${KIOSK_API}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: process.env.SMART_KIOSK_ADMIN_EMAIL || "admin@kiosk.ro",
            password: process.env.SMART_KIOSK_ADMIN_PASSWORD || "admin123",
          }),
        });
        if (!loginResp.ok) throw new Error("Smart Kiosk login failed");
        const { token } = await loginResp.json();

        const resp = await fetch(
          `${KIOSK_API}/api/locations/${input.locationId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(input.data),
          }
        );
        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`Update failed: ${resp.status} ${errText}`);
        }
        return resp.json();
      }),

    // Get promotions config from Smart Kiosk
    getPromotions: protectedProcedure.query(async () => {
      const KIOSK_API =
        process.env.SMART_KIOSK_API_URL || "http://localhost:4000";
      const API_KEY = process.env.SMART_KIOSK_API_KEY || "sk-live-2024-secure";

      const resp = await fetch(`${KIOSK_API}/api/promotions`, {
        headers: { "x-api-key": API_KEY },
      });
      if (!resp.ok) return {};
      return resp.json();
    }),

    // Get kiosk screensaver configs
    getKioskConfigs: protectedProcedure.query(async () => {
      const KIOSK_API =
        process.env.SMART_KIOSK_API_URL || "http://localhost:4000";

      const resp = await fetch(`${KIOSK_API}/api/admin/kiosk-config`);
      if (!resp.ok) return { posters: {} };
      return resp.json();
    }),

    // ── READ-ONLY: Menu from Syrve via Smart Kiosk ──
    getMenu: protectedProcedure
      .input(
        z.object({
          brandId: z.string().default("smashme"),
          locId: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        const KIOSK_API =
          process.env.SMART_KIOSK_API_URL || "http://localhost:4000";
        const API_KEY =
          process.env.SMART_KIOSK_API_KEY || "sk-live-2024-secure";

        let url = `${KIOSK_API}/api/menu?brandId=${input.brandId}`;
        if (input.locId) url += `&locId=${input.locId}`;

        const resp = await fetch(url, { headers: { "x-api-key": API_KEY } });
        if (!resp.ok) throw new Error(`Menu fetch failed: ${resp.status}`);
        return resp.json();
      }),

    // ── READ-ONLY: Orders list from Smart Kiosk ──
    listOrders: protectedProcedure
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
        const API_KEY =
          process.env.SMART_KIOSK_API_KEY || "sk-live-2024-secure";

        let url = `${KIOSK_API}/api/orders?limit=${input.limit}`;
        if (input.status) url += `&status=${input.status}`;
        if (input.brand) url += `&brand=${input.brand}`;

        const resp = await fetch(url, { headers: { "x-api-key": API_KEY } });
        if (!resp.ok) throw new Error(`Orders fetch failed: ${resp.status}`);
        return resp.json();
      }),

    // ── READ-ONLY: Single order detail ──
    getOrder: protectedProcedure
      .input(z.object({ orderId: z.string() }))
      .query(async ({ input }) => {
        const KIOSK_API =
          process.env.SMART_KIOSK_API_URL || "http://localhost:4000";
        const API_KEY =
          process.env.SMART_KIOSK_API_KEY || "sk-live-2024-secure";

        const resp = await fetch(`${KIOSK_API}/api/orders/${input.orderId}`, {
          headers: { "x-api-key": API_KEY },
        });
        if (!resp.ok) throw new Error(`Order not found: ${resp.status}`);
        return resp.json();
      }),

    // ── READ-ONLY: Brands list ──
    listBrands: protectedProcedure.query(async () => {
      const KIOSK_API =
        process.env.SMART_KIOSK_API_URL || "http://localhost:4000";
      const API_KEY = process.env.SMART_KIOSK_API_KEY || "sk-live-2024-secure";

      const resp = await fetch(`${KIOSK_API}/api/brands`, {
        headers: { "x-api-key": API_KEY },
      });
      if (!resp.ok) return { brands: [] };
      return resp.json();
    }),
  }),

  // ── AGGREGATOR BRIDGE — Proxy to Aggregator Monitor (Supabase) ──
  aggregatorBridge: router({
    listPlatformSales: protectedProcedure
      .input(z.object({ organizationId: z.string().optional() }).optional())
      .query(async ({ input }) => {
        if (!input?.organizationId) return [];

        const KEYS = [
          "3ec9ef9d592440ea9039d6dae3e4a33f",
          "124d0880f4b44717b69ee21d45fc2656",
        ];
        let validOrders: any[] = [];

        for (const apiKey of KEYS) {
          const tokenRes = await fetch(
            "https://api-eu.syrve.live/api/1/access_token",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ apiLogin: apiKey }),
            }
          );
          const tokenData = await tokenRes.json();
          if (!tokenData.token) continue;

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
            }
          );
          const data = await res.json();
          const orgOrders = data?.ordersByOrganizations?.[0]?.orders;
          if (orgOrders) {
            validOrders = orgOrders;
            break;
          }
        }

        return validOrders.map((o: any) => {
          const ord = o.order;
          let platformName = "manual";
          const ot = ord.orderType?.name?.toLowerCase() || "";
          if (ot.includes("glovo")) platformName = "glovo";
          else if (ot.includes("bolt")) platformName = "bolt_food";
          else if (ot.includes("tazz")) platformName = "tazz";
          else if (ot.includes("wolt")) platformName = "wolt";

          return {
            id: ord.id,
            platform: platformName,
            order_id: ord.externalId || ord.id.split("-")[0],
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
