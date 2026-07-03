import { sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";

/**
 * HORECA Module — Safe Migrations
 * Rulat la pornirea serverului via runHorecaMigrations()
 * CREATE TABLE IF NOT EXISTS — nu distruge nimic dacă tabelul există deja.
 */
export async function runHorecaMigrations(db: MySql2Database<any>) {
  console.log("[HORECA] Running migrations...");
  try {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS horecaLocations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenantId INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      address TEXT,
      city VARCHAR(100),
      phone VARCHAR(20),
      type ENUM('restaurant','bar','cafenea','fast_food','pizzerie','catering','hotel') DEFAULT 'restaurant',
      currency VARCHAR(3) DEFAULT 'RON',
      defaultVatFood INT DEFAULT 9,
      defaultVatAlcohol INT DEFAULT 19,
      settings TEXT,
      isActive INT DEFAULT 1,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

    await db.execute(sql`CREATE TABLE IF NOT EXISTS horecaMenuCategories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      locationId INT NOT NULL,
      tenantId INT NOT NULL,
      name VARCHAR(150) NOT NULL,
      description TEXT,
      icon VARCHAR(50),
      color VARCHAR(20),
      sortOrder INT DEFAULT 0,
      isActive INT DEFAULT 1,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

    await db.execute(sql`CREATE TABLE IF NOT EXISTS horecaMenuItems (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenantId INT NOT NULL,
      locationId INT NOT NULL,
      categoryId INT,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      sku VARCHAR(100),
      price DECIMAL(10,2) NOT NULL,
      vatRate INT DEFAULT 9,
      unit VARCHAR(20) DEFAULT 'portie',
      hasRecipe INT DEFAULT 0,
      foodCostTarget DECIMAL(5,2),
      isAvailableDelivery INT DEFAULT 1,
      isAvailableDineIn INT DEFAULT 1,
      isAvailableTakeaway INT DEFAULT 1,
      glovoId VARCHAR(100),
      woltId VARCHAR(100),
      boltId VARCHAR(100),
      tazzId VARCHAR(100),
      imageUrl VARCHAR(512),
      allergens TEXT,
      isActive INT DEFAULT 1,
      sortOrder INT DEFAULT 0,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

    await db.execute(sql`CREATE TABLE IF NOT EXISTS horecaIngredients (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenantId INT NOT NULL,
      locationId INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      unit VARCHAR(20) DEFAULT 'kg',
      currentStock DECIMAL(12,4) DEFAULT 0.0000,
      unitCost DECIMAL(10,4) DEFAULT 0.0000,
      isActive INT DEFAULT 1,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

    await db.execute(sql`CREATE TABLE IF NOT EXISTS horecaStockMovements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenantId INT NOT NULL,
      locationId INT NOT NULL,
      ingredientId INT NOT NULL,
      type ENUM('in','out','adjustment') NOT NULL,
      quantity DECIMAL(12,4) NOT NULL,
      unitCost DECIMAL(10,4),
      reference VARCHAR(255),
      notes TEXT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);

    await db.execute(sql`CREATE TABLE IF NOT EXISTS horecaRecipeLines (
      id INT AUTO_INCREMENT PRIMARY KEY,
      menuItemId INT NOT NULL,
      tenantId INT NOT NULL,
      ingredientName VARCHAR(255) NOT NULL,
      ingredientId INT NULL,
      productId INT,
      quantity DECIMAL(10,4) NOT NULL,
      unit VARCHAR(20) NOT NULL,
      unitCost DECIMAL(10,4),
      sortOrder INT DEFAULT 0
    )`);

    try {
      await db.execute(sql`ALTER TABLE horecaRecipeLines ADD COLUMN ingredientId INT NULL`);
    } catch (e: any) {
      const code = e.code || e.cause?.code;
      if (code !== "ER_DUP_FIELDNAME") throw e;
      // else: column already exists, ignore silently
    }

    await db.execute(sql`CREATE TABLE IF NOT EXISTS horecaModifierGroups (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenantId INT NOT NULL,
      locationId INT NOT NULL,
      name VARCHAR(150) NOT NULL,
      isRequired INT DEFAULT 0,
      minSelect INT DEFAULT 0,
      maxSelect INT DEFAULT 1,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);

    await db.execute(sql`CREATE TABLE IF NOT EXISTS horecaModifiers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      groupId INT NOT NULL,
      name VARCHAR(150) NOT NULL,
      priceAdjustment DECIMAL(8,2) DEFAULT 0.00,
      isDefault INT DEFAULT 0,
      isActive INT DEFAULT 1,
      sortOrder INT DEFAULT 0
    )`);

    await db.execute(sql`CREATE TABLE IF NOT EXISTS horecaTables (
      id INT AUTO_INCREMENT PRIMARY KEY,
      locationId INT NOT NULL,
      tenantId INT NOT NULL,
      number VARCHAR(20) NOT NULL,
      capacity INT DEFAULT 4,
      zone VARCHAR(100),
      posX INT DEFAULT 0,
      posY INT DEFAULT 0,
      status ENUM('free','occupied','reserved','cleaning') DEFAULT 'free',
      currentOrderId INT,
      isActive INT DEFAULT 1,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

    await db.execute(sql`CREATE TABLE IF NOT EXISTS horecaOrders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenantId INT NOT NULL,
      locationId INT NOT NULL,
      orderNumber VARCHAR(50) NOT NULL,
      type ENUM('dine_in','takeaway','delivery') NOT NULL DEFAULT 'dine_in',
      status ENUM('draft','sent','preparing','ready','served','paid','cancelled') DEFAULT 'draft',
      tableId INT,
      tableNumber VARCHAR(20),
      guestCount INT DEFAULT 1,
      staffName VARCHAR(100),
      subtotal DECIMAL(12,2) DEFAULT 0.00,
      vatAmount DECIMAL(12,2) DEFAULT 0.00,
      total DECIMAL(12,2) DEFAULT 0.00,
      discount DECIMAL(12,2) DEFAULT 0.00,
      tip DECIMAL(12,2) DEFAULT 0.00,
      currency VARCHAR(3) DEFAULT 'RON',
      paymentMethod ENUM('cash','card','voucher','online','room_charge','mixed'),
      paidAt TIMESTAMP NULL,
      deliveryOrderId INT,
      deliveryPlatform VARCHAR(50),
      notes TEXT,
      kitchenNotes TEXT,
      stockDeducted INT DEFAULT 0,
      openedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      closedAt TIMESTAMP NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

    try {
      await db.execute(sql`ALTER TABLE horecaOrders ADD COLUMN stockDeducted INT DEFAULT 0`);
    } catch (e: any) {
      const code = e.code || e.cause?.code;
      if (code !== "ER_DUP_FIELDNAME") throw e;
      // else: column already exists, ignore silently
    }

    await db.execute(sql`CREATE TABLE IF NOT EXISTS horecaOrderLines (
      id INT AUTO_INCREMENT PRIMARY KEY,
      orderId INT NOT NULL,
      tenantId INT NOT NULL,
      menuItemId INT,
      name VARCHAR(255) NOT NULL,
      quantity DECIMAL(8,2) NOT NULL,
      unitPrice DECIMAL(10,2) NOT NULL,
      vatRate INT DEFAULT 9,
      vatAmount DECIMAL(10,2) DEFAULT 0.00,
      total DECIMAL(12,2) NOT NULL,
      foodCostUnit DECIMAL(10,4),
      modifiers TEXT,
      notes TEXT,
      status ENUM('pending','sent','preparing','ready','served','cancelled') DEFAULT 'pending',
      kitchenSection VARCHAR(50),
      sentToKitchenAt TIMESTAMP NULL,
      preparedAt TIMESTAMP NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);

    await db.execute(sql`CREATE TABLE IF NOT EXISTS horecaDeliveryOrders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenantId INT NOT NULL,
      locationId INT NOT NULL,
      externalId VARCHAR(100),
      platform ENUM('glovo','wolt','bolt_food','tazz','manual') NOT NULL,
      status ENUM('new','accepted','preparing','ready','picked_up','delivered','cancelled','rejected') DEFAULT 'new',
      customerName VARCHAR(255),
      customerPhone VARCHAR(20),
      deliveryAddress TEXT,
      subtotal DECIMAL(12,2),
      commission DECIMAL(12,2) DEFAULT 0.00,
      commissionPct DECIMAL(5,2) DEFAULT 0.00,
      deliveryFee DECIMAL(10,2) DEFAULT 0.00,
      total DECIMAL(12,2),
      currency VARCHAR(3) DEFAULT 'RON',
      rawPayload TEXT,
      internalOrderId INT,
      notes TEXT,
      estimatedDeliveryTime TIMESTAMP NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

    await db.execute(sql`CREATE TABLE IF NOT EXISTS horecaShifts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenantId INT NOT NULL,
      locationId INT NOT NULL,
      openedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      closedAt TIMESTAMP NULL,
      openedBy INT,
      closedBy INT,
      startCash DECIMAL(12,2) DEFAULT 0.00,
      endCashExpected DECIMAL(12,2) DEFAULT 0.00,
      endCashActual DECIMAL(12,2) DEFAULT 0.00,
      totalCard DECIMAL(12,2) DEFAULT 0.00,
      totalDelivery DECIMAL(12,2) DEFAULT 0.00,
      totalSales DECIMAL(12,2) DEFAULT 0.00,
      totalTips DECIMAL(12,2) DEFAULT 0.00,
      status ENUM('open','closed') DEFAULT 'open',
      notes TEXT,
      zReportData TEXT
    )`);

    await db.execute(sql`CREATE TABLE IF NOT EXISTS horecaKioskSettings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenantId INT NOT NULL,
      locationId INT NOT NULL UNIQUE,
      bannerTopUrl VARCHAR(500),
      bannerBottomUrl VARCHAR(500),
      primaryColor VARCHAR(50) DEFAULT '#EE3B24',
      secondaryColor VARCHAR(50),
      activeBrands TEXT,
      promoConfig TEXT,
      advancedConfig TEXT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

    // Add column if it doesn't exist
    try {
      await db.execute(
        sql`ALTER TABLE horecaKioskSettings ADD COLUMN advancedConfig TEXT`
      );
      console.log("[HORECA] Added advancedConfig to horecaKioskSettings");
    } catch (e) {
      // Ignore if exists
    }

    console.log("[HORECA] ✓ All tables ensured");
  } catch (err) {
    console.error("[HORECA] Migration error:", err);
  }
}
