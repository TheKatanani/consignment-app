import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createProductSchema = z.object({
  sku: z.string().trim().min(1, "SKU is strictly required and cannot be empty"),
  name: z.string().trim().min(1, "Product name is required"),
  price: z.number().nonnegative("Price must be >= 0"),
  zohoItemId: z.string().trim().optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim() || "";
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const whereClause = query
      ? {
          OR: [
            { sku: { contains: query, mode: "insensitive" as const } },
            { name: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {};

    const products = await db.product.findMany({
      where: whereClause,
      orderBy: { updatedAt: "desc" },
      take: Math.min(limit, 200),
    });

    const totalCount = await db.product.count();

    return NextResponse.json({
      products,
      totalCount,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createProductSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { sku, name, price, zohoItemId } = parsed.data;

    // Check if SKU already exists
    const existing = await db.product.findUnique({
      where: { sku },
    });

    if (existing) {
      return NextResponse.json(
        { error: `A product with SKU "${sku}" already exists.` },
        { status: 409 }
      );
    }

    const product = await db.product.create({
      data: {
        sku,
        name,
        price,
        zohoItemId: zohoItemId || null,
        lastSyncedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
