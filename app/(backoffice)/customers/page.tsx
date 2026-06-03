import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import CustomersClient, { CustomerRow } from "./CustomersClient";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { estimates: true } } },
  });

  const rows: CustomerRow[] = customers.map((c) => ({
    id: c.id,
    customerNumber: c.customerNumber,
    firstName: c.firstName,
    lastName: c.lastName,
    company: c.company,
    phone: c.phone,
    email: c.email,
    leadSource: c.leadSource,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    estimateCount: c._count.estimates,
  }));

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={`${rows.length} ${rows.length === 1 ? "contact" : "contacts"} in your CRM.`}
      />
      <CustomersClient customers={rows} />
    </div>
  );
}
