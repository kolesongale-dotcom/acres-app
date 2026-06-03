"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Modal from "@/components/Modal";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useToast } from "@/components/Toast";
import { createCustomer } from "@/lib/actions/customers";
import { CUSTOMER_STATUSES, LEAD_SOURCES } from "@/lib/types";
import { formatDate } from "@/lib/format";

export interface CustomerRow {
  id: number;
  customerNumber: string;
  firstName: string;
  lastName: string;
  company: string;
  phone: string;
  email: string;
  leadSource: string;
  status: string;
  createdAt: string;
  estimateCount: number;
}

const BLANK = {
  firstName: "",
  lastName: "",
  company: "",
  email: "",
  phone: "",
  street: "",
  city: "",
  state: "PA",
  zip: "",
  leadSource: "Unknown",
  status: "lead",
  notes: "",
};

export default function CustomersClient({ customers }: { customers: CustomerRow[] }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!q) return true;
      const hay = `${c.firstName} ${c.lastName} ${c.company} ${c.email}`.toLowerCase();
      return hay.includes(q);
    });
  }, [customers, search, statusFilter]);

  function submit() {
    startTransition(async () => {
      const res = await createCustomer(form);
      if (res.success && res.data) {
        success("Customer created.");
        setOpen(false);
        setForm(BLANK);
        router.push(`/customers/${res.data.id}`);
      } else if (!res.success) {
        error(res.error);
      }
    });
  }

  const set = (k: keyof typeof BLANK, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 18,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          className="input"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <select
          className="select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ maxWidth: 180 }}
        >
          <option value="all">All Statuses</option>
          {CUSTOMER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <div style={{ marginLeft: "auto" }}>
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            + New Customer
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <EmptyState
            icon="◉"
            title="No customers found"
            description={
              customers.length === 0
                ? "Add your first lead to get started."
                : "Try adjusting your search or filter."
            }
            action={
              <button className="btn btn-primary" onClick={() => setOpen(true)}>
                + New Customer
              </button>
            }
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer #</th>
                <th>Name</th>
                <th>Company</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Lead Source</th>
                <th>Status</th>
                <th>Created</th>
                <th>Estimates</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="row-link"
                  onClick={() => router.push(`/customers/${c.id}`)}
                >
                  <td style={{ color: "var(--text-muted)", fontWeight: 600 }}>
                    {c.customerNumber}
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {`${c.firstName} ${c.lastName}`.trim() || "—"}
                  </td>
                  <td style={{ color: "var(--text-dim)" }}>{c.company || "—"}</td>
                  <td style={{ color: "var(--text-dim)" }}>{c.phone || "—"}</td>
                  <td style={{ color: "var(--text-dim)" }}>{c.email || "—"}</td>
                  <td style={{ color: "var(--text-dim)" }}>{c.leadSource}</td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                  <td style={{ color: "var(--text-dim)" }}>{formatDate(c.createdAt)}</td>
                  <td style={{ color: "var(--text-dim)" }}>{c.estimateCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New Customer"
        width={620}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={submit} disabled={pending}>
              {pending ? <LoadingSpinner size={16} /> : "Create Customer"}
            </button>
          </>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="First Name">
            <input className="input" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
          </Field>
          <Field label="Last Name">
            <input className="input" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
          </Field>
          <Field label="Company" full>
            <input className="input" value={form.company} onChange={(e) => set("company", e.target.value)} />
          </Field>
          <Field label="Email">
            <input className="input" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Phone">
            <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Street" full>
            <input className="input" value={form.street} onChange={(e) => set("street", e.target.value)} />
          </Field>
          <Field label="City">
            <input className="input" value={form.city} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="State">
              <input className="input" value={form.state} onChange={(e) => set("state", e.target.value)} />
            </Field>
            <Field label="Zip">
              <input className="input" value={form.zip} onChange={(e) => set("zip", e.target.value)} />
            </Field>
          </div>
          <Field label="Lead Source">
            <select className="select" value={form.leadSource} onChange={(e) => set("leadSource", e.target.value)}>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select className="select" value={form.status} onChange={(e) => set("status", e.target.value)}>
              {CUSTOMER_STATUSES.map((s) => (
                <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </Field>
          <Field label="Notes" full>
            <textarea className="textarea" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div style={full ? { gridColumn: "1 / -1" } : undefined}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
