import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getColorSheetData } from "@/lib/colorSheet";
import ColorSheetForm from "./ColorSheetForm";

export const dynamic = "force-dynamic";
const ACCENT = "#16a34a";

export default async function ColorSheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const proposalId = parseInt(id, 10);
  if (isNaN(proposalId)) notFound();

  const [data, company] = await Promise.all([
    getColorSheetData(proposalId),
    prisma.companyProfile.findUnique({ where: { id: 1 } }),
  ]);
  if (!data) notFound();

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", color: "#0f172a", fontFamily: "var(--font-body), system-ui, sans-serif", padding: "0 0 60px" }}>
      <header style={{ background: "#0a0f0d", color: "#f0fdf4", padding: "32px 24px", textAlign: "center" }}>
        {company?.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={company.logoUrl} alt={company?.name || "Company logo"} style={{ height: 64, maxWidth: 260, objectFit: "contain", display: "block", margin: "0 auto 14px" }} />
        )}
        <div style={{ fontFamily: "var(--font-display)", fontSize: 34, letterSpacing: "0.04em" }}>{company?.name ?? "Acres Painting Co."}</div>
        <div style={{ color: ACCENT, fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", marginTop: 4 }}>{company?.tagline || "Painting Co."}</div>
      </header>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 28, marginTop: -28, boxShadow: "0 12px 40px -16px rgba(0,0,0,0.3)" }}>
          <h1 style={{ fontSize: 28, margin: "0 0 6px", fontFamily: "var(--font-display)" }}>Color &amp; Sheen Selections</h1>
          <div style={{ color: "#475569", fontSize: 15 }}>{data.project} · {data.client}</div>
          <p style={{ color: "#64748b", fontSize: 14, marginTop: 12, marginBottom: 0, lineHeight: 1.6 }}>
            For each surface below, enter the paint <strong>color</strong> you&apos;d like, its <strong>color code</strong>, where it&apos;s
            from, and the <strong>sheen</strong>. You can come back and finish this anytime — just hit Save when you&apos;re done.
          </p>
        </div>

        <ColorSheetForm proposalId={proposalId} surfaces={data.surfaces} accent={ACCENT} />
      </div>
    </div>
  );
}
