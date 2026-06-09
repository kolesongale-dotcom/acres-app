"use server";

import { prisma } from "@/lib/prisma";
import { ActionResult } from "@/lib/types";
import { generateFormattedNumber } from "@/lib/idGenerator";
import { ESTIMATE_INCLUDE, computeEstimate } from "@/lib/estimateCalc";
import { getPaintCatalog } from "@/lib/priceCatalog";
import { getCurrentRatesAndDefaults } from "@/lib/jobRates";
import { calcTiers } from "@/lib/calculations";
import { revalidatePath } from "next/cache";

const DUE_DAYS_DEFAULT = 14;

interface InvoiceSnapshot {
  proposalId: number | null;
  tier: string;
  tierLabel: string;
  changeOrderId: number | null;
  subtotal: number;
  total: number;
  lineItems: { name: string; total: number }[];
}

/** Build the invoice figures for a job = accepted-tier total (+ optional change order). */
async function computeInvoiceSnapshot(estimateId: number, changeOrderId?: number | null): Promise<InvoiceSnapshot | null> {
  const [est, proposal, biz, catalog, rd, co] = await Promise.all([
    prisma.estimate.findUnique({ where: { id: estimateId }, include: ESTIMATE_INCLUDE }),
    prisma.proposal.findUnique({ where: { estimateId } }),
    prisma.businessSettings.findUnique({ where: { id: 1 } }),
    getPaintCatalog(),
    getCurrentRatesAndDefaults(),
    changeOrderId ? prisma.changeOrder.findUnique({ where: { id: changeOrderId } }) : Promise.resolve(null),
  ]);
  if (!est) return null;

  const { services, totals } = computeEstimate(est as any, catalog, rd.defaults);
  const tiers = calcTiers(totals.grandTotal, {
    midDepositPercent: biz?.midDepositPercent ?? 15,
    midDepositDiscount: biz?.midDepositDiscount ?? 3,
    maxDepositPercent: biz?.maxDepositPercent ?? 30,
    maxDepositDiscount: biz?.maxDepositDiscount ?? 6,
  });
  const tier = proposal?.selectedTier ?? "full";
  const chosen =
    tier === "mid" ? { total: tiers.mid.total, label: tiers.mid.label }
    : tier === "max" ? { total: tiers.max.total, label: tiers.max.label }
    : { total: tiers.full.total, label: "Full Price" };

  const lineItems = [
    ...services.map((s) => ({ name: s.name, total: s.total })),
    ...(est.overheadItems ?? []).map((o: any) => ({ name: o.description || "Project cost", total: o.cost * (1 + o.markup / 100) })),
  ].filter((l) => l.total !== 0);

  let subtotal = totals.grandTotal;
  let total = chosen.total;
  if (co) {
    let col: { description: string; amount: number }[] = [];
    try { const p = JSON.parse(co.lineItemsJson); if (Array.isArray(p)) col = p; } catch { /* ignore */ }
    const coLines = col.length
      ? col.map((l) => ({ name: `Change Order ${co.changeOrderNumber}: ${l.description || "Change"}`, total: Number(l.amount) || 0 }))
      : [{ name: `Change Order ${co.changeOrderNumber}`, total: co.total }];
    lineItems.push(...coLines.filter((l) => l.total !== 0));
    subtotal += co.total;
    total += co.total;
  }

  return { proposalId: proposal?.id ?? null, tier, tierLabel: chosen.label, changeOrderId: co?.id ?? null, subtotal, total, lineItems };
}

/** Create the invoice for an accepted estimate, or return the existing one (no change order). */
export async function generateInvoice(estimateId: number): Promise<ActionResult<{ id: number }>> {
  try {
    const existing = await prisma.invoice.findUnique({ where: { estimateId } });
    if (existing) return { success: true, data: { id: existing.id } };

    const snap = await computeInvoiceSnapshot(estimateId, null);
    if (!snap) return { success: false, error: "Estimate not found." };

    const allNumbers = await prisma.invoice.findMany({ select: { invoiceNumber: true } });
    const invoiceNumber = generateFormattedNumber("INV", allNumbers.map((i) => i.invoiceNumber));

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber, estimateId, proposalId: snap.proposalId, tier: snap.tier, tierLabel: snap.tierLabel,
        changeOrderId: snap.changeOrderId, subtotal: snap.subtotal, total: snap.total,
        lineItemsJson: JSON.stringify(snap.lineItems), dueDate: new Date(Date.now() + DUE_DAYS_DEFAULT * 86400000),
      },
    });
    revalidatePath("/invoices");
    revalidatePath(`/proposals/${snap.proposalId ?? ""}`);
    return { success: true, data: { id: invoice.id } };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to create invoice." };
  }
}

/**
 * Build (or rebuild) a job's invoice from a chosen proposal + optional change
 * order. If an invoice already exists for the job, its figures are updated
 * (payments, due date, and notes are preserved).
 */
export async function buildInvoice(proposalId: number, changeOrderId: number | null): Promise<ActionResult<{ id: number }>> {
  try {
    const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
    if (!proposal) return { success: false, error: "Pick a proposal." };
    const snap = await computeInvoiceSnapshot(proposal.estimateId, changeOrderId);
    if (!snap) return { success: false, error: "Estimate not found." };

    const existing = await prisma.invoice.findUnique({ where: { estimateId: proposal.estimateId } });
    if (existing) {
      await prisma.invoice.update({
        where: { id: existing.id },
        data: { proposalId, tier: snap.tier, tierLabel: snap.tierLabel, changeOrderId: snap.changeOrderId, subtotal: snap.subtotal, total: snap.total, lineItemsJson: JSON.stringify(snap.lineItems) },
      });
      revalidatePath("/invoices");
      revalidatePath(`/invoices/${existing.id}`);
      return { success: true, data: { id: existing.id } };
    }

    const allNumbers = await prisma.invoice.findMany({ select: { invoiceNumber: true } });
    const invoiceNumber = generateFormattedNumber("INV", allNumbers.map((i) => i.invoiceNumber));
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber, estimateId: proposal.estimateId, proposalId, tier: snap.tier, tierLabel: snap.tierLabel,
        changeOrderId: snap.changeOrderId, subtotal: snap.subtotal, total: snap.total,
        lineItemsJson: JSON.stringify(snap.lineItems), dueDate: new Date(Date.now() + DUE_DAYS_DEFAULT * 86400000),
      },
    });
    revalidatePath("/invoices");
    return { success: true, data: { id: invoice.id } };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to build invoice." };
  }
}

export async function updateInvoice(
  id: number,
  input: { dueDate?: string; notes?: string; paymentLink?: string }
): Promise<ActionResult> {
  try {
    await prisma.invoice.update({
      where: { id },
      data: {
        ...(input.dueDate !== undefined && { dueDate: new Date(input.dueDate) }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.paymentLink !== undefined && { paymentLink: input.paymentLink.trim() }),
      },
    });
    revalidatePath(`/invoices/${id}`);
    revalidatePath("/invoices");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to update invoice." };
  }
}

export async function addPayment(
  invoiceId: number,
  input: { amount: number; paidAt: string; note: string }
): Promise<ActionResult> {
  try {
    if (!(input.amount > 0)) return { success: false, error: "Enter a payment amount greater than 0." };
    await prisma.payment.create({
      data: {
        invoiceId,
        amount: input.amount,
        paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
        note: input.note ?? "",
      },
    });
    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath("/invoices");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to record payment." };
  }
}

export async function deletePayment(id: number, invoiceId: number): Promise<ActionResult> {
  try {
    await prisma.payment.delete({ where: { id } });
    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath("/invoices");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to delete payment." };
  }
}

export async function deleteInvoice(id: number): Promise<ActionResult> {
  try {
    await prisma.invoice.delete({ where: { id } });
    revalidatePath("/invoices");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to delete invoice." };
  }
}
