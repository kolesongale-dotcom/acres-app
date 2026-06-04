"use client";

import { useEffect, useRef, useState } from "react";
import { signChangeOrder } from "@/lib/actions/changeOrders";

export default function ChangeOrderSign({ id, accent }: { id: number; accent: string }) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [hasInk, setHasInk] = useState(false);
  const [done, setDone] = useState(false);

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
    if (ctx) { ctx.scale(ratio, ratio); ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#0f172a"; }
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) { const r = canvasRef.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function down(e: React.PointerEvent<HTMLCanvasElement>) { drawing.current = true; last.current = pos(e); canvasRef.current?.setPointerCapture(e.pointerId); }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d"); if (!ctx || !last.current) return;
    const p = pos(e); ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last.current = p; setHasInk(true);
  }
  function up() { drawing.current = false; last.current = null; }
  function clear() { const c = canvasRef.current; const ctx = c?.getContext("2d"); if (c && ctx) ctx.clearRect(0, 0, c.width, c.height); setHasInk(false); }

  async function submit() {
    setErrorMsg("");
    if (!hasInk) { setErrorMsg("Please draw your signature in the box above."); return; }
    if (!name.trim()) { setErrorMsg("Please print your full name."); return; }
    const dataUrl = canvasRef.current?.toDataURL("image/png") ?? "";
    setSubmitting(true);
    const res = await signChangeOrder({ id, signatureData: dataUrl, signatureName: name.trim() });
    setSubmitting(false);
    if (res.success) setDone(true); else setErrorMsg(res.error);
  }

  if (done) {
    return (
      <div style={{ marginTop: 28, textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: 52, color: accent }}>✓</div>
        <h2 style={{ fontSize: 24, margin: "10px 0 6px", color: "#0f172a" }}>Change order approved</h2>
        <p style={{ color: "#475569", fontSize: 15.5, margin: 0 }}>Thank you, {name.trim()}. We&apos;ll proceed with the additional work.</p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 28 }}>
      <h3 style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: accent, marginBottom: 16 }}>Approve &amp; Sign</h3>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 24 }}>
        <p style={{ color: "#475569", fontSize: 14.5, marginTop: 0, marginBottom: 16 }}>By signing below, you approve this change order and the additional cost.</p>
        <div style={{ position: "relative" }}>
          <canvas ref={canvasRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
            style={{ width: "100%", height: 200, background: "#f8fafc", border: "2px dashed #cbd5e1", borderRadius: 12, touchAction: "none", cursor: "crosshair", display: "block" }} />
          {!hasInk && <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", color: "#cbd5e1", fontSize: 15, pointerEvents: "none" }}>Sign here</span>}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={clear} style={{ background: "transparent", border: "none", color: "#64748b", fontSize: 13.5, fontWeight: 600, cursor: "pointer", padding: "6px 10px" }}>Clear</button>
        </div>
        <div style={{ marginTop: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 6 }}>Print Your Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" style={{ width: "100%", padding: "12px 14px", fontSize: 15, borderRadius: 10, border: "1px solid #cbd5e1", color: "#0f172a", background: "#fff" }} />
        </div>
        {errorMsg && <div style={{ marginTop: 14, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#b91c1c", fontSize: 14 }}>{errorMsg}</div>}
        <button onClick={submit} disabled={submitting} style={{ marginTop: 18, width: "100%", padding: "15px", fontSize: 16, fontWeight: 700, color: "#fff", background: accent, border: "none", borderRadius: 12, cursor: submitting ? "wait" : "pointer", opacity: submitting ? 0.7 : 1 }}>
          {submitting ? "Submitting…" : "Approve & Sign"}
        </button>
      </div>
    </div>
  );
}
