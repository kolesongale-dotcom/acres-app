"use server";

import { prisma } from "@/lib/prisma";
import { ActionResult } from "@/lib/types";
import { ensureBudgetEntry } from "@/lib/actions/estimates";
import { revalidatePath } from "next/cache";

export async function updateBudgetActuals(
  estimateId: number,
  input: {
    estimatedLaborCost: number; // owner's expected labor (revenue/paint/materials stay auto)
    actualRevenue: number;
    actualLaborCost: number;
    actualPaintCost: number;
    actualMaterialCost: number;
    notes: string;
  }
): Promise<ActionResult> {
  try {
    // Guarantee the entry exists (with fresh estimated values) before updating.
    await ensureBudgetEntry(estimateId);
    await prisma.budgetEntry.update({
      where: { estimateId },
      data: {
        estimatedLaborCost: input.estimatedLaborCost,
        actualRevenue: input.actualRevenue,
        actualLaborCost: input.actualLaborCost,
        actualPaintCost: input.actualPaintCost,
        actualMaterialCost: input.actualMaterialCost,
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
