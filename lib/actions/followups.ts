"use server";

import { prisma } from "@/lib/prisma";
import { ActionResult } from "@/lib/types";
import { revalidatePath } from "next/cache";

export async function createFollowUp(input: {
  customerId: number;
  estimateId?: number | null;
  dueDate: string;
  note: string;
}): Promise<ActionResult> {
  try {
    await prisma.followUpReminder.create({
      data: {
        customerId: input.customerId,
        estimateId: input.estimateId ?? null,
        dueDate: new Date(input.dueDate),
        note: input.note ?? "",
      },
    });
    revalidatePath(`/customers/${input.customerId}`);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to create follow-up." };
  }
}

export async function toggleFollowUp(
  id: number,
  completed: boolean
): Promise<ActionResult> {
  try {
    const fu = await prisma.followUpReminder.update({
      where: { id },
      data: { completed },
    });
    revalidatePath(`/customers/${fu.customerId}`);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to update follow-up." };
  }
}

export async function deleteFollowUp(id: number): Promise<ActionResult> {
  try {
    const fu = await prisma.followUpReminder.delete({ where: { id } });
    revalidatePath(`/customers/${fu.customerId}`);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to delete follow-up." };
  }
}
