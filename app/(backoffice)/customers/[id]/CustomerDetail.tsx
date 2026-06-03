"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import ConfirmDialog from "@/components/ConfirmDialog";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useToast } from "@/components/Toast";
import { updateCustomer, deleteCustomer } from "@/lib/actions/customers";
import { createEstimate } from "@/lib/actions/estimates";
import { createFollowUp, toggleFollowUp, deleteFollowUp } from "@/lib/actions/followups";
import { CUSTOMER_STATUSES, LEAD_SOURCES } from "@/lib/types";
import { formatDate, toDateInput } from "@/lib/format";
import { formatCurrency as fmt } from "@/lib/calculations";

interface EstimateRow {
  id: number;
  estimateNumber: string;
  projectName: string;
  status: string;
  total: number;
  createdAt: string;
}
interface FollowUp {
  id: number;
  note: string;
  dueDate: string;
  completed: boolean;
}
export interface CustomerData {
  id: number;
  customerNumber: string;
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  leadSource: string;
  status: string;
  notes: string;
  createdAt: string;
}

export default function CustomerDetail({
  customer,
  estimates,
  followUps,
}: {
  customer: CustomerData;
  estimates: EstimateRow[];
  followUps: FollowUp[];
}) {
  const router = useRouter();
  const { success, error } = useToast();
  const [form, setForm] = useState(customer);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [creating, setCreating] = useState(false);

  // Follow-up form
  const [fuNote, setFuNote] = useState("");
  const [fuDate, setFuDate] = useState(toDateInput(new Date()));
  const [fuList, setFuList] = useState(followUps);

  const set = (k: keyof CustomerData, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  function save() {
    startTransition(async () => {
      const res = await updateCustomer(customer.id, form);
      if (res.success) {
        success("Customer saved.");
        setDirty(false);
        router.refresh();
      } else {
        error(res.error);
      }
    });
  }

  function newEstimate() {
    setCreating(true);
    startTransition(async () => {
      const res = await createEstimate(customer.id);
      if (res.success && res.data) {
        router.push(`/estimates/${res.data.id}`);
      } else if (!res.success) {
        error(res.error);
        setCreating(false);
      }
    });
  }

  function addFollowUp() {
    if (!fuDate) {
      error("Pick a due date.");
      return;
    }
    startTransition(async () => {
      const res = await createFollowUp({
        customerId: customer.id,
        dueDate: fuDate,
        note: fuNote,
      });
      if (res.success) {
        success("Follow-up added.");
        setFuNote("");
        router.refresh();
      } else {
        error(res.error);
      }
    });
  }

  function completeFu(id: number) {
    setFuList((l) => l.filter((f) => f.id !== id));
    startTransition(async () => {
      await toggleFollowUp(id, true);
      router.refresh();
    });
  }
  function removeFu(id: number) {
    setFuList((l) => l.filter((f) => f.id !== id));
    startTransition(async () => {
      await deleteFollowUp(id);
      router.refresh();
    });
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link href="/customers" className="btn btn-ghost btn-sm" style={{ paddingLeft: 0 }}>
          ← All Customers
        </Link>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 className="page-title">
              {`${form.firstName} ${form.lastName}`.trim() || form.company || "Customer"}
            </h1>
            <StatusBadge status={form.status} />
          </div>
          <p style={{ color: "var(--text-dim)", margin: "8px 0 0" }}>
            {customer.customerNumber} · Added {formatDate(customer.createdAt)}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-secondary" onClick={newEstimate} disabled={pending}>
            {creating ? <LoadingSpinner size={16} /> : "+ New Estimate"}
          </button>
          <button className="btn btn-primary" onClick={save} disabled={!dirty || pending}>
            {pending && dirty ? <LoadingSpinner size={16} /> : dirty ? "Save Changes" : "Saved"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24, alignItems: "start" }}>
        {/* Contact card */}
        <div className="card">
          <h2 className="section-title" style={{ marginBottom: 16 }}>Contact Details</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <F label="First Name"><input className="input" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} /></F>
            <F label="Last Name"><input className="input" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} /></F>
            <F label="Company" full><input className="input" value={form.company} onChange={(e) => set("company", e.target.value)} /></F>
            <F label="Email"><input className="input" value={form.email} onChange={(e) => set("email", e.target.value)} /></F>
            <F label="Phone"><input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></F>
            <F label="Street" full><input className="input" value={form.street} onChange={(e) => set("street", e.target.value)} /></F>
            <F label="City"><input className="input" value={form.city} onChange={(e) => set("city", e.target.value)} /></F>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <F label="State"><input className="input" value={form.state} onChange={(e) => set("state", e.target.value)} /></F>
              <F label="Zip"><input className="input" value={form.zip} onChange={(e) => set("zip", e.target.value)} /></F>
            </div>
            <F label="Lead Source">
              <select className="select" value={form.leadSource} onChange={(e) => set("leadSource", e.target.value)}>
                {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </F>
            <F label="Status">
              <select className="select" value={form.status} onChange={(e) => set("status", e.target.value)}>
                {CUSTOMER_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
              </select>
            </F>
            <F label="Notes" full><textarea className="textarea" value={form.notes} onChange={(e) => set("notes", e.target.value)} /></F>
          </div>
          <hr className="divider" style={{ margin: "20px 0 16px" }} />
          <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(true)}>
            Delete Customer
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Estimates */}
          <div className="card">
            <h2 className="section-title" style={{ marginBottom: 14 }}>Estimates</h2>
            {estimates.length === 0 ? (
              <p style={{ color: "var(--text-dim)", fontSize: 14, margin: 0 }}>
                No estimates yet for this customer.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {estimates.map((e) => (
                  <Link
                    key={e.id}
                    href={`/estimates/${e.id}`}
                    className="card-hover"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "11px 13px",
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-light)",
                      borderRadius: 9,
                      textDecoration: "none",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>
                        {e.projectName || "Untitled"}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                        {e.estimateNumber} · {fmt(e.total)}
                      </div>
                    </div>
                    <StatusBadge status={e.status} />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Follow-ups */}
          <div className="card">
            <h2 className="section-title" style={{ marginBottom: 14 }}>Follow-Up Reminders</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              {fuList.length === 0 && (
                <p style={{ color: "var(--text-dim)", fontSize: 14, margin: 0 }}>No active reminders.</p>
              )}
              {fuList.map((f) => (
                <div
                  key={f.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-light)",
                    borderRadius: 9,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: "var(--text-primary)" }}>{f.note || "Follow up"}</div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Due {formatDate(f.dueDate)}</div>
                  </div>
                  <button className="btn btn-sm btn-primary" onClick={() => completeFu(f.id)}>✓</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => removeFu(f.id)}>✕</button>
                </div>
              ))}
            </div>
            <hr className="divider" style={{ marginBottom: 14 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input className="input" placeholder="Reminder note…" value={fuNote} onChange={(e) => setFuNote(e.target.value)} />
              <div style={{ display: "flex", gap: 10 }}>
                <input type="date" className="input" value={fuDate} onChange={(e) => setFuDate(e.target.value)} />
                <button className="btn btn-secondary" onClick={addFollowUp} disabled={pending}>Add</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete customer?"
        message="This permanently deletes the customer and unlinks their estimates. This cannot be undone."
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          const res = await deleteCustomer(customer.id);
          if (res.success) {
            success("Customer deleted.");
            router.push("/customers");
          } else {
            error(res.error);
            setConfirmDelete(false);
          }
        }}
      />
    </div>
  );
}

function F({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={full ? { gridColumn: "1 / -1" } : undefined}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
