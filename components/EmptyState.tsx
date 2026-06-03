import { ReactNode } from "react";

export default function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "56px 24px",
        gap: 12,
      }}
      className="animate-fade-in"
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          display: "grid",
          placeItems: "center",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          color: "var(--accent)",
          fontSize: 26,
        }}
      >
        {icon ?? "◇"}
      </div>
      <h3
        className="font-display"
        style={{ fontSize: 20, margin: 0, color: "var(--text-primary)" }}
      >
        {title}
      </h3>
      {description && (
        <p style={{ color: "var(--text-dim)", margin: 0, maxWidth: 360 }}>
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
