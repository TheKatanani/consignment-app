import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createSettlementInvoiceInZoho } from "@/lib/zoho/createSettlementInvoice";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: settlementId } = await params;

    const result = await createSettlementInvoiceInZoho(settlementId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          status: result.status,
          message: result.message,
          error: result.message,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      zohoInvoiceId: result.zohoInvoiceId,
      message: result.message,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[Settlement Confirm API] Error:", errorMsg);
    return NextResponse.json({ error: errorMsg, success: false }, { status: 500 });
  }
}
