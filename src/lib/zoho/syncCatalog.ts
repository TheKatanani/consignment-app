import { db } from "../db";
import { zohoClient } from "./client";

interface ZohoItem {
  item_id: string;
  name: string;
  sku?: string | null;
  rate?: number | string | null;
  status?: string;
  status_formatted?: string;
  is_active?: boolean;
}

export interface SyncCatalogResult {
  totalFetched: number;
  syncedCount: number;
  skippedCount: number;
  errors: string[];
}

export async function syncProductCatalogFromZoho(): Promise<SyncCatalogResult> {
  const result: SyncCatalogResult = {
    totalFetched: 0,
    syncedCount: 0,
    skippedCount: 0,
    errors: [],
  };

  let page = 1;
  let hasMore = true;
  const perPage = 200;

  try {
    while (hasMore) {
      const response = await zohoClient.request<{
        items: ZohoItem[];
        page_context?: { has_more_page: boolean; page: number };
      }>("/items", {
        method: "GET",
        params: {
          status: "active",
          page,
          per_page: perPage,
        },
      });

      const items = (response.data.items || []) as ZohoItem[];
      result.totalFetched += items.length;

      for (const item of items) {
        const rawSku = item.sku ? String(item.sku).trim() : "";
        const itemId = String(item.item_id);
        const name = String(item.name || "").trim() || `Item ${rawSku || itemId}`;
        const price = Number(item.rate || 0);

        // CRITICAL RULE: Reject & skip any item with null/empty SKU
        if (!rawSku || rawSku.length === 0) {
          result.skippedCount++;
          const reason = `Skipped Zoho item ${itemId} ("${name}"): Null or empty SKU is strictly prohibited.`;
          result.errors.push(reason);

          // Log failure to ZohoSyncLog as required
          await db.zohoSyncLog.create({
            data: {
              operation: "catalog_sync",
              entityType: "Product",
              entityId: itemId,
              status: "failed",
              errorMessage: reason,
              zohoResponse: JSON.stringify(item),
            },
          });
          continue;
        }

        // Upsert by zohoItemId if exists, or by SKU
        try {
          const existingByZohoId = await db.product.findUnique({
            where: { zohoItemId: itemId },
          });

          if (existingByZohoId) {
            await db.product.update({
              where: { id: existingByZohoId.id },
              data: {
                sku: rawSku,
                name,
                price,
                lastSyncedAt: new Date(),
              },
            });
          } else {
            const existingBySku = await db.product.findUnique({
              where: { sku: rawSku },
            });

            if (existingBySku) {
              await db.product.update({
                where: { id: existingBySku.id },
                data: {
                  zohoItemId: itemId,
                  name,
                  price,
                  lastSyncedAt: new Date(),
                },
              });
            } else {
              await db.product.create({
                data: {
                  sku: rawSku,
                  name,
                  price,
                  zohoItemId: itemId,
                  lastSyncedAt: new Date(),
                },
              });
            }
          }

          result.syncedCount++;
        } catch (itemErr: unknown) {
          result.skippedCount++;
          const itemErrMsg = itemErr instanceof Error ? itemErr.message : String(itemErr);
          result.errors.push(`Error upserting SKU ${rawSku}: ${itemErrMsg}`);

          await db.zohoSyncLog.create({
            data: {
              operation: "catalog_sync",
              entityType: "Product",
              entityId: rawSku,
              status: "failed",
              errorMessage: itemErrMsg,
              zohoResponse: JSON.stringify(item),
            },
          });
        }
      }

      const pageContext = response.data.page_context;
      hasMore = Boolean(pageContext?.has_more_page);
      page++;

      if (page > 50) break; // Safety cap
    }

    // Log overall sync summary
    await db.zohoSyncLog.create({
      data: {
        operation: "catalog_sync_batch",
        entityType: "ProductCatalog",
        entityId: `sync_${Date.now()}`,
        status: "success",
        zohoResponse: JSON.stringify({
          totalFetched: result.totalFetched,
          syncedCount: result.syncedCount,
          skippedCount: result.skippedCount,
          errorCount: result.errors.length,
        }),
      },
    });

    return result;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await db.zohoSyncLog.create({
      data: {
        operation: "catalog_sync_batch",
        entityType: "ProductCatalog",
        entityId: `sync_failed_${Date.now()}`,
        status: "failed",
        errorMessage: errorMsg,
      },
    });
    throw err;
  }
}
