"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useToast } from "@/components/Toast";
import { buildInvoice } from "@/lib/actions/invoices";

interface PropOpt { id: number; estimateId: number; label: string }
interface CoOpt { id: number; estimateId: number; label: string }

export default function NewInvoice({ proposals, changeOrders }: { proposals: PropOpt[]; changeOrders: CoOpt[] }) {
  const router = useRouter();
  const { error } = useToast();
  const [open, setOpen] = useState(false);
  const [proposalId, setProposalId] = useState<number | "">("");
  const [coId, setCoId] = useState<number | "">("");
  const [busy, setBusy] = useState(false);

  // Only change orders belonging to the selected proposal's job.
  const eligibleCOs = useMemo(() => {
    const p = proposals.find((x) => x.id === proposalId);
    return p ? changeOrders.filter((c) => c.estimateId === p.estimateId) : [];
  }, [proposalId, proposals, changeOrders]);

  async function build() {
    if (!proposalId) { error("Pick a proposal."); return; }
    setBusy(true);
    const res = await buildInvoice(Number(proposalId), coId ? Number(coId) : null);
    setBusy(false);
    if (res.success && res.data) router.push(`/invoices/${res.data.id}`);
    else if (!res.success) error(res.error);
  }

  if (!open) {
    return <button className="btn btn-primary" onClick={() => setOpen(true)} disabled={proposals.length === 0}>+ New Invoice</button>;
  }
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <select className="select" style={{ minWidth: 220 }} value={proposalId} onChange={(e) => { setProposalId(e.target.value ? Number(e.target.value) : ""); setCoId(""); }}>
        <option value="">— Proposal —</option>
        {proposals.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      <select className="select" style={{ minWidth: 180 }} value={coId} onChange={(e) => setCoId(e.target.value ? Number(e.target.value) : "")} disabled={!proposalId}>
        <option value="">No change order</option>
        {eligibleCOs.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <button className="btn btn-primary" onClick={build} disabled={busy}>{busy ? <LoadingSpinner size={16} /> : "Build"}</button>
      <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
    </div>
  );
}
