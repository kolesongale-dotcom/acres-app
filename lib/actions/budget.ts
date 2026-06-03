"use server";

import { prisma } from "@/lib/prisma";
import { ActionResult } from "@/lib/types";
import { ensureBudgetEntry } from "@/lib/actions/estimates";
import { revalidatePath } from "next/cache";

export async function updateBudgetActuals(
  estimateId: number,
  input: {
    actualRevenue: number;
    actualLaborCost: number;
    actualMaterialCost: number;
    actualOverhead: number;
    notes: string;
  }
): Promise<ActionResult> {
  try {
    // Guarantee the entry exists (with fresh estimated values) before updating.
    await ensureBudgetEntry(estimateId);
    await prisma.budgetEntry.update({
      where: { estimateId },
      data: {
        actualRevenue: input.actualRevenue,
        actualLaborCost: input.actualLaborCost,
        actualMaterialCost: input.actualMaterialCost,
        actualOverhead: input.actualOverhead,
        notes: input.notes,
      },
    });
    revalidatePath("/budget");
    revalidatePath(`/budget/${estimateId}`);
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to save budget." };
  }
}
