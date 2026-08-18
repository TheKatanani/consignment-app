import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncProductCatalogFromZoho } from "@/lib/zoho/syncCatalog";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await syncProductCatalogFromZoho();

    return NextResponse.json({
      success: true,
      message: `Catalog sync complete: ${result.syncedCount} synced, ${result.skippedCount} skipped (missing or invalid SKU).`,
      data: result,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[SyncCatalog API] Error:", errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        message: "Failed to synchronize catalog with Zoho Inventory.",
      },
      { status: 500 }
    );
  }
}
