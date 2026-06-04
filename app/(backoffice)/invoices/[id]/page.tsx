import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { customerName } from "@/lib/format";
import InvoiceDetail from "./InvoiceDetail";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoiceId = parseInt(id, 10);
  if (isNaN(invoiceId)) notFound();

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: { orderBy: { paidAt: "asc" } } },
  });
  if (!invoice) notFound();

  const [estimate, zoho, company] = await Promise.all([
    prisma.estimate.findUnique({ where: { id: invoice.estimateId }, include: { customer: true } }),
    prisma.zohoConfig.findUnique({ where: { id: 1 } }),
    prisma.companyProfile.findUnique({ where: { id: 1 } }),
  ]);

  let lineItems: { name: string; total: number }[] = [];
  try {
    const parsed = JSON.parse(invoice.lineItemsJson);
    if (Array.isArray(parsed)) lineItems = parsed;
  } catch {
    /* ignore */
  }

  const region = zoho?.region ?? "com";
  const zohoDraftsUrl = `https://mail.zoho.${region === "com" ? "com" : region}/zm/#mail/folder/drafts`;

  return (
    <InvoiceDetail
      invoice={{
        id: invoice.id,
        number: invoice.invoiceNumber,
        tierLabel: invoice.tierLabel,
        subtotal: invoice.subtotal,
        total: invoice.total,
        dueDate: invoice.dueDate.toISOString(),
        notes: invoice.notes,
        estimateId: invoice.estimateId,
        proposalId: invoice.proposalId,
        lineItems,
        payments: invoice.payments.map((p) => ({ id: p.id, amount: p.amount, paidAt: p.paidAt.toISOString(), note: p.note })),
      }}
      client={estimate ? customerName(estimate.customer) : "Customer"}
      clientEmail={estimate?.customer?.email ?? ""}
      project={estimate?.projectName || "Project"}
      companyName={company?.name ?? "Acres Painting Co."}
      zohoConnected={zoho?.connected ?? false}
      zohoDraftsUrl={zohoDraftsUrl}
    />
  );
}
