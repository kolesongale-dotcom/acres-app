import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getColorSheetData } from "@/lib/colorSheet";

export const dynamic = "force-dynamic";

export default async function ColorSheetViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const proposalId = parseInt(id, 10);
  if (isNaN(proposalId)) notFound();

  const [data, biz] = await Promise.all([
    getColorSheetData(proposalId),
    prisma.businessSettings.findUnique({ where: { id: 1 } }),
  ]);
  if (!data) notFound();

  const base = (biz?.publicBaseUrl || "").replace(/\/$/, "");
  const clientUrl = `${base}/proposals/${proposalId}/colors`;
  const anyFilled = data.surfaces.some((s) => s.colorName || s.colorCode || s.provider);

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <Link href="/color-sheets" className="btn btn-ghost btn-sm" style={{ paddingLeft: 0 }}>← Color Sheets</Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <h1 className="page-title">{data.project}</h1>
          <p style={{ color: "var(--text-dim)", margin: "8px 0 0" }}>
            {data.client} ·{" "}
            <Link href={`/proposals/${proposalId}`} style={{ color: "var(--text-muted)" }}>proposal</Link>
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a href={`/api/estimates/${data.estimateId}/shopping-list`} target="_blank" rel="noreferrer" className="btn btn-secondary">↓ Shopping List</a>
          <a href={`/proposals/${proposalId}/colors`} target="_blank" rel="noreferrer" className="btn btn-secondary">↗ Open client form</a>
        </div>
      </div>

      {base && (
        <div className="card card-tight" style={{ marginBottom: 20 }}>
          <div className="section-title" style={{ marginBottom: 6 }}>Client form link</div>
          <div style={{ fontSize: 13, color: "var(--accent)", wordBreak: "break-all" }}>{clientUrl}</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>This link is also included automatically in the proposal email.</div>
        </div>
      )}

      {data.surfaces.length === 0 ? (
        <div className="card"><p style={{ color: "var(--text-dim)", margin: 0 }}>No paintable surfaces on this job.</p></div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Surface</th>
                <th>Paint Line</th>
                <th>Color Name</th>
                <th>Code</th>
                <th>Provider</th>
                <th>Sheen</th>
              </tr>
            </thead>
            <tbody>
              {data.surfaces.map((s) => (
                <tr key={s.key}>
                  <td style={{ fontWeight: 600 }}>{s.label}</td>
                  <td style={{ color: "var(--text-dim)" }}>{s.paintName || "—"}</td>
                  <td>{s.colorName || <span style={{ color: "var(--text-dim)" }}>—</span>}</td>
                  <td>{s.colorCode || <span style={{ color: "var(--text-dim)" }}>—</span>}</td>
                  <td>{s.provider || <span style={{ color: "var(--text-dim)" }}>—</span>}</td>
                  <td>{s.sheen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!anyFilled && (
        <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 14 }}>
          The client hasn&apos;t entered any colors yet. They fill this in from the link in their proposal email.
        </p>
      )}
    </div>
  );
}
