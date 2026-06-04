import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { customerName, formatDate } from "@/lib/format";
import { formatCurrency } from "@/lib/calculations";
import { invoiceStatus, INVOICE_STATUS_COLOR } from "@/lib/invoiceStatus";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const invoices = await prisma.invoice.findMany({
    include: { payments: true },
    orderBy: { createdAt: "desc" },
  });
  const estimates = await prisma.estimate.findMany({
    where: { id: { in: invoices.map((i) => i.estimateId) } },
    include: { customer: true },
  });
  const estById = new Map(estimates.map((e) => [e.id, e]));

  const rows = invoices.map((inv) => {
    const est = estById.get(inv.estimateId);
    const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
    const remaining = Math.max(0, inv.total - paid);
    return {
      id: inv.id,
      number: inv.invoiceNumber,
      client: est ? customerName(est.customer) : "—",
      project: est?.projectName || "Untitled Project",
      total: inv.total,
      paid,
      remaining,
      dueDate: inv.dueDate,
      status: invoiceStatus(inv.total, paid, inv.dueDate),
    };
  });

  const outstanding = rows.reduce((s, r) => s + r.remaining, 0);
  const collected = rows.reduce((s, r) => s + r.paid, 0);

  return (
    <div>
      <PageHeader title="Invoices" subtitle="Bill accepted jobs and track payments." />

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="$"
            title="No invoices yet"
            description="Open an accepted proposal and click “Create Invoice” to bill the job."
          />
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
            <Card label="Invoices" value={String(rows.length)} />
            <Card label="Collected" value={formatCurrency(collected)} accent />
            <Card label="Outstanding" value={formatCurrency(outstanding)} danger={outstanding > 0} />
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Client / Project</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                  <th style={{ textAlign: "right" }}>Remaining</th>
                  <th>Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="row-link">
                    <td style={{ fontWeight: 700 }}><Link href={`/invoices/${r.id}`} style={{ color: "var(--text-primary)", textDecoration: "none" }}>{r.number}</Link></td>
                    <td>
                      <Link href={`/invoices/${r.id}`} style={{ color: "var(--text-primary)", textDecoration: "none" }}>
                        <div style={{ fontWeight: 600 }}>{r.client}</div>
                        <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>{r.project}</div>
                      </Link>
                    </td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(r.total)}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: r.remaining > 0 ? "var(--text-primary)" : "var(--accent)" }}>{formatCurrency(r.remaining)}</td>
                    <td style={{ color: "var(--text-dim)" }}>{formatDate(r.dueDate)}</td>
                    <td><StatusPill status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Card({ label, value, accent, danger }: { label: string; value: string; accent?: boolean; danger?: boolean }) {
  return (
    <div className="card card-tight">
      <div className="section-title" style={{ fontSize: 11 }}>{label}</div>
      <div className="font-display" style={{ fontSize: 22, marginTop: 6, color: danger ? "#f87171" : accent ? "var(--accent)" : "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const c = INVOICE_STATUS_COLOR[status] ?? { bg: "var(--bg-secondary)", fg: "var(--text-dim)" };
  return (
    <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: c.bg, color: c.fg }}>{status}</span>
  );
}
