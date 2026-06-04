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

/**
 * Create the invoice for an accepted estimate, or return the existing one.
 * Snapshots the accepted-tier total + the itemized line breakdown so the
 * invoice is a stable document.
 */
export async function generateInvoice(estimateId: number): Promise<ActionResult<{ id: number }>> {
  try {
    const existing = await prisma.invoice.findUnique({ where: { estimateId } });
    if (existing) return { success: true, data: { id: existing.id } };

    const [est, proposal, biz, catalog, rd] = await Promise.all([
      prisma.estimate.findUnique({ where: { id: estimateId }, include: ESTIMATE_INCLUDE }),
      prisma.proposal.findUnique({ where: { estimateId } }),
      prisma.businessSettings.findUnique({ where: { id: 1 } }),
      getPaintCatalog(),
      getCurrentRatesAndDefaults(),
    ]);
    if (!est) return { success: false, error: "Estimate not found." };

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

    // Snapshot line items (services + project overhead) for display.
    const lineItems = [
      ...services.map((s) => ({ name: s.name, total: s.total })),
      ...(est.overheadItems ?? []).map((o: any) => ({
        name: o.description || "Project cost",
        total: o.cost * (1 + o.markup / 100),
      })),
    ].filter((l) => l.total !== 0);

    const allNumbers = await prisma.invoice.findMany({ select: { invoiceNumber: true } });
    const invoiceNumber = generateFormattedNumber("INV", allNumbers.map((i) => i.invoiceNumber));

    const dueDate = new Date(Date.now() + DUE_DAYS_DEFAULT * 86400000);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        estimateId,
        proposalId: proposal?.id ?? null,
        tier,
        tierLabel: chosen.label,
        subtotal: totals.grandTotal,
        total: chosen.total,
        lineItemsJson: JSON.stringify(lineItems),
        dueDate,
      },
    });
    revalidatePath("/invoices");
    revalidatePath(`/proposals/${proposal?.id ?? ""}`);
    return { success: true, data: { id: invoice.id } };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to create invoice." };
  }
}

export async function updateInvoice(
  id: number,
  input: { dueDate?: string; notes?: string }
): Promise<ActionResult> {
  try {
    await prisma.invoice.update({
      where: { id },
      data: {
        ...(input.dueDate !== undefined && { dueDate: new Date(input.dueDate) }),
        ...(input.notes !== undefined && { notes: input.notes }),
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
