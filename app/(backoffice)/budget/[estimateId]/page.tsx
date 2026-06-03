import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ESTIMATE_INCLUDE } from "@/lib/estimateCalc";
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
        revenue: entry?.estimatedRevenue ?? 0,
        paint: entry?.estimatedPaintCost ?? 0,
        material: entry?.estimatedMaterialCost ?? 0,
        labor: entry?.estimatedLaborCost ?? 0,
      }}
      actual={{
        actualRevenue: entry?.actualRevenue ?? 0,
        actualPaintCost: entry?.actualPaintCost ?? 0,
        actualMaterialCost: entry?.actualMaterialCost ?? 0,
        actualLaborCost: entry?.actualLaborCost ?? 0,
        notes: entry?.notes ?? "",
      }}
    />
  );
}
