import { Totals } from "@/lib/calculations";
import { formatCurrency } from "@/lib/calculations";

function Row({
  label,
  value,
  strong,
  accent,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: strong ? "12px 0 2px" : "5px 0",
        fontSize: strong ? 16 : 14,
        fontWeight: strong ? 700 : 500,
        color: muted
          ? "var(--text-dim)"
          : accent
            ? "var(--accent)"
            : "var(--text-primary)",
        borderTop: strong ? "1px solid var(--border)" : "none",
      }}
    >
      <span>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

export default function TotalsPanel({
  totals,
  showOther = true,
}: {
  totals: Totals;
  showOther?: boolean;
}) {
  return (
    <div>
      <Row label="Labor" value={formatCurrency(totals.laborTotal)} />
      <Row label="Materials" value={formatCurrency(totals.materialTotal)} />
      {showOther && totals.otherTotal > 0 && (
        <Row label="Other" value={formatCurrency(totals.otherTotal)} />
      )}
      {totals.overheadTotal > 0 && (
        <Row label="Overhead" value={formatCurrency(totals.overheadTotal)} />
      )}
      <Row label="Subtotal" value={formatCurrency(totals.subtotal)} strong />
      {totals.discountAmount > 0 && (
        <Row
          label="Discount"
          value={`− ${formatCurrency(totals.discountAmount)}`}
          accent
        />
      )}
      {totals.discountAmount > 0 && (
        <Row label="Pre-Tax Total" value={formatCurrency(totals.preTaxTotal)} />
      )}
      {totals.taxAmount > 0 && (
        <Row label="Tax" value={formatCurrency(totals.taxAmount)} />
      )}
      <Row label="Grand Total" value={formatCurrency(totals.grandTotal)} strong accent />
    </div>
  );
}
