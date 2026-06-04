/** Derived invoice status from total / paid / due date (no stored status column). */
export function invoiceStatus(total: number, paid: number, dueDate: Date | string): string {
  if (paid >= total - 0.005) return "Paid";
  const due = new Date(dueDate).getTime();
  if (Number.isFinite(due) && due < Date.now()) return "Overdue";
  if (paid > 0) return "Partial";
  return "Unpaid";
}

export const INVOICE_STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  Paid: { bg: "rgba(34,197,94,0.15)", fg: "var(--accent)" },
  Partial: { bg: "rgba(59,130,246,0.15)", fg: "#60a5fa" },
  Unpaid: { bg: "rgba(148,163,184,0.15)", fg: "var(--text-muted)" },
  Overdue: { bg: "rgba(239,68,68,0.15)", fg: "#f87171" },
};
