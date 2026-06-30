import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
} from "drizzle-orm/mysql-core";

// ─────────────────────────────────────────────────────────────────────────────
//  SMART HORECA MODULE — Schema izolat
//  Tabelele acestui modul NU sunt importate în drizzle/schema.ts principal.
//  Sunt gestionate exclusiv prin modules/horeca/migrations.ts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * HORECA Locations — Locațiile (restaurant/bar/cafenea) per tenant
 */
export const horecaLocations = mysqlTable("horecaLocations", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  phone: varchar("phone", { length: 20 }),
  type: mysqlEnum("type", [
    "restaurant",
    "bar",
    "cafenea",
    "fast_food",
    "pizzerie",
    "catering",
    "hotel",
  ]).default("restaurant"),
  currency: varchar("currency", { length: 3 }).default("RON"),
  defaultVatFood: int("defaultVatFood").default(9),
  defaultVatAlcohol: int("defaultVatAlcohol").default(19),
  settings: text("settings"), // JSON
  isActive: int("isActive").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type HorecaLocation = typeof horecaLocations.$inferSelect;
export type InsertHorecaLocation = typeof horecaLocations.$inferInsert;

/**
 * HORECA Menu Categories — Categorii meniu
 */
export const horecaMenuCategories = mysqlTable("horecaMenuCategories", {
  id: int("id").autoincrement().primaryKey(),
  locationId: int("locationId").notNull(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }),
  color: varchar("color", { length: 20 }),
  sortOrder: int("sortOrder").default(0),
  isActive: int("isActive").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type HorecaMenuCategory = typeof horecaMenuCategories.$inferSelect;
export type InsertHorecaMenuCategory = typeof horecaMenuCategories.$inferInsert;

/**
 * HORECA Menu Items — Produsele din meniu
 */
export const horecaMenuItems = mysqlTable("horecaMenuItems", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  locationId: int("locationId").notNull(),
  categoryId: int("categoryId"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  sku: varchar("sku", { length: 100 }),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  vatRate: int("vatRate").default(9),
  unit: varchar("unit", { length: 20 }).default("portie"),
  hasRecipe: int("hasRecipe").default(0),
  foodCostTarget: decimal("foodCostTarget", { precision: 5, scale: 2 }),
  isAvailableDelivery: int("isAvailableDelivery").default(1),
  isAvailableDineIn: int("isAvailableDineIn").default(1),
  isAvailableTakeaway: int("isAvailableTakeaway").default(1),
  glovoId: varchar("glovoId", { length: 100 }),
  woltId: varchar("woltId", { length: 100 }),
  boltId: varchar("boltId", { length: 100 }),
  tazzId: varchar("tazzId", { length: 100 }),
  imageUrl: varchar("imageUrl", { length: 512 }),
  allergens: text("allergens"), // JSON array ["gluten","lactate"]
  isActive: int("isActive").default(1),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type HorecaMenuItem = typeof horecaMenuItems.$inferSelect;
export type InsertHorecaMenuItem = typeof horecaMenuItems.$inferInsert;

/**
 * HORECA Recipe Lines — Rețetă: ingrediente per produs de meniu
 * productId → optional link la tabelul `products` din core (stoc)
 */
export const horecaRecipeLines = mysqlTable("horecaRecipeLines", {
  id: int("id").autoincrement().primaryKey(),
  menuItemId: int("menuItemId").notNull(),
  tenantId: int("tenantId").notNull(),
  ingredientName: varchar("ingredientName", { length: 255 }).notNull(),
  productId: int("productId"), // FK opțional → products (core)
  quantity: decimal("quantity", { precision: 10, scale: 4 }).notNull(),
  unit: varchar("unit", { length: 20 }).notNull(),
  unitCost: decimal("unitCost", { precision: 10, scale: 4 }),
  sortOrder: int("sortOrder").default(0),
});

export type HorecaRecipeLine = typeof horecaRecipeLines.$inferSelect;
export type InsertHorecaRecipeLine = typeof horecaRecipeLines.$inferInsert;

/**
 * HORECA Modifier Groups — Grupuri de modificatori (ex: "Temperatura carne")
 */
export const horecaModifierGroups = mysqlTable("horecaModifierGroups", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  locationId: int("locationId").notNull(),
  name: varchar("name", { length: 150 }).notNull(),
  isRequired: int("isRequired").default(0),
  minSelect: int("minSelect").default(0),
  maxSelect: int("maxSelect").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type HorecaModifierGroup = typeof horecaModifierGroups.$inferSelect;
export type InsertHorecaModifierGroup =
  typeof horecaModifierGroups.$inferInsert;

/**
 * HORECA Modifiers — Opțiuni per grup (ex: "Mediu", "Bine făcut", "+Bacon")
 */
export const horecaModifiers = mysqlTable("horecaModifiers", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("groupId").notNull(),
  name: varchar("name", { length: 150 }).notNull(),
  priceAdjustment: decimal("priceAdjustment", {
    precision: 8,
    scale: 2,
  }).default("0.00"),
  isDefault: int("isDefault").default(0),
  isActive: int("isActive").default(1),
  sortOrder: int("sortOrder").default(0),
});

export type HorecaModifier = typeof horecaModifiers.$inferSelect;
export type InsertHorecaModifier = typeof horecaModifiers.$inferInsert;

/**
 * HORECA Tables — Mese fizice din local
 */
export const horecaTables = mysqlTable("horecaTables", {
  id: int("id").autoincrement().primaryKey(),
  locationId: int("locationId").notNull(),
  tenantId: int("tenantId").notNull(),
  number: varchar("number", { length: 20 }).notNull(),
  capacity: int("capacity").default(4),
  zone: varchar("zone", { length: 100 }),
  posX: int("posX").default(0),
  posY: int("posY").default(0),
  status: mysqlEnum("status", [
    "free",
    "occupied",
    "reserved",
    "cleaning",
  ]).default("free"),
  currentOrderId: int("currentOrderId"),
  isActive: int("isActive").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type HorecaTable = typeof horecaTables.$inferSelect;
export type InsertHorecaTable = typeof horecaTables.$inferInsert;

/**
 * HORECA Orders — Comenzi (dine-in / takeaway / delivery)
 */
export const horecaOrders = mysqlTable("horecaOrders", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  locationId: int("locationId").notNull(),
  orderNumber: varchar("orderNumber", { length: 50 }).notNull(),
  type: mysqlEnum("type", ["dine_in", "takeaway", "delivery"])
    .notNull()
    .default("dine_in"),
  status: mysqlEnum("status", [
    "draft",
    "sent",
    "preparing",
    "ready",
    "served",
    "paid",
    "cancelled",
  ]).default("draft"),
  tableId: int("tableId"),
  tableNumber: varchar("tableNumber", { length: 20 }),
  guestCount: int("guestCount").default(1),
  staffName: varchar("staffName", { length: 100 }),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).default("0.00"),
  vatAmount: decimal("vatAmount", { precision: 12, scale: 2 }).default("0.00"),
  total: decimal("total", { precision: 12, scale: 2 }).default("0.00"),
  discount: decimal("discount", { precision: 12, scale: 2 }).default("0.00"),
  tip: decimal("tip", { precision: 12, scale: 2 }).default("0.00"),
  currency: varchar("currency", { length: 3 }).default("RON"),
  paymentMethod: mysqlEnum("paymentMethod", [
    "cash",
    "card",
    "voucher",
    "online",
    "room_charge",
    "mixed",
  ]),
  paidAt: timestamp("paidAt"),
  deliveryOrderId: int("deliveryOrderId"),
  deliveryPlatform: varchar("deliveryPlatform", { length: 50 }),
  notes: text("notes"),
  kitchenNotes: text("kitchenNotes"),
  openedAt: timestamp("openedAt").defaultNow(),
  closedAt: timestamp("closedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type HorecaOrder = typeof horecaOrders.$inferSelect;
export type InsertHorecaOrder = typeof horecaOrders.$inferInsert;

/**
 * HORECA Order Lines — Linii comandă
 */
export const horecaOrderLines = mysqlTable("horecaOrderLines", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  tenantId: int("tenantId").notNull(),
  menuItemId: int("menuItemId"),
  name: varchar("name", { length: 255 }).notNull(),
  quantity: decimal("quantity", { precision: 8, scale: 2 }).notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  vatRate: int("vatRate").default(9),
  vatAmount: decimal("vatAmount", { precision: 10, scale: 2 }).default("0.00"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  foodCostUnit: decimal("foodCostUnit", { precision: 10, scale: 4 }),
  modifiers: text("modifiers"), // JSON snapshot modificatori
  notes: text("notes"),
  status: mysqlEnum("status", [
    "pending",
    "sent",
    "preparing",
    "ready",
    "served",
    "cancelled",
  ]).default("pending"),
  kitchenSection: varchar("kitchenSection", { length: 50 }),
  sentToKitchenAt: timestamp("sentToKitchenAt"),
  preparedAt: timestamp("preparedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type HorecaOrderLine = typeof horecaOrderLines.$inferSelect;
export type InsertHorecaOrderLine = typeof horecaOrderLines.$inferInsert;

/**
 * HORECA Delivery Orders — Comenzi agregate Glovo / Wolt / Bolt / Tazz
 */
export const horecaDeliveryOrders = mysqlTable("horecaDeliveryOrders", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  locationId: int("locationId").notNull(),
  externalId: varchar("externalId", { length: 100 }),
  platform: mysqlEnum("platform", [
    "glovo",
    "wolt",
    "bolt_food",
    "tazz",
    "manual",
  ]).notNull(),
  status: mysqlEnum("status", [
    "new",
    "accepted",
    "preparing",
    "ready",
    "picked_up",
    "delivered",
    "cancelled",
    "rejected",
  ]).default("new"),
  customerName: varchar("customerName", { length: 255 }),
  customerPhone: varchar("customerPhone", { length: 20 }),
  deliveryAddress: text("deliveryAddress"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }),
  commission: decimal("commission", { precision: 12, scale: 2 }).default(
    "0.00"
  ),
  commissionPct: decimal("commissionPct", { precision: 5, scale: 2 }).default(
    "0.00"
  ),
  deliveryFee: decimal("deliveryFee", { precision: 10, scale: 2 }).default(
    "0.00"
  ),
  total: decimal("total", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("RON"),
  rawPayload: text("rawPayload"), // JSON raw din API platformă
  internalOrderId: int("internalOrderId"),
  notes: text("notes"),
  estimatedDeliveryTime: timestamp("estimatedDeliveryTime"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type HorecaDeliveryOrder = typeof horecaDeliveryOrders.$inferSelect;
export type InsertHorecaDeliveryOrder =
  typeof horecaDeliveryOrders.$inferInsert;

/**
 * HORECA Shifts — Ture / Închideri de Zi (Raport Z)
 */
export const horecaShifts = mysqlTable("horecaShifts", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  locationId: int("locationId").notNull(),
  openedAt: timestamp("openedAt").defaultNow().notNull(),
  closedAt: timestamp("closedAt"),
  openedBy: int("openedBy"), // UserId (optional)
  closedBy: int("closedBy"), // UserId (optional)
  startCash: decimal("startCash", { precision: 12, scale: 2 }).default("0.00"), // Fond sertar
  endCashExpected: decimal("endCashExpected", {
    precision: 12,
    scale: 2,
  }).default("0.00"), // Cash calculat
  endCashActual: decimal("endCashActual", { precision: 12, scale: 2 }).default(
    "0.00"
  ), // Cash numărat
  totalCard: decimal("totalCard", { precision: 12, scale: 2 }).default("0.00"),
  totalDelivery: decimal("totalDelivery", { precision: 12, scale: 2 }).default(
    "0.00"
  ), // Tazz/Glovo/Wolt etc
  totalSales: decimal("totalSales", { precision: 12, scale: 2 }).default(
    "0.00"
  ),
  totalTips: decimal("totalTips", { precision: 12, scale: 2 }).default("0.00"),
  status: mysqlEnum("status", ["open", "closed"]).default("open"),
  notes: text("notes"),
  zReportData: text("zReportData"), // JSON cu breakdown detaliat, număr bonuri, etc.
});

export type HorecaShift = typeof horecaShifts.$inferSelect;
export type InsertHorecaShift = typeof horecaShifts.$inferInsert;

/**
 * HORECA Kiosk Settings — Configurări vizuale și promoționale pentru interfața Kiosk-ului
 */
export const horecaKioskSettings = mysqlTable("horecaKioskSettings", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  locationId: int("locationId").notNull().unique(), // Only one settings profile per location
  bannerTopUrl: varchar("bannerTopUrl", { length: 500 }),
  bannerBottomUrl: varchar("bannerBottomUrl", { length: 500 }),
  primaryColor: varchar("primaryColor", { length: 50 }).default("#EE3B24"),
  secondaryColor: varchar("secondaryColor", { length: 50 }),
  activeBrands: text("activeBrands"), // JSON array of brand strings e.g., ["smashme", "sushimaster"]
  promoConfig: text("promoConfig"), // JSON object for Fortune Wheel prizes etc.
  advancedConfig: text("advancedConfig"), // JSON object for PIN, Languages, Syrve Overrides, Screensaver, etc.
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type HorecaKioskSetting = typeof horecaKioskSettings.$inferSelect;
export type InsertHorecaKioskSetting = typeof horecaKioskSettings.$inferInsert;
