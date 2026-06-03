import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ESTIMATE_INCLUDE, computeEstimate } from "@/lib/estimateCalc";
import { getPaintCatalog } from "@/lib/priceCatalog";
import { getCurrentRatesAndDefaults } from "@/lib/jobRates";
import { formatCurrency } from "@/lib/calculations";
import { customerName, relativeDays } from "@/lib/format";
import { ESTIMATE_STATUSES } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import FollowUpList, { FollowUpRow } from "./FollowUpList";

export const dynamic = "force-dynamic";

const PIPELINE: string[] = [...ESTIMATE_STATUSES];

export default async function DashboardPage() {
  const [estimates, catalog, rd] = await Promise.all([
    prisma.estimate.findMany({
      include: ESTIMATE_INCLUDE,
      orderBy: { updatedAt: "desc" },
    }),
    getPaintCatalog(),
    getCurrentRatesAndDefaults(),
  ]);

  const cards = estimates.map((e) => {
    const { totals } = computeEstimate(e as any, catalog, rd.defaults);
    return {
      id: e.id,
      estimateNumber: e.estimateNumber,
      projectName: e.projectName || "Untitled Project",
      customer: customerName(e.customer),
      status: e.status,
      total: totals.grandTotal,
      updatedAt: e.updatedAt,
    };
  });

  const totalValue = cards.reduce((s, c) => s + c.total, 0);
  const acceptedCards = cards.filter(
    (c) => c.status === "Accepted" || c.status === "Scheduled"
  );
  const acceptedValue = acceptedCards.reduce((s, c) => s + c.total, 0);
  const decided = cards.filter((c) =>
    ["Accepted", "Scheduled", "Rejected"].includes(c.status)
  );
  const conversionRate =
    decided.length > 0
      ? Math.round((acceptedCards.length / decided.length) * 100)
      : 0;

  const followUpsRaw = await prisma.followUpReminder.findMany({
    where: { completed: false },
    include: { customer: true },
    orderBy: { dueDate: "asc" },
  });
  const followUps: FollowUpRow[] = followUpsRaw.map((f) => ({
    id: f.id,
    note: f.note,
    dueDate: f.dueDate.toISOString(),
    customerId: f.customerId,
    customerName: customerName(f.customer),
    estimateId: f.estimateId,
  }));

  const metrics = [
    { label: "Pipeline Value", value: formatCurrency(totalValue), sub: `${cards.length} estimates` },
    { label: "Accepted Value", value: formatCurrency(acceptedValue), sub: `${acceptedCards.length} won` },
    { label: "Conversion Rate", value: `${conversionRate}%`, sub: `${decided.length} decided` },
    { label: "Open Follow-Ups", value: String(followUps.length), sub: "reminders" },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Your deal pipeline at a glance."
        actions={
          <Link href="/estimates" className="btn btn-secondary">
            View Estimates
          </Link>
        }
      />

      {/* Metrics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 32,
        }}
      >
        {metrics.map((m) => (
          <div key={m.label} className="card card-tight">
            <div className="section-title">{m.label}</div>
            <div
              className="font-display"
              style={{ fontSize: 30, marginTop: 8, color: "var(--text-primary)" }}
            >
              {m.value}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 2 }}>
              {m.sub}
            </div>
          </div>
        ))}
      </div>

      <div>
        {/* Pipeline */}
        <div style={{ marginBottom: 32 }}>
          <h2 className="section-title" style={{ marginBottom: 14 }}>
            Pipeline
          </h2>
          {cards.length === 0 ? (
            <div className="card">
              <EmptyState
                icon="▤"
                title="No estimates yet"
                description="Create your first estimate to start building your pipeline."
                action={
                  <Link href="/estimates" className="btn btn-primary">
                    Go to Estimates
                  </Link>
                }
              />
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 14,
              }}
            >
              {PIPELINE.map((status) => {
                const col = cards.filter((c) => c.status === status);
                const colValue = col.reduce((s, c) => s + c.total, 0);
                return (
                  <div
                    key={status}
                    style={{
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-light)",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 10,
                      }}
                    >
                      <StatusBadge status={status} />
                      <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                        {col.length}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 10 }}>
                      {formatCurrency(colValue)}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {col.map((c) => (
                        <Link
                          key={c.id}
                          href={`/estimates/${c.id}`}
                          className="card-hover"
                          style={{
                            display: "block",
                            background: "var(--bg-card)",
                            border: "1px solid var(--border-light)",
                            borderRadius: 9,
                            padding: 12,
                            textDecoration: "none",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 13.5,
                              fontWeight: 700,
                              color: "var(--text-primary)",
                            }}
                          >
                            {c.customer}
                          </div>
                          <div
                            style={{
                              fontSize: 12.5,
                              color: "var(--text-muted)",
                              margin: "2px 0 8px",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {c.projectName}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "baseline",
                            }}
                          >
                            <span
                              className="font-display"
                              style={{ fontSize: 16, color: "var(--accent)" }}
                            >
                              {formatCurrency(c.total)}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                              {relativeDays(c.updatedAt)}
                            </span>
                          </div>
                        </Link>
                      ))}
                      {col.length === 0 && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--text-dim)",
                            textAlign: "center",
                            padding: "12px 0",
                            opacity: 0.6,
                          }}
                        >
                          —
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Follow-ups */}
        <div className="card">
          <h2 className="section-title" style={{ marginBottom: 14 }}>
            Follow-Up Reminders
          </h2>
          <FollowUpList items={followUps} />
        </div>
      </div>
    </div>
  );
}
