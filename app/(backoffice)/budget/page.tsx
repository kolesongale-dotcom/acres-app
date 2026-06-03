import { prisma } from "@/lib/prisma";
import { ESTIMATE_INCLUDE, computeEstimate } from "@/lib/estimateCalc";
import { getPaintCatalog } from "@/lib/priceCatalog";
import { getCurrentRatesAndDefaults } from "@/lib/jobRates";
import { customerName } from "@/lib/format";
import { formatCurrency } from "@/lib/calculations";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import BudgetTable, { BudgetRow } from "./BudgetTable";

export const dynamic = "force-dynamic";

export default async function BudgetPage() {
  // Only Accepted estimates appear in the budget tracker.
  const estimates = await prisma.estimate.findMany({
    where: { status: "Accepted" },
    include: ESTIMATE_INCLUDE,
    orderBy: { updatedAt: "desc" },
  });

  const [entries, catalog] = await Promise.all([
    prisma.budgetEntry.findMany({
      where: { estimateId: { in: estimates.map((e) => e.id) } },
    }),
    getPaintCatalog(),
  ]);
  const { defaults } = await getCurrentRatesAndDefaults();
  const entryByEstimate = new Map(entries.map((e) => [e.estimateId, e]));

  const rows: BudgetRow[] = estimates.map((e) => {
    const { totals } = computeEstimate(e as any, catalog, defaults);
    const entry = entryByEstimate.get(e.id);

    const estRevenue = entry?.estimatedRevenue ?? totals.grandTotal;
    const estCost =
      (entry?.estimatedLaborCost ?? totals.laborTotal) +
      (entry?.estimatedMaterialCost ?? totals.materialTotal) +
      (entry?.estimatedOverhead ?? totals.overheadTotal);
    const actRevenue = entry?.actualRevenue ?? 0;
    const actCost =
      (entry?.actualLaborCost ?? 0) +
      (entry?.actualMaterialCost ?? 0) +
      (entry?.actualOverhead ?? 0);

    const estProfit = estRevenue - estCost;
    const actProfit = actRevenue - actCost;
    const varianceDollar = actProfit - estProfit;
    const variancePct = estProfit !== 0 ? (varianceDollar / Math.abs(estProfit)) * 100 : 0;

    return {
      estimateId: e.id,
      project: e.projectName,
      customer: customerName(e.customer),
      estRevenue,
      actRevenue,
      estCost,
      actCost,
      estProfit,
      actProfit,
      varianceDollar,
      variancePct,
    };
  });

  const sum = (key: keyof BudgetRow) =>
    rows.reduce((s, r) => s + (r[key] as number), 0);

  const cards = [
    { label: "Est. Revenue", value: formatCurrency(sum("estRevenue")) },
    { label: "Actual Revenue", value: formatCurrency(sum("actRevenue")) },
    { label: "Est. Costs", value: formatCurrency(sum("estCost")) },
    { label: "Actual Costs", value: formatCurrency(sum("actCost")) },
    { label: "Est. Profit", value: formatCurrency(sum("estProfit")) },
    { label: "Actual Profit", value: formatCurrency(sum("actProfit")), accent: true },
    { label: "Total Variance", value: formatCurrency(sum("varianceDollar")), variance: sum("varianceDollar") },
  ];

  return (
    <div>
      <PageHeader
        title="Budget Tracker"
        subtitle="Estimated vs. actual performance on accepted jobs."
      />

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="$"
            title="No accepted jobs yet"
            description="Once an estimate or proposal is accepted, it appears here for budget tracking."
          />
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 12, marginBottom: 28 }}>
            {cards.map((c) => (
              <div key={c.label} className="card card-tight">
                <div className="section-title" style={{ fontSize: 11 }}>{c.label}</div>
                <div
                  className="font-display"
                  style={{
                    fontSize: 20,
                    marginTop: 6,
                    color:
                      c.variance !== undefined
                        ? c.variance >= 0 ? "var(--accent)" : "#f87171"
                        : c.accent ? "var(--accent)" : "var(--text-primary)",
                  }}
                >
                  {c.value}
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <BudgetTable rows={rows} />
          </div>
        </>
      )}
    </div>
  );
}
