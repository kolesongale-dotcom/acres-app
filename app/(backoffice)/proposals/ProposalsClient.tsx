"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import Modal from "@/components/Modal";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useToast } from "@/components/Toast";
import { generateProposal } from "@/lib/actions/proposals";
import { createEstimate } from "@/lib/actions/estimates";
import { PROPOSAL_STATUSES } from "@/lib/types";
import { formatCurrency } from "@/lib/calculations";
import { formatDate } from "@/lib/format";

export interface ProposalRow {
  id: number;
  proposalNumber: string;
  estimateNumber: string;
  client: string;
  project: string;
  status: string;
  total: number;
  sentAt: string | null;
}

export interface EligibleEstimate {
  id: number;
  label: string;
  total: number;
}

export default function ProposalsClient({
  proposals,
  eligibleEstimates,
}: {
  proposals: ProposalRow[];
  eligibleEstimates: EligibleEstimate[];
}) {
  const router = useRouter();
  const { success, error } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [estimateId, setEstimateId] = useState<string>("");
  const [pending, start] = useTransition();

  const filtered = useMemo(
    () => proposals.filter((p) => statusFilter === "all" || p.status === statusFilter),
    [proposals, statusFilter]
  );

  function createForEstimate() {
    if (!estimateId) {
      error("Pick an estimate first.");
      return;
    }
    start(async () => {
      const res = await generateProposal(parseInt(estimateId, 10));
      if (res.success && res.data) {
        success("Proposal created.");
        router.push(`/proposals/${res.data.id}`);
      } else if (!res.success) {
        error(res.error);
      }
    });
  }

  function newEstimateThenProposal() {
    start(async () => {
      const res = await createEstimate(null);
      if (res.success && res.data) {
        router.push(`/estimates/${res.data.id}`);
      } else if (!res.success) {
        error(res.error);
      }
    });
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 18, alignItems: "center" }}>
        <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="all">All Statuses</option>
          {PROPOSAL_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <div style={{ marginLeft: "auto" }}>
          <button className="btn btn-primary" onClick={() => setOpen(true)}>+ New Proposal</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <EmptyState
            icon="✎"
            title="No proposals"
            description="Create one from an estimate below, or from any estimate's Summary tab."
            action={<button className="btn btn-primary" onClick={() => setOpen(true)}>+ New Proposal</button>}
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Proposal #</th>
                <th>Estimate #</th>
                <th>Client</th>
                <th>Project</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Grand Total</th>
                <th>Sent</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="row-link" onClick={() => router.push(`/proposals/${p.id}`)}>
                  <td style={{ color: "var(--text-muted)", fontWeight: 600 }}>{p.proposalNumber}</td>
                  <td style={{ color: "var(--text-dim)" }}>{p.estimateNumber}</td>
                  <td style={{ fontWeight: 600 }}>{p.client}</td>
                  <td style={{ color: "var(--text-dim)" }}>{p.project || "Untitled"}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td style={{ textAlign: "right", color: "var(--accent)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                    {formatCurrency(p.total)}
                  </td>
                  <td style={{ color: "var(--text-dim)" }}>{p.sentAt ? formatDate(p.sentAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New Proposal"
        width={520}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={createForEstimate} disabled={pending || eligibleEstimates.length === 0}>
              {pending ? <LoadingSpinner size={16} /> : "Create Proposal"}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13.5, color: "var(--text-secondary)", marginTop: 0, lineHeight: 1.6 }}>
          A proposal is generated from an estimate (it pulls in the scope, totals, and tiers).
          Pick an estimate that doesn&apos;t have a proposal yet:
        </p>
        {eligibleEstimates.length === 0 ? (
          <div style={{ padding: "14px 0" }}>
            <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
              Every estimate already has a proposal. Create a new estimate first, then generate its proposal from the Summary tab.
            </p>
            <button className="btn btn-secondary" onClick={newEstimateThenProposal} disabled={pending}>
              {pending ? <LoadingSpinner size={16} /> : "+ New Estimate"}
            </button>
          </div>
        ) : (
          <>
            <label className="label">Estimate</label>
            <select className="select" value={estimateId} onChange={(e) => setEstimateId(e.target.value)} autoFocus>
              <option value="">— Select an estimate —</option>
              {eligibleEstimates.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label} — {formatCurrency(e.total)}
                </option>
              ))}
            </select>
            <p style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 12 }}>
              Don&apos;t see the right one? <span style={{ color: "var(--text-muted)" }}>Create a new estimate</span> and generate its proposal from the Summary tab.
            </p>
          </>
        )}
      </Modal>
    </div>
  );
}
