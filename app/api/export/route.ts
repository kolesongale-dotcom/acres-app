import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { ESTIMATE_INCLUDE, computeEstimate } from "@/lib/estimateCalc";
import { getPaintCatalog } from "@/lib/priceCatalog";
import { getCurrentRatesAndDefaults } from "@/lib/jobRates";
import { customerName } from "@/lib/format";
import { round2 } from "@/lib/calculations";
import { invoiceStatus } from "@/lib/invoiceStatus";

function fmtDate(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "";
}

type Row = (string | number)[];
function addSheet(wb: XLSX.WorkBook, name: string, rows: Row[], cols: number[]) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = cols.map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, ws, name);
}

export async function GET(req: NextRequest) {
  const type = (req.nextUrl.searchParams.get("type") ?? "all").toLowerCase();
  const all = type === "all";
  const want = (t: string) => all || type === t;
  const wb = XLSX.utils.book_new();

  const wantCustomers = want("customers");
  const wantEstimates = want("estimates");
  const wantProposals = want("proposals");
  const wantInvoices = want("invoices");
  const wantPayments = want("payments");
  const wantChangeOrders = want("changeorders");
  const wantColorSheets = want("colorsheets");
  const wantPriceBook = want("pricebook");
  const wantBudget = want("budget");
  const wantFollowUps = want("followups");

  // Catalog/defaults only needed for estimate/proposal grand totals.
  const needTotals = wantEstimates || wantProposals;
  const [catalog, { defaults }] = needTotals
    ? await Promise.all([getPaintCatalog(), getCurrentRatesAndDefaults()])
    : [{}, { defaults: undefined as any }];

  // Shared estimate → { number, project, customer } map for the sheets that
  // reference an estimate but have no Prisma relation (invoices/payments/change
  // orders/color sheets/budget).
  const needEstMap = wantInvoices || wantPayments || wantChangeOrders || wantColorSheets || wantBudget;
  const estMap = new Map<number, { number: string; project: string; customer: string }>();
  if (needEstMap) {
    const ests = await prisma.estimate.findMany({ include: { customer: true } });
    for (const e of ests) {
      estMap.set(e.id, { number: e.estimateNumber, project: e.projectName || "Untitled", customer: customerName(e.customer) });
    }
  }
  const est = (id: number | null | undefined) => (id != null ? estMap.get(id) : undefined);

  if (wantCustomers) {
    const customers = await prisma.customer.findMany({
      orderBy: { customerNumber: "asc" },
      include: { _count: { select: { estimates: true } } },
    });
    addSheet(wb, "Customers", [
      ["Customer #", "Name", "Company", "Email", "Phone", "Address", "Lead Source", "Status", "Created", "Estimates"],
      ...customers.map((c): Row => [
        c.customerNumber,
        `${c.firstName} ${c.lastName}`.trim(),
        c.company, c.email, c.phone,
        [c.street, c.city, c.state, c.zip].filter(Boolean).join(", "),
        c.leadSource, c.status, fmtDate(c.createdAt), c._count.estimates,
      ]),
    ], [12, 22, 20, 26, 16, 34, 16, 12, 12, 10]);
  }

  if (wantEstimates) {
    const estimates = await prisma.estimate.findMany({ include: ESTIMATE_INCLUDE, orderBy: { estimateNumber: "asc" } });
    addSheet(wb, "Estimates", [
      ["Estimate #", "Project", "Customer", "Status", "Grand Total", "Created"],
      ...estimates.map((e): Row => {
        const { totals } = computeEstimate(e as any, catalog, defaults);
        return [e.estimateNumber, e.projectName || "Untitled", customerName(e.customer), e.status, round2(totals.grandTotal), fmtDate(e.createdAt)];
      }),
    ], [12, 28, 22, 12, 14, 12]);
  }

  if (wantProposals) {
    const proposals = await prisma.proposal.findMany({ orderBy: { proposalNumber: "asc" }, include: { estimate: { include: ESTIMATE_INCLUDE } } });
    addSheet(wb, "Proposals", [
      ["Proposal #", "Estimate #", "Client", "Project", "Status", "Selected Tier", "Grand Total", "Sent", "Signed By", "Signed"],
      ...proposals.map((p): Row => {
        const { totals } = computeEstimate(p.estimate as any, catalog, defaults);
        return [p.proposalNumber, p.estimate.estimateNumber, customerName(p.estimate.customer), p.estimate.projectName || "Untitled", p.status, p.selectedTier, round2(totals.grandTotal), fmtDate(p.sentAt), p.signatureName, fmtDate(p.signedAt)];
      }),
    ], [12, 12, 22, 26, 12, 12, 14, 12, 20, 12]);
  }

  if (wantInvoices) {
    const invoices = await prisma.invoice.findMany({ include: { payments: true }, orderBy: { invoiceNumber: "asc" } });
    addSheet(wb, "Invoices", [
      ["Invoice #", "Customer", "Project", "Total", "Amount Paid", "Balance Due", "Due Date", "Status"],
      ...invoices.map((inv): Row => {
        const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
        const e = est(inv.estimateId);
        return [inv.invoiceNumber, e?.customer ?? "—", e?.project ?? "—", round2(inv.total), round2(paid), round2(Math.max(0, inv.total - paid)), fmtDate(inv.dueDate), invoiceStatus(inv.total, paid, inv.dueDate)];
      }),
    ], [12, 22, 26, 12, 12, 12, 12, 10]);
  }

  if (wantPayments) {
    const payments = await prisma.payment.findMany({ include: { invoice: true }, orderBy: { paidAt: "asc" } });
    addSheet(wb, "Payment History", [
      ["Invoice #", "Customer", "Payment Amount", "Date", "Note"],
      ...payments.map((p): Row => {
        const e = est(p.invoice?.estimateId);
        return [p.invoice?.invoiceNumber ?? "—", e?.customer ?? "—", round2(p.amount), fmtDate(p.paidAt), p.note];
      }),
    ], [12, 22, 16, 12, 34]);
  }

  if (wantChangeOrders) {
    const cos = await prisma.changeOrder.findMany({ orderBy: { changeOrderNumber: "asc" } });
    addSheet(wb, "Change Orders", [
      ["Change Order #", "Estimate #", "Project", "Description", "Total", "Status", "Signed"],
      ...cos.map((c): Row => {
        const e = est(c.estimateId);
        return [c.changeOrderNumber, e?.number ?? "—", e?.project ?? "—", c.description, round2(c.total), c.status, fmtDate(c.signedAt)];
      }),
    ], [14, 12, 26, 40, 12, 12, 12]);
  }

  if (wantColorSheets) {
    const colors = await prisma.colorSelection.findMany({ orderBy: [{ estimateId: "asc" }, { slotKey: "asc" }] });
    addSheet(wb, "Color Sheets", [
      ["Estimate #", "Customer", "Project", "Surface / Slot", "Color Name", "Color Code", "Provider"],
      ...colors.map((c): Row => {
        const e = est(c.estimateId);
        return [e?.number ?? "—", e?.customer ?? "—", e?.project ?? "—", c.slotKey, c.colorName, c.colorCode, c.provider];
      }),
    ], [12, 22, 26, 26, 22, 16, 18]);
  }

  if (wantPriceBook) {
    const items = await prisma.priceBookItem.findMany({ orderBy: [{ type: "asc" }, { sortOrder: "asc" }] });
    addSheet(wb, "Price Book", [
      ["Type", "Name", "Brand", "Unit", "Unit Cost", "Markup %", "Coverage (sf/gal)", "Category"],
      ...items.map((p): Row => [p.type, p.name, p.brand, p.unit, round2(p.unitCost), round2(p.markup), round2(p.coverage), p.category]),
    ], [10, 28, 18, 12, 12, 10, 16, 22]);
  }

  if (wantBudget) {
    const budgets = await prisma.budgetEntry.findMany({ orderBy: { estimateId: "asc" } });
    addSheet(wb, "Budget Summary", [
      ["Estimate #", "Project", "Customer", "Est. Revenue", "Act. Revenue", "Est. Labor", "Act. Labor", "Est. Paint", "Act. Paint", "Est. Materials", "Act. Materials"],
      ...budgets.map((b): Row => {
        const e = est(b.estimateId);
        return [e?.number ?? "—", e?.project ?? "—", e?.customer ?? "—",
          round2(b.estimatedRevenue), round2(b.actualRevenue),
          round2(b.estimatedLaborCost), round2(b.actualLaborCost),
          round2(b.estimatedPaintCost), round2(b.actualPaintCost),
          round2(b.estimatedMaterialCost), round2(b.actualMaterialCost)];
      }),
    ], [12, 26, 22, 13, 13, 12, 12, 12, 12, 13, 13]);
  }

  if (wantFollowUps) {
    const followUps = await prisma.followUpReminder.findMany({ include: { customer: true }, orderBy: { dueDate: "asc" } });
    addSheet(wb, "Follow-Ups", [
      ["Customer", "Due Date", "Note", "Status"],
      ...followUps.map((f): Row => [customerName(f.customer), fmtDate(f.dueDate), f.note, f.completed ? "Completed" : "Open"]),
    ], [22, 12, 44, 12]);
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
