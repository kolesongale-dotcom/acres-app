"use client";

import { ReactNode } from "react";

/** Small shared form primitives for the estimate builder. */

export function Labeled({
  label,
  children,
  width,
}: {
  label: string;
  children: ReactNode;
  width?: number | string;
}) {
  return (
    <div style={{ width }}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

export function NumberField({
  value,
  onChange,
  step = "any",
  min,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: string;
  min?: number;
  suffix?: string;
}) {
  return (
    <div style={{ position: "relative" }}>
      <input
        type="number"
        className="input"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={min}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          onChange(Number.isFinite(v) ? v : 0);
        }}
        style={suffix ? { paddingRight: 36 } : undefined}
      />
      {suffix && (
        <span
          style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 12,
            color: "var(--text-dim)",
            pointerEvents: "none",
          }}
        >
          {suffix}
        </span>
      )}
    </div>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      className="input"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export interface PaintOption {
  id: number;
  name: string;
  brand: string;
  unitCost: number;
  markup: number;
  coverage: number;
  category?: string;
}

/** Dropdown to pick a paint product from the Price Book, grouped by category. */
export function PaintSelect({
  options,
  value,
  onChange,
  placeholder = "— Select paint —",
}: {
  options: PaintOption[];
  value: number | null;
  onChange: (id: number | null, name: string) => void;
  placeholder?: string;
}) {
  // Group options by category so the estimator picks within the right category
  // (the chosen paint's category drives what the client can later swap to).
  const groups = new Map<string, PaintOption[]>();
  for (const o of options) {
    const cat = o.category || "Uncategorized";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(o);
  }

  return (
    <select
      className="select"
      value={value ?? ""}
      onChange={(e) => {
        if (e.target.value === "") return onChange(null, "");
        const id = parseInt(e.target.value, 10);
        const opt = options.find((o) => o.id === id);
        onChange(id, opt?.name ?? "");
      }}
    >
      <option value="">{placeholder}</option>
      {[...groups.entries()].map(([cat, opts]) => (
        <optgroup key={cat} label={cat}>
          {opts.map((o) => (
            <option key={o.id} value={o.id}>
              {o.brand ? `${o.brand} — ` : ""}
              {o.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 14,
        color: checked ? "var(--text-primary)" : "var(--text-dim)",
        cursor: "pointer",
        fontWeight: 600,
      }}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function CardHeader({
  name,
  onName,
  onMoveUp,
  onMoveDown,
  onDelete,
  meta,
}: {
  name: string;
  onName: (v: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete: () => void;
  meta?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 16,
      }}
    >
      <span style={{ color: "var(--text-dim)", cursor: "grab", fontSize: 16 }}>⠿</span>
      <input
        className="input"
        value={name}
        onChange={(e) => onName(e.target.value)}
        style={{ fontWeight: 700, maxWidth: 260 }}
      />
      {meta}
      <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
        <button className="btn btn-icon btn-ghost btn-sm" onClick={onMoveUp} disabled={!onMoveUp} title="Move up">↑</button>
        <button className="btn btn-icon btn-ghost btn-sm" onClick={onMoveDown} disabled={!onMoveDown} title="Move down">↓</button>
        <button className="btn btn-icon btn-danger btn-sm" onClick={onDelete} title="Delete">✕</button>
      </div>
    </div>
  );
}
