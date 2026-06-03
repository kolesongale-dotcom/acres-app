"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import LoadingSpinner from "@/components/LoadingSpinner";
import ConfirmDialog from "@/components/ConfirmDialog";
import TotalsPanel from "@/components/TotalsPanel";
import { useToast } from "@/components/Toast";
import {
  setProposalStatus,
  updateProposalTier,
  updateProposalSOPs,
  updateProposalNotes,
  markProposalSent,
  deleteProposal,
} from "@/lib/actions/proposals";
import { createZohoDraft } from "@/lib/actions/zoho";
import { PROPOSAL_STATUSES } from "@/lib/types";
import { Totals, TierPricing, formatCurrency } from "@/lib/calculations";
import { formatDateTime } from "@/lib/format";

interface Procedure { id: number; category: string; title: string; description: string }

export default function ProposalDetail({
  proposal,
  estimate,
  totals,
  tiers,
  procedures,
  emailTemplate,
  zohoConnected,
  zohoDraftsUrl,
  photos,
  signUrl,
}: {
  proposal: {
    id: number;
    proposalNumber: string;
    status: string;
    selectedTier: string;
    customNotes: string;
    includedSOPs: number[];
    signatureData: string;
    signatureName: string;
    signedAt: string | null;
    sentAt: string | null;
  };
  estimate: { id: number; estimateNumber: string; projectName: string; client: string; clientEmail: string };
  totals: Totals;
  tiers: TierPricing;
  procedures: Procedure[];
  emailTemplate: string;
  zohoConnected: boolean;
  zohoDraftsUrl: string;
  photos: { url: string; caption: string }[];
  signUrl: string;
}) {
  const router = useRouter();
  const { success, error } = useToast();
  const [, start] = useTransition();
  const [status, setStatus] = useState(proposal.status);
  const [tier, setTier] = useState(proposal.selectedTier);
  const [sops, setSops] = useState<number[]>(proposal.includedSOPs);
  const [notes, setNotes] = useState(proposal.customNotes);
  const [notesDirty, setNotesDirty] = useState(false);
  const [confirm, setConfirm] = useState<null | "Accepted" | "Rejected" | "delete">(null);
  const [copied, setCopied] = useState(false);

  // Pull the client + project name off the estimate and fill the template's
  // [Client Name] / [Project Name] placeholders so the email is ready to send.
  const projectName = estimate.projectName || "Your Project";
  const clientName = estimate.client && estimate.client !== "—" ? estimate.client : "there";

  function fillTemplate(text: string): string {
    return text
      .replace(/\[client name\]/gi, clientName)
      .replace(/\[project name\]/gi, projectName);
  }

  const subject = `Your Acres Painting Co. Proposal – ${projectName}`;
  // The stored template begins with its own "Subject:" line — strip it for the
  // body shown/copied, and use the rest (placeholders filled) as the email body.
  const filledFull = fillTemplate(emailTemplate);
  const baseBody = filledFull.replace(/^subject:.*\n?/i, "").replace(/^\s*\n/, "");
  const filledBody = signUrl
    ? `${baseBody}\n\n— — —\nReview your options, choose a deposit tier, and sign your proposal online here:\n${signUrl}\n`
    : baseBody;
  const mailtoHref = `mailto:${encodeURIComponent(estimate.clientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(filledBody)}`;

  function changeStatus(next: string) {
    if (next === "Accepted" || next === "Rejected") {
      setConfirm(next);
      return;
    }
    applyStatus(next);
  }

  function applyStatus(next: string) {
    setStatus(next);
    start(async () => {
      const res = await setProposalStatus(proposal.id, next);
      if (res.success) success(`Marked ${next}.`);
      else error(res.error);
      router.refresh();
    });
  }

  function changeTier(next: string) {
    setTier(next);
    start(async () => {
      await updateProposalTier(proposal.id, next);
      router.refresh();
    });
  }

  function toggleSop(id: number) {
    const next = sops.includes(id) ? sops.filter((x) => x !== id) : [...sops, id];
    setSops(next);
    start(async () => {
      await updateProposalSOPs(proposal.id, next);
    });
  }

  function saveNotes() {
    start(async () => {
      const res = await updateProposalNotes(proposal.id, notes);
      if (res.success) { success("Notes saved."); setNotesDirty(false); }
      else error(res.error);
    });
  }

  function copyEmail() {
    navigator.clipboard.writeText(filledBody).then(() => {
      setCopied(true);
      success("Email text copied (placeholders filled).");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const [zohoBusy, setZohoBusy] = useState(false);
  const [zohoDrafted, setZohoDrafted] = useState(false);

  async function draftToZoho() {
    setZohoBusy(true);
    const res = await createZohoDraft({ proposalId: proposal.id, to: estimate.clientEmail, subject, body: filledBody });
    setZohoBusy(false);
    if (res.success) {
      setZohoDrafted(true);
      success(res.data?.attached
        ? "Draft created in Zoho with the proposal PDF attached — review & send."
        : "Draft created in Zoho (PDF attach failed — attach manually). Review & send.");
    } else {
      error(res.error);
    }
  }

  const tierData = [
    { key: "full", label: tiers.full.label, total: tiers.full.total, deposit: 0, savings: 0 },
    { key: "mid", label: `${tiers.mid.depositPercent}% Deposit`, total: tiers.mid.total, deposit: tiers.mid.deposit, savings: tiers.mid.savings },
    { key: "max", label: `${tiers.max.depositPercent}% Deposit`, total: tiers.max.total, deposit: tiers.max.deposit, savings: tiers.max.savings },
  ];

  const grouped = procedures.reduce<Record<string, Procedure[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <Link href="/proposals" className="btn btn-ghost btn-sm" style={{ paddingLeft: 0 }}>← All Proposals</Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 className="page-title">{estimate.projectName || "Proposal"}</h1>
            <StatusBadge status={status} />
          </div>
          <p style={{ color: "var(--text-dim)", margin: "8px 0 0" }}>
            {proposal.proposalNumber} · {estimate.client} ·{" "}
            <Link href={`/estimates/${estimate.id}`} style={{ color: "var(--text-muted)" }}>{estimate.estimateNumber}</Link>
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <a href={`/proposals/${proposal.id}/sign`} target="_blank" rel="noreferrer" className="btn btn-secondary">
            ↗ View Client Proposal
          </a>
          <button className="btn btn-danger" onClick={() => setConfirm("delete")}>Delete</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Status controls */}
          <div className="card">
            <h2 className="section-title" style={{ marginBottom: 14 }}>Status</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {PROPOSAL_STATUSES.map((s) => (
                <button
                  key={s}
                  className={`btn ${status === s ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => changeStatus(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Tier selection */}
          <div className="card">
            <h2 className="section-title" style={{ marginBottom: 14 }}>Pricing Tier</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {tierData.map((t) => (
                <button
                  key={t.key}
                  onClick={() => changeTier(t.key)}
                  style={{
                    textAlign: "left",
                    background: tier === t.key ? "rgba(34,197,94,0.1)" : "var(--bg-secondary)",
                    border: `1.5px solid ${tier === t.key ? "var(--accent)" : "var(--border)"}`,
                    borderRadius: 10,
                    padding: 14,
                    cursor: "pointer",
                    transition: "all 0.16s ease",
                  }}
                >
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 600 }}>{t.label}</div>
                  <div className="font-display" style={{ fontSize: 22, color: "var(--accent)", margin: "6px 0 2px" }}>
                    {formatCurrency(t.total)}
                  </div>
                  {t.deposit > 0 && <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>Deposit {formatCurrency(t.deposit)}</div>}
                  {t.savings > 0 && <div style={{ fontSize: 11.5, color: "var(--accent)" }}>Save {formatCurrency(t.savings)}</div>}
                </button>
              ))}
            </div>
          </div>

          {/* SOP checklist */}
          <div className="card">
            <h2 className="section-title" style={{ marginBottom: 14 }}>
              Standard Operating Procedures ({sops.length} selected)
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>{cat}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {items.map((p) => {
                      const on = sops.includes(p.id);
                      return (
                        <label key={p.id} style={{
                          display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px",
                          background: on ? "rgba(34,197,94,0.08)" : "var(--bg-secondary)",
                          border: `1px solid ${on ? "var(--accent-muted)" : "var(--border-light)"}`,
                          borderRadius: 8, cursor: "pointer",
                        }}>
                          <input type="checkbox" checked={on} onChange={() => toggleSop(p.id)} style={{ marginTop: 2 }} />
                          <div>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>{p.title}</div>
                            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2, lineHeight: 1.45 }}>{p.description}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
              {procedures.length === 0 && <p style={{ color: "var(--text-dim)", margin: 0 }}>No procedures defined. Add some in Settings.</p>}
            </div>
          </div>

          {/* Project photos (from the estimate) */}
          {photos.length > 0 && (
            <div className="card">
              <h2 className="section-title" style={{ marginBottom: 12 }}>
                Project Photos ({photos.length})
                <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--text-dim)", marginLeft: 8 }}>
                  — shown to the client
                </span>
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                {photos.map((ph, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ph.url} alt={ph.caption || "photo"} style={{ width: "100%", height: 130, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border-light)" }} />
                    {ph.caption && <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.4 }}>{ph.caption}</div>}
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "12px 0 0" }}>
                Manage photos on the <Link href={`/estimates/${estimate.id}`} style={{ color: "var(--text-muted)" }}>estimate&apos;s Photos tab</Link>.
              </p>
            </div>
          )}

          {/* Custom notes */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 className="section-title">Custom Notes</h2>
              <button className="btn btn-primary btn-sm" onClick={saveNotes} disabled={!notesDirty}>
                {notesDirty ? "Save Notes" : "Saved"}
              </button>
            </div>
            <textarea
              className="textarea"
              style={{ minHeight: 120 }}
              placeholder="Notes shown to the client on the proposal…"
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setNotesDirty(true); }}
            />
          </div>

          {/* Email draft */}
          <div className="card">
            <h2 className="section-title" style={{ marginBottom: 12 }}>Email Draft</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label className="label">To</label>
                <input className="input" readOnly value={estimate.clientEmail || "— no email on file —"} />
              </div>
              <div>
                <label className="label">Subject</label>
                <input className="input" readOnly value={subject} />
              </div>
            </div>
            <label className="label">Body (placeholders filled from the estimate)</label>
            <pre style={{
              whiteSpace: "pre-wrap", fontFamily: "var(--font-body)", background: "var(--bg-primary)",
              border: "1px solid var(--border)", borderRadius: 8, padding: 16, fontSize: 13.5, lineHeight: 1.6,
              color: "var(--text-secondary)", maxHeight: 280, overflowY: "auto", margin: 0,
            }}>
              {filledBody}
            </pre>
            <p style={{ fontSize: 12.5, color: "var(--text-dim)", margin: "10px 0 14px" }}>
              Client name and project name are auto-filled from the estimate. Edit the base template in{" "}
              <Link href="/settings" style={{ color: "var(--text-muted)" }}>Settings → Proposal Email</Link>.
              <strong style={{ color: "var(--text-muted)" }}> Draft to Zoho attaches the proposal PDF automatically.</strong>
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              {zohoConnected ? (
                <button className="btn btn-primary" onClick={draftToZoho} disabled={zohoBusy || !estimate.clientEmail} title={estimate.clientEmail ? "Create a draft in your Zoho mailbox" : "No client email on file"}>
                  {zohoBusy ? <LoadingSpinner size={16} /> : zohoDrafted ? "Drafted ✓ — draft again" : "✉ Draft to Zoho"}
                </button>
              ) : (
                <Link href="/settings" className="btn btn-secondary" title="Connect Zoho Mail in Settings">Connect Zoho to draft email</Link>
              )}
              {zohoDrafted && (
                <a href={zohoDraftsUrl} target="_blank" rel="noreferrer" className="btn btn-ghost">Open Zoho Drafts ↗</a>
              )}
              <a className="btn btn-secondary" href={`/api/proposals/${proposal.id}/pdf`} target="_blank" rel="noreferrer">↓ PDF</a>
              <button className="btn btn-secondary" onClick={copyEmail}>{copied ? "Copied ✓" : "Copy Text"}</button>
              <a className="btn btn-ghost" href={mailtoHref} title="Open your default mail app">Mail app</a>
              <button className="btn btn-secondary" style={{ marginLeft: "auto" }} onClick={() => { start(async () => { const r = await markProposalSent(proposal.id); if (r.success) { setStatus("Sent"); success("Marked as Sent."); router.refresh(); } else error(r.error); }); }}>
                Mark as Sent
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <h2 className="section-title" style={{ marginBottom: 14 }}>Totals</h2>
            <TotalsPanel totals={totals} />
          </div>
          <div className="card">
            <h2 className="section-title" style={{ marginBottom: 12 }}>Signature</h2>
            {proposal.signedAt ? (
              <div>
                <p style={{ fontSize: 14, color: "var(--text-primary)", margin: "0 0 4px" }}>
                  Signed by <strong>{proposal.signatureName}</strong>
                </p>
                <p style={{ fontSize: 12.5, color: "var(--text-dim)", margin: 0 }}>{formatDateTime(proposal.signedAt)}</p>
                {proposal.signatureData && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={proposal.signatureData} alt="signature" style={{ marginTop: 12, background: "#fff", borderRadius: 8, maxWidth: "100%", border: "1px solid var(--border)" }} />
                )}
              </div>
            ) : (
              <p style={{ fontSize: 13.5, color: "var(--text-dim)", margin: 0 }}>
                Not yet signed. Share the client proposal link to collect a signature.
              </p>
            )}
          </div>
          {proposal.sentAt && (
            <div className="card card-tight">
              <div className="section-title">Sent</div>
              <div style={{ fontSize: 13.5, color: "var(--text-secondary)", marginTop: 4 }}>{formatDateTime(proposal.sentAt)}</div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirm === "Accepted" || confirm === "Rejected"}
        title={confirm === "Accepted" ? "Accept this proposal?" : "Reject this proposal?"}
        message={
          confirm === "Accepted"
            ? "This marks the proposal and its estimate as Accepted and creates a budget entry."
            : "This marks the proposal and its estimate as Rejected."
        }
        confirmLabel={confirm === "Accepted" ? "Accept" : "Reject"}
        danger={confirm === "Rejected"}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          const next = confirm as string;
          setConfirm(null);
          applyStatus(next);
        }}
      />

      <ConfirmDialog
        open={confirm === "delete"}
        title="Delete proposal?"
        message="This permanently deletes the proposal, including any captured signature. The estimate is not deleted."
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          const res = await deleteProposal(proposal.id);
          if (res.success) { success("Proposal deleted."); router.push("/proposals"); }
          else { error(res.error); setConfirm(null); }
        }}
      />
    </div>
  );
}
