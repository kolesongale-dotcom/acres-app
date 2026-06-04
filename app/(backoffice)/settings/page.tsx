import { prisma } from "@/lib/prisma";
import { rowToJobRates, rowToPaintDefaults } from "@/lib/jobRates";
import PageHeader from "@/components/PageHeader";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [company, business, procedures, zoho, jobRates, priceItems] = await Promise.all([
    prisma.companyProfile.findUnique({ where: { id: 1 } }),
    prisma.businessSettings.findUnique({ where: { id: 1 } }),
    prisma.procedureTemplate.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.zohoConfig.findUnique({ where: { id: 1 } }),
    prisma.jobRateSettings.findUnique({ where: { id: 1 } }),
    prisma.priceBookItem.findMany({ where: { type: "paint" }, orderBy: { sortOrder: "asc" } }),
  ]);

  const paintOptions = priceItems.map((p) => ({ id: p.id, label: `${p.brand ? p.brand + " — " : ""}${p.name}` }));

  const zohoData = {
    connected: zoho?.connected ?? false,
    region: zoho?.region ?? "com",
    fromAddress: zoho?.fromAddress ?? "",
    accountId: zoho?.accountId ?? "",
    hasClientId: !!zoho?.clientId,
  };

  const companyData = {
    name: company?.name ?? "Acres Painting Co.",
    email: company?.email ?? "",
    phone: company?.phone ?? "",
    address: company?.address ?? "",
    website: company?.website ?? "",
    tagline: company?.tagline ?? "",
    logoUrl: company?.logoUrl ?? "",
  };

  const businessData = {
    globalTaxRate: business?.globalTaxRate ?? 0,
    globalMarkupDefault: business?.globalMarkupDefault ?? 30,
    standardTerms: business?.standardTerms ?? "",
    standardExclusions: business?.standardExclusions ?? "",
    midDepositPercent: business?.midDepositPercent ?? 15,
    midDepositDiscount: business?.midDepositDiscount ?? 3,
    maxDepositPercent: business?.maxDepositPercent ?? 30,
    maxDepositDiscount: business?.maxDepositDiscount ?? 6,
    publicBaseUrl: business?.publicBaseUrl ?? "",
    proposalEmailTemplate: business?.proposalEmailTemplate ?? "",
    resourceInteriorUrl: business?.resourceInteriorUrl ?? "",
    resourceExteriorUrl: business?.resourceExteriorUrl ?? "",
    warrantyMonths: business?.warrantyMonths ?? 24,
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Configure your company, pricing, and proposal defaults." />
      <SettingsClient
        company={companyData}
        business={businessData}
        procedures={procedures}
        zoho={zohoData}
        jobRates={{ ...rowToJobRates(jobRates), ...rowToPaintDefaults(jobRates) }}
        paintOptions={paintOptions}
      />
    </div>
  );
}
