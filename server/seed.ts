/**
 * Seed script for GetApp Smart Invoice
 * Initializes subscription plans and superadmin account
 * Run: npx tsx server/seed.ts
 */

import { getDb } from "./db";
import { subscriptionPlans, accounts, tenants } from "../drizzle/schema";
import bcrypt from "bcrypt";

async function seed() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    process.exit(1);
  }

  try {
    console.log("🌱 Seeding subscription plans...");

    // Seed subscription plans
    const plans = [
      {
        name: "Basic",
        description: "Perfect for small businesses",
        monthlyPrice: 2999, // $29.99
        maxCostCenters: 1,
        maxUsers: 1,
        features: JSON.stringify(["Up to 1 location", "Up to 1 user", "Basic reports", "Email support"]),
        isActive: 1,
      },
      {
        name: "Pro",
        description: "For growing businesses",
        monthlyPrice: 7999, // $79.99
        maxCostCenters: 5,
        maxUsers: 5,
        features: JSON.stringify([
          "Up to 5 locations",
          "Up to 5 users",
          "Advanced reports",
          "Inventory tracking",
          "Priority support",
        ]),
        isActive: 1,
      },
      {
        name: "Enterprise",
        description: "For large organizations",
        monthlyPrice: 19999, // $199.99
        maxCostCenters: 999,
        maxUsers: 999,
        features: JSON.stringify([
          "Unlimited locations",
          "Unlimited users",
          "Custom reports",
          "Full inventory management",
          "API access",
          "Dedicated support",
        ]),
        isActive: 1,
      },
    ];

    for (const plan of plans) {
      await db.insert(subscriptionPlans).values(plan as any).catch(() => {
        // Plan may already exist
      });
    }

    console.log("✅ Subscription plans seeded");

    console.log("🌱 Creating superadmin account...");

    // Hash superadmin password
    const superadminPassword = "19Iunie2026!$";
    const passwordHash = await bcrypt.hash(superadminPassword, 10);

    // Create superadmin account
    await db.insert(accounts).values({
      email: "jeka7ro@gmail.com",
      passwordHash,
      tenantId: null, // Superadmin has no tenant
      role: "superadmin",
      isActive: 1,
    } as any).catch(() => {
      // Account may already exist
    });

    console.log("✅ Superadmin account created: jeka7ro@gmail.com");

    console.log("🌱 Creating demo tenant...");

    // Create demo tenant
    const basicPlan = await db.select().from(subscriptionPlans).limit(1);

    if (basicPlan.length > 0) {
      await db
        .insert(tenants)
        .values({
          name: "ConstructMaster SRL",
          email: "contact@constructmaster.ro",
          phone: "+40 721 123 456",
          address: "Str. Constructorilor 10, București",
          cui: "RO12345678",
          subscriptionPlanId: basicPlan[0]?.id,
          subscriptionStatus: "active",
          subscriptionStartDate: new Date(),
          subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        } as any)
        .catch(() => {
          // Tenant may already exist
        });

      const demoTenant = { id: 1 }; // Demo tenant ID

      console.log("✅ Demo tenant created");

      // Create demo tenant admin account
      const demoAdminPassword = "Demo123!@#";
      const demoAdminHash = await bcrypt.hash(demoAdminPassword, 10);

      await db.insert(accounts).values({
        email: "admin@constructmaster.ro",
        passwordHash: demoAdminHash,
        tenantId: demoTenant.id,
        role: "admin",
        isActive: 1,
      } as any).catch(() => {
        // Account may already exist
      });

      console.log("✅ Demo tenant admin created: admin@constructmaster.ro / Demo123!@#");
    }

    console.log("\n✅ Seeding complete!");
    console.log("\n📝 Superadmin credentials:");
    console.log("   Email: jeka7ro@gmail.com");
    console.log("   Password: 19Iunie2026!$");
    console.log("\n📝 Demo tenant admin credentials:");
    console.log("   Email: admin@constructmaster.ro");
    console.log("   Password: Demo123!@#");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seed();
