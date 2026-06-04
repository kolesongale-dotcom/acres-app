"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useToast } from "@/components/Toast";
import { createChangeOrder } from "@/lib/actions/changeOrders";

export default function NewChangeOrder({ jobs }: { jobs: { estimateId: number; label: string }[] }) {
  const router = useRouter();
  const { error } = useToast();
  const [open, setOpen] = useState(false);
  const [estimateId, setEstimateId] = useState<number | "">("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!estimateId) { error("Pick a job."); return; }
    setBusy(true);
    const res = await createChangeOrder(Number(estimateId));
    setBusy(false);
    if (res.success && res.data) router.push(`/change-orders/${res.data.id}`);
    else if (!res.success) error(res.error);
  }

  if (!open) {
    return <button className="btn btn-primary" onClick={() => setOpen(true)} disabled={jobs.length === 0}>+ New Change Order</button>;
  }
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <select className="select" style={{ minWidth: 260 }} value={estimateId} onChange={(e) => setEstimateId(e.target.value ? Number(e.target.value) : "")}>
        <option value="">— Select a job —</option>
        {jobs.map((j) => <option key={j.estimateId} value={j.estimateId}>{j.label}</option>)}
      </select>
      <button className="btn btn-primary" onClick={create} disabled={busy}>{busy ? <LoadingSpinner size={16} /> : "Create"}</button>
      <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
    </div>
  );
}
