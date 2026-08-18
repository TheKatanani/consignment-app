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

    return NextResponse.json(result, { status: result.success ? 200 : 502 });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMsg, success: false }, { status: 500 });
  }
}
