import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { customerName, formatDateTime } from "@/lib/format";
import { formatCurrency } from "@/lib/calculations";
import ChangeOrderSign from "./ChangeOrderSign";

export const dynamic = "force-dynamic";
const ACCENT = "#16a34a";

export default async function ChangeOrderSignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const coId = parseInt(id, 10);
  if (isNaN(coId)) notFound();

  const co = await prisma.changeOrder.findUnique({ where: { id: coId } });
  if (!co) notFound();
  const [estimate, company] = await Promise.all([
    prisma.estimate.findUnique({ where: { id: co.estimateId }, include: { customer: true } }),
    prisma.companyProfile.findUnique({ where: { id: 1 } }),
  ]);

  let lines: { description: string; amount: number }[] = [];
  try { const p = JSON.parse(co.lineItemsJson); if (Array.isArray(p)) lines = p; } catch { /* ignore */ }

  const client = estimate ? customerName(estimate.customer) : "Customer";
  const project = estimate?.projectName || "Your Project";

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", color: "#0f172a", fontFamily: "var(--font-body), system-ui, sans-serif", padding: "0 0 60px" }}>
      <header style={{ background: "#0a0f0d", color: "#f0fdf4", padding: "32px 24px", textAlign: "center" }}>
        {company?.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={company.logoUrl} alt={company?.name || "logo"} style={{ height: 64, maxWidth: 260, objectFit: "contain", display: "block", margin: "0 auto 14px" }} />
        )}
        <div style={{ fontFamily: "var(--font-display)", fontSize: 34, letterSpacing: "0.04em" }}>{company?.name ?? "Acres Painting Co."}</div>
        <div style={{ color: ACCENT, fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", marginTop: 4 }}>{company?.tagline || "Painting Co."}</div>
      </header>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 28, marginTop: -28, boxShadow: "0 12px 40px -16px rgba(0,0,0,0.3)" }}>
          <div style={{ fontSize: 13, color: "#64748b", fontWeight: 700, letterSpacing: "0.05em" }}>CHANGE ORDER {co.changeOrderNumber}</div>
          <h1 style={{ fontSize: 28, margin: "8px 0 6px", fontFamily: "var(--font-display)" }}>{project}</h1>
          <div style={{ color: "#475569", fontSize: 15 }}>Prepared for {client}</div>
          {co.description && <p style={{ color: "#334155", fontSize: 14.5, lineHeight: 1.6, marginTop: 12, marginBottom: 0, whiteSpace: "pre-wrap" }}>{co.description}</p>}
        </div>

        {co.signedAt ? (
          <div style={{ marginTop: 36, textAlign: "center", background: "#fff", borderRadius: 16, padding: 40, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 48, color: ACCENT }}>✓</div>
            <h2 style={{ fontSize: 24, margin: "10px 0 6px" }}>This change order has been approved</h2>
            <p style={{ color: "#475569", fontSize: 15.5, margin: 0 }}>Approved by <strong>{co.signatureName}</strong> on {formatDateTime(co.signedAt.toISOString())}.</p>
          </div>
        ) : (
          <div style={{ marginTop: 36 }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: ACCENT, marginBottom: 16 }}>Additional Work</h3>
            <div style={{ background: "#fff", borderRadius: 14, padding: "8px 4px", border: "1px solid #e2e8f0" }}>
              {lines.length === 0 && <div style={{ padding: 16, color: "#94a3b8" }}>No items listed.</div>}
              {lines.map((l, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
                  <span style={{ color: "#334155" }}>{l.description || "Change"}</span>
                  <span style={{ fontWeight: 700, color: "#0f172a" }}>{formatCurrency(l.amount)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "18px", borderTop: "2px solid #e2e8f0" }}>
                <span style={{ fontSize: 18, fontWeight: 800 }}>Total</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: ACCENT }}>{formatCurrency(co.total)}</span>
              </div>
            </div>
            <ChangeOrderSign id={co.id} accent={ACCENT} />
          </div>
        )}
      </div>
    </div>
  );
}
