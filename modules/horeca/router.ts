import { router, protectedProcedure } from "../../server/_core/trpc";
import { z } from "zod";
import { getDb } from "../../server/db";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  horecaLocations, horecaMenuCategories, horecaMenuItems, horecaRecipeLines,
  horecaTables, horecaOrders, horecaOrderLines, horecaDeliveryOrders,
  horecaModifierGroups, horecaModifiers,
} from "./schema";

// ─────────────────────────────────────────────────────────────────────────────
//  HORECA MODULE ROUTER
//  Importat în server/routers.ts ca: horeca: horecaRouter
// ─────────────────────────────────────────────────────────────────────────────

export const horecaRouter = router({

  // ── LOCATIONS ─────────────────────────────────────────────────────────────
  locations: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("No DB");
      return db.select().from(horecaLocations)
        .where(and(eq(horecaLocations.tenantId, ctx.user.tenantId!), eq(horecaLocations.isActive, 1)))
        .orderBy(horecaLocations.name);
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        address: z.string().optional(),
        city: z.string().optional(),
        phone: z.string().optional(),
        type: z.enum(["restaurant", "bar", "cafenea", "fast_food", "pizzerie", "catering", "hotel"]).default("restaurant"),
        currency: z.string().default("RON"),
        defaultVatFood: z.number().default(9),
        defaultVatAlcohol: z.number().default(19),
      }))
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
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        phone: z.string().optional(),
        type: z.enum(["restaurant", "bar", "cafenea", "fast_food", "pizzerie", "catering", "hotel"]).optional(),
        defaultVatFood: z.number().optional(),
        defaultVatAlcohol: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { id, ...rest } = input;
        await db.update(horecaLocations).set(rest)
          .where(and(eq(horecaLocations.id, id), eq(horecaLocations.tenantId, ctx.user.tenantId!)));
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        await db.update(horecaLocations).set({ isActive: 0 })
          .where(and(eq(horecaLocations.id, input.id), eq(horecaLocations.tenantId, ctx.user.tenantId!)));
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
        return db.select().from(horecaMenuCategories)
          .where(and(
            eq(horecaMenuCategories.tenantId, ctx.user.tenantId!),
            eq(horecaMenuCategories.locationId, input.locationId),
            eq(horecaMenuCategories.isActive, 1),
          ))
          .orderBy(horecaMenuCategories.sortOrder, horecaMenuCategories.name);
      }),

    createCategory: protectedProcedure
      .input(z.object({
        locationId: z.number(),
        name: z.string().min(1),
        description: z.string().optional(),
        icon: z.string().optional(),
        color: z.string().optional(),
        sortOrder: z.number().default(0),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const [r] = await db.insert(horecaMenuCategories).values({ tenantId: ctx.user.tenantId!, ...input });
        return { id: (r as any).insertId };
      }),

    updateCategory: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        color: z.string().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { id, ...rest } = input;
        await db.update(horecaMenuCategories).set(rest)
          .where(and(eq(horecaMenuCategories.id, id), eq(horecaMenuCategories.tenantId, ctx.user.tenantId!)));
        return { success: true };
      }),

    deleteCategory: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        await db.update(horecaMenuCategories).set({ isActive: 0 })
          .where(and(eq(horecaMenuCategories.id, input.id), eq(horecaMenuCategories.tenantId, ctx.user.tenantId!)));
        return { success: true };
      }),

    // Items
    listItems: protectedProcedure
      .input(z.object({ locationId: z.number(), categoryId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const conditions = [
          eq(horecaMenuItems.tenantId, ctx.user.tenantId!),
          eq(horecaMenuItems.locationId, input.locationId),
          eq(horecaMenuItems.isActive, 1),
        ];
        if (input.categoryId) conditions.push(eq(horecaMenuItems.categoryId, input.categoryId));
        return db.select().from(horecaMenuItems).where(and(...conditions))
          .orderBy(horecaMenuItems.sortOrder, horecaMenuItems.name);
      }),

    createItem: protectedProcedure
      .input(z.object({
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
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const [r] = await db.insert(horecaMenuItems).values({ tenantId: ctx.user.tenantId!, ...input });
        return { id: (r as any).insertId };
      }),

    updateItem: protectedProcedure
      .input(z.object({
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
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { id, ...rest } = input;
        await db.update(horecaMenuItems).set(rest)
          .where(and(eq(horecaMenuItems.id, id), eq(horecaMenuItems.tenantId, ctx.user.tenantId!)));
        return { success: true };
      }),

    deleteItem: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        await db.update(horecaMenuItems).set({ isActive: 0 })
          .where(and(eq(horecaMenuItems.id, input.id), eq(horecaMenuItems.tenantId, ctx.user.tenantId!)));
        return { success: true };
      }),

    // Recipe
    getRecipe: protectedProcedure
      .input(z.object({ menuItemId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        return db.select().from(horecaRecipeLines)
          .where(and(eq(horecaRecipeLines.menuItemId, input.menuItemId), eq(horecaRecipeLines.tenantId, ctx.user.tenantId!)))
          .orderBy(horecaRecipeLines.sortOrder);
      }),

    upsertRecipe: protectedProcedure
      .input(z.object({
        menuItemId: z.number(),
        lines: z.array(z.object({
          id: z.number().optional(),
          ingredientName: z.string().min(1),
          productId: z.number().optional(),
          quantity: z.string(),
          unit: z.string(),
          unitCost: z.string().optional(),
          sortOrder: z.number().default(0),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        // Șterge vechile linii și reinserează
        await db.delete(horecaRecipeLines)
          .where(and(eq(horecaRecipeLines.menuItemId, input.menuItemId), eq(horecaRecipeLines.tenantId, ctx.user.tenantId!)));
        if (input.lines.length > 0) {
          await db.insert(horecaRecipeLines).values(
            input.lines.map(l => ({ ...l, menuItemId: input.menuItemId, tenantId: ctx.user.tenantId! }))
          );
        }
        // Marchează produsul ca având rețetă
        await db.update(horecaMenuItems).set({ hasRecipe: input.lines.length > 0 ? 1 : 0 })
          .where(and(eq(horecaMenuItems.id, input.menuItemId), eq(horecaMenuItems.tenantId, ctx.user.tenantId!)));
        return { success: true };
      }),

    calculateFoodCost: protectedProcedure
      .input(z.object({ menuItemId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const lines = await db.select().from(horecaRecipeLines)
          .where(and(eq(horecaRecipeLines.menuItemId, input.menuItemId), eq(horecaRecipeLines.tenantId, ctx.user.tenantId!)));
        const [item] = await db.select().from(horecaMenuItems)
          .where(and(eq(horecaMenuItems.id, input.menuItemId), eq(horecaMenuItems.tenantId, ctx.user.tenantId!)));
        const totalCost = lines.reduce((sum, l) => sum + (Number(l.quantity) * Number(l.unitCost || 0)), 0);
        const price = Number(item?.price || 0);
        const pct = price > 0 ? (totalCost / price) * 100 : 0;
        return { totalCost: totalCost.toFixed(4), price: price.toFixed(2), foodCostPct: pct.toFixed(1) };
      }),
  }),

  // ── TABLES ────────────────────────────────────────────────────────────────
  tables: router({
    list: protectedProcedure
      .input(z.object({ locationId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        return db.select().from(horecaTables)
          .where(and(
            eq(horecaTables.tenantId, ctx.user.tenantId!),
            eq(horecaTables.locationId, input.locationId),
            eq(horecaTables.isActive, 1),
          ))
          .orderBy(horecaTables.number);
      }),

    create: protectedProcedure
      .input(z.object({
        locationId: z.number(),
        number: z.string().min(1),
        capacity: z.number().default(4),
        zone: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const [r] = await db.insert(horecaTables).values({ tenantId: ctx.user.tenantId!, ...input });
        return { id: (r as any).insertId };
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["free", "occupied", "reserved", "cleaning"]),
        currentOrderId: z.number().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { id, ...rest } = input;
        await db.update(horecaTables).set(rest)
          .where(and(eq(horecaTables.id, id), eq(horecaTables.tenantId, ctx.user.tenantId!)));
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        await db.update(horecaTables).set({ isActive: 0 })
          .where(and(eq(horecaTables.id, input.id), eq(horecaTables.tenantId, ctx.user.tenantId!)));
        return { success: true };
      }),
  }),

  // ── ORDERS ────────────────────────────────────────────────────────────────
  orders: router({
    list: protectedProcedure
      .input(z.object({
        locationId: z.number(),
        status: z.string().optional(),
        type: z.string().optional(),
        date: z.string().optional(), // YYYY-MM-DD
      }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const rows = await db.select().from(horecaOrders)
          .where(and(
            eq(horecaOrders.tenantId, ctx.user.tenantId!),
            eq(horecaOrders.locationId, input.locationId),
          ))
          .orderBy(desc(horecaOrders.createdAt))
          .limit(200);
        return rows.filter(r => {
          if (input.status && r.status !== input.status) return false;
          if (input.type && r.type !== input.type) return false;
          if (input.date) {
            const d = r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : "";
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
        const [order] = await db.select().from(horecaOrders)
          .where(and(eq(horecaOrders.id, input.id), eq(horecaOrders.tenantId, ctx.user.tenantId!)));
        if (!order) throw new Error("Not found");
        const lines = await db.select().from(horecaOrderLines)
          .where(eq(horecaOrderLines.orderId, input.id))
          .orderBy(horecaOrderLines.createdAt);
        return { ...order, lines };
      }),

    create: protectedProcedure
      .input(z.object({
        locationId: z.number(),
        type: z.enum(["dine_in", "takeaway", "delivery"]).default("dine_in"),
        tableId: z.number().optional(),
        tableNumber: z.string().optional(),
        guestCount: z.number().default(1),
        staffName: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        // Generare număr comandă
        const [cnt] = await db.select({ c: sql<number>`COUNT(*)` }).from(horecaOrders)
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
          await db.update(horecaTables).set({ status: "occupied", currentOrderId: orderId })
            .where(and(eq(horecaTables.id, input.tableId), eq(horecaTables.tenantId, ctx.user.tenantId!)));
        }
        return { id: orderId, orderNumber };
      }),

    addLine: protectedProcedure
      .input(z.object({
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
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const qty = Number(input.quantity);
        const price = Number(input.unitPrice);
        const vatRate = input.vatRate;
        const vatAmount = parseFloat((qty * price * vatRate / (100 + vatRate)).toFixed(2));
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
        const lines = await db.select().from(horecaOrderLines)
          .where(and(eq(horecaOrderLines.orderId, input.orderId), sql`status != 'cancelled'`));
        const subtotal = lines.reduce((s, l) => s + Number(l.total), 0);
        const totalVat = lines.reduce((s, l) => s + Number(l.vatAmount), 0);
        await db.update(horecaOrders).set({
          subtotal: subtotal.toFixed(2),
          vatAmount: totalVat.toFixed(2),
          total: subtotal.toFixed(2),
        }).where(eq(horecaOrders.id, input.orderId));
        return { success: true };
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["draft", "sent", "preparing", "ready", "served", "paid", "cancelled"]),
        paymentMethod: z.enum(["cash", "card", "voucher", "online", "room_charge", "mixed"]).optional(),
        tip: z.string().optional(),
        discount: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { id, status, paymentMethod, tip, discount } = input;
        const update: Record<string, any> = { status };
        if (paymentMethod) update.paymentMethod = paymentMethod;
        if (tip) update.tip = tip;
        if (discount) update.discount = discount;
        if (status === "paid") update.paidAt = new Date();
        if (status === "paid" || status === "cancelled") update.closedAt = new Date();
        await db.update(horecaOrders).set(update)
          .where(and(eq(horecaOrders.id, id), eq(horecaOrders.tenantId, ctx.user.tenantId!)));
        // Eliberează masa dacă e plătit/anulat
        if (status === "paid" || status === "cancelled") {
          const [order] = await db.select().from(horecaOrders).where(eq(horecaOrders.id, id));
          if (order?.tableId) {
            await db.update(horecaTables).set({ status: "free", currentOrderId: null })
              .where(and(eq(horecaTables.id, order.tableId), eq(horecaTables.tenantId, ctx.user.tenantId!)));
          }
        }
        return { success: true };
      }),

    cancel: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        await db.update(horecaOrders).set({ status: "cancelled", closedAt: new Date() })
          .where(and(eq(horecaOrders.id, input.id), eq(horecaOrders.tenantId, ctx.user.tenantId!)));
        const [order] = await db.select().from(horecaOrders).where(eq(horecaOrders.id, input.id));
        if (order?.tableId) {
          await db.update(horecaTables).set({ status: "free", currentOrderId: null })
            .where(and(eq(horecaTables.id, order.tableId), eq(horecaTables.tenantId, ctx.user.tenantId!)));
        }
        return { success: true };
      }),
  }),

  // ── DELIVERY ──────────────────────────────────────────────────────────────
  delivery: router({
    list: protectedProcedure
      .input(z.object({ locationId: z.number(), status: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const rows = await db.select().from(horecaDeliveryOrders)
          .where(and(
            eq(horecaDeliveryOrders.tenantId, ctx.user.tenantId!),
            eq(horecaDeliveryOrders.locationId, input.locationId),
          ))
          .orderBy(desc(horecaDeliveryOrders.createdAt))
          .limit(200);
        if (input.status) return rows.filter(r => r.status === input.status);
        return rows;
      }),

    create: protectedProcedure
      .input(z.object({
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
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const [r] = await db.insert(horecaDeliveryOrders).values({ tenantId: ctx.user.tenantId!, ...input });
        return { id: (r as any).insertId };
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["new", "accepted", "preparing", "ready", "picked_up", "delivered", "cancelled", "rejected"]),
        internalOrderId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const { id, ...rest } = input;
        await db.update(horecaDeliveryOrders).set(rest)
          .where(and(eq(horecaDeliveryOrders.id, id), eq(horecaDeliveryOrders.tenantId, ctx.user.tenantId!)));
        return { success: true };
      }),
  }),

  // ── REPORTS ───────────────────────────────────────────────────────────────
  reports: router({
    dailySummary: protectedProcedure
      .input(z.object({ locationId: z.number(), date: z.string() })) // YYYY-MM-DD
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("No DB");
        const allOrders = await db.select().from(horecaOrders)
          .where(and(
            eq(horecaOrders.tenantId, ctx.user.tenantId!),
            eq(horecaOrders.locationId, input.locationId),
          ));
        const dayOrders = allOrders.filter(o => {
          const d = o.createdAt ? new Date(o.createdAt).toISOString().slice(0, 10) : "";
          return d === input.date && o.status === "paid";
        });
        const totalRevenue = dayOrders.reduce((s, o) => s + Number(o.total), 0);
        const totalVat = dayOrders.reduce((s, o) => s + Number(o.vatAmount), 0);
        const totalTip = dayOrders.reduce((s, o) => s + Number(o.tip), 0);
        const byType = { dine_in: 0, takeaway: 0, delivery: 0 };
        dayOrders.forEach(o => { byType[o.type as keyof typeof byType] += Number(o.total); });
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
        const all = await db.select().from(horecaDeliveryOrders)
          .where(and(
            eq(horecaDeliveryOrders.tenantId, ctx.user.tenantId!),
            eq(horecaDeliveryOrders.locationId, input.locationId),
          ));
        const inMonth = all.filter(o => {
          const m = o.createdAt ? new Date(o.createdAt).toISOString().slice(0, 7) : "";
          return m === input.month && o.status === "delivered";
        });
        const byPlatform: Record<string, { orders: number; revenue: number; commission: number }> = {};
        inMonth.forEach(o => {
          if (!byPlatform[o.platform]) byPlatform[o.platform] = { orders: 0, revenue: 0, commission: 0 };
          byPlatform[o.platform].orders++;
          byPlatform[o.platform].revenue += Number(o.total || 0);
          byPlatform[o.platform].commission += Number(o.commission || 0);
        });
        return { month: input.month, byPlatform };
      }),
  }),
});
