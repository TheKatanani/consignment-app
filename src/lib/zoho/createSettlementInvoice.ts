import { db } from "../db";
import { zohoClient } from "./client";

export interface SettlementInvoiceResult {
  success: boolean;
  zohoInvoiceId?: string;
  message: string;
  status: string;
}

export async function createSettlementInvoiceInZoho(
  settlementId: string
): Promise<SettlementInvoiceResult> {
  const settlement = await db.settlement.findUnique({
    where: { id: settlementId },
    include: {
      reconciliation: {
        include: {
          scans: true,
          batch: {
            include: {
              store: true,
              items: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!settlement) {
    throw new Error(`Settlement ${settlementId} not found.`);
  }

  const { reconciliation } = settlement;
  const { batch } = reconciliation;

  // 1. IDEMPOTENCY CHECK: Check if invoice was already created successfully
  const existingSuccessLog = await db.zohoSyncLog.findFirst({
    where: {
      entityType: "Settlement",
      entityId: settlement.id,
      operation: "invoice_create",
      status: "success",
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingSuccessLog && settlement.zohoInvoiceId) {
    return {
      success: true,
      zohoInvoiceId: settlement.zohoInvoiceId,
      status: "CONFIRMED",
      message: "Invoice already created in Zoho Inventory (Idempotent).",
    };
  }

  // 2. Compute sold quantities per product
  // Aggregate total scanned quantities from scans table
  const scannedQtyMap = new Map<string, number>();
  for (const scan of reconciliation.scans) {
    const current = scannedQtyMap.get(scan.productId) || 0;
    scannedQtyMap.set(scan.productId, current + scan.scannedQty);
  }

  // Line items for ONLY sold quantities (sentQty - scannedQty > 0)
  const lineItems: Array<{
    item_id?: string;
    name: string;
    rate: number;
    quantity: number;
    sku: string;
  }> = [];

  let computedTotalValue = 0;

  for (const item of batch.items) {
    const scannedQty = scannedQtyMap.get(item.productId) || 0;
    const soldQty = Math.max(0, item.sentQty - scannedQty);

    if (soldQty > 0) {
      const unitPrice = Number(item.product.price);
      lineItems.push({
        item_id: item.product.zohoItemId || undefined,
        name: item.product.name,
        rate: unitPrice,
        quantity: soldQty,
        sku: item.product.sku,
      });

      const lineTotal = item.product.price * soldQty;
      computedTotalValue += lineTotal;
    }
  }

  // Update total value if not set
  await db.settlement.update({
    where: { id: settlement.id },
    data: {
      totalValue: computedTotalValue,
      status: "SENT_TO_ZOHO",
    },
  });

  // If nothing was sold (all goods accounted for or returned)
  if (lineItems.length === 0) {
    await db.settlement.update({
      where: { id: settlement.id },
      data: {
        status: "CONFIRMED",
        zohoInvoiceId: "ZERO_SOLD_NO_INVOICE",
      },
    });

    await db.zohoSyncLog.create({
      data: {
        operation: "invoice_create",
        entityType: "Settlement",
        entityId: settlement.id,
        status: "success",
        errorMessage: "No items sold in this batch reconciliation. Total value is 0.",
      },
    });

    return {
      success: true,
      zohoInvoiceId: "ZERO_SOLD_NO_INVOICE",
      status: "CONFIRMED",
      message: "No items sold. Settlement confirmed without generating an invoice.",
    };
  }

  // 3. Prepare Zoho Invoice payload
  const invoicePayload = {
    customer_name: batch.store.name,
    reference_number: `RECON-${reconciliation.id.slice(-8).toUpperCase()}`,
    date: new Date().toISOString().split("T")[0],
    line_items: lineItems,
    notes: `Settlement for Consignment Batch ${batch.id} at ${batch.store.name}.`,
  };

  try {
    const response = await zohoClient.request<{
      invoice?: { invoice_id: string; invoice_number: string };
    }>("/invoices", {
      method: "POST",
      body: invoicePayload,
    });

    const zohoInvoiceId =
      response.data?.invoice?.invoice_id ||
      response.data?.invoice?.invoice_number ||
      `zoho_inv_${Date.now()}`;

    // Update settlement as CONFIRMED
    await db.settlement.update({
      where: { id: settlement.id },
      data: {
        zohoInvoiceId,
        status: "CONFIRMED",
      },
    });

    // Mark consignment batch as RECONCILED
    await db.consignmentBatch.update({
      where: { id: batch.id },
      data: { status: "RECONCILED" },
    });

    // Log success
    await db.zohoSyncLog.create({
      data: {
        operation: "invoice_create",
        entityType: "Settlement",
        entityId: settlement.id,
        status: "success",
        zohoResponse: JSON.stringify(response.raw),
      },
    });

    return {
      success: true,
      zohoInvoiceId,
      status: "CONFIRMED",
      message: "Settlement invoice created in Zoho Inventory successfully.",
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const rawResponse = (err as unknown as { zohoResponse?: unknown })?.zohoResponse;

    // Set settlement status to FAILED with clear retry option in UI
    await db.settlement.update({
      where: { id: settlement.id },
      data: {
        status: "FAILED",
      },
    });

    // Log failure
    await db.zohoSyncLog.create({
      data: {
        operation: "invoice_create",
        entityType: "Settlement",
        entityId: settlement.id,
        status: "failed",
        errorMessage: errorMsg,
        zohoResponse: rawResponse ? JSON.stringify(rawResponse) : null,
      },
    });

    return {
      success: false,
      status: "FAILED",
      message: `Failed to create Zoho invoice: ${errorMsg}`,
    };
  }
}
