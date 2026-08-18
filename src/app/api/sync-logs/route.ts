import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const operation = searchParams.get("operation");
    const status = searchParams.get("status");
    const entityType = searchParams.get("entityType");
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const where: Record<string, unknown> = {};
    if (operation) where.operation = operation;
    if (status) where.status = status;
    if (entityType) where.entityType = entityType;

    const logs = await db.zohoSyncLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 500),
    });

    const counts = {
      total: await db.zohoSyncLog.count(),
      success: await db.zohoSyncLog.count({ where: { status: "success" } }),
      failed: await db.zohoSyncLog.count({ where: { status: "failed" } }),
      skipped: await db.zohoSyncLog.count({ where: { status: "skipped" } }),
    };

    return NextResponse.json({ logs, counts });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
