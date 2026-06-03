import { ReactNode } from "react";

export default function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 28,
        flexWrap: "wrap",
      }}
    >
      <div>
        {back}
        <h1 className="page-title">{title}</h1>
        {subtitle && (
          <p style={{ color: "var(--text-dim)", margin: "8px 0 0", fontSize: 15 }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {actions}
        </div>
      )}
    </div>
  );
}
