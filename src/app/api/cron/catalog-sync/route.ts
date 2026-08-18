import { NextResponse } from "next/server";
import { syncProductCatalogFromZoho } from "@/lib/zoho/syncCatalog";

// CRON Endpoint for Vercel Cron or periodic scheduling
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    // Verify optional cron secret if set in production
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await syncProductCatalogFromZoho();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
