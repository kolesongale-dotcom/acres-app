"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { selectTierPublic, signProposal } from "@/lib/actions/proposals";
import { formatCurrency } from "@/lib/calculations";

interface TierOption {
  key: string;
  label: string;
  sublabel: string;
  total: number;
  deposit: number;
  savings: number;
}

export default function SignClient({
  proposalId,
  initialTier,
  tiers,
  accent,
}: {
  proposalId: number;
  initialTier: string;
  tiers: TierOption[];
  accent: string;
}) {
  const router = useRouter();
  const [tier, setTier] = useState(initialTier);
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
  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    last.current = pos(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !last.current) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    setHasInk(true);
  }
  function up() {
    drawing.current = false;
    last.current = null;
  }
  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }

  function chooseTier(key: string) {
    setTier(key);
    selectTierPublic(proposalId, key);
  }

  async function submit() {
    setErrorMsg("");
    if (!hasInk) {
      setErrorMsg("Please draw your signature in the box above.");
      return;
    }
    if (!name.trim()) {
      setErrorMsg("Please print your full name.");
      return;
    }
    const dataUrl = canvasRef.current?.toDataURL("image/png") ?? "";
    setSubmitting(true);
    const res = await signProposal({
      id: proposalId,
      signatureData: dataUrl,
      signatureName: name.trim(),
      selectedTier: tier,
    });
    setSubmitting(false);
    if (res.success) {
      setDone(true);
    } else {
      setErrorMsg(res.error);
    }
  }

  if (done) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <div style={{ fontSize: 56, color: accent }}>✓</div>
        <h2 style={{ fontSize: 26, margin: "12px 0 8px", color: "#0f172a" }}>
          Your proposal has been accepted
        </h2>
        <p style={{ color: "#475569", fontSize: 16, maxWidth: 460, margin: "0 auto" }}>
          Thank you, {name.trim()}. We&apos;ll be in touch shortly to confirm scheduling and next
          steps. We look forward to working with you!
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Tier selector */}
      <h3 style={sectionStyle}>Choose Your Pricing Option</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 36 }}>
        {tiers.map((t) => {
          const active = tier === t.key;
          return (
            <button
              key={t.key}
              onClick={() => chooseTier(t.key)}
              style={{
                textAlign: "left",
                background: active ? "#f0fdf4" : "#fff",
                border: `2px solid ${active ? accent : "#e2e8f0"}`,
                borderRadius: 14,
                padding: 20,
                cursor: "pointer",
                transition: "all 0.16s ease",
                boxShadow: active ? `0 8px 20px -8px ${accent}66` : "none",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {t.label}
              </div>
              <div style={{ fontSize: 12.5, color: "#94a3b8", margin: "2px 0 10px" }}>{t.sublabel}</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: "#0f172a", fontFamily: "var(--font-display)" }}>
                {formatCurrency(t.total)}
              </div>
              {t.deposit > 0 && (
                <div style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>
                  Deposit today: <strong>{formatCurrency(t.deposit)}</strong>
                </div>
              )}
              {t.savings > 0 && (
                <div style={{ display: "inline-block", marginTop: 8, fontSize: 12.5, fontWeight: 700, color: accent, background: "#dcfce7", padding: "3px 10px", borderRadius: 999 }}>
                  Save {formatCurrency(t.savings)}
                </div>
              )}
              {active && (
                <div style={{ marginTop: 10, fontSize: 12.5, color: accent, fontWeight: 700 }}>✓ Selected</div>
              )}
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
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerLeave={up}
            style={{
              width: "100%",
              height: 200,
              background: "#f8fafc",
              border: "2px dashed #cbd5e1",
              borderRadius: 12,
              touchAction: "none",
              cursor: "crosshair",
              display: "block",
            }}
          />
          {!hasInk && (
            <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", color: "#cbd5e1", fontSize: 15, pointerEvents: "none" }}>
              Sign here
            </span>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={clear} style={ghostBtn}>Clear</button>
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
            Print Your Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            style={{
              width: "100%", padding: "12px 14px", fontSize: 15, borderRadius: 10,
              border: "1px solid #cbd5e1", color: "#0f172a", background: "#fff",
            }}
          />
        </div>

        {errorMsg && (
          <div style={{ marginTop: 14, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#b91c1c", fontSize: 14 }}>
            {errorMsg}
          </div>
        )}

        <button
          onClick={submit}
          disabled={submitting}
          style={{
            marginTop: 18, width: "100%", padding: "15px", fontSize: 16, fontWeight: 700,
            color: "#fff", background: accent, border: "none", borderRadius: 12,
            cursor: submitting ? "wait" : "pointer", opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? "Submitting…" : "Accept & Sign Proposal"}
        </button>
      </div>
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#16a34a",
  marginBottom: 16,
};

const ghostBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#64748b",
  fontSize: 13.5,
  fontWeight: 600,
  cursor: "pointer",
  padding: "6px 10px",
};
