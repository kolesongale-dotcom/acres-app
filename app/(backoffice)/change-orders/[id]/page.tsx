import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { customerName } from "@/lib/format";
import ChangeOrderDetail from "./ChangeOrderDetail";

export const dynamic = "force-dynamic";

export default async function ChangeOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const coId = parseInt(id, 10);
  if (isNaN(coId)) notFound();

  const co = await prisma.changeOrder.findUnique({ where: { id: coId } });
  if (!co) notFound();

  const [estimate, biz] = await Promise.all([
    prisma.estimate.findUnique({ where: { id: co.estimateId }, include: { customer: true } }),
    prisma.businessSettings.findUnique({ where: { id: 1 } }),
  ]);

  let lineItems: { description: string; amount: number }[] = [];
  try {
    const p = JSON.parse(co.lineItemsJson);
    if (Array.isArray(p)) lineItems = p;
  } catch {
    /* ignore */
  }

  const base = (biz?.publicBaseUrl || "").replace(/\/$/, "");

  return (
    <ChangeOrderDetail
      co={{
        id: co.id,
        number: co.changeOrderNumber,
        estimateId: co.estimateId,
        description: co.description,
        lineItems,
        total: co.total,
        status: co.status,
        signatureName: co.signatureName,
        signedAt: co.signedAt ? co.signedAt.toISOString() : null,
      }}
      client={estimate ? customerName(estimate.customer) : "Customer"}
      project={estimate?.projectName || "Project"}
      signUrl={base ? `${base}/change-orders/${co.id}/sign` : ""}
    />
  );
}
