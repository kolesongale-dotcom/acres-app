"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useToast } from "@/components/Toast";
import { updateBudgetActuals } from "@/lib/actions/budget";
import { formatCurrency } from "@/lib/calculations";

interface Estimated {
  revenue: number;
  labor: number;
  material: number;
  overhead: number;
}
interface Actual {
  actualRevenue: number;
  actualLaborCost: number;
  actualMaterialCost: number;
  actualOverhead: number;
  notes: string;
}

export default function BudgetDetail({
  estimateId,
  project,
  customer,
  dates,
  estimated,
  actual,
}: {
  estimateId: number;
  project: string;
  customer: string;
  dates: string;
  estimated: Estimated;
  actual: Actual;
}) {
  const router = useRouter();
  const { success, error } = useToast();
  const [pending, start] = useTransition();
  const [form, setForm] = useState(actual);
  const [dirty, setDirty] = useState(false);

  const set = (k: keyof Actual, v: number | string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  const estCost = estimated.labor + estimated.material + estimated.overhead;
  const actCost = form.actualLaborCost + form.actualMaterialCost + form.actualOverhead;
  const estProfit = estimated.revenue - estCost;
  const actProfit = form.actualRevenue - actCost;

  function save() {
    start(async () => {
      const res = await updateBudgetActuals(estimateId, {
        actualRevenue: form.actualRevenue,
        actualLaborCost: form.actualLaborCost,
        actualMaterialCost: form.actualMaterialCost,
        actualOverhead: form.actualOverhead,
        notes: form.notes,
      });
      if (res.success) { success("Budget saved."); setDirty(false); router.refresh(); }
      else error(res.error);
    });
  }

  const rows: { label: string; est: number; actKey?: keyof Actual; actVal: number }[] = [
    { label: "Revenue", est: estimated.revenue, actKey: "actualRevenue", actVal: form.actualRevenue },
    { label: "Labor Cost", est: estimated.labor, actKey: "actualLaborCost", actVal: form.actualLaborCost },
    { label: "Material Cost", est: estimated.material, actKey: "actualMaterialCost", actVal: form.actualMaterialCost },
    { label: "Overhead", est: estimated.overhead, actKey: "actualOverhead", actVal: form.actualOverhead },
  ];

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <Link href="/budget" className="btn btn-ghost btn-sm" style={{ paddingLeft: 0 }}>← Budget Tracker</Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <h1 className="page-title">{project || "Untitled Project"}</h1>
          <p style={{ color: "var(--text-dim)", margin: "8px 0 0" }}>{customer}{dates ? ` · ${dates}` : ""}</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href={`/estimates/${estimateId}`} className="btn btn-secondary">View Estimate</Link>
          <button className="btn btn-primary" onClick={save} disabled={!dirty || pending}>
            {pending ? <LoadingSpinner size={16} /> : dirty ? "Save Actuals" : "Saved ✓"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Line</th>
                <th style={{ textAlign: "right" }}>Estimated</th>
                <th style={{ textAlign: "right" }}>Actual</th>
                <th style={{ textAlign: "right" }}>Variance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                // For costs, lower actual = favorable (green). For revenue, higher = favorable.
                const diff = r.actVal - r.est;
                const favorable = r.label === "Revenue" ? diff >= 0 : diff <= 0;
                const color = diff === 0 ? "var(--text-dim)" : favorable ? "var(--accent)" : "#f87171";
                return (
                  <tr key={r.label}>
                    <td style={{ fontWeight: 600 }}>{r.label}</td>
                    <td style={{ textAlign: "right", color: "var(--text-dim)" }}>{formatCurrency(r.est)}</td>
                    <td style={{ textAlign: "right", maxWidth: 160 }}>
                      <input
                        type="number"
                        step="any"
                        className="input"
                        style={{ textAlign: "right", maxWidth: 150, marginLeft: "auto" }}
                        value={Number.isFinite(r.actVal) ? r.actVal : 0}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => set(r.actKey!, parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td style={{ textAlign: "right", color, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      {diff >= 0 ? "+" : "−"}{formatCurrency(Math.abs(diff))}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: "2px solid var(--border)" }}>
                <td style={{ fontWeight: 800 }}>Profit</td>
                <td style={{ textAlign: "right", color: "var(--text-dim)", fontWeight: 700 }}>{formatCurrency(estProfit)}</td>
                <td style={{ textAlign: "right", fontWeight: 800, color: "var(--accent)" }}>{formatCurrency(actProfit)}</td>
                <td style={{ textAlign: "right", fontWeight: 700, color: actProfit - estProfit >= 0 ? "var(--accent)" : "#f87171" }}>
                  {actProfit - estProfit >= 0 ? "+" : "−"}{formatCurrency(Math.abs(actProfit - estProfit))}
                </td>
              </tr>
            </tbody>
          </table>
          <div style={{ padding: 20, borderTop: "1px solid var(--border-light)" }}>
            <label className="label">Job Budget Notes</label>
            <textarea className="textarea" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Receipts, change orders, labor notes…" />
          </div>
        </div>

        <div style={{ position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card card-tight">
            <div className="section-title">Estimated Profit</div>
            <div className="font-display" style={{ fontSize: 26, marginTop: 6, color: "var(--text-primary)" }}>{formatCurrency(estProfit)}</div>
          </div>
          <div className="card card-tight">
            <div className="section-title">Actual Profit</div>
            <div className="font-display" style={{ fontSize: 26, marginTop: 6, color: "var(--accent)" }}>{formatCurrency(actProfit)}</div>
          </div>
          <div className="card card-tight">
            <div className="section-title">Profit Variance</div>
            <div className="font-display" style={{ fontSize: 26, marginTop: 6, color: actProfit - estProfit >= 0 ? "var(--accent)" : "#f87171" }}>
              {actProfit - estProfit >= 0 ? "+" : "−"}{formatCurrency(Math.abs(actProfit - estProfit))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
