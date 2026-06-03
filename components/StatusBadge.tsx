type BadgeStyle = { bg: string; color: string };

const STATUS_STYLES: Record<string, BadgeStyle> = {
  // Estimate + Proposal statuses
  Draft: { bg: "#374151", color: "#d1d5db" },
  Sent: { bg: "#1e3a5f", color: "#60a5fa" },
  Pending: { bg: "#451a03", color: "#f59e0b" },
  Viewed: { bg: "#2e1065", color: "#a78bfa" },
  Accepted: { bg: "#166534", color: "#22c55e" },
  Scheduled: { bg: "#134e4a", color: "#2dd4bf" },
  Rejected: { bg: "#450a0a", color: "#f87171" },
  // Customer statuses
  lead: { bg: "#1e3a5f", color: "#60a5fa" },
  active: { bg: "#166534", color: "#22c55e" },
  past: { bg: "#374151", color: "#d1d5db" },
  inactive: { bg: "#3f1d1d", color: "#f87171" },
};

const LABELS: Record<string, string> = {
  lead: "Lead",
  active: "Active",
  past: "Past Client",
  inactive: "Inactive",
};

export default function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.Draft;
  const label = LABELS[status] ?? status;
  return (
    <span
      className="badge"
      style={{ background: style.bg, color: style.color }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: style.color,
          display: "inline-block",
        }}
      />
      {label}
    </span>
  );
}
