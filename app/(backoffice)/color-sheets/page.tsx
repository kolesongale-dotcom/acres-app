import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { customerName } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function ColorSheetsPage() {
  const proposals = await prisma.proposal.findMany({
    include: { estimate: { include: { customer: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const estimateIds = proposals.map((p) => p.estimateId);
  const colorCounts = await prisma.colorSelection.groupBy({
    by: ["estimateId"],
    where: { estimateId: { in: estimateIds }, OR: [{ colorName: { not: "" } }, { colorCode: { not: "" } }] },
    _count: { _all: true },
  });
  const filledByEstimate = new Map(colorCounts.map((c) => [c.estimateId, c._count._all]));

  return (
    <div>
      <PageHeader title="Color Sheets" subtitle="Color & sheen choices your clients fill in for each job." />

      {proposals.length === 0 ? (
        <div className="card">
          <EmptyState icon="🎨" title="No proposals yet" description="Color sheets appear here once a job has a proposal. The client fills theirs in from the proposal email link." />
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Proposal</th>
                <th>Client / Project</th>
                <th style={{ textAlign: "right" }}>Colors entered</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => {
                const filled = filledByEstimate.get(p.estimateId) ?? 0;
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700 }}><Link href={`/color-sheets/${p.id}`} style={{ color: "var(--text-primary)", textDecoration: "none" }}>{p.proposalNumber}</Link></td>
                    <td>
                      <Link href={`/color-sheets/${p.id}`} style={{ color: "var(--text-primary)", textDecoration: "none" }}>
                        <div style={{ fontWeight: 600 }}>{customerName(p.estimate.customer)}</div>
                        <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>{p.estimate.projectName || "Untitled Project"}</div>
                      </Link>
                    </td>
                    <td style={{ textAlign: "right", color: filled > 0 ? "var(--accent)" : "var(--text-dim)", fontWeight: 600 }}>{filled > 0 ? `${filled} surface${filled === 1 ? "" : "s"}` : "—"}</td>
                    <td style={{ textAlign: "right" }}><Link href={`/color-sheets/${p.id}`} className="btn btn-secondary btn-sm">View</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
