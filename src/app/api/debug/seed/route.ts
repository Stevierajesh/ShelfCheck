import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  SEED_STORES_DATA,
  SEED_PRODUCTS_DATA,
} from "@/lib/connectors/seed-data";

export async function POST() {
  try {
    // Clear existing seed data
    await prisma.inventoryOffer.deleteMany({
      where: { sourceName: "SeedDataConnector" },
    });
    await prisma.product.deleteMany({
      where: { sourceName: "SeedDataConnector" },
    });

    let storesCreated = 0;
    let productsCreated = 0;
    let offersCreated = 0;

    // Upsert stores
    const storeRecords = [];
    for (const s of SEED_STORES_DATA) {
      let store = await prisma.store.findFirst({
        where: { retailer: s.retailer, name: s.name },
      });
      if (!store) {
        store = await prisma.store.create({
          data: {
            name: s.name,
            retailer: s.retailer,
            address: s.address,
            city: s.city,
            state: s.state,
            zip: s.zip,
            latitude: s.lat,
            longitude: s.lng,
            phone: s.phone,
          },
        });
        storesCreated++;
      }
      storeRecords.push(store);
    }

    // Create products and offers
    for (const p of SEED_PRODUCTS_DATA) {
      const product = await prisma.product.create({
        data: {
          title: p.title,
          brand: p.brand,
          category: p.category,
          sourceName: "SeedDataConnector",
        },
      });
      productsCreated++;

      for (const storeIdx of p.storeIndices) {
        const store = storeRecords[storeIdx];
        await prisma.inventoryOffer.create({
          data: {
            productId: product.id,
            storeId: store.id,
            sourceName: "SeedDataConnector",
            price: p.price,
            availabilityStatus: p.availability,
            confidence: p.confidence,
            evidenceText: p.evidence,
            lastCheckedAt: new Date(),
          },
        });
        offersCreated++;
      }
    }

    return NextResponse.json({
      success: true,
      storesCreated,
      productsCreated,
      offersCreated,
    });
  } catch (err) {
    console.error("[API/debug/seed] Error:", err);
    return NextResponse.json(
      { error: "Seed import failed" },
      { status: 500 }
    );
  }
}
