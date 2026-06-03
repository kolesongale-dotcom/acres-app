import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ESTIMATE_INCLUDE, computeEstimate } from "@/lib/estimateCalc";
import { getPaintCatalog } from "@/lib/priceCatalog";
import { getCurrentRatesAndDefaults } from "@/lib/jobRates";
import { ensureBudgetEntry } from "@/lib/actions/estimates";
import { customerName, formatDate } from "@/lib/format";
import BudgetDetail from "./BudgetDetail";

export const dynamic = "force-dynamic";

export default async function BudgetDetailPage({
  params,
}: {
  params: Promise<{ estimateId: string }>;
}) {
  const { estimateId: idStr } = await params;
  const estimateId = parseInt(idStr, 10);
  if (isNaN(estimateId)) notFound();

  const estimate = await prisma.estimate.findUnique({
    where: { id: estimateId },
    include: ESTIMATE_INCLUDE,
  });
  if (!estimate) notFound();

  // Make sure a budget entry exists with fresh estimated values.
  await ensureBudgetEntry(estimateId);
  const entry = await prisma.budgetEntry.findUnique({ where: { estimateId } });
  const [catalog, { defaults }] = await Promise.all([getPaintCatalog(), getCurrentRatesAndDefaults()]);
  const { totals } = computeEstimate(estimate as any, catalog, defaults);

  const dates =
    estimate.startDate || estimate.endDate
      ? [estimate.startDate, estimate.endDate]
          .map((d) => (d ? formatDate(d) : "—"))
          .join(" → ")
      : "";

  return (
    <BudgetDetail
      estimateId={estimateId}
      project={estimate.projectName}
      customer={customerName(estimate.customer)}
      dates={dates}
      estimated={{
        revenue: entry?.estimatedRevenue ?? totals.grandTotal,
        labor: entry?.estimatedLaborCost ?? totals.laborTotal,
        material: entry?.estimatedMaterialCost ?? totals.materialTotal,
        overhead: entry?.estimatedOverhead ?? totals.overheadTotal,
      }}
      actual={{
        actualRevenue: entry?.actualRevenue ?? 0,
        actualLaborCost: entry?.actualLaborCost ?? 0,
        actualMaterialCost: entry?.actualMaterialCost ?? 0,
        actualOverhead: entry?.actualOverhead ?? 0,
        notes: entry?.notes ?? "",
      }}
    />
  );
}
