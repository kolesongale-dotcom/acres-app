"use server";

import { prisma } from "@/lib/prisma";
import { ActionResult } from "@/lib/types";
import { revalidatePath } from "next/cache";

export async function updateCompanyProfile(input: {
  name: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  tagline: string;
  logoUrl?: string;
}): Promise<ActionResult> {
  try {
    await prisma.companyProfile.upsert({
      where: { id: 1 },
      update: { ...input },
      create: { id: 1, ...input },
    });
    revalidatePath("/settings");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to save company profile." };
  }
}

export async function updateBusinessSettings(input: {
  globalTaxRate: number;
  globalMarkupDefault: number;
  standardTerms: string;
  standardExclusions: string;
  midDepositPercent: number;
  midDepositDiscount: number;
  maxDepositPercent: number;
  maxDepositDiscount: number;
  publicBaseUrl: string;
  resourceInteriorUrl?: string;
  resourceExteriorUrl?: string;
  warrantyMonths?: number;
}): Promise<ActionResult> {
  try {
    const clean = { ...input, publicBaseUrl: input.publicBaseUrl.trim() };
    await prisma.businessSettings.upsert({
      where: { id: 1 },
      update: { ...clean },
      create: { id: 1, ...clean },
    });
    revalidatePath("/settings");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to save business settings." };
  }
}

export async function updateProposalEmailTemplate(
  proposalEmailTemplate: string
): Promise<ActionResult> {
  try {
    await prisma.businessSettings.upsert({
      where: { id: 1 },
      update: { proposalEmailTemplate },
      create: { id: 1, proposalEmailTemplate },
    });
    revalidatePath("/settings");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to save email template." };
  }
}

export async function updateJobRates(input: {
  wallRate: number; ceilingRate: number; trimRate: number;
  cabinetDoorRate: number; cabinetDrawerRate: number; cabinetFrameRate: number;
  deckFloorRate: number; deckRailingRate: number; deckStepRate: number; deckLatticeRate: number;
  sidingRate: number; powerWashRate: number; doorRate: number;
  shutterStory1Rate: number; shutterStory2Rate: number; shutterStory3Rate: number; shutterSqFtEach: number;
  garageRate: number; primerRate: number; laborMarkup: number;
  defaultWallPaintId: number | null;
  defaultCeilingPaintId: number | null;
  defaultTrimPaintId: number | null;
  defaultDeckFloorStainId: number | null;
  defaultDeckRailStainId: number | null;
  defaultSidingPaintId: number | null;
  defaultDoorPaintId: number | null;
  defaultShutterPaintId: number | null;
  defaultGaragePaintId: number | null;
}): Promise<ActionResult> {
  try {
    await prisma.jobRateSettings.upsert({
      where: { id: 1 },
      update: { ...input },
      create: { id: 1, ...input },
    });
    revalidatePath("/settings");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to save job rates." };
  }
}

export async function createProcedure(input: {
  category: string;
  title: string;
  description: string;
  isDefault: boolean;
}): Promise<ActionResult> {
  try {
    const max = await prisma.procedureTemplate.aggregate({
      _max: { sortOrder: true },
    });
    await prisma.procedureTemplate.create({
      data: { ...input, sortOrder: (max._max.sortOrder ?? 0) + 1 },
    });
    revalidatePath("/settings");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to add procedure." };
  }
}

export async function updateProcedure(
  id: number,
  input: {
    category?: string;
    title?: string;
    description?: string;
    isDefault?: boolean;
    sortOrder?: number;
  }
): Promise<ActionResult> {
  try {
    await prisma.procedureTemplate.update({ where: { id }, data: input });
    revalidatePath("/settings");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to update procedure." };
  }
}

export async function deleteProcedure(id: number): Promise<ActionResult> {
  try {
    await prisma.procedureTemplate.delete({ where: { id } });
    revalidatePath("/settings");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to delete procedure." };
  }
}

export async function reorderProcedure(
  id: number,
  direction: "up" | "down"
): Promise<ActionResult> {
  try {
    const all = await prisma.procedureTemplate.findMany({
      orderBy: { sortOrder: "asc" },
    });
    const idx = all.findIndex((p) => p.id === id);
    if (idx === -1) return { success: false, error: "Procedure not found." };
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= all.length) return { success: true };

    const a = all[idx];
    const b = all[swapWith];
    await prisma.$transaction([
      prisma.procedureTemplate.update({
        where: { id: a.id },
        data: { sortOrder: b.sortOrder },
      }),
      prisma.procedureTemplate.update({
        where: { id: b.id },
        data: { sortOrder: a.sortOrder },
      }),
    ]);
    revalidatePath("/settings");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to reorder procedure." };
  }
}
