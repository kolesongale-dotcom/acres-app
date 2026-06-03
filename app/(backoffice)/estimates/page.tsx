import { prisma } from "@/lib/prisma";
import { ESTIMATE_INCLUDE, computeEstimate } from "@/lib/estimateCalc";
import { getPaintCatalog } from "@/lib/priceCatalog";
import { getCurrentRatesAndDefaults } from "@/lib/jobRates";
import { customerName } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import EstimatesClient, { EstimateRow } from "./EstimatesClient";

export const dynamic = "force-dynamic";

export default async function EstimatesPage() {
  const [estimates, catalog] = await Promise.all([
    prisma.estimate.findMany({
      include: ESTIMATE_INCLUDE,
      orderBy: { createdAt: "desc" },
    }),
    getPaintCatalog(),
  ]);
  const { defaults } = await getCurrentRatesAndDefaults();

  const rows: EstimateRow[] = estimates.map((e) => {
    const { totals } = computeEstimate(e as any, catalog, defaults);
    return {
      id: e.id,
      estimateNumber: e.estimateNumber,
      projectName: e.projectName,
      customer: customerName(e.customer),
      status: e.status,
      total: totals.grandTotal,
      createdAt: e.createdAt.toISOString(),
    };
  });

  return (
    <div>
      <PageHeader
        title="Estimates"
        subtitle={`${rows.length} ${rows.length === 1 ? "estimate" : "estimates"}.`}
      />
      <EstimatesClient estimates={rows} />
    </div>
  );
}
