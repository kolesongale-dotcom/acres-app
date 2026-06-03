"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { createEstimate, deleteEstimate } from "@/lib/actions/estimates";
import { ESTIMATE_STATUSES } from "@/lib/types";
import { formatCurrency } from "@/lib/calculations";
import { formatDate } from "@/lib/format";

export interface EstimateRow {
  id: number;
  estimateNumber: string;
  projectName: string;
  customer: string;
  status: string;
  total: number;
  createdAt: string;
}

export default function EstimatesClient({ estimates }: { estimates: EstimateRow[] }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [pending, start] = useTransition();
  const [creating, setCreating] = useState(false);
  const [delId, setDelId] = useState<number | null>(null);

  const filtered = useMemo(
    () =>
      estimates.filter((e) => statusFilter === "all" || e.status === statusFilter),
    [estimates, statusFilter]
  );

  function create() {
    setCreating(true);
    start(async () => {
      const res = await createEstimate(null);
      if (res.success && res.data) router.push(`/estimates/${res.data.id}`);
      else if (!res.success) {
        error(res.error);
        setCreating(false);
      }
    });
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 18, alignItems: "center" }}>
        <select
          className="select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ maxWidth: 200 }}
        >
          <option value="all">All Statuses</option>
          {ESTIMATE_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <div style={{ marginLeft: "auto" }}>
          <button className="btn btn-primary" onClick={create} disabled={pending}>
            {creating ? <LoadingSpinner size={16} /> : "+ New Estimate"}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <EmptyState
            icon="▤"
            title="No estimates"
            description="Create a new estimate to start building a quote."
            action={
              <button className="btn btn-primary" onClick={create} disabled={pending}>
                + New Estimate
              </button>
            }
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Estimate #</th>
                <th>Project</th>
                <th>Customer</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Grand Total</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="row-link" onClick={() => router.push(`/estimates/${e.id}`)}>
                  <td style={{ color: "var(--text-muted)", fontWeight: 600 }}>{e.estimateNumber}</td>
                  <td style={{ fontWeight: 600 }}>{e.projectName || "Untitled"}</td>
                  <td style={{ color: "var(--text-dim)" }}>{e.customer}</td>
                  <td><StatusBadge status={e.status} /></td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--accent)", fontWeight: 600 }}>
                    {formatCurrency(e.total)}
                  </td>
                  <td style={{ color: "var(--text-dim)" }}>{formatDate(e.createdAt)}</td>
                  <td onClick={(ev) => ev.stopPropagation()} style={{ textAlign: "right" }}>
                    <button className="btn btn-icon btn-danger btn-sm" onClick={() => setDelId(e.id)} title="Delete">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={delId !== null}
        title="Delete estimate?"
        message="This permanently deletes the estimate, its rooms, line items, and any linked proposal and budget entry."
        confirmLabel="Delete"
        danger
        onCancel={() => setDelId(null)}
        onConfirm={async () => {
          if (delId === null) return;
          const res = await deleteEstimate(delId);
          if (res.success) success("Estimate deleted."); else error(res.error);
          setDelId(null);
          router.refresh();
        }}
      />
    </div>
  );
}
