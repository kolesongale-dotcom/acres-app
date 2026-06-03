import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ESTIMATE_INCLUDE, computeEstimate } from "@/lib/estimateCalc";
import { getPaintCatalog } from "@/lib/priceCatalog";
import { getCurrentRatesAndDefaults } from "@/lib/jobRates";
import CustomerDetail, { CustomerData } from "./CustomerDetail";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customerId = parseInt(id, 10);
  if (isNaN(customerId)) notFound();

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      estimates: { include: ESTIMATE_INCLUDE, orderBy: { createdAt: "desc" } },
      followUps: { where: { completed: false }, orderBy: { dueDate: "asc" } },
    },
  });

  if (!customer) notFound();

  const data: CustomerData = {
    id: customer.id,
    customerNumber: customer.customerNumber,
    firstName: customer.firstName,
    lastName: customer.lastName,
    company: customer.company,
    email: customer.email,
    phone: customer.phone,
    street: customer.street,
    city: customer.city,
    state: customer.state,
    zip: customer.zip,
    leadSource: customer.leadSource,
    status: customer.status,
    notes: customer.notes,
    createdAt: customer.createdAt.toISOString(),
  };

  const [catalog, { defaults }] = await Promise.all([getPaintCatalog(), getCurrentRatesAndDefaults()]);
  const estimates = customer.estimates.map((e) => {
    const { totals } = computeEstimate(e as any, catalog, defaults);
    return {
      id: e.id,
      estimateNumber: e.estimateNumber,
      projectName: e.projectName,
      status: e.status,
      total: totals.grandTotal,
      createdAt: e.createdAt.toISOString(),
    };
  });

  const followUps = customer.followUps.map((f) => ({
    id: f.id,
    note: f.note,
    dueDate: f.dueDate.toISOString(),
    completed: f.completed,
  }));

  return (
    <CustomerDetail customer={data} estimates={estimates} followUps={followUps} />
  );
}
