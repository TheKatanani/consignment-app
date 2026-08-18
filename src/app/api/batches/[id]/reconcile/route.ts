import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const finishReconciliationSchema = z.object({
  scans: z.array(
    z.object({
      productId: z.string(),
      sku: z.string(),
      scannedQty: z.number().int().positive(),
      scannedAt: z.string().optional(),
    })
  ),
  notes: z.string().optional(),
  overrideAnomalies: z.boolean().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id?: string })?.id || "user_staff";
    const { id: batchId } = await params;

    const batch = await db.consignmentBatch.findUnique({
      where: { id: batchId },
      include: {
        store: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: "Consignment batch not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = finishReconciliationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid reconciliation payload", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { scans, overrideAnomalies } = parsed.data;

    // Build batch product map
    const batchProductMap = new Map<string, { productId: string; sku: string; sentQty: number; price: number; name: string }>();
    for (const item of batch.items) {
      batchProductMap.set(item.productId, {
        productId: item.productId,
        sku: item.product.sku,
        sentQty: item.sentQty,
        price: item.product.price,
        name: item.product.name,
      });
    }

    // 1. Check for unknown products
    const unknownScans = scans.filter((s) => !batchProductMap.has(s.productId));
    if (unknownScans.length > 0) {
      return NextResponse.json(
        {
          error: "Unknown products found in scan list. Only products belonging to this consignment batch can be reconciled.",
          unknownSkus: unknownScans.map((s) => s.sku),
        },
        { status: 400 }
      );
    }

    // 2. Aggregate scanned counts per product
    const scannedTotals = new Map<string, number>();
    for (const s of scans) {
      const cur = scannedTotals.get(s.productId) || 0;
      scannedTotals.set(s.productId, cur + s.scannedQty);
    }

    // 3. Anomaly check: scannedQty > sentQty
    const anomalies: Array<{
      productId: string;
      sku: string;
      name: string;
      sentQty: number;
      scannedQty: number;
      excessQty: number;
    }> = [];

    let totalSettlementValue = 0;
    const breakdown: Array<{
      productId: string;
      sku: string;
      name: string;
      sentQty: number;
      scannedQty: number;
      soldQty: number;
      unitPrice: number;
      lineTotal: number;
      isAnomaly: boolean;
    }> = [];

    for (const item of batch.items) {
      const scannedQty = scannedTotals.get(item.productId) || 0;
      const sentQty = item.sentQty;
      const isOverScanned = scannedQty > sentQty;

      if (isOverScanned) {
        anomalies.push({
          productId: item.productId,
          sku: item.product.sku,
          name: item.product.name,
          sentQty,
          scannedQty,
          excessQty: scannedQty - sentQty,
        });
      }

      // sold quantity is sentQty - scannedQty, never negative
      const soldQty = Math.max(0, sentQty - scannedQty);
      const unitPrice = Number(item.product.price);
      const lineTotal = unitPrice * soldQty;

      totalSettlementValue += lineTotal;

      breakdown.push({
        productId: item.productId,
        sku: item.product.sku,
        name: item.product.name,
        sentQty,
        scannedQty,
        soldQty,
        unitPrice,
        lineTotal,
        isAnomaly: isOverScanned,
      });
    }

    // If there are anomalies and user hasn't explicitly reviewed/confirmed override
    if (anomalies.length > 0 && !overrideAnomalies) {
      return NextResponse.json(
        {
          error: "Anomaly detected: One or more scanned quantities exceed the original sent quantity.",
          requiresConfirmation: true,
          anomalies,
          breakdown,
        },
        { status: 422 }
      );
    }

    // 4. Save atomic Reconciliation + ReconciliationScan records + Settlement
    const reconciliation = await db.$transaction(async (tx) => {
      // Create reconciliation
      const recon = await tx.reconciliation.create({
        data: {
          batchId: batch.id,
          performedBy: userId,
        },
      });

      // Save individual scan records for audit trail
      if (scans.length > 0) {
        await tx.reconciliationScan.createMany({
          data: scans.map((s) => ({
            reconciliationId: recon.id,
            productId: s.productId,
            scannedQty: s.scannedQty,
            scannedAt: s.scannedAt ? new Date(s.scannedAt) : new Date(),
          })),
        });
      }

      // Create settlement in PENDING status
      const settlement = await tx.settlement.create({
        data: {
          reconciliationId: recon.id,
          totalValue: totalSettlementValue,
          status: "PENDING",
        },
      });

      return { ...recon, settlement };
    });

    return NextResponse.json(
      {
        success: true,
        reconciliationId: reconciliation.id,
        settlementId: reconciliation.settlement.id,
        totalValue: totalSettlementValue.toString(),
        breakdown,
        anomalies,
        message: "Reconciliation completed. Ready for settlement confirmation.",
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[Reconciliation API] Error:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
