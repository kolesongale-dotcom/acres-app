"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import {
  createPriceBookItem,
  updatePriceBookItem,
  deletePriceBookItem,
} from "@/lib/actions/priceBook";
import { PRICEBOOK_UNITS, PAINT_CATEGORIES } from "@/lib/types";
import { formatCurrency } from "@/lib/calculations";

export interface PriceItem {
  id: number;
  type: string;
  name: string;
  brand: string;
  unit: string;
  unitCost: number;
  markup: number;
  coverage: number;
  category: string;
  notes: string;
}

export default function PriceBookClient({ items }: { items: PriceItem[] }) {
  const [tab, setTab] = useState<"paint" | "material">("paint");
  const paint = items.filter((i) => i.type === "paint");
  const material = items.filter((i) => i.type === "material");

  return (
    <div>
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
        <button className={`tab-btn ${tab === "paint" ? "active" : ""}`} onClick={() => setTab("paint")}>
          Paint ({paint.length})
        </button>
        <button className={`tab-btn ${tab === "material" ? "active" : ""}`} onClick={() => setTab("material")}>
          Materials &amp; Supplies ({material.length})
        </button>
      </div>

      {tab === "paint" ? (
        <Section type="paint" items={paint} />
      ) : (
        <Section type="material" items={material} />
      )}
    </div>
  );
}

function Section({ type, items }: { type: "paint" | "material"; items: PriceItem[] }) {
  const isPaint = type === "paint";
  return (
    <div className="animate-fade-in" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {items.length === 0 ? (
          <EmptyState
            icon={isPaint ? "🪣" : "📦"}
            title={isPaint ? "No paint products yet" : "No materials yet"}
            description="Add items on the right. Each stores your cost and a per-item markup, then pulls into estimates."
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Brand</th>
                {isPaint && <th>Category</th>}
                {isPaint ? <th style={{ textAlign: "right" }}>Coverage</th> : <th>Unit</th>}
                <th style={{ textAlign: "right" }}>Cost</th>
                <th style={{ textAlign: "right" }}>Markup</th>
                <th style={{ textAlign: "right" }}>Client Price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <Row key={it.id} item={it} isPaint={isPaint} />
              ))}
            </tbody>
          </table>
        )}
      </div>
      <AddForm type={type} />
    </div>
  );
}

function Row({ item, isPaint }: { item: PriceItem; isPaint: boolean }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(item);
  const [confirm, setConfirm] = useState(false);
  const [, start] = useTransition();

  const retail = item.unitCost * (1 + item.markup / 100);

  function save() {
    start(async () => {
      const res = await updatePriceBookItem(item.id, {
        name: form.name,
        brand: form.brand,
        unit: form.unit,
        unitCost: form.unitCost,
        markup: form.markup,
        coverage: form.coverage,
        category: form.category,
      });
      if (res.success) { success("Item updated."); setEditing(false); router.refresh(); }
      else error(res.error);
    });
  }

  if (editing) {
    return (
      <tr>
        <td colSpan={isPaint ? 8 : 7}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "4px 0" }}>
            <input className="input" style={{ flex: 2, minWidth: 160 }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" />
            <input className="input" style={{ flex: 1, minWidth: 110 }} value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Brand" />
            {isPaint && (
              <MiniLabeled label="category">
                <select className="select" style={{ width: 170 }} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {PAINT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </MiniLabeled>
            )}
            {isPaint ? (
              <MiniLabeled label="sf/gal"><input className="input" type="number" step="any" style={{ width: 80 }} value={form.coverage} onChange={(e) => setForm({ ...form, coverage: parseFloat(e.target.value) || 0 })} /></MiniLabeled>
            ) : (
              <select className="select" style={{ width: 120 }} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {PRICEBOOK_UNITS.map((u) => <option key={u}>{u}</option>)}
              </select>
            )}
            <MiniLabeled label="cost $"><input className="input" type="number" step="any" style={{ width: 90 }} value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: parseFloat(e.target.value) || 0 })} /></MiniLabeled>
            <MiniLabeled label="markup %"><input className="input" type="number" step="any" style={{ width: 80 }} value={form.markup} onChange={(e) => setForm({ ...form, markup: parseFloat(e.target.value) || 0 })} /></MiniLabeled>
            <button className="btn btn-primary btn-sm" onClick={save}>Save</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setForm(item); setEditing(false); }}>Cancel</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td style={{ fontWeight: 600 }}>{item.name}</td>
      <td style={{ color: "var(--text-dim)" }}>{item.brand || "—"}</td>
      {isPaint && (
        <td>
          <span className="badge" style={{ fontSize: 11 }}>{item.category}</span>
        </td>
      )}
      {isPaint ? (
        <td style={{ textAlign: "right", color: "var(--text-dim)" }}>{item.coverage} sf/gal</td>
      ) : (
        <td style={{ color: "var(--text-dim)" }}>{item.unit}</td>
      )}
      <td style={{ textAlign: "right" }}>{formatCurrency(item.unitCost)}</td>
      <td style={{ textAlign: "right", color: "var(--text-dim)" }}>{item.markup}%</td>
      <td style={{ textAlign: "right", color: "var(--accent)", fontWeight: 600 }}>{formatCurrency(retail)}{isPaint ? "/gal" : ""}</td>
      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
        <button className="btn btn-icon btn-ghost btn-sm" onClick={() => setEditing(true)} title="Edit">✎</button>
        <button className="btn btn-icon btn-danger btn-sm" onClick={() => setConfirm(true)} title="Delete">✕</button>
        <ConfirmDialog
          open={confirm}
          title="Delete item?"
          message={`Remove "${item.name}" from the price book? Existing estimates keep their saved pricing.`}
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirm(false)}
          onConfirm={async () => {
            const res = await deletePriceBookItem(item.id);
            if (res.success) success("Item deleted."); else error(res.error);
            setConfirm(false);
            router.refresh();
          }}
        />
      </td>
    </tr>
  );
}

function AddForm({ type }: { type: "paint" | "material" }) {
  const isPaint = type === "paint";
  const router = useRouter();
  const { success, error } = useToast();
  const [pending, start] = useTransition();
  const blank = {
    name: "",
    brand: "",
    unit: isPaint ? "gallon" : "each",
    unitCost: 0,
    markup: 35,
    coverage: isPaint ? 400 : 400,
    category: "Interior Wall/Ceiling",
    notes: "",
  };
  const [form, setForm] = useState(blank);

  function add() {
    if (!form.name.trim()) { error("Name is required."); return; }
    start(async () => {
      const res = await createPriceBookItem({ type, ...form });
      if (res.success) { success("Item added."); setForm(blank); router.refresh(); }
      else if (!res.success) error(res.error);
    });
  }

  return (
    <div className="card">
      <h2 className="section-title" style={{ marginBottom: 14 }}>
        Add {isPaint ? "Paint Product" : "Material / Supply"}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={isPaint ? "e.g. Cashmere Eggshell" : "e.g. Plastic Sheeting"} /></Field>
        <Field label="Brand"><input className="input" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></Field>
        {isPaint && (
          <Field label="Category">
            <select className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {PAINT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
        )}
        {isPaint ? (
          <Field label="Coverage (sq ft / gallon)"><input className="input" type="number" step="any" value={form.coverage} onChange={(e) => setForm({ ...form, coverage: parseFloat(e.target.value) || 0 })} /></Field>
        ) : (
          <Field label="Unit">
            <select className="select" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {PRICEBOOK_UNITS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </Field>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label={isPaint ? "Cost / gallon" : "Your Cost"}><input className="input" type="number" step="any" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: parseFloat(e.target.value) || 0 })} /></Field>
          <Field label="Markup %"><input className="input" type="number" step="any" value={form.markup} onChange={(e) => setForm({ ...form, markup: parseFloat(e.target.value) || 0 })} /></Field>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
          Client price: <span style={{ color: "var(--accent)", fontWeight: 600 }}>{formatCurrency(form.unitCost * (1 + form.markup / 100))}</span>{isPaint ? " / gal" : ` / ${form.unit}`}
        </div>
        <button className="btn btn-primary" onClick={add} disabled={pending} style={{ width: "100%" }}>
          {pending ? <LoadingSpinner size={16} /> : `+ Add ${isPaint ? "Paint" : "Material"}`}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
function MiniLabeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase" }}>{label}</span>
      {children}
    </div>
  );
}
