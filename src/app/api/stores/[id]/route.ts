import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const store = await prisma.store.findUnique({
      where: { id },
      include: {
        inventoryOffers: {
          include: { product: true },
          orderBy: { lastCheckedAt: "desc" },
        },
      },
    });

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    return NextResponse.json({ store });
  } catch (err) {
    console.error("[API/stores] Error:", err);
    return NextResponse.json(
      { error: "Failed to load store" },
      { status: 500 }
    );
  }
}
