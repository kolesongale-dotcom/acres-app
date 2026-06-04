import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ESTIMATE_INCLUDE, computeEstimate } from "@/lib/estimateCalc";
import { getPaintCatalog } from "@/lib/priceCatalog";
import { getCurrentRatesAndDefaults } from "@/lib/jobRates";
import { calcTiers } from "@/lib/calculations";
import { customerName } from "@/lib/format";
import ProposalDetail from "./ProposalDetail";

export const dynamic = "force-dynamic";

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const proposalId = parseInt(id, 10);
  if (isNaN(proposalId)) notFound();

  const [proposal, procedures, settings, zoho] = await Promise.all([
    prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { estimate: { include: ESTIMATE_INCLUDE } },
    }),
    prisma.procedureTemplate.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.businessSettings.findUnique({ where: { id: 1 } }),
    prisma.zohoConfig.findUnique({ where: { id: 1 } }),
  ]);

  if (!proposal) notFound();

  const [catalog, { defaults }] = await Promise.all([getPaintCatalog(), getCurrentRatesAndDefaults()]);
  const { totals } = computeEstimate(proposal.estimate as any, catalog, defaults);
  const tiers = calcTiers(totals.grandTotal, {
    midDepositPercent: settings?.midDepositPercent ?? 15,
    midDepositDiscount: settings?.midDepositDiscount ?? 3,
    maxDepositPercent: settings?.maxDepositPercent ?? 30,
    maxDepositDiscount: settings?.maxDepositDiscount ?? 6,
  });

  let includedSOPs: number[] = [];
  try {
    includedSOPs = JSON.parse(proposal.includedSOPs);
    if (!Array.isArray(includedSOPs)) includedSOPs = [];
  } catch {
    includedSOPs = [];
  }

  return (
    <ProposalDetail
      proposal={{
        id: proposal.id,
        proposalNumber: proposal.proposalNumber,
        status: proposal.status,
        selectedTier: proposal.selectedTier,
        customNotes: proposal.customNotes,
        includedSOPs,
        signatureData: proposal.signatureData,
        signatureName: proposal.signatureName,
        signedAt: proposal.signedAt ? proposal.signedAt.toISOString() : null,
        sentAt: proposal.sentAt ? proposal.sentAt.toISOString() : null,
      }}
      estimate={{
        id: proposal.estimate.id,
        estimateNumber: proposal.estimate.estimateNumber,
        projectName: proposal.estimate.projectName,
        client: customerName(proposal.estimate.customer),
        clientEmail: proposal.estimate.customer?.email ?? "",
      }}
      totals={totals}
      tiers={tiers}
      procedures={procedures.map((p) => ({
        id: p.id,
        category: p.category,
        title: p.title,
        description: p.description,
      }))}
      emailTemplate={settings?.proposalEmailTemplate ?? ""}
      zohoConnected={zoho?.connected ?? false}
      zohoDraftsUrl={zohoDraftsUrl(zoho?.region ?? "com")}
      photos={proposal.estimate.photos.map((p) => ({ url: p.url, caption: p.caption }))}
      signUrl={settings?.publicBaseUrl?.trim() ? `${settings.publicBaseUrl.trim().replace(/\/+$/, "")}/proposals/${proposal.id}/sign` : ""}
      colorsUrl={settings?.publicBaseUrl?.trim() ? `${settings.publicBaseUrl.trim().replace(/\/+$/, "")}/proposals/${proposal.id}/colors` : ""}
    />
  );
}

function zohoDraftsUrl(region: string): string {
  const host = region === "ca" ? "mail.zohocloud.ca" : `mail.zoho.${region || "com"}`;
  return `https://${host}/zm/#mail/folder/drafts`;
}
