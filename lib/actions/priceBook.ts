"use server";

import { prisma } from "@/lib/prisma";
import { ActionResult } from "@/lib/types";
import { revalidatePath } from "next/cache";

export interface PriceBookInput {
  type: string; // "paint" | "material"
  name: string;
  brand?: string;
  unit?: string;
  unitCost: number;
  markup: number;
  coverage?: number;
  category?: string; // paints only — see PAINT_CATEGORIES
  notes?: string;
}

export async function createPriceBookItem(
  input: PriceBookInput
): Promise<ActionResult<{ id: number }>> {
  try {
    if (!input.name?.trim()) return { success: false, error: "Name is required." };
    const max = await prisma.priceBookItem.aggregate({
      where: { type: input.type },
      _max: { sortOrder: true },
    });
    const item = await prisma.priceBookItem.create({
      data: {
        type: input.type === "paint" ? "paint" : "material",
        name: input.name.trim(),
        brand: input.brand?.trim() ?? "",
        unit: input.unit?.trim() || (input.type === "paint" ? "gallon" : "each"),
        unitCost: input.unitCost,
        markup: input.markup,
        coverage: input.coverage ?? 400,
        category: input.type === "paint" ? (input.category ?? "Interior Wall/Ceiling") : "Interior Wall/Ceiling",
        notes: input.notes ?? "",
        sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
    });
    revalidatePath("/price-book");
    return { success: true, data: { id: item.id } };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to add item." };
  }
}

export async function updatePriceBookItem(
  id: number,
  input: Partial<PriceBookInput>
): Promise<ActionResult> {
  try {
    await prisma.priceBookItem.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.brand !== undefined && { brand: input.brand.trim() }),
        ...(input.unit !== undefined && { unit: input.unit.trim() }),
        ...(input.unitCost !== undefined && { unitCost: input.unitCost }),
        ...(input.markup !== undefined && { markup: input.markup }),
        ...(input.coverage !== undefined && { coverage: input.coverage }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    });
    revalidatePath("/price-book");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to update item." };
  }
}

export async function deletePriceBookItem(id: number): Promise<ActionResult> {
  try {
    await prisma.priceBookItem.delete({ where: { id } });
    revalidatePath("/price-book");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to delete item." };
  }
}
