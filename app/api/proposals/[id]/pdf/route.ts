import { NextRequest, NextResponse } from "next/server";
import { generateProposalPdf } from "@/lib/proposalPdf";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const proposalId = parseInt(id, 10);
  if (isNaN(proposalId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const pdf = await generateProposalPdf(proposalId);
  if (!pdf) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(pdf.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdf.filename}"`,
    },
  });
}
