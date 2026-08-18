import { db } from "../db";
import { zohoClient } from "./client";

export interface DispatchBatchResult {
  success: boolean;
  skipped: boolean;
  message: string;
  zohoTransferId?: string;
}

export async function dispatchBatchToZoho(batchId: string): Promise<DispatchBatchResult> {
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
    throw new Error(`Consignment batch ${batchId} not found.`);
  }

  // 1. If store does not have zohoWarehouseId, skip Zoho call and return skipped status
  if (!batch.store.zohoWarehouseId) {
    const skippedMessage = "Store is not linked to a Zoho warehouse. Saved locally only.";
    await db.zohoSyncLog.create({
      data: {
        operation: "transfer_order_create",
        entityType: "ConsignmentBatch",
        entityId: batch.id,
        status: "skipped",
        errorMessage: skippedMessage,
      },
    });

    return {
      success: true,
      skipped: true,
      message: skippedMessage,
    };
  }

  // 2. IDEMPOTENCY CHECK: Check if this batch was already successfully synced
  const existingSuccessLog = await db.zohoSyncLog.findFirst({
    where: {
      entityType: "ConsignmentBatch",
      entityId: batch.id,
      operation: "transfer_order_create",
      status: "success",
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingSuccessLog) {
    let transferId = batch.zohoTransferId;
    if (!transferId && existingSuccessLog.zohoResponse) {
      try {
        const parsed = JSON.parse(existingSuccessLog.zohoResponse);
        transferId = parsed.transferorder_id || parsed.inventory_adjustment_id;
      } catch {
        // ignore
      }
    }

    return {
      success: true,
      skipped: false,
      message: "Batch already synced to Zoho Inventory (Idempotent).",
      zohoTransferId: transferId || "ALREADY_SYNCED",
    };
  }

  // 3. Prepare transfer order payload
  const defaultSourceWarehouse =
    process.env.DEFAULT_ZOHO_WAREHOUSE_ID || "default_source_warehouse";
  const destinationWarehouse = batch.store.zohoWarehouseId;

  // Build line items
  const lineItems = batch.items.map((item) => ({
    item_id: item.product.zohoItemId || item.product.sku,
    name: item.product.name,
    sku: item.product.sku,
    transfer_quantity: item.sentQty,
  }));

  const payload = {
    from_warehouse_id: defaultSourceWarehouse,
    to_warehouse_id: destinationWarehouse,
    reference_number: `BATCH-${batch.id.slice(-8).toUpperCase()}`,
    date: new Date().toISOString().split("T")[0],
    description: `Consignment Dispatch to Store: ${batch.store.name} (${batch.id})`,
    line_items: lineItems,
  };

  try {
    // Call Zoho Inventory Transfer Order API
    const response = await zohoClient.request<{
      transfer_order?: { transferorder_id: string };
      inventory_adjustment?: { inventory_adjustment_id: string };
    }>("/transferorders", {
      method: "POST",
      body: payload,
    });

    const zohoTransferId =
      response.data?.transfer_order?.transferorder_id ||
      response.data?.inventory_adjustment?.inventory_adjustment_id ||
      `zoho_to_${Date.now()}`;

    // Update batch with transfer ID
    await db.consignmentBatch.update({
      where: { id: batch.id },
      data: { zohoTransferId },
    });

    // Log success to ZohoSyncLog
    await db.zohoSyncLog.create({
      data: {
        operation: "transfer_order_create",
        entityType: "ConsignmentBatch",
        entityId: batch.id,
        status: "success",
        zohoResponse: JSON.stringify(response.raw),
      },
    });

    return {
      success: true,
      skipped: false,
      message: "Transfer order created in Zoho Inventory successfully.",
      zohoTransferId,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const rawResponse = (err as unknown as { zohoResponse?: unknown })?.zohoResponse;

    // Log failure to ZohoSyncLog
    await db.zohoSyncLog.create({
      data: {
        operation: "transfer_order_create",
        entityType: "ConsignmentBatch",
        entityId: batch.id,
        status: "failed",
        errorMessage: errorMsg,
        zohoResponse: rawResponse ? JSON.stringify(rawResponse) : null,
      },
    });

    throw new Error(`Failed to dispatch batch to Zoho Inventory: ${errorMsg}`);
  }
}
