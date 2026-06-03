"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toggleFollowUp, deleteFollowUp } from "@/lib/actions/followups";
import { useToast } from "@/components/Toast";
import { formatDate, daysSince } from "@/lib/format";

export interface FollowUpRow {
  id: number;
  note: string;
  dueDate: string;
  customerId: number;
  customerName: string;
  estimateId: number | null;
}

export default function FollowUpList({ items }: { items: FollowUpRow[] }) {
  const [rows, setRows] = useState(items);
  const [, startTransition] = useTransition();
  const { success, error } = useToast();

  function complete(id: number) {
    setRows((r) => r.filter((x) => x.id !== id));
    startTransition(async () => {
      const res = await toggleFollowUp(id, true);
      if (res.success) success("Follow-up completed.");
      else error(res.error);
    });
  }

  function dismiss(id: number) {
    setRows((r) => r.filter((x) => x.id !== id));
    startTransition(async () => {
      const res = await deleteFollowUp(id);
      if (res.success) success("Follow-up dismissed.");
      else error(res.error);
    });
  }

  if (rows.length === 0) {
    return (
      <p style={{ color: "var(--text-dim)", fontSize: 14, margin: "8px 0 0" }}>
        No open follow-ups. You&apos;re all caught up. ✓
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((f) => {
        const overdue = new Date(f.dueDate).getTime() < Date.now() - 86400000;
        return (
          <div
            key={f.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              background: "var(--bg-secondary)",
              border: `1px solid ${overdue ? "rgba(239,68,68,0.4)" : "var(--border-light)"}`,
              borderRadius: 10,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                {f.note || "Follow up"}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 3 }}>
                <Link
                  href={`/customers/${f.customerId}`}
                  style={{ color: "var(--text-muted)", textDecoration: "none" }}
                >
                  {f.customerName}
                </Link>
                {" · "}
                <span style={{ color: overdue ? "#f87171" : "var(--text-dim)" }}>
                  {overdue
                    ? `Overdue ${daysSince(f.dueDate)}d`
                    : `Due ${formatDate(f.dueDate)}`}
                </span>
              </div>
            </div>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => complete(f.id)}
              title="Mark complete"
            >
              ✓
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => dismiss(f.id)}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
