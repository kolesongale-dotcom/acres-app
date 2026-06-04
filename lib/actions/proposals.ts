"use server";

import { prisma } from "@/lib/prisma";
import { generateFormattedNumber } from "@/lib/idGenerator";
import { ActionResult, CLIENT_SELECTABLE_CATEGORIES } from "@/lib/types";
import { ensureBudgetEntry } from "@/lib/actions/estimates";
import { ESTIMATE_INCLUDE, toFullEstimateInput } from "@/lib/estimateCalc";
import { getPaintCatalog } from "@/lib/priceCatalog";
import { getCurrentRatesAndDefaults } from "@/lib/jobRates";
import { extractPaintSlots, isValidSlotField, sheenFieldFor, slotKey, type PaintSlotKind, type PaintSlotRef } from "@/lib/paintSlots";
import { SHEEN_OPTIONS } from "@/lib/types";
import { revalidatePath } from "next/cache";

// Maps a slot kind to its Prisma model delegate (all have an estimateId column).
const SLOT_DELEGATE: Record<PaintSlotKind, any> = {
  room: () => prisma.room,
  cabinet: () => prisma.cabinetSet,
  deck: () => prisma.deckArea,
  exterior: () => prisma.exteriorHouse,
  door: () => prisma.exteriorDoor,
  shutter: () => prisma.exteriorShutter,
  garage: () => prisma.exteriorGarageDoor,
  custom: () => prisma.customArea,
};

/**
 * Client-facing: change the paint on one surface of a proposal's estimate.
 * Validates the surface belongs to this proposal, is client-selectable, and that
 * the new paint is in the SAME category (so a client can't swap to an
 * off-category/cheaper paint). Persists to the estimate so the accepted proposal,
 * PDF, and budget all reflect the choice.
 */
export async function selectPaintPublic(
  proposalId: number,
  ref: PaintSlotRef,
  paintId: number
): Promise<ActionResult> {
  try {
    if (!ref || !isValidSlotField(ref.kind, ref.field)) {
      return { success: false, error: "Invalid surface." };
    }
    const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
    if (!proposal) return { success: false, error: "Proposal not found." };
    if (proposal.signedAt) return { success: false, error: "This proposal has already been accepted." };

    const newPaint = await prisma.priceBookItem.findUnique({ where: { id: paintId } });
    if (!newPaint || newPaint.type !== "paint") return { success: false, error: "Paint not found." };
    if (!CLIENT_SELECTABLE_CATEGORIES.includes(newPaint.category)) {
      return { success: false, error: "That paint cannot be selected." };
    }

    // Reuse the exact slot logic to validate ownership + category match.
    const [est, catalog, rd] = await Promise.all([
      prisma.estimate.findUnique({ where: { id: proposal.estimateId }, include: ESTIMATE_INCLUDE }),
      getPaintCatalog(),
      getCurrentRatesAndDefaults(),
    ]);
    if (!est) return { success: false, error: "Estimate not found." };
    const slots = extractPaintSlots(toFullEstimateInput(est as any, catalog, rd.defaults), catalog);
    const slot = slots.find((s) => s.ref.kind === ref.kind && s.ref.id === ref.id && s.ref.field === ref.field);
    if (!slot) return { success: false, error: "That surface can't be changed." };
    if (slot.category !== newPaint.category) {
      return { success: false, error: "Please pick a paint in the same category." };
    }

    const delegate = SLOT_DELEGATE[ref.kind]();
    const res = await delegate.updateMany({
      where: { id: ref.id, estimateId: proposal.estimateId },
      data: { [ref.field]: paintId },
    });
    if (res.count === 0) return { success: false, error: "Surface not found." };

    revalidatePath(`/proposals/${proposalId}/sign`);
    revalidatePath(`/proposals/${proposalId}`);
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to update paint." };
  }
}

/**
 * Client-facing: change the sheen/finish on one surface. Informational only (no
 * price impact). Persists to the matching sheen column on the estimate component.
 */
export async function selectSheenPublic(
  proposalId: number,
  ref: PaintSlotRef,
  sheen: string
): Promise<ActionResult> {
  try {
    if (!ref || !isValidSlotField(ref.kind, ref.field)) {
      return { success: false, error: "Invalid surface." };
    }
    if (!SHEEN_OPTIONS.includes(sheen as (typeof SHEEN_OPTIONS)[number])) {
      return { success: false, error: "Invalid sheen." };
    }
    const sheenCol = sheenFieldFor(ref.kind, ref.field);
    if (!sheenCol) return { success: false, error: "No sheen for this surface." };

    const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
    if (!proposal) return { success: false, error: "Proposal not found." };
    if (proposal.signedAt) return { success: false, error: "This proposal has already been accepted." };

    const delegate = SLOT_DELEGATE[ref.kind]();
    const res = await delegate.updateMany({
      where: { id: ref.id, estimateId: proposal.estimateId },
      data: { [sheenCol]: sheen },
    });
    if (res.count === 0) return { success: false, error: "Surface not found." };

    revalidatePath(`/proposals/${proposalId}/sign`);
    revalidatePath(`/proposals/${proposalId}`);
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to update sheen." };
  }
}

/** Snapshot the estimator's effective paint pick per client-selectable surface. */
async function captureRecommended(estimateId: number): Promise<Record<string, number>> {
  const [est, catalog, rd] = await Promise.all([
    prisma.estimate.findUnique({ where: { id: estimateId }, include: ESTIMATE_INCLUDE }),
    getPaintCatalog(),
    getCurrentRatesAndDefaults(),
  ]);
  const recommended: Record<string, number> = {};
  if (est) {
    const slots = extractPaintSlots(toFullEstimateInput(est as any, catalog, rd.defaults), catalog);
    for (const s of slots) recommended[slotKey(s.ref)] = s.currentPaintId;
  }
  return recommended;
}

/**
 * Client-facing: save the whole Color/Sheen sheet. Per surface: color name/code/
 * provider (stored in ColorSelection) + sheen (stored on the estimate component).
 */
export async function saveColorSheet(
  proposalId: number,
  rows: { kind: string; id: number; field: string; colorName: string; colorCode: string; provider: string; sheen: string }[]
): Promise<ActionResult> {
  try {
    const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
    if (!proposal) return { success: false, error: "Proposal not found." };
    const estimateId = proposal.estimateId;

    for (const r of rows) {
      if (!isValidSlotField(r.kind, r.field)) continue;
      const key = `${r.kind}:${r.id}:${r.field}`;
      await prisma.colorSelection.upsert({
        where: { estimateId_slotKey: { estimateId, slotKey: key } },
        update: { colorName: r.colorName ?? "", colorCode: r.colorCode ?? "", provider: r.provider ?? "" },
        create: { estimateId, slotKey: key, colorName: r.colorName ?? "", colorCode: r.colorCode ?? "", provider: r.provider ?? "" },
      });
      // Sheen → the estimate component's sheen column.
      if (SHEEN_OPTIONS.includes(r.sheen as (typeof SHEEN_OPTIONS)[number])) {
        const sheenCol = sheenFieldFor(r.kind, r.field);
        if (sheenCol) {
          const delegate = SLOT_DELEGATE[r.kind as PaintSlotKind]?.();
          if (delegate) await delegate.updateMany({ where: { id: r.id, estimateId }, data: { [sheenCol]: r.sheen } });
        }
      }
    }

    revalidatePath(`/proposals/${proposalId}/colors`);
    revalidatePath(`/color-sheets/${proposalId}`);
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to save color selections." };
  }
}

/** Create a proposal for an estimate, or return the existing one. */
export async function generateProposal(
  estimateId: number
): Promise<ActionResult<{ id: number }>> {
  try {
    const existing = await prisma.proposal.findUnique({ where: { estimateId } });
    if (existing) {
      // Self-heal: backfill the recommendation snapshot if an older proposal
      // never captured one (and the client hasn't signed/changed paints yet).
      if ((!existing.recommendedPaints || existing.recommendedPaints === "{}") && !existing.signedAt) {
        const recommended = await captureRecommended(estimateId);
        if (Object.keys(recommended).length) {
          await prisma.proposal.update({ where: { id: existing.id }, data: { recommendedPaints: JSON.stringify(recommended) } });
        }
      }
      return { success: true, data: { id: existing.id } };
    }

    const allNumbers = await prisma.proposal.findMany({
      select: { proposalNumber: true },
    });
    const proposalNumber = generateFormattedNumber(
      "PRO",
      allNumbers.map((p) => p.proposalNumber)
    );

    // Pre-select default SOPs.
    const defaults = await prisma.procedureTemplate.findMany({
      where: { isDefault: true },
      select: { id: true },
    });
    const includedSOPs = JSON.stringify(defaults.map((d) => d.id));

    // Snapshot the estimator's current paint pick per surface as the recommendation.
    const recommended = await captureRecommended(estimateId);

    const proposal = await prisma.proposal.create({
      data: { proposalNumber, estimateId, includedSOPs, recommendedPaints: JSON.stringify(recommended) },
    });

    revalidatePath("/proposals");
    revalidatePath(`/estimates/${estimateId}`);
    revalidatePath("/dashboard");
    return { success: true, data: { id: proposal.id } };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to generate proposal." };
  }
}

export async function setProposalStatus(
  id: number,
  status: string
): Promise<ActionResult> {
  try {
    const data: Record<string, unknown> = { status };
    if (status === "Sent") data.sentAt = new Date();

    const proposal = await prisma.proposal.update({ where: { id }, data });

    // Keep the estimate's status aligned with the proposal lifecycle.
    if (status === "Accepted") {
      await prisma.estimate.update({
        where: { id: proposal.estimateId },
        data: { status: "Accepted" },
      });
      await ensureBudgetEntry(proposal.estimateId);
    } else if (status === "Rejected") {
      await prisma.estimate.update({
        where: { id: proposal.estimateId },
        data: { status: "Rejected" },
      });
    } else if (status === "Sent") {
      await prisma.estimate.update({
        where: { id: proposal.estimateId },
        data: { status: "Sent" },
      });
    }

    revalidatePath("/proposals");
    revalidatePath(`/proposals/${id}`);
    revalidatePath("/dashboard");
    revalidatePath("/budget");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to update proposal status." };
  }
}

export async function markProposalSent(id: number): Promise<ActionResult> {
  return setProposalStatus(id, "Sent");
}

export async function updateProposalTier(
  id: number,
  tier: string
): Promise<ActionResult> {
  try {
    await prisma.proposal.update({ where: { id }, data: { selectedTier: tier } });
    revalidatePath(`/proposals/${id}`);
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to update tier." };
  }
}

export async function updateProposalSOPs(
  id: number,
  sopIds: number[]
): Promise<ActionResult> {
  try {
    await prisma.proposal.update({
      where: { id },
      data: { includedSOPs: JSON.stringify(sopIds) },
    });
    revalidatePath(`/proposals/${id}`);
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to update procedures." };
  }
}

export async function updateProposalNotes(
  id: number,
  customNotes: string
): Promise<ActionResult> {
  try {
    await prisma.proposal.update({ where: { id }, data: { customNotes } });
    revalidatePath(`/proposals/${id}`);
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to save notes." };
  }
}

export async function recordProposalView(id: number): Promise<ActionResult> {
  try {
    const p = await prisma.proposal.findUnique({ where: { id } });
    if (!p) return { success: false, error: "Not found." };
    // Only stamp the first view, and don't regress an already-decided proposal.
    if (!p.viewedAt && (p.status === "Sent" || p.status === "Pending")) {
      await prisma.proposal.update({
        where: { id },
        data: { viewedAt: new Date() },
      });
      revalidatePath("/proposals");
      revalidatePath(`/proposals/${id}`);
    }
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to record view." };
  }
}

/** Client-facing tier change from the signing page. */
export async function selectTierPublic(
  id: number,
  tier: string
): Promise<ActionResult> {
  try {
    await prisma.proposal.update({ where: { id }, data: { selectedTier: tier } });
    revalidatePath(`/proposals/${id}/sign`);
    revalidatePath(`/proposals/${id}`);
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to select tier." };
  }
}

/** Client signs and accepts the proposal. */
export async function signProposal(input: {
  id: number;
  signatureData: string;
  signatureName: string;
  selectedTier?: string;
}): Promise<ActionResult> {
  try {
    if (!input.signatureData || !input.signatureName.trim()) {
      return { success: false, error: "Signature and printed name are required." };
    }
    const proposal = await prisma.proposal.findUnique({
      where: { id: input.id },
    });
    if (!proposal) return { success: false, error: "Proposal not found." };
    if (proposal.signedAt) {
      return { success: false, error: "This proposal has already been signed." };
    }

    await prisma.proposal.update({
      where: { id: input.id },
      data: {
        signatureData: input.signatureData,
        signatureName: input.signatureName.trim(),
        signedAt: new Date(),
        status: "Accepted",
        ...(input.selectedTier && { selectedTier: input.selectedTier }),
      },
    });

    await prisma.estimate.update({
      where: { id: proposal.estimateId },
      data: { status: "Accepted" },
    });
    await ensureBudgetEntry(proposal.estimateId);

    revalidatePath("/proposals");
    revalidatePath(`/proposals/${input.id}`);
    revalidatePath(`/proposals/${input.id}/sign`);
    revalidatePath("/dashboard");
    revalidatePath("/budget");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to record signature." };
  }
}

export async function deleteProposal(id: number): Promise<ActionResult> {
  try {
    const p = await prisma.proposal.findUnique({ where: { id } });
    await prisma.proposal.delete({ where: { id } });
    revalidatePath("/proposals");
    if (p) revalidatePath(`/estimates/${p.estimateId}`);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to delete proposal." };
  }
}
