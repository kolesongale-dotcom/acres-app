"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  computeAll, calcTiers, formatCurrency,
  type FullEstimateInput, type TierSettings, type PaintCatalog,
} from "@/lib/calculations";
import { extractPaintSlots, applyPaintSelection, retailPerGallon, type PaintSlotRef } from "@/lib/paintSlots";
import { selectTierPublic, signProposal, selectPaintPublic } from "@/lib/actions/proposals";

export default function SignFlow({
  proposalId,
  initialInput,
  tierSettings,
  initialTier,
  accent,
  resources,
  recommended,
  children,
}: {
  proposalId: number;
  initialInput: FullEstimateInput;
  tierSettings: TierSettings;
  initialTier: string;
  accent: string;
  resources?: { interior: string; exterior: string };
  recommended?: Record<string, number>; // "kind:id:field" -> recommended paintId
  children?: React.ReactNode; // static sections (photos, notes, SOPs, terms)
}) {
  const [lightbox, setLightbox] = useState<{ src: string; title: string } | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox]);
  const [input, setInput] = useState<FullEstimateInput>(initialInput);
  const [tier, setTier] = useState(initialTier);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [paintNote, setPaintNote] = useState("");
  const [hasInk, setHasInk] = useState(false);
  const [done, setDone] = useState(false);
  const [, startSaving] = useTransition();

  const catalog: PaintCatalog = input.paintCatalog ?? {};

  // Live recompute from the current paint selections.
  const { services, totals } = useMemo(() => computeAll(input), [input]);
  const tiers = useMemo(() => calcTiers(totals.grandTotal, tierSettings), [totals.grandTotal, tierSettings]);

  const tierData = [
    { key: "full", label: tiers.full.label, sublabel: "Paid at completion", total: tiers.full.total, deposit: 0, savings: 0 },
    { key: "mid", label: tiers.mid.label, sublabel: `Save ${tiers.mid.discountPercent}% upfront`, total: tiers.mid.total, deposit: tiers.mid.deposit, savings: tiers.mid.savings },
    { key: "max", label: tiers.max.label, sublabel: `Save ${tiers.max.discountPercent}% — best value`, total: tiers.max.total, deposit: tiers.max.deposit, savings: tiers.max.savings },
  ];

  // Options grouped by category (id + name + retail $/gal).
  const optionsByCategory = useMemo(() => {
    const map: Record<string, { id: number; name: string; perGal: number }[]> = {};
    for (const [idStr, e] of Object.entries(catalog)) {
      if (!e.category) continue;
      (map[e.category] ??= []).push({ id: Number(idStr), name: e.name, perGal: retailPerGallon(e) });
    }
    for (const cat of Object.keys(map)) map[cat].sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [catalog]);

  // Only surfaces whose category has a real choice (2+ paints).
  const slots = useMemo(() => {
    return extractPaintSlots(input, catalog).filter((s) => (optionsByCategory[s.category]?.length ?? 0) >= 2);
  }, [input, catalog, optionsByCategory]);

  function choosePaint(ref: PaintSlotRef, paintId: number) {
    setInput((prev) => applyPaintSelection(prev, ref, paintId));
    setPaintNote("");
    startSaving(async () => {
      const res = await selectPaintPublic(proposalId, ref, paintId);
      if (!res.success) setPaintNote(res.error || "Couldn't save that change — please try again.");
    });
  }

  // --- signature canvas ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0f172a";
    }
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function down(e: React.PointerEvent<HTMLCanvasElement>) { drawing.current = true; last.current = pos(e); canvasRef.current?.setPointerCapture(e.pointerId); }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !last.current) return;
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p; setHasInk(true);
  }
  function up() { drawing.current = false; last.current = null; }
  function clear() {
    const canvas = canvasRef.current; const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }

  function chooseTier(key: string) { setTier(key); selectTierPublic(proposalId, key); }

  async function submit() {
    setErrorMsg("");
    if (!hasInk) { setErrorMsg("Please draw your signature in the box above."); return; }
    if (!name.trim()) { setErrorMsg("Please print your full name."); return; }
    const dataUrl = canvasRef.current?.toDataURL("image/png") ?? "";
    setSubmitting(true);
    const res = await signProposal({ id: proposalId, signatureData: dataUrl, signatureName: name.trim(), selectedTier: tier });
    setSubmitting(false);
    if (res.success) setDone(true); else setErrorMsg(res.error);
  }

  if (done) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <div style={{ fontSize: 56, color: accent }}>✓</div>
        <h2 style={{ fontSize: 26, margin: "12px 0 8px", color: "#0f172a" }}>Your proposal has been accepted</h2>
        <p style={{ color: "#475569", fontSize: 16, maxWidth: 460, margin: "0 auto" }}>
          Thank you, {name.trim()}. We&apos;ll be in touch shortly to confirm scheduling and next steps. We look forward to working with you!
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 36 }}>
      {/* Services breakdown (updates live as paints change) */}
      <h3 style={sectionStyle}>Services Breakdown</h3>
      <div style={{ background: "#fff", borderRadius: 14, padding: "8px 4px", border: "1px solid #e2e8f0" }}>
        {services.map((s) => (
          <div key={s.key} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15.5, fontWeight: 700, color: "#0f172a" }}>{s.name}</div>
              {s.subtitle && <div style={{ fontSize: 12.5, color: "#94a3b8", marginTop: 3, fontStyle: "italic", lineHeight: 1.5 }}>{s.subtitle}</div>}
            </div>
            <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>{s.qtyLabel}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#16a34a" }}>{formatCurrency(s.total)}</div>
            </div>
          </div>
        ))}
        {(input.overheadItems ?? []).map((o, i) => (
          n(o.cost) === 0 ? null : (
            <div key={`oh-${i}`} style={{ display: "flex", justifyContent: "space-between", padding: "12px 18px", borderBottom: "1px solid #f1f5f9", fontSize: 14.5 }}>
              <span style={{ color: "#334155" }}>{o.description || "Project cost"}</span>
              <span style={{ color: "#0f172a", fontWeight: 600 }}>{formatCurrency(o.cost * (1 + o.markup / 100))}</span>
            </div>
          )
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "18px 18px", borderTop: "2px solid #e2e8f0" }}>
          <span style={{ fontSize: 18, fontWeight: 800 }}>Project Total</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#16a34a" }}>{formatCurrency(totals.grandTotal)}</span>
        </div>
      </div>

      {/* Choose your paint */}
      {slots.length > 0 && (
        <>
          <h3 style={{ ...sectionStyle, marginTop: 36 }}>Choose Your Paint</h3>
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #e2e8f0" }}>
            <p style={{ marginTop: 0, marginBottom: 16, color: "#475569", fontSize: 14 }}>
              Prefer a different product on any surface? Pick below — your price and total update instantly.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {slots.map((slot) => {
                const opts = optionsByCategory[slot.category] ?? [];
                const current = catalog[slot.currentPaintId];
                const perGal = current ? retailPerGallon(current) : 0;
                const recId = recommended?.[`${slot.ref.kind}:${slot.ref.id}:${slot.ref.field}`];
                const onRecommended = recId != null && recId === slot.currentPaintId;
                return (
                  <div key={`${slot.ref.kind}-${slot.ref.id}-${slot.ref.field}`} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ minWidth: 180 }}>
                      <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 14.5, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {slot.label}
                        {onRecommended && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#15803d", background: "#dcfce7", borderRadius: 999, padding: "2px 8px" }}>★ Recommended</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>{slot.category} · {formatCurrency(perGal)}/gal</div>
                    </div>
                    <select
                      value={slot.currentPaintId}
                      onChange={(e) => choosePaint(slot.ref, Number(e.target.value))}
                      style={{ flex: "1 1 240px", minWidth: 220, padding: "10px 12px", fontSize: 14, borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a" }}
                    >
                      {opts.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} — {formatCurrency(o.perGal)}/gal{o.id === recId ? "  ★ Recommended" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
            {paintNote && (
              <div style={{ marginTop: 14, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#b91c1c", fontSize: 13.5 }}>
                {paintNote}
              </div>
            )}
          </div>
        </>
      )}

      {/* Helpful Resources (click-to-open reference charts) */}
      {(resources?.interior || resources?.exterior) && (
        <>
          <h3 style={{ ...sectionStyle, marginTop: 36 }}>Helpful Resources</h3>
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #e2e8f0" }}>
            <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 15.5 }}>Choosing a Paint Line</div>
            <p style={{ marginTop: 4, marginBottom: 14, color: "#475569", fontSize: 14 }}>
              Compare paint lines to help decide what&apos;s right for your project.
            </p>
            <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
              {resources?.interior && (
                <button type="button" onClick={() => setLightbox({ src: resources.interior, title: "Interior Paint Lines" })} style={resourceLink(accent)}>
                  🔍 Interior Paint Lines
                </button>
              )}
              {resources?.exterior && (
                <button type="button" onClick={() => setLightbox({ src: resources.exterior, title: "Exterior Paint Lines" })} style={resourceLink(accent)}>
                  🔍 Exterior Paint Lines
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Static sections (photos, notes, SOPs, terms) */}
      {children}

      {/* Lightbox pop-up (portaled to body so it always centers on the viewport) */}
      {mounted && lightbox && createPortal(
        <div
          onClick={() => setLightbox(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.82)", display: "grid", placeItems: "center", padding: 20, zIndex: 1000 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 14, maxWidth: "min(980px, 96vw)", maxHeight: "92vh", overflow: "auto", boxShadow: "0 24px 60px -16px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>{lightbox.title}</div>
              <button onClick={() => setLightbox(null)} aria-label="Close" style={{ background: "none", border: "none", fontSize: 22, lineHeight: 1, cursor: "pointer", color: "#64748b" }}>✕</button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.src} alt={lightbox.title} style={{ width: "100%", height: "auto", borderRadius: 8, display: "block" }} />
          </div>
        </div>,
        document.body
      )}

      {/* Pricing tiers */}
      <h3 style={{ ...sectionStyle, marginTop: 36 }}>Choose Your Pricing Option</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 36 }}>
        {tierData.map((t) => {
          const active = tier === t.key;
          return (
            <button
              key={t.key}
              onClick={() => chooseTier(t.key)}
              style={{
                textAlign: "left", background: active ? "#f0fdf4" : "#fff",
                border: `2px solid ${active ? accent : "#e2e8f0"}`, borderRadius: 14, padding: 20,
                cursor: "pointer", transition: "all 0.16s ease", boxShadow: active ? `0 8px 20px -8px ${accent}66` : "none",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>{t.label}</div>
              <div style={{ fontSize: 12.5, color: "#94a3b8", margin: "2px 0 10px" }}>{t.sublabel}</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: "#0f172a", fontFamily: "var(--font-display)" }}>{formatCurrency(t.total)}</div>
              {t.deposit > 0 && <div style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>Deposit today: <strong>{formatCurrency(t.deposit)}</strong></div>}
              {t.savings > 0 && <div style={{ display: "inline-block", marginTop: 8, fontSize: 12.5, fontWeight: 700, color: accent, background: "#dcfce7", padding: "3px 10px", borderRadius: 999 }}>Save {formatCurrency(t.savings)}</div>}
              {active && <div style={{ marginTop: 10, fontSize: 12.5, color: accent, fontWeight: 700 }}>✓ Selected</div>}
            </button>
          );
        })}
      </div>

      {/* Signature */}
      <h3 style={sectionStyle}>Accept &amp; Sign</h3>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 24 }}>
        <p style={{ color: "#475569", fontSize: 14.5, marginTop: 0, marginBottom: 16 }}>
          By signing below, you accept this proposal and the selected pricing option.
        </p>
        <div style={{ position: "relative" }}>
          <canvas
            ref={canvasRef}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
            style={{ width: "100%", height: 200, background: "#f8fafc", border: "2px dashed #cbd5e1", borderRadius: 12, touchAction: "none", cursor: "crosshair", display: "block" }}
          />
          {!hasInk && <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", color: "#cbd5e1", fontSize: 15, pointerEvents: "none" }}>Sign here</span>}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={clear} style={ghostBtn}>Clear</button>
        </div>
        <div style={{ marginTop: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 6 }}>Print Your Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" style={{ width: "100%", padding: "12px 14px", fontSize: 15, borderRadius: 10, border: "1px solid #cbd5e1", color: "#0f172a", background: "#fff" }} />
        </div>
        {errorMsg && (
          <div style={{ marginTop: 14, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#b91c1c", fontSize: 14 }}>{errorMsg}</div>
        )}
        <button onClick={submit} disabled={submitting} style={{ marginTop: 18, width: "100%", padding: "15px", fontSize: 16, fontWeight: 700, color: "#fff", background: accent, border: "none", borderRadius: 12, cursor: submitting ? "wait" : "pointer", opacity: submitting ? 0.7 : 1 }}>
          {submitting ? "Submitting…" : "Accept & Sign Proposal"}
        </button>
      </div>
    </div>
  );
}

function n(v: unknown): number { const x = typeof v === "number" ? v : parseFloat(String(v ?? 0)); return Number.isFinite(x) ? x : 0; }

const sectionStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#16a34a", marginBottom: 16,
};
const ghostBtn: React.CSSProperties = {
  background: "transparent", border: "none", color: "#64748b", fontSize: 13.5, fontWeight: 600, cursor: "pointer", padding: "6px 10px",
};
const resourceLink = (accent: string): React.CSSProperties => ({
  background: "none", border: "none", color: accent, fontSize: 15, fontWeight: 700,
  cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3, padding: 0,
});
