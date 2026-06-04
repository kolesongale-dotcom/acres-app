import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { customerName } from "@/lib/format";
import { formatCurrency } from "@/lib/calculations";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import NewChangeOrder from "./NewChangeOrder";

export const dynamic = "force-dynamic";

export default async function ChangeOrdersPage() {
  const [changeOrders, proposals] = await Promise.all([
    prisma.changeOrder.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.proposal.findMany({ include: { estimate: { include: { customer: true } } }, orderBy: { updatedAt: "desc" } }),
  ]);
  const estimates = await prisma.estimate.findMany({
    where: { id: { in: changeOrders.map((c) => c.estimateId) } },
    include: { customer: true },
  });
  const estById = new Map(estimates.map((e) => [e.id, e]));

  const jobOptions = proposals.map((p) => ({
    estimateId: p.estimateId,
    label: `${p.proposalNumber} · ${customerName(p.estimate.customer)} · ${p.estimate.projectName || "Untitled"}`,
  }));

  return (
    <div>
      <PageHeader title="Change Orders" subtitle="Mid-job scope changes the client signs; can roll into the job's invoice." actions={<NewChangeOrder jobs={jobOptions} />} />

      {changeOrders.length === 0 ? (
        <div className="card">
          <EmptyState icon="⇄" title="No change orders yet" description="Start one with “+ New Change Order,” add the extra work, and send it to the client to sign." />
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Change Order</th>
                <th>Client / Project</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {changeOrders.map((co) => {
                const est = estById.get(co.estimateId);
                return (
                  <tr key={co.id}>
                    <td style={{ fontWeight: 700 }}><Link href={`/change-orders/${co.id}`} style={{ color: "var(--text-primary)", textDecoration: "none" }}>{co.changeOrderNumber}</Link></td>
                    <td>
                      <Link href={`/change-orders/${co.id}`} style={{ color: "var(--text-primary)", textDecoration: "none" }}>
                        <div style={{ fontWeight: 600 }}>{est ? customerName(est.customer) : "—"}</div>
                        <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>{est?.projectName || "Untitled Project"}</div>
                      </Link>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{formatCurrency(co.total)}</td>
                    <td><StatusBadge status={co.status} /></td>
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
