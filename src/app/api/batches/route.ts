import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { dispatchBatchToZoho } from "@/lib/zoho/dispatchBatch";
import { z } from "zod";

const createBatchSchema = z.object({
  storeId: z.string().min(1, "Store selection is required"),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, "Product is required"),
        sentQty: z.number().int().positive("sentQty must be strictly greater than 0"),
      })
    )
    .min(1, "At least one product item is required in the consignment batch"),
});

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const storeId = searchParams.get("storeId");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (storeId) where.storeId = storeId;

    const batches = await db.consignmentBatch.findMany({
      where,
      include: {
        store: true,
        items: {
          include: {
            product: true,
          },
        },
        reconciliations: {
          include: {
            settlement: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ batches });
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

    const userId = (session.user as { id?: string })?.id || "system_user";
    const body = await req.json();
    const parsed = createBatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.issues.map((i) => i.message).join(", "),
        },
        { status: 400 }
      );
    }

    const { storeId, items } = parsed.data;

    // Check store existence
    const store = await db.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      return NextResponse.json({ error: "Selected store not found." }, { status: 404 });
    }

    // Validate all products exist
    for (const item of items) {
      if (item.sentQty <= 0) {
        return NextResponse.json(
          { error: `Invalid quantity for product ${item.productId}: sentQty must be greater than 0.` },
          { status: 400 }
        );
      }
      const prod = await db.product.findUnique({ where: { id: item.productId } });
      if (!prod) {
        return NextResponse.json(
          { error: `Product ID ${item.productId} was not found in catalog.` },
          { status: 404 }
        );
      }
    }

    // Create batch in DB
    const batch = await db.consignmentBatch.create({
      data: {
        storeId,
        createdBy: userId,
        status: "ACTIVE",
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            sentQty: i.sentQty,
          })),
        },
      },
      include: {
        store: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // Attempt Zoho Transfer Order Dispatch
    let dispatchResult;
    try {
      dispatchResult = await dispatchBatchToZoho(batch.id);
    } catch (dispatchErr: unknown) {
      const errMsg = dispatchErr instanceof Error ? dispatchErr.message : String(dispatchErr);
      console.warn(`[Zoho Batch Dispatch Warning] ${errMsg}`);
      // Return created batch with warning so frontend can show notification
      return NextResponse.json(
        {
          success: true,
          batch,
          warning: `Batch created locally, but Zoho transfer sync failed: ${errMsg}`,
          syncedToZoho: false,
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        batch,
        dispatchResult,
        syncedToZoho: !dispatchResult.skipped,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
