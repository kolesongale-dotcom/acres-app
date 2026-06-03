import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ESTIMATE_INCLUDE, toFullEstimateInput } from "@/lib/estimateCalc";
import { getPaintCatalog } from "@/lib/priceCatalog";
import { getCurrentRatesAndDefaults } from "@/lib/jobRates";
import { TierSettings } from "@/lib/calculations";
import { customerName, formatDateTime } from "@/lib/format";
import SignFlow from "./SignFlow";

export const dynamic = "force-dynamic";

const ACCENT = "#16a34a";

export default async function SignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const proposalId = parseInt(id, 10);
  if (isNaN(proposalId)) notFound();

  const [proposal, company, settings] = await Promise.all([
    prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { estimate: { include: ESTIMATE_INCLUDE } },
    }),
    prisma.companyProfile.findUnique({ where: { id: 1 } }),
    prisma.businessSettings.findUnique({ where: { id: 1 } }),
  ]);

  if (!proposal) notFound();

  // Stamp first view (non-blocking semantics; safe to ignore failures).
  if (!proposal.viewedAt && (proposal.status === "Sent" || proposal.status === "Pending")) {
    try {
      await prisma.proposal.update({
        where: { id: proposalId },
        data: { viewedAt: new Date() },
      });
    } catch {
      /* ignore */
    }
  }

  const [catalog, { defaults }] = await Promise.all([getPaintCatalog(), getCurrentRatesAndDefaults()]);
  // Calc input passed to the interactive flow so it can recompute totals live as
  // the client swaps paints. paintCatalog carries categories + prices.
  const calcInput = toFullEstimateInput(proposal.estimate as any, catalog, defaults);
  const tierSettings: TierSettings = {
    midDepositPercent: settings?.midDepositPercent ?? 15,
    midDepositDiscount: settings?.midDepositDiscount ?? 3,
    maxDepositPercent: settings?.maxDepositPercent ?? 30,
    maxDepositDiscount: settings?.maxDepositDiscount ?? 6,
  };

  // Selected SOPs
  let sopIds: number[] = [];
  try {
    const parsed = JSON.parse(proposal.includedSOPs);
    if (Array.isArray(parsed)) sopIds = parsed;
  } catch {
    /* ignore */
  }
  const procedures =
    sopIds.length > 0
      ? await prisma.procedureTemplate.findMany({
          where: { id: { in: sopIds } },
          orderBy: { sortOrder: "asc" },
        })
      : [];
  const sopByCategory = procedures.reduce<Record<string, typeof procedures>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  const client = customerName(proposal.estimate.customer);
  const projectName = proposal.estimate.projectName || "Your Project";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
        color: "#0f172a",
        fontFamily: "var(--font-body), system-ui, sans-serif",
        padding: "0 0 60px",
      }}
    >
      {/* Header */}
      <header
        style={{
          background: "#0a0f0d",
          color: "#f0fdf4",
          padding: "32px 24px",
          textAlign: "center",
        }}
      >
        {company?.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={company.logoUrl}
            alt={company?.name || "Company logo"}
            style={{ height: 72, maxWidth: 280, objectFit: "contain", display: "block", margin: "0 auto 16px" }}
          />
        )}
        <div style={{ fontFamily: "var(--font-display)", fontSize: 38, letterSpacing: "0.04em" }}>
          {company?.name ?? "Acres Painting Co."}
        </div>
        <div style={{ color: ACCENT, fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", marginTop: 4 }}>
          {company?.tagline || "Painting Co."}
        </div>
      </header>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "0 24px" }}>
        {/* Title card */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: 28,
            marginTop: -28,
            boxShadow: "0 12px 40px -16px rgba(0,0,0,0.3)",
            position: "relative",
          }}
        >
          <div style={{ fontSize: 13, color: "#64748b", fontWeight: 700, letterSpacing: "0.05em" }}>
            PROPOSAL {proposal.proposalNumber}
          </div>
          <h1 style={{ fontSize: 30, margin: "8px 0 6px", fontFamily: "var(--font-display)" }}>{projectName}</h1>
          <div style={{ color: "#475569", fontSize: 15 }}>Prepared for {client}</div>
          {(proposal.estimate.street || proposal.estimate.city) && (
            <div style={{ color: "#94a3b8", fontSize: 14, marginTop: 4 }}>
              {[proposal.estimate.street, proposal.estimate.city, proposal.estimate.state, proposal.estimate.zip].filter(Boolean).join(", ")}
            </div>
          )}
        </div>

        {proposal.signedAt ? (
          <LockedView
            name={proposal.signatureName}
            signedAt={proposal.signedAt.toISOString()}
            signatureData={proposal.signatureData}
          />
        ) : (
          <SignFlow
            proposalId={proposal.id}
            initialInput={calcInput}
            tierSettings={tierSettings}
            initialTier={proposal.selectedTier}
            accent={ACCENT}
          >
            {proposal.estimate.photos.length > 0 && (
              <Section title="Project Photos">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
                  {proposal.estimate.photos.map((ph) => (
                    <figure key={ph.id} style={{ margin: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ph.url} alt={ph.caption || "Project photo"} style={{ width: "100%", height: 200, objectFit: "cover", display: "block", background: "#f1f5f9" }} />
                      {ph.caption && (
                        <figcaption style={{ padding: "10px 14px", fontSize: 13.5, color: "#475569", lineHeight: 1.5 }}>{ph.caption}</figcaption>
                      )}
                    </figure>
                  ))}
                </div>
              </Section>
            )}

            {proposal.customNotes.trim() && (
              <Section title="A Note From Us">
                <div style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #e2e8f0", color: "#334155", fontSize: 14.5, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                  {proposal.customNotes}
                </div>
              </Section>
            )}

            {/* SOPs */}
            {procedures.length > 0 && (
              <Section title="Our Standard Operating Procedures">
                <div style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #e2e8f0" }}>
                  {Object.entries(sopByCategory).map(([cat, items]) => (
                    <div key={cat} style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>{cat}</div>
                      {items.map((p) => (
                        <div key={p.id} style={{ display: "flex", gap: 12, padding: "8px 0", alignItems: "flex-start" }}>
                          <span style={{ color: "#16a34a", fontSize: 16, fontWeight: 800, lineHeight: 1.4 }}>✓</span>
                          <div>
                            <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 14.5 }}>{p.title}</div>
                            <div style={{ color: "#64748b", fontSize: 13.5, marginTop: 2, lineHeight: 1.5 }}>{p.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Terms & Exclusions */}
            {(settings?.standardTerms || settings?.standardExclusions) && (
              <Section title="Terms & Exclusions">
                <div style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #e2e8f0", fontSize: 13.5, color: "#475569", lineHeight: 1.65 }}>
                  {settings?.standardTerms && (
                    <div style={{ marginBottom: settings?.standardExclusions ? 16 : 0 }}>
                      <strong style={{ color: "#334155" }}>Terms.</strong> {settings.standardTerms}
                    </div>
                  )}
                  {settings?.standardExclusions && (
                    <div>
                      <strong style={{ color: "#334155" }}>Exclusions.</strong> {settings.standardExclusions}
                    </div>
                  )}
                </div>
              </Section>
            )}

          </SignFlow>
        )}

        <footer style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, marginTop: 48, lineHeight: 1.7 }}>
          {company?.name ?? "Acres Painting Co."}
          {company?.phone ? ` · ${company.phone}` : ""}
          {company?.email ? ` · ${company.email}` : ""}
          <br />
          Thank you for considering us for your project.
        </footer>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 36 }}>
      <h3 style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#16a34a", marginBottom: 16 }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function LockedView({
  name,
  signedAt,
  signatureData,
}: {
  name: string;
  signedAt: string;
  signatureData: string;
}) {
  return (
    <div style={{ marginTop: 36, textAlign: "center", background: "#fff", borderRadius: 16, padding: 40, border: "1px solid #e2e8f0" }}>
      <div style={{ fontSize: 48, color: "#16a34a" }}>✓</div>
      <h2 style={{ fontSize: 24, margin: "10px 0 6px" }}>This proposal has been accepted</h2>
      <p style={{ color: "#475569", fontSize: 15.5, margin: 0 }}>
        Accepted by <strong>{name}</strong> on {formatDateTime(signedAt)}.
      </p>
      {signatureData && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={signatureData}
          alt="signature"
          style={{ marginTop: 20, maxWidth: 360, width: "100%", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10 }}
        />
      )}
    </div>
  );
}
