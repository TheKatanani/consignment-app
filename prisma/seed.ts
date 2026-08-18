import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Consignment Reconciliation Database...");

  const adminPassword = await bcrypt.hash("admin123", 10);
  const staffPassword = await bcrypt.hash("staff123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@consignment.test" },
    update: {
      password: adminPassword,
      name: "Alex Admin",
      role: "ADMIN",
    },
    create: {
      email: "admin@consignment.test",
      password: adminPassword,
      name: "Alex Admin",
      role: "ADMIN",
    },
  });

  const staff = await prisma.user.upsert({
    where: { email: "staff@consignment.test" },
    update: {
      password: staffPassword,
      name: "Sam Field Staff",
      role: "FIELD_STAFF",
    },
    create: {
      email: "staff@consignment.test",
      password: staffPassword,
      name: "Sam Field Staff",
      role: "FIELD_STAFF",
    },
  });

  console.log("👤 Users seeded:", { admin: admin.email, staff: staff.email });

  // Stores
  const store1 = await prisma.store.upsert({
    where: { id: "store-downtown" },
    update: {
      name: "Downtown Supermarket",
      address: "123 Main Street, Central Plaza",
      zohoWarehouseId: "wh_downtown_01",
    },
    create: {
      id: "store-downtown",
      name: "Downtown Supermarket",
      address: "123 Main Street, Central Plaza",
      zohoWarehouseId: "wh_downtown_01",
    },
  });

  const store2 = await prisma.store.upsert({
    where: { id: "store-uptown" },
    update: {
      name: "Uptown Retail Outlet",
      address: "742 Evergreen Terrace, North Wing",
      zohoWarehouseId: "wh_uptown_02",
    },
    create: {
      id: "store-uptown",
      name: "Uptown Retail Outlet",
      address: "742 Evergreen Terrace, North Wing",
      zohoWarehouseId: "wh_uptown_02",
    },
  });

  const store3 = await prisma.store.upsert({
    where: { id: "store-airport" },
    update: {
      name: "Airport Express Kiosk",
      address: "Terminal 2, Departure Gate 14",
      zohoWarehouseId: null, // intentionally unmapped for testing
    },
    create: {
      id: "store-airport",
      name: "Airport Express Kiosk",
      address: "Terminal 2, Departure Gate 14",
      zohoWarehouseId: null,
    },
  });

  console.log("🏬 Stores seeded:", [store1.name, store2.name, store3.name]);

  // Products (SKUs must be unique and non-empty)
  const productsData = [
    { sku: "SKU-GP-001", name: "Geepas Blender 500W 2-in-1", price: 45.0, zohoItemId: "zoho_item_001" },
    { sku: "SKU-GP-002", name: "Geepas Electric Kettle 1.7L Stainless", price: 28.5, zohoItemId: "zoho_item_002" },
    { sku: "SKU-GP-003", name: "Geepas Professional Hair Dryer 2000W", price: 32.0, zohoItemId: "zoho_item_003" },
    { sku: "SKU-GP-004", name: "Geepas Tactical LED Flashlight Rechargeable", price: 15.0, zohoItemId: "zoho_item_004" },
    { sku: "SKU-GP-005", name: "Geepas 2-Slice Non-Stick Sandwich Maker", price: 22.0, zohoItemId: "zoho_item_005" },
    { sku: "SKU-GP-006", name: "Geepas Steam Iron Ceramic Soleplate", price: 35.0, zohoItemId: "zoho_item_006" },
  ];

  const products = [];
  for (const p of productsData) {
    const prod = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        name: p.name,
        price: p.price,
        zohoItemId: p.zohoItemId,
        lastSyncedAt: new Date(),
      },
      create: {
        sku: p.sku,
        name: p.name,
        price: p.price,
        zohoItemId: p.zohoItemId,
        lastSyncedAt: new Date(),
      },
    });
    products.push(prod);
  }

  console.log(`📦 Seeded ${products.length} Products with validated SKUs`);

  // Sample active consignment batch for Downtown Supermarket
  const sampleBatchId = "batch-sample-active-01";
  const existingBatch = await prisma.consignmentBatch.findUnique({
    where: { id: sampleBatchId },
  });

  if (!existingBatch) {
    const batch = await prisma.consignmentBatch.create({
      data: {
        id: sampleBatchId,
        storeId: store1.id,
        status: "ACTIVE",
        createdBy: admin.id,
        zohoTransferId: "zoho_tr_demo_9821",
        items: {
          create: [
            { productId: products[0].id, sentQty: 10 },
            { productId: products[1].id, sentQty: 15 },
            { productId: products[2].id, sentQty: 8 },
            { productId: products[3].id, sentQty: 20 },
          ],
        },
      },
      include: {
        items: true,
      },
    });
    console.log(`🚚 Seeded sample active batch ${batch.id} with ${batch.items.length} items.`);
  }

  console.log("✅ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
