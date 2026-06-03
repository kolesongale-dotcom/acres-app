import { prisma } from "@/lib/prisma";
import { computeEstimate, ESTIMATE_INCLUDE } from "@/lib/estimateCalc";
import { getPaintCatalog } from "@/lib/priceCatalog";
import { getCurrentRatesAndDefaults } from "@/lib/jobRates";
import { customerName } from "@/lib/format";
import { formatCurrency } from "@/lib/calculations";
import PageHeader from "@/components/PageHeader";
import ProposalsClient, { ProposalRow, EligibleEstimate } from "./ProposalsClient";

export const dynamic = "force-dynamic";

export default async function ProposalsPage() {
  const [proposals, catalog, eligible] = await Promise.all([
    prisma.proposal.findMany({
      orderBy: { createdAt: "desc" },
      include: { estimate: { include: ESTIMATE_INCLUDE } },
    }),
    getPaintCatalog(),
    prisma.estimate.findMany({
      where: { proposal: { is: null } },
      include: ESTIMATE_INCLUDE,
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const { defaults } = await getCurrentRatesAndDefaults();

  const eligibleEstimates: EligibleEstimate[] = eligible.map((e) => {
    const { totals } = computeEstimate(e as any, catalog, defaults);
    return {
      id: e.id,
      label: `${e.estimateNumber} · ${e.projectName || "Untitled"} · ${customerName(e.customer)}`,
      total: totals.grandTotal,
    };
  });

  const enriched = proposals.map((p) => {
    const { totals } = computeEstimate(p.estimate as any, catalog, defaults);
    return {
      id: p.id,
      proposalNumber: p.proposalNumber,
      estimateNumber: p.estimate.estimateNumber,
      client: customerName(p.estimate.customer),
      project: p.estimate.projectName,
      status: p.status,
      total: totals.grandTotal,
      sentAt: p.sentAt,
      signedAt: p.signedAt,
      updatedAt: p.updatedAt,
    };
  });

  const rows: ProposalRow[] = enriched.map((p) => ({
    id: p.id,
    proposalNumber: p.proposalNumber,
    estimateNumber: p.estimateNumber,
    client: p.client,
    project: p.project,
    status: p.status,
    total: p.total,
    sentAt: p.sentAt ? p.sentAt.toISOString() : null,
  }));

  // Metrics
  const awaitingValue = enriched
    .filter((p) => p.status === "Sent" || p.status === "Pending")
    .reduce((s, p) => s + p.total, 0);
  const activeDrafts = enriched.filter((p) => p.status === "Draft").length;
  const thirtyDaysAgo = Date.now() - 30 * 86400000;
  const closedRevenue = enriched
    .filter((p) => {
      if (p.status !== "Accepted") return false;
      const when = (p.signedAt ?? p.updatedAt).getTime();
      return when >= thirtyDaysAgo;
    })
    .reduce((s, p) => s + p.total, 0);

  const cards = [
    { label: "Awaiting Signature", value: formatCurrency(awaitingValue), icon: "◷", accent: "var(--warning)" },
    { label: "Active Drafts", value: String(activeDrafts), icon: "▤", accent: "var(--info)" },
    { label: "Closed Revenue (30 Days)", value: formatCurrency(closedRevenue), icon: "✓", accent: "var(--accent)" },
  ];

  return (
    <div>
      <PageHeader
        title="Proposals"
        subtitle="Manage client-facing documents, deposit tiers, and e-signatures."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
        {cards.map((c) => (
          <div
            key={c.label}
            className="card"
            style={{ position: "relative", overflow: "hidden", paddingBottom: 22 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div className="section-title" style={{ fontSize: 11 }}>{c.label}</div>
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  display: "grid",
                  placeItems: "center",
                  color: c.accent,
                  background: "var(--bg-secondary)",
                  border: `1px solid ${c.accent}55`,
                  fontSize: 15,
                }}
              >
                {c.icon}
              </span>
            </div>
            <div className="font-display" style={{ fontSize: 34, marginTop: 12, color: "var(--text-primary)" }}>
              {c.value}
            </div>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: c.accent }} />
          </div>
        ))}
      </div>

      <ProposalsClient proposals={rows} eligibleEstimates={eligibleEstimates} />
    </div>
  );
}
