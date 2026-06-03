import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { ESTIMATE_INCLUDE, computeEstimate } from "@/lib/estimateCalc";
import { getPaintCatalog } from "@/lib/priceCatalog";
import { getCurrentRatesAndDefaults } from "@/lib/jobRates";
import { customerName } from "@/lib/format";
import { round2 } from "@/lib/calculations";

function fmtDate(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "";
}

export async function GET(req: NextRequest) {
  const type = (req.nextUrl.searchParams.get("type") ?? "all").toLowerCase();
  const [catalog, { defaults }] = await Promise.all([getPaintCatalog(), getCurrentRatesAndDefaults()]);
  const wb = XLSX.utils.book_new();

  const wantCustomers = type === "all" || type === "customers";
  const wantEstimates = type === "all" || type === "estimates";
  const wantProposals = type === "all" || type === "proposals";

  if (wantCustomers) {
    const customers = await prisma.customer.findMany({
      orderBy: { customerNumber: "asc" },
      include: { _count: { select: { estimates: true } } },
    });
    const rows: (string | number)[][] = [
      ["Customer #", "Name", "Company", "Email", "Phone", "Address", "Lead Source", "Status", "Created", "Estimates"],
      ...customers.map((c) => [
        c.customerNumber,
        `${c.firstName} ${c.lastName}`.trim(),
        c.company,
        c.email,
        c.phone,
        [c.street, c.city, c.state, c.zip].filter(Boolean).join(", "),
        c.leadSource,
        c.status,
        fmtDate(c.createdAt),
        c._count.estimates,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 12 }, { wch: 22 }, { wch: 20 }, { wch: 26 }, { wch: 16 }, { wch: 34 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, "Customers");
  }

  if (wantEstimates) {
    const estimates = await prisma.estimate.findMany({
      include: ESTIMATE_INCLUDE,
      orderBy: { estimateNumber: "asc" },
    });
    const rows: (string | number)[][] = [
      ["Estimate #", "Project", "Customer", "Status", "Grand Total", "Created"],
      ...estimates.map((e) => {
        const { totals } = computeEstimate(e as any, catalog, defaults);
        return [
          e.estimateNumber,
          e.projectName || "Untitled",
          customerName(e.customer),
          e.status,
          round2(totals.grandTotal),
          fmtDate(e.createdAt),
        ];
      }),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 12 }, { wch: 28 }, { wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, "Estimates");
  }

  if (wantProposals) {
    const proposals = await prisma.proposal.findMany({
      orderBy: { proposalNumber: "asc" },
      include: { estimate: { include: ESTIMATE_INCLUDE } },
    });
    const rows: (string | number)[][] = [
      ["Proposal #", "Estimate #", "Client", "Project", "Status", "Selected Tier", "Grand Total", "Sent", "Signed By", "Signed"],
      ...proposals.map((p) => {
        const { totals } = computeEstimate(p.estimate as any, catalog, defaults);
        return [
          p.proposalNumber,
          p.estimate.estimateNumber,
          customerName(p.estimate.customer),
          p.estimate.projectName || "Untitled",
          p.status,
          p.selectedTier,
          round2(totals.grandTotal),
          fmtDate(p.sentAt),
          p.signatureName,
          fmtDate(p.signedAt),
        ];
      }),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 26 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, "Proposals");
  }

  if (wb.SheetNames.length === 0) {
    return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
  }

  const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `acres_${type}_${stamp}.xlsx`;

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
