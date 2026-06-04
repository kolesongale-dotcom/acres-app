import { NextRequest, NextResponse } from "next/server";
import { generateShoppingListPdf } from "@/lib/shoppingListPdf";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const estimateId = parseInt(id, 10);
  if (isNaN(estimateId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const pdf = await generateShoppingListPdf(estimateId);
  if (!pdf) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(pdf.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdf.filename}"`,
    },
  });
}
