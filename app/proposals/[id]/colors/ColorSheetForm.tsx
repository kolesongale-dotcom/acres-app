"use client";

import { useState } from "react";
import { saveColorSheet } from "@/lib/actions/proposals";
import { COLOR_PROVIDERS, SHEEN_OPTIONS } from "@/lib/types";
import type { ColorSurface } from "@/lib/colorSheet";

interface RowVals { colorName: string; colorCode: string; providerSelect: string; providerOther: string; sheen: string }

function initRow(s: ColorSurface): RowVals {
  const brands = COLOR_PROVIDERS.filter((b) => b !== "Other") as readonly string[];
  const isBrand = brands.includes(s.provider);
  return {
    colorName: s.colorName,
    colorCode: s.colorCode,
    providerSelect: s.provider ? (isBrand ? s.provider : "Other") : "",
    providerOther: s.provider && !isBrand ? s.provider : "",
    sheen: s.sheen || "Unsure",
  };
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", fontSize: 14, borderRadius: 9,
  border: "1px solid #cbd5e1", color: "#0f172a", background: "#fff",
};
const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 4 };

export default function ColorSheetForm({
  proposalId, surfaces, accent,
}: {
  proposalId: number; surfaces: ColorSurface[]; accent: string;
}) {
  const [vals, setVals] = useState<Record<string, RowVals>>(() =>
    Object.fromEntries(surfaces.map((s) => [s.key, initRow(s)]))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  const set = (key: string, patch: Partial<RowVals>) => {
    setVals((v) => ({ ...v, [key]: { ...v[key], ...patch } }));
    setSaved(false);
  };

  async function save() {
    setErr("");
    setSaving(true);
    const payload = surfaces.map((s) => {
      const v = vals[s.key];
      const provider = v.providerSelect === "Other" ? v.providerOther.trim() : v.providerSelect;
      return { kind: s.ref.kind, id: s.ref.id, field: s.ref.field, colorName: v.colorName.trim(), colorCode: v.colorCode.trim(), provider, sheen: v.sheen };
    });
    const res = await saveColorSheet(proposalId, payload);
    setSaving(false);
    if (res.success) { setSaved(true); window.scrollTo({ top: 0, behavior: "smooth" }); }
    else setErr(res.error);
  }

  if (surfaces.length === 0) {
    return (
      <div style={{ marginTop: 28, background: "#fff", borderRadius: 14, padding: 28, textAlign: "center", color: "#64748b" }}>
        No paintable surfaces on this project yet.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 28 }}>
      {saved && (
        <div style={{ background: "#dcfce7", border: "1px solid #86efac", color: "#15803d", borderRadius: 12, padding: "14px 18px", marginBottom: 20, fontWeight: 600 }}>
          ✓ Saved! Your color selections are recorded. You can update them anytime and Save again.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {surfaces.map((s) => {
          const v = vals[s.key];
          return (
            <div key={s.key} style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>{s.label}</div>
                {s.paintName && <div style={{ fontSize: 12.5, color: "#94a3b8" }}>Paint line: {s.paintName}</div>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Color Name</label>
                  <input style={inputStyle} value={v.colorName} placeholder="e.g. Alabaster" onChange={(e) => set(s.key, { colorName: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Color Code</label>
                  <input style={inputStyle} value={v.colorCode} placeholder="e.g. SW 7008" onChange={(e) => set(s.key, { colorCode: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Provider</label>
                  <select style={inputStyle} value={v.providerSelect} onChange={(e) => set(s.key, { providerSelect: e.target.value })}>
                    <option value="">— Select —</option>
                    {COLOR_PROVIDERS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Sheen / Finish</label>
                  <select style={inputStyle} value={v.sheen} onChange={(e) => set(s.key, { sheen: e.target.value })}>
                    {SHEEN_OPTIONS.map((sh) => <option key={sh} value={sh}>{sh}</option>)}
                  </select>
                </div>
                {v.providerSelect === "Other" && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>Provider (other)</label>
                    <input style={inputStyle} value={v.providerOther} placeholder="Type the store / brand" onChange={(e) => set(s.key, { providerOther: e.target.value })} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {err && (
        <div style={{ marginTop: 16, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#b91c1c", fontSize: 14 }}>{err}</div>
      )}

      <button
        onClick={save}
        disabled={saving}
        style={{ marginTop: 22, width: "100%", padding: "15px", fontSize: 16, fontWeight: 700, color: "#fff", background: accent, border: "none", borderRadius: 12, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}
      >
        {saving ? "Saving…" : "Save My Selections"}
      </button>
    </div>
  );
}
