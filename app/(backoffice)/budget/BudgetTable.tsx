"use client";

import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/calculations";

export interface BudgetRow {
  estimateId: number;
  project: string;
  customer: string;
  estRevenue: number;
  actRevenue: number;
  estCost: number;
  actCost: number;
  estProfit: number;
  actProfit: number;
  varianceDollar: number;
  variancePct: number;
}

function vColor(v: number) {
  if (v > 0.5) return "var(--accent)";
  if (v < -0.5) return "#f87171";
  return "var(--text-dim)";
}

export default function BudgetTable({ rows }: { rows: BudgetRow[] }) {
  const router = useRouter();
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Project</th>
          <th>Customer</th>
          <th style={{ textAlign: "right" }}>Est. Rev</th>
          <th style={{ textAlign: "right" }}>Act. Rev</th>
          <th style={{ textAlign: "right" }}>Est. Cost</th>
          <th style={{ textAlign: "right" }}>Act. Cost</th>
          <th style={{ textAlign: "right" }}>Est. Profit</th>
          <th style={{ textAlign: "right" }}>Act. Profit</th>
          <th style={{ textAlign: "right" }}>Variance</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.estimateId} className="row-link" onClick={() => router.push(`/budget/${r.estimateId}`)}>
            <td style={{ fontWeight: 600 }}>{r.project || "Untitled"}</td>
            <td style={{ color: "var(--text-dim)" }}>{r.customer}</td>
            <td style={{ textAlign: "right" }}>{formatCurrency(r.estRevenue)}</td>
            <td style={{ textAlign: "right" }}>{formatCurrency(r.actRevenue)}</td>
            <td style={{ textAlign: "right" }}>{formatCurrency(r.estCost)}</td>
            <td style={{ textAlign: "right" }}>{formatCurrency(r.actCost)}</td>
            <td style={{ textAlign: "right" }}>{formatCurrency(r.estProfit)}</td>
            <td style={{ textAlign: "right", fontWeight: 600 }}>{formatCurrency(r.actProfit)}</td>
            <td style={{ textAlign: "right", color: vColor(r.varianceDollar), fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(r.varianceDollar)}
              <span style={{ fontSize: 11, marginLeft: 6, opacity: 0.8 }}>
                {r.variancePct >= 0 ? "+" : ""}{r.variancePct.toFixed(0)}%
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
