"use server";

import { prisma } from "@/lib/prisma";
import { generateFormattedNumber } from "@/lib/idGenerator";
import { ActionResult, FullEstimatePayload } from "@/lib/types";
import { ESTIMATE_INCLUDE, computeEstimate } from "@/lib/estimateCalc";
import { getPaintCatalog } from "@/lib/priceCatalog";
import { getCurrentRatesAndDefaults } from "@/lib/jobRates";
import { calcTiers, type CalcLineItem } from "@/lib/calculations";
import { revalidatePath } from "next/cache";

/** Split Material-category lines into paint/primer cost vs other materials cost (at unit cost, no markup). */
function budgetCostBreakdown(lines: CalcLineItem[]): { paint: number; material: number } {
  let paint = 0, material = 0;
  for (const l of lines) {
    if (l.category !== "Material") continue;
    const cost = (Number(l.unitCost) || 0) * (Number(l.quantity) || 0);
    if (/^Paint — |^Primer — /.test(l.description)) paint += cost;
    else material += cost;
  }
  return { paint, material };
}

/** Budget revenue = the price of the proposal's accepted tier (full price if none). */
async function budgetRevenue(estimateId: number, grandTotal: number): Promise<number> {
  const [proposal, biz] = await Promise.all([
    prisma.proposal.findUnique({ where: { estimateId } }),
    prisma.businessSettings.findUnique({ where: { id: 1 } }),
  ]);
  const tiers = calcTiers(grandTotal, {
    midDepositPercent: biz?.midDepositPercent ?? 15,
    midDepositDiscount: biz?.midDepositDiscount ?? 3,
    maxDepositPercent: biz?.maxDepositPercent ?? 30,
    maxDepositDiscount: biz?.maxDepositDiscount ?? 6,
  });
  const tier = proposal?.selectedTier ?? "full";
  return tier === "mid" ? tiers.mid.total : tier === "max" ? tiers.max.total : tiers.full.total;
}

export async function createEstimate(
  customerId?: number | null
): Promise<ActionResult<{ id: number }>> {
  try {
    const existing = await prisma.estimate.findMany({
      select: { estimateNumber: true },
    });
    const estimateNumber = generateFormattedNumber(
      "EST",
      existing.map((e) => e.estimateNumber)
    );

    let prefill: { street?: string; city?: string; state?: string; zip?: string } =
      {};
    if (customerId) {
      const cust = await prisma.customer.findUnique({ where: { id: customerId } });
      if (cust) {
        prefill = {
          street: cust.street,
          city: cust.city,
          state: cust.state,
          zip: cust.zip,
        };
      }
    }

    const settings = await prisma.businessSettings.findUnique({ where: { id: 1 } });
    const { rates } = await getCurrentRatesAndDefaults();

    const estimate = await prisma.estimate.create({
      data: {
        estimateNumber,
        customerId: customerId ?? null,
        ...prefill,
        taxRate: settings?.globalTaxRate ?? 0,
        ratesSnapshot: JSON.stringify(rates),
      },
    });

    revalidatePath("/estimates");
    revalidatePath("/dashboard");
    return { success: true, data: { id: estimate.id } };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to create estimate." };
  }
}

export async function deleteEstimate(id: number): Promise<ActionResult> {
  try {
    await prisma.estimate.delete({ where: { id } });
    revalidatePath("/estimates");
    revalidatePath("/dashboard");
    revalidatePath("/budget");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to delete estimate." };
  }
}

/**
 * Save the full estimate from the builder. Setup fields are updated in place;
 * all sub-collections are replaced (delete + recreate) for simplicity and
 * correctness in this single-user local app.
 */
export async function saveEstimate(
  payload: FullEstimatePayload
): Promise<ActionResult> {
  const { id, setup } = payload;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.estimate.update({
        where: { id },
        data: {
          projectName: setup.projectName,
          customerId: setup.customerId,
          street: setup.street,
          city: setup.city,
          state: setup.state || "PA",
          zip: setup.zip,
          status: setup.status,
          startDate: setup.startDate ? new Date(setup.startDate) : null,
          endDate: setup.endDate ? new Date(setup.endDate) : null,
          durationDays: setup.durationDays,
          taxRate: setup.taxRate,
          discountType: setup.discountType,
          discountValue: setup.discountValue,
          ratesSnapshot: JSON.stringify(payload.rates),
          notes: setup.notes,
        },
      });

      // Wipe child collections
      await tx.room.deleteMany({ where: { estimateId: id } });
      await tx.cabinetSet.deleteMany({ where: { estimateId: id } });
      await tx.deckArea.deleteMany({ where: { estimateId: id } });
      await tx.exteriorHouse.deleteMany({ where: { estimateId: id } });
      await tx.exteriorDoor.deleteMany({ where: { estimateId: id } });
      await tx.exteriorShutter.deleteMany({ where: { estimateId: id } });
      await tx.exteriorGarageDoor.deleteMany({ where: { estimateId: id } });
      await tx.customArea.deleteMany({ where: { estimateId: id } });
      await tx.estimatePhoto.deleteMany({ where: { estimateId: id } });
      await tx.estimateLineItem.deleteMany({ where: { estimateId: id } });
      await tx.overheadItem.deleteMany({ where: { estimateId: id } });

      // Rooms (with nested deductions + accent walls)
      for (let i = 0; i < payload.rooms.length; i++) {
        const r = payload.rooms[i];
        await tx.room.create({
          data: {
            estimateId: id,
            name: r.name,
            length: r.length,
            width: r.width,
            height: r.height,
            paintWalls: r.paintWalls,
            paintCeiling: r.paintCeiling,
            paintTrim: r.paintTrim,
            wallCoats: r.wallCoats,
            ceilingCoats: r.ceilingCoats,
            trimCoats: r.trimCoats,
            wallSqftAdjust: r.wallSqftAdjust,
            ceilingSqftAdjust: r.ceilingSqftAdjust,
            trimLfAdjust: r.trimLfAdjust,
            wallProduct: r.wallProduct,
            ceilingProduct: r.ceilingProduct,
            trimProduct: r.trimProduct,
            wallPaintId: r.wallPaintId,
            ceilingPaintId: r.ceilingPaintId,
            trimPaintId: r.trimPaintId,
            wallPrimerPaintId: r.wallPrimerPaintId,
            wallPrimerCoats: r.wallPrimerCoats,
            wallPrimerSqftAdjust: r.wallPrimerSqftAdjust,
            ceilingPrimerPaintId: r.ceilingPrimerPaintId,
            ceilingPrimerCoats: r.ceilingPrimerCoats,
            ceilingPrimerSqftAdjust: r.ceilingPrimerSqftAdjust,
            trimPrimerPaintId: r.trimPrimerPaintId,
            trimPrimerCoats: r.trimPrimerCoats,
            trimPrimerSqftAdjust: r.trimPrimerSqftAdjust,
            materials: JSON.stringify(r.materials ?? []),
            sortOrder: i,
            deductions: {
              create: r.deductions.map((d) => ({
                label: d.label,
                kind: d.kind,
                width: d.width,
                height: d.height,
                includeTrim: d.includeTrim,
              })),
            },
            accentWalls: {
              create: r.accentWalls.map((a) => ({
                label: a.label,
                length: a.length,
                height: a.height,
                coats: a.coats,
                product: a.product,
                paintId: a.paintId,
              })),
            },
          },
        });
      }

      // Cabinet sets
      for (let i = 0; i < payload.cabinetSets.length; i++) {
        const c = payload.cabinetSets[i];
        await tx.cabinetSet.create({
          data: {
            estimateId: id,
            name: c.name,
            doorCount: c.doorCount,
            drawerCount: c.drawerCount,
            frameCount: c.frameCount,
            coats: c.coats,
            primerCoats: c.primerCoats,
            primerProduct: c.primerProduct,
            paintProduct: c.paintProduct,
            paintId: c.paintId,
            primerId: c.primerId,
            materials: JSON.stringify(c.materials ?? []),
            sortOrder: i,
          },
        });
      }

      // Decks
      for (let i = 0; i < payload.deckAreas.length; i++) {
        const d = payload.deckAreas[i];
        await tx.deckArea.create({
          data: {
            estimateId: id,
            name: d.name,
            floorLength: d.floorLength,
            floorWidth: d.floorWidth,
            includeRailing: d.includeRailing,
            railingLinFt: d.railingLinFt,
            stepCount: d.stepCount,
            includeLattice: d.includeLattice,
            latticeSqFt: d.latticeSqFt,
            coats: d.coats,
            powerWashCost: d.powerWashCost,
            woodReplCost: d.woodReplCost,
            floorStainId: d.floorStainId,
            railStainId: d.railStainId,
            primerPaintId: d.primerPaintId,
            primerCoats: d.primerCoats,
            primerSqftAdjust: d.primerSqftAdjust,
            materials: JSON.stringify(d.materials ?? []),
            sortOrder: i,
          },
        });
      }

      // Exterior houses (with nested deductions + replacements)
      for (let i = 0; i < payload.exteriorHouses.length; i++) {
        const h = payload.exteriorHouses[i];
        await tx.exteriorHouse.create({
          data: {
            estimateId: id,
            name: h.name,
            sidingLength: h.sidingLength,
            sidingWidth: h.sidingWidth,
            sidingHeight: h.sidingHeight,
            sidingSqftAdjust: h.sidingSqftAdjust,
            sidingMaterial: h.sidingMaterial,
            coats: h.coats,
            paintProduct: h.paintProduct,
            paintId: h.paintId,
            primerPaintId: h.primerPaintId,
            primerCoats: h.primerCoats,
            primerSqftAdjust: h.primerSqftAdjust,
            materials: JSON.stringify(h.materials ?? []),
            sortOrder: i,
            deductions: {
              create: h.deductions.map((d) => ({
                label: d.label,
                width: d.width,
                height: d.height,
              })),
            },
            replacements: {
              create: h.replacements.map((r) => ({
                description: r.description,
                cost: r.cost,
              })),
            },
          },
        });
      }

      // Doors
      for (let i = 0; i < payload.exteriorDoors.length; i++) {
        const d = payload.exteriorDoors[i];
        await tx.exteriorDoor.create({
          data: {
            estimateId: id,
            name: d.name,
            count: d.count,
            width: d.width,
            height: d.height,
            paintedSides: d.paintedSides,
            coats: d.coats,
            paintProduct: d.paintProduct,
            paintId: d.paintId,
            primerPaintId: d.primerPaintId,
            primerCoats: d.primerCoats,
            primerSqftAdjust: d.primerSqftAdjust,
            materials: JSON.stringify(d.materials ?? []),
            sortOrder: i,
          },
        });
      }

      // Shutters
      for (let i = 0; i < payload.exteriorShutters.length; i++) {
        const s = payload.exteriorShutters[i];
        await tx.exteriorShutter.create({
          data: {
            estimateId: id,
            name: s.name,
            story1: s.story1,
            story2: s.story2,
            story3: s.story3,
            customQty: s.customQty,
            customRate: s.customRate,
            coats: s.coats,
            paintProduct: s.paintProduct,
            paintId: s.paintId,
            primerPaintId: s.primerPaintId,
            primerCoats: s.primerCoats,
            primerSqftAdjust: s.primerSqftAdjust,
            materials: JSON.stringify(s.materials ?? []),
            sortOrder: i,
          },
        });
      }

      // Garage doors
      for (let i = 0; i < payload.garageDoors.length; i++) {
        const g = payload.garageDoors[i];
        await tx.exteriorGarageDoor.create({
          data: {
            estimateId: id,
            name: g.name,
            count: g.count,
            width: g.width,
            height: g.height,
            coats: g.coats,
            paintProduct: g.paintProduct,
            paintId: g.paintId,
            primerPaintId: g.primerPaintId,
            primerCoats: g.primerCoats,
            primerSqftAdjust: g.primerSqftAdjust,
            materials: JSON.stringify(g.materials ?? []),
            sortOrder: i,
          },
        });
      }

      // Custom areas
      for (let i = 0; i < payload.customAreas.length; i++) {
        const c = payload.customAreas[i];
        await tx.customArea.create({
          data: {
            estimateId: id,
            label: c.label,
            measureType: c.measureType,
            amount: c.amount,
            rate: c.rate,
            coats: c.coats,
            paintProduct: c.paintProduct,
            paintId: c.paintId,
            primerPaintId: c.primerPaintId,
            primerCoats: c.primerCoats,
            primerSqftAdjust: c.primerSqftAdjust,
            materials: JSON.stringify(c.materials ?? []),
            sortOrder: i,
          },
        });
      }

      // Manual line items
      for (let i = 0; i < payload.lineItems.length; i++) {
        const li = payload.lineItems[i];
        await tx.estimateLineItem.create({
          data: {
            estimateId: id,
            description: li.description,
            category: li.category,
            quantity: li.quantity,
            unitCost: li.unitCost,
            markup: li.markup,
            taxable: li.taxable,
            unit: li.unit,
            priceBookItemId: li.priceBookItemId,
            sortOrder: i,
          },
        });
      }

      // Overhead items
      for (let i = 0; i < payload.overheadItems.length; i++) {
        const o = payload.overheadItems[i];
        await tx.overheadItem.create({
          data: {
            estimateId: id,
            description: o.description,
            cost: o.cost,
            markup: o.markup,
            sortOrder: i,
          },
        });
      }

      // Photos
      for (let i = 0; i < payload.photos.length; i++) {
        const ph = payload.photos[i];
        await tx.estimatePhoto.create({
          data: {
            estimateId: id,
            url: ph.url,
            caption: ph.caption,
            sortOrder: i,
          },
        });
      }
    });

    // If the estimate is Accepted, keep its budget entry estimates in sync.
    await syncBudgetEstimates(id);

    revalidatePath(`/estimates/${id}`);
    revalidatePath("/estimates");
    revalidatePath("/dashboard");
    revalidatePath("/budget");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to save estimate." };
  }
}

/** Re-pull the current master Job Rates into an estimate's snapshot. */
export async function refreshEstimateRates(
  id: number
): Promise<ActionResult<{ rates: import("@/lib/calculations").JobRates }>> {
  try {
    const { rates } = await getCurrentRatesAndDefaults();
    await prisma.estimate.update({ where: { id }, data: { ratesSnapshot: JSON.stringify(rates) } });
    revalidatePath(`/estimates/${id}`);
    return { success: true, data: { rates } };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to refresh rates." };
  }
}

export async function setEstimateStatus(
  id: number,
  status: string
): Promise<ActionResult> {
  try {
    await prisma.estimate.update({ where: { id }, data: { status } });
    if (status === "Accepted") {
      await ensureBudgetEntry(id);
    }
    revalidatePath("/estimates");
    revalidatePath(`/estimates/${id}`);
    revalidatePath("/dashboard");
    revalidatePath("/budget");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to update status." };
  }
}

/**
 * Create a BudgetEntry for an estimate if one doesn't exist, pre-populating
 * the estimated columns from the computed estimate totals.
 */
export async function ensureBudgetEntry(estimateId: number): Promise<void> {
  const existing = await prisma.budgetEntry.findUnique({ where: { estimateId } });
  const est = await prisma.estimate.findUnique({
    where: { id: estimateId },
    include: ESTIMATE_INCLUDE,
  });
  if (!est) return;
  const [catalog, rd] = await Promise.all([getPaintCatalog(), getCurrentRatesAndDefaults()]);
  const { generated, totals } = computeEstimate(est as any, catalog, rd.defaults);
  const { paint, material } = budgetCostBreakdown(generated);
  const revenue = await budgetRevenue(estimateId, totals.grandTotal);

  if (existing) {
    // Refresh the auto-derived figures; preserve actuals, notes, and the
    // owner's hand-entered expected labor.
    await prisma.budgetEntry.update({
      where: { estimateId },
      data: {
        estimatedRevenue: revenue,
        estimatedPaintCost: paint,
        estimatedMaterialCost: material,
      },
    });
  } else {
    await prisma.budgetEntry.create({
      data: {
        estimateId,
        estimatedRevenue: revenue,
        estimatedPaintCost: paint,
        estimatedMaterialCost: material,
        estimatedLaborCost: 0,
      },
    });
  }
}

/** Only refresh estimated budget figures when a budget entry already exists. */
async function syncBudgetEstimates(estimateId: number): Promise<void> {
  const existing = await prisma.budgetEntry.findUnique({ where: { estimateId } });
  if (existing) {
    await ensureBudgetEntry(estimateId);
  }
}
