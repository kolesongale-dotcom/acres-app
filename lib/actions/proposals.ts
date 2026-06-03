"use server";

import { prisma } from "@/lib/prisma";
import { generateFormattedNumber } from "@/lib/idGenerator";
import { ActionResult } from "@/lib/types";
import { ensureBudgetEntry } from "@/lib/actions/estimates";
import { revalidatePath } from "next/cache";

/** Create a proposal for an estimate, or return the existing one. */
export async function generateProposal(
  estimateId: number
): Promise<ActionResult<{ id: number }>> {
  try {
    const existing = await prisma.proposal.findUnique({ where: { estimateId } });
    if (existing) {
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

    const proposal = await prisma.proposal.create({
      data: { proposalNumber, estimateId, includedSOPs },
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
