"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { formatCurrency } from "@/lib/calculations";
import { formatDate } from "@/lib/format";
import { invoiceStatus, INVOICE_STATUS_COLOR } from "@/lib/invoiceStatus";
import { updateInvoice, addPayment, deletePayment, deleteInvoice } from "@/lib/actions/invoices";
import { createZohoInvoiceDraft } from "@/lib/actions/zoho";

interface Payment { id: number; amount: number; paidAt: string; note: string }
interface Invoice {
  id: number; number: string; tierLabel: string; subtotal: number; total: number;
  dueDate: string; notes: string; estimateId: number; proposalId: number | null;
  lineItems: { name: string; total: number }[]; payments: Payment[];
}

function todayInput() { return new Date().toISOString().slice(0, 10); }

export default function InvoiceDetail({
  invoice, client, clientEmail, project, companyName, zohoConnected, zohoDraftsUrl,
}: {
  invoice: Invoice; client: string; clientEmail: string; project: string;
  companyName: string; zohoConnected: boolean; zohoDraftsUrl: string;
}) {
  const router = useRouter();
  const { success, error } = useToast();
  const [, start] = useTransition();

  const [dueDate, setDueDate] = useState(invoice.dueDate.slice(0, 10));
  const [notes, setNotes] = useState(invoice.notes);
  const [metaDirty, setMetaDirty] = useState(false);

  const [payAmount, setPayAmount] = useState<number>(0);
  const [payDate, setPayDate] = useState(todayInput());
  const [payNote, setPayNote] = useState("");

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [zohoBusy, setZohoBusy] = useState(false);
  const [zohoDrafted, setZohoDrafted] = useState(false);

  const paid = invoice.payments.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, invoice.total - paid);
  const discount = Math.max(0, invoice.subtotal - invoice.total);
  const status = invoiceStatus(invoice.total, paid, invoice.dueDate);
  const c = INVOICE_STATUS_COLOR[status];

  function saveMeta() {
    start(async () => {
      const res = await updateInvoice(invoice.id, { dueDate, notes });
      if (res.success) { success("Invoice updated."); setMetaDirty(false); router.refresh(); }
      else error(res.error);
    });
  }

  function recordPayment() {
    if (!(payAmount > 0)) { error("Enter an amount greater than 0."); return; }
    start(async () => {
      const res = await addPayment(invoice.id, { amount: payAmount, paidAt: payDate, note: payNote });
      if (res.success) { success("Payment recorded."); setPayAmount(0); setPayNote(""); setPayDate(todayInput()); router.refresh(); }
      else error(res.error);
    });
  }

  function removePayment(id: number) {
    start(async () => {
      const res = await deletePayment(id, invoice.id);
      if (res.success) { success("Payment removed."); router.refresh(); } else error(res.error);
    });
  }

  const subject = `Invoice ${invoice.number} — ${project}`;
  const emailBody =
    `Hi ${client},\n\n` +
    `Please find your invoice (${invoice.number}) attached for ${project}.\n\n` +
    `Total due: ${formatCurrency(invoice.total)}\n` +
    (paid > 0 ? `Paid to date: ${formatCurrency(paid)}\nBalance remaining: ${formatCurrency(remaining)}\n` : "") +
    `Due by: ${formatDate(invoice.dueDate)}\n\n` +
    `Thank you for your business!\n\n${companyName}`;
  const mailtoHref = `mailto:${encodeURIComponent(clientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;

  async function draftToZoho() {
    setZohoBusy(true);
    const res = await createZohoInvoiceDraft({ invoiceId: invoice.id, to: clientEmail, subject, body: emailBody });
    setZohoBusy(false);
    if (res.success) { setZohoDrafted(true); success(res.data?.attached ? "Draft created in Zoho with the invoice PDF attached." : "Draft created in Zoho (attach the PDF manually)."); }
    else error(res.error);
  }

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <Link href="/invoices" className="btn btn-ghost btn-sm" style={{ paddingLeft: 0 }}>← All Invoices</Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 className="page-title">{invoice.number}</h1>
            <span style={{ fontSize: 12.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: c.bg, color: c.fg }}>{status}</span>
          </div>
          <p style={{ color: "var(--text-dim)", margin: "8px 0 0" }}>
            {client} · {project} ·{" "}
            <Link href={`/estimates/${invoice.estimateId}`} style={{ color: "var(--text-muted)" }}>estimate</Link>
            {invoice.proposalId ? <> · <Link href={`/proposals/${invoice.proposalId}`} style={{ color: "var(--text-muted)" }}>proposal</Link></> : null}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a className="btn btn-secondary" href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">↓ PDF</a>
          {zohoConnected ? (
            <button className="btn btn-primary" onClick={draftToZoho} disabled={zohoBusy || !clientEmail} title={clientEmail ? "Create a draft in your Zoho mailbox" : "No client email on file"}>
              {zohoBusy ? <LoadingSpinner size={16} /> : zohoDrafted ? "Drafted ✓ — again" : "✉ Draft to Zoho"}
            </button>
          ) : (
            <Link href="/settings" className="btn btn-secondary" title="Connect Zoho Mail in Settings">Connect Zoho</Link>
          )}
          {zohoDrafted && <a href={zohoDraftsUrl} target="_blank" rel="noreferrer" className="btn btn-ghost">Open Zoho Drafts ↗</a>}
          <a className="btn btn-ghost" href={mailtoHref} title="Open your default mail app">Mail app</a>
          <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>Delete</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Line items */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="data-table">
              <thead><tr><th>Summary of Work</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
              <tbody>
                {invoice.lineItems.map((li, i) => (
                  <tr key={i}><td>{li.name}</td><td style={{ textAlign: "right" }}>{formatCurrency(li.total)}</td></tr>
                ))}
                {discount > 0 && (
                  <>
                    <tr><td style={{ color: "var(--text-dim)" }}>Subtotal</td><td style={{ textAlign: "right", color: "var(--text-dim)" }}>{formatCurrency(invoice.subtotal)}</td></tr>
                    <tr><td style={{ color: "var(--accent)" }}>Deposit discount ({invoice.tierLabel})</td><td style={{ textAlign: "right", color: "var(--accent)" }}>− {formatCurrency(discount)}</td></tr>
                  </>
                )}
                <tr style={{ borderTop: "2px solid var(--border)" }}>
                  <td style={{ fontWeight: 800 }}>Total Due</td>
                  <td style={{ textAlign: "right", fontWeight: 800, fontSize: 16 }}>{formatCurrency(invoice.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Payments */}
          <div className="card">
            <h2 className="section-title" style={{ marginBottom: 14 }}>Payments</h2>
            {invoice.payments.length === 0 ? (
              <p style={{ color: "var(--text-dim)", fontSize: 14, margin: "0 0 16px" }}>No payments recorded yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {invoice.payments.map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--bg-secondary)", border: "1px solid var(--border-light)", borderRadius: 9 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{formatCurrency(p.amount)}</div>
                      <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{formatDate(p.paidAt)}{p.note ? ` · ${p.note}` : ""}</div>
                    </div>
                    <button className="btn btn-icon btn-ghost btn-sm" title="Remove payment" onClick={() => removePayment(p.id)}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div><label className="label">Amount</label><input type="number" step="any" className="input" style={{ width: 120 }} value={payAmount || ""} placeholder="0.00" onFocus={(e) => e.target.select()} onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)} /></div>
              <div><label className="label">Date</label><input type="date" className="input" style={{ width: 160 }} value={payDate} onChange={(e) => setPayDate(e.target.value)} /></div>
              <div style={{ flex: 1, minWidth: 140 }}><label className="label">Note (e.g. deposit)</label><input className="input" value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Deposit, check #…" /></div>
              <button className="btn btn-primary" onClick={recordPayment}>+ Record</button>
            </div>
          </div>

          {/* Notes */}
          <div className="card">
            <h2 className="section-title" style={{ marginBottom: 12 }}>Invoice Notes</h2>
            <textarea className="textarea" style={{ minHeight: 90 }} value={notes} placeholder="Payment terms, instructions…" onChange={(e) => { setNotes(e.target.value); setMetaDirty(true); }} />
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <h2 className="section-title" style={{ marginBottom: 14 }}>Summary</h2>
            <Row label="Total Due" value={formatCurrency(invoice.total)} bold />
            <Row label="Paid" value={formatCurrency(paid)} accent={paid > 0} />
            <div style={{ borderTop: "1px solid var(--border-light)", margin: "8px 0", paddingTop: 8 }}>
              <Row label="Balance Remaining" value={formatCurrency(remaining)} bold danger={remaining > 0} />
            </div>
          </div>
          <div className="card">
            <h2 className="section-title" style={{ marginBottom: 12 }}>Payment Due Date</h2>
            <input type="date" className="input" value={dueDate} onChange={(e) => { setDueDate(e.target.value); setMetaDirty(true); }} />
            <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} disabled={!metaDirty} onClick={saveMeta}>
              {metaDirty ? "Save Changes" : "Saved ✓"}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete invoice?"
        message="This permanently deletes the invoice and its recorded payments. The estimate and proposal are not affected."
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          const res = await deleteInvoice(invoice.id);
          if (res.success) { success("Invoice deleted."); router.push("/invoices"); }
          else { error(res.error); setConfirmDelete(false); }
        }}
      />
    </div>
  );
}

function Row({ label, value, bold, accent, danger }: { label: string; value: string; bold?: boolean; accent?: boolean; danger?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 0" }}>
      <span style={{ fontSize: 13.5, color: "var(--text-dim)" }}>{label}</span>
      <span style={{ fontWeight: bold ? 800 : 600, fontSize: bold ? 16 : 14, color: danger ? "#f87171" : accent ? "var(--accent)" : "var(--text-primary)" }}>{value}</span>
    </div>
  );
}
