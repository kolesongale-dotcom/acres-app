"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import ConfirmDialog from "@/components/ConfirmDialog";
import StatusBadge from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { formatCurrency } from "@/lib/calculations";
import { formatDateTime } from "@/lib/format";
import { updateChangeOrder, markChangeOrderSent, deleteChangeOrder } from "@/lib/actions/changeOrders";

interface Line { description: string; amount: number }
interface CO {
  id: number; number: string; estimateId: number; description: string;
  lineItems: Line[]; total: number; status: string; signatureName: string; signedAt: string | null;
}

export default function ChangeOrderDetail({
  co, client, project, signUrl,
}: {
  co: CO; client: string; project: string; signUrl: string;
}) {
  const router = useRouter();
  const { success, error } = useToast();
  const [, start] = useTransition();
  const locked = !!co.signedAt;

  const [description, setDescription] = useState(co.description);
  const [lines, setLines] = useState<Line[]>(co.lineItems.length ? co.lineItems : [{ description: "", amount: 0 }]);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);

  const setLine = (i: number, patch: Partial<Line>) => { setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l))); setDirty(true); };
  const addLine = () => { setLines((ls) => [...ls, { description: "", amount: 0 }]); setDirty(true); };
  const removeLine = (i: number) => { setLines((ls) => ls.filter((_, j) => j !== i)); setDirty(true); };

  function save() {
    start(async () => {
      const res = await updateChangeOrder(co.id, { description, lineItems: lines });
      if (res.success) { success("Change order saved."); setDirty(false); router.refresh(); }
      else error(res.error);
    });
  }
  function markSent() {
    start(async () => {
      const r = await markChangeOrderSent(co.id);
      if (r.success) { success("Marked as Sent."); router.refresh(); } else error(r.error);
    });
  }
  function copyLink() {
    navigator.clipboard.writeText(signUrl).then(() => { setCopied(true); success("Link copied."); setTimeout(() => setCopied(false), 2000); });
  }

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <Link href="/change-orders" className="btn btn-ghost btn-sm" style={{ paddingLeft: 0 }}>← Change Orders</Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 className="page-title">{co.number}</h1>
            <StatusBadge status={co.status} />
          </div>
          <p style={{ color: "var(--text-dim)", margin: "8px 0 0" }}>
            {client} · {project} · <Link href={`/estimates/${co.estimateId}`} style={{ color: "var(--text-muted)" }}>estimate</Link>
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {signUrl && <a href={`/change-orders/${co.id}/sign`} target="_blank" rel="noreferrer" className="btn btn-secondary">↗ View Client Form</a>}
          {!locked && <button className="btn btn-secondary" onClick={markSent} disabled={co.status === "Sent"}>Mark as Sent</button>}
          <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>Delete</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card">
            <h2 className="section-title" style={{ marginBottom: 12 }}>Description</h2>
            <textarea className="textarea" style={{ minHeight: 70 }} value={description} disabled={locked} placeholder="What's changing and why…" onChange={(e) => { setDescription(e.target.value); setDirty(true); }} />
          </div>

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 className="section-title">Additional Work</h2>
              {!locked && <button className="btn btn-secondary btn-sm" onClick={addLine}>+ Line</button>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {lines.map((l, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input className="input" style={{ flex: 1 }} value={l.description} disabled={locked} placeholder="Description (e.g. Paint added closet)" onChange={(e) => setLine(i, { description: e.target.value })} />
                  <input className="input" type="number" step="any" style={{ width: 130, textAlign: "right" }} value={l.amount || ""} disabled={locked} placeholder="0.00" onFocus={(e) => e.target.select()} onChange={(e) => setLine(i, { amount: parseFloat(e.target.value) || 0 })} />
                  {!locked && <button className="btn btn-icon btn-danger btn-sm" onClick={() => removeLine(i)}>✕</button>}
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 10, marginBottom: 0 }}>Use a negative amount for a credit. This total adds to the job&apos;s invoice when included.</p>
          </div>
        </div>

        <div style={{ position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span className="section-title">Change Order Total</span>
              <span className="font-display" style={{ fontSize: 24, color: "var(--accent)" }}>{formatCurrency(total)}</span>
            </div>
            {!locked && (
              <button className="btn btn-primary" style={{ width: "100%", marginTop: 14 }} onClick={save} disabled={!dirty}>{dirty ? "Save" : "Saved ✓"}</button>
            )}
          </div>

          {signUrl ? (
            <div className="card">
              <h2 className="section-title" style={{ marginBottom: 8 }}>Client Sign Link</h2>
              <div style={{ fontSize: 12.5, color: "var(--accent)", wordBreak: "break-all", marginBottom: 10 }}>{signUrl}</div>
              <button className="btn btn-secondary btn-sm" onClick={copyLink}>{copied ? "Copied ✓" : "Copy Link"}</button>
            </div>
          ) : (
            <div className="card card-tight">
              <div className="section-title">Client Sign Link</div>
              <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "6px 0 0" }}>Set a Public Base URL in <Link href="/settings" style={{ color: "var(--text-muted)" }}>Settings</Link> to generate a signable link.</p>
            </div>
          )}

          <div className="card card-tight">
            <div className="section-title">Signature</div>
            {co.signedAt ? (
              <p style={{ fontSize: 13.5, color: "var(--text-secondary)", margin: "6px 0 0" }}>Signed by <strong>{co.signatureName}</strong> on {formatDateTime(co.signedAt)}.</p>
            ) : (
              <p style={{ fontSize: 13.5, color: "var(--text-dim)", margin: "6px 0 0" }}>Not yet signed.</p>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete change order?"
        message="This permanently deletes the change order. The estimate and any invoice are not affected."
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          const res = await deleteChangeOrder(co.id);
          if (res.success) { success("Change order deleted."); router.push("/change-orders"); }
          else { error(res.error); setConfirmDelete(false); }
        }}
      />
    </div>
  );
}
