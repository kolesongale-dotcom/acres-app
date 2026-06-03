export default function LoadingSpinner({
  size = 20,
  label,
}: {
  size?: number;
  label?: string;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <span
        className="spinner"
        style={{ width: size, height: size }}
        aria-hidden
      />
      {label && <span style={{ color: "var(--text-muted)" }}>{label}</span>}
    </span>
  );
}
