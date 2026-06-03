"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useToast } from "@/components/Toast";
import { updateBudgetActuals } from "@/lib/actions/budget";
import { formatCurrency } from "@/lib/calculations";

interface Estimated {
  revenue: number;  // accepted-tier price (auto)
  paint: number;    // paint+primer at unit cost (auto)
  material: number; // other materials at unit cost (auto)
  labor: number;    // owner's expected labor (editable)
}
interface Actual {
  actualRevenue: number;
  actualPaintCost: number;
  actualMaterialCost: number;
  actualLaborCost: number;
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
  // Form holds the editable values: expected labor + all actuals + notes.
  const [form, setForm] = useState({ estLabor: estimated.labor, ...actual });
  const [dirty, setDirty] = useState(false);

  const set = (k: keyof typeof form, v: number | string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  const estCost = estimated.paint + estimated.material + form.estLabor;
  const actCost = form.actualPaintCost + form.actualMaterialCost + form.actualLaborCost;
  const estProfit = estimated.revenue - estCost;
  const actProfit = form.actualRevenue - actCost;

  function save() {
    start(async () => {
      const res = await updateBudgetActuals(estimateId, {
        estimatedLaborCost: form.estLabor,
        actualRevenue: form.actualRevenue,
        actualLaborCost: form.actualLaborCost,
        actualPaintCost: form.actualPaintCost,
        actualMaterialCost: form.actualMaterialCost,
        notes: form.notes,
      });
      if (res.success) { success("Budget saved."); setDirty(false); router.refresh(); }
      else error(res.error);
    });
  }

  type Row = {
    label: string;
    est: number;
    estKey?: keyof typeof form; // present => editable estimated cell (labor)
    actKey: keyof typeof form;
    actVal: number;
    isRevenue?: boolean;
  };
  const rows: Row[] = [
    { label: "Revenue", est: estimated.revenue, actKey: "actualRevenue", actVal: form.actualRevenue, isRevenue: true },
    { label: "Paint Cost", est: estimated.paint, actKey: "actualPaintCost", actVal: form.actualPaintCost },
    { label: "Materials Cost", est: estimated.material, actKey: "actualMaterialCost", actVal: form.actualMaterialCost },
    { label: "Labor Cost", est: form.estLabor, estKey: "estLabor", actKey: "actualLaborCost", actVal: form.actualLaborCost },
  ];

  const numInput = (key: keyof typeof form, value: number) => (
    <input
      type="number"
      step="any"
      className="input"
      style={{ textAlign: "right", maxWidth: 150, marginLeft: "auto" }}
      value={Number.isFinite(value) ? value : 0}
      onFocus={(e) => e.target.select()}
      onChange={(e) => set(key, parseFloat(e.target.value) || 0)}
    />
  );

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
            {pending ? <LoadingSpinner size={16} /> : dirty ? "Save" : "Saved ✓"}
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
                const diff = r.actVal - r.est;
                const favorable = r.isRevenue ? diff >= 0 : diff <= 0;
                const color = diff === 0 ? "var(--text-dim)" : favorable ? "var(--accent)" : "#f87171";
                return (
                  <tr key={r.label}>
                    <td style={{ fontWeight: 600 }}>{r.label}</td>
                    <td style={{ textAlign: "right", maxWidth: 160 }}>
                      {r.estKey ? numInput(r.estKey, form.estLabor) : <span style={{ color: "var(--text-dim)" }}>{formatCurrency(r.est)}</span>}
                    </td>
                    <td style={{ textAlign: "right", maxWidth: 160 }}>{numInput(r.actKey, r.actVal)}</td>
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
            <p style={{ fontSize: 12.5, color: "var(--text-dim)", margin: "0 0 12px" }}>
              Revenue, Paint, and Materials are auto-figured from the estimate (paint &amp; materials at your
              cost). Enter your <strong>expected labor</strong> now; fill the <strong>Actual</strong> column once the job is complete.
            </p>
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
