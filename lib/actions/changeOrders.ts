"use server";

import { prisma } from "@/lib/prisma";
import { ActionResult } from "@/lib/types";
import { generateFormattedNumber } from "@/lib/idGenerator";
import { revalidatePath } from "next/cache";

export interface ChangeOrderLine { description: string; amount: number }

const sumLines = (lines: ChangeOrderLine[]) =>
  (lines ?? []).reduce((s, l) => s + (Number(l.amount) || 0), 0);

/** Create a blank change order for a job. */
export async function createChangeOrder(estimateId: number): Promise<ActionResult<{ id: number }>> {
  try {
    const est = await prisma.estimate.findUnique({ where: { id: estimateId } });
    if (!est) return { success: false, error: "Job not found." };
    const all = await prisma.changeOrder.findMany({ select: { changeOrderNumber: true } });
    const changeOrderNumber = generateFormattedNumber("CO", all.map((c) => c.changeOrderNumber));
    const co = await prisma.changeOrder.create({ data: { changeOrderNumber, estimateId } });
    revalidatePath("/change-orders");
    return { success: true, data: { id: co.id } };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to create change order." };
  }
}

export async function updateChangeOrder(
  id: number,
  input: { description?: string; lineItems?: ChangeOrderLine[] }
): Promise<ActionResult> {
  try {
    const co = await prisma.changeOrder.findUnique({ where: { id } });
    if (!co) return { success: false, error: "Change order not found." };
    if (co.signedAt) return { success: false, error: "This change order is signed and can't be edited." };
    const data: Record<string, unknown> = {};
    if (input.description !== undefined) data.description = input.description;
    if (input.lineItems !== undefined) {
      const clean = input.lineItems.filter((l) => (l.description?.trim() || Number(l.amount)));
      data.lineItemsJson = JSON.stringify(clean.map((l) => ({ description: l.description ?? "", amount: Number(l.amount) || 0 })));
      data.total = sumLines(clean);
    }
    await prisma.changeOrder.update({ where: { id }, data });
    revalidatePath(`/change-orders/${id}`);
    revalidatePath("/change-orders");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to save change order." };
  }
}

export async function markChangeOrderSent(id: number): Promise<ActionResult> {
  try {
    await prisma.changeOrder.update({ where: { id }, data: { status: "Sent" } });
    revalidatePath(`/change-orders/${id}`);
    revalidatePath("/change-orders");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to update." };
  }
}

export async function deleteChangeOrder(id: number): Promise<ActionResult> {
  try {
    await prisma.changeOrder.delete({ where: { id } });
    revalidatePath("/change-orders");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to delete change order." };
  }
}

/** Client signs the change order from the public link. */
export async function signChangeOrder(input: {
  id: number;
  signatureData: string;
  signatureName: string;
}): Promise<ActionResult> {
  try {
    if (!input.signatureData || !input.signatureName.trim()) {
      return { success: false, error: "Signature and printed name are required." };
    }
    const co = await prisma.changeOrder.findUnique({ where: { id: input.id } });
    if (!co) return { success: false, error: "Change order not found." };
    if (co.signedAt) return { success: false, error: "This change order has already been signed." };
    await prisma.changeOrder.update({
      where: { id: input.id },
      data: { signatureData: input.signatureData, signatureName: input.signatureName.trim(), signedAt: new Date(), status: "Accepted" },
    });
    revalidatePath(`/change-orders/${input.id}/sign`);
    revalidatePath(`/change-orders/${input.id}`);
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to record signature." };
  }
}
