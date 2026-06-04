import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ESTIMATE_INCLUDE } from "@/lib/estimateCalc";
import { getCurrentRatesAndDefaults, parseRatesSnapshot } from "@/lib/jobRates";
import { customerName, toDateInput } from "@/lib/format";
import { BuilderState } from "@/lib/builderState";
import { MaterialCatalogEntry, PaintDefaults } from "@/lib/types";
import { JobRates } from "@/lib/calculations";
import { ItemMaterialPayload } from "@/lib/types";
import { PaintOption } from "./builderUI";
import EstimateBuilder from "./EstimateBuilder";

export const dynamic = "force-dynamic";

function parseMats(json: string | null | undefined): ItemMaterialPayload[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr.map((m: any) => ({ priceBookItemId: m.priceBookItemId ?? null, name: m.name ?? "", unit: m.unit ?? "each", quantity: Number(m.quantity) || 0, unitCost: Number(m.unitCost) || 0, markup: Number(m.markup) || 0 }));
  } catch {
    return [];
  }
}

export default async function EstimateBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const estimateId = parseInt(id, 10);
  if (isNaN(estimateId)) notFound();

  const [estimate, customers, settings, priceItems, rd] = await Promise.all([
    prisma.estimate.findUnique({
      where: { id: estimateId },
      include: { ...ESTIMATE_INCLUDE, proposal: true },
    }),
    prisma.customer.findMany({ orderBy: { firstName: "asc" } }),
    prisma.businessSettings.findUnique({ where: { id: 1 } }),
    prisma.priceBookItem.findMany({ orderBy: [{ type: "asc" }, { sortOrder: "asc" }] }),
    getCurrentRatesAndDefaults(),
  ]);

  if (!estimate) notFound();

  const paintItems: PaintOption[] = priceItems
    .filter((p) => p.type === "paint")
    .map((p) => ({ id: p.id, name: p.name, brand: p.brand, unitCost: p.unitCost, markup: p.markup, coverage: p.coverage, category: p.category }));
  const materialItems: MaterialCatalogEntry[] = priceItems
    .filter((p) => p.type === "material")
    .map((p) => ({ id: p.id, name: p.name, brand: p.brand, unit: p.unit, unitCost: p.unitCost, markup: p.markup }));

  // Rates: use the estimate's snapshot, or fall back to current master rates.
  const rates: JobRates = estimate.ratesSnapshot
    ? parseRatesSnapshot(estimate.ratesSnapshot)
    : rd.rates;
  const defaults: PaintDefaults = rd.defaults;

  const initial: BuilderState = {
    setup: {
      projectName: estimate.projectName,
      customerId: estimate.customerId,
      street: estimate.street,
      city: estimate.city,
      state: estimate.state,
      zip: estimate.zip,
      status: estimate.status,
      startDate: estimate.startDate ? toDateInput(estimate.startDate) : null,
      endDate: estimate.endDate ? toDateInput(estimate.endDate) : null,
      completedAt: estimate.completedAt ? toDateInput(estimate.completedAt) : null,
      durationDays: estimate.durationDays,
      taxRate: estimate.taxRate,
      discountType: estimate.discountType,
      discountValue: estimate.discountValue,
      notes: estimate.notes,
    },
    rates,
    rooms: estimate.rooms.map((r) => ({
      id: r.id,
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
      wallSheen: r.wallSheen,
      ceilingSheen: r.ceilingSheen,
      trimSheen: r.trimSheen,
      wallPaintId: r.wallPaintId,
      ceilingPaintId: r.ceilingPaintId,
      trimPaintId: r.trimPaintId,
      wallPrimerPaintId: r.wallPrimerPaintId, wallPrimerCoats: r.wallPrimerCoats, wallPrimerSqftAdjust: r.wallPrimerSqftAdjust,
      ceilingPrimerPaintId: r.ceilingPrimerPaintId, ceilingPrimerCoats: r.ceilingPrimerCoats, ceilingPrimerSqftAdjust: r.ceilingPrimerSqftAdjust,
      trimPrimerPaintId: r.trimPrimerPaintId, trimPrimerCoats: r.trimPrimerCoats, trimPrimerSqftAdjust: r.trimPrimerSqftAdjust,
      materials: parseMats(r.materials),
      sortOrder: r.sortOrder,
      deductions: r.deductions.map((d) => ({ label: d.label, kind: d.kind, width: d.width, height: d.height, includeTrim: d.includeTrim })),
      accentWalls: r.accentWalls.map((a) => ({ label: a.label, length: a.length, height: a.height, coats: a.coats, product: a.product, paintId: a.paintId })),
    })),
    cabinetSets: estimate.cabinetSets.map((c) => ({ id: c.id, name: c.name, doorCount: c.doorCount, drawerCount: c.drawerCount, frameCount: c.frameCount, coats: c.coats, primerCoats: c.primerCoats, primerProduct: c.primerProduct, paintProduct: c.paintProduct, sheen: c.sheen, paintId: c.paintId, primerId: c.primerId, materials: parseMats(c.materials), sortOrder: c.sortOrder })),
    deckAreas: estimate.deckAreas.map((d) => ({ id: d.id, name: d.name, floorLength: d.floorLength, floorWidth: d.floorWidth, includeRailing: d.includeRailing, railingLinFt: d.railingLinFt, stepCount: d.stepCount, includeLattice: d.includeLattice, latticeSqFt: d.latticeSqFt, coats: d.coats, powerWashCost: d.powerWashCost, woodReplCost: d.woodReplCost, floorSheen: d.floorSheen, railSheen: d.railSheen, floorStainId: d.floorStainId, railStainId: d.railStainId, primerPaintId: d.primerPaintId, primerCoats: d.primerCoats, primerSqftAdjust: d.primerSqftAdjust, materials: parseMats(d.materials), sortOrder: d.sortOrder })),
    exteriorHouses: estimate.exteriorHouses.map((h) => ({ id: h.id, name: h.name, sidingLength: h.sidingLength, sidingWidth: h.sidingWidth, sidingHeight: h.sidingHeight, sidingSqftAdjust: h.sidingSqftAdjust, sidingMaterial: h.sidingMaterial, coats: h.coats, paintProduct: h.paintProduct, sheen: h.sheen, paintId: h.paintId, primerPaintId: h.primerPaintId, primerCoats: h.primerCoats, primerSqftAdjust: h.primerSqftAdjust, materials: parseMats(h.materials), sortOrder: h.sortOrder, deductions: h.deductions.map((d) => ({ label: d.label, width: d.width, height: d.height })), replacements: h.replacements.map((r) => ({ description: r.description, cost: r.cost })) })),
    exteriorDoors: estimate.exteriorDoors.map((d) => ({ id: d.id, name: d.name, count: d.count, width: d.width, height: d.height, paintedSides: d.paintedSides, coats: d.coats, paintProduct: d.paintProduct, sheen: d.sheen, paintId: d.paintId, primerPaintId: d.primerPaintId, primerCoats: d.primerCoats, primerSqftAdjust: d.primerSqftAdjust, materials: parseMats(d.materials), sortOrder: d.sortOrder })),
    exteriorShutters: estimate.exteriorShutters.map((s) => ({ id: s.id, name: s.name, story1: s.story1, story2: s.story2, story3: s.story3, customQty: s.customQty, customRate: s.customRate, coats: s.coats, paintProduct: s.paintProduct, sheen: s.sheen, paintId: s.paintId, primerPaintId: s.primerPaintId, primerCoats: s.primerCoats, primerSqftAdjust: s.primerSqftAdjust, materials: parseMats(s.materials), sortOrder: s.sortOrder })),
    garageDoors: estimate.garageDoors.map((g) => ({ id: g.id, name: g.name, count: g.count, width: g.width, height: g.height, coats: g.coats, paintProduct: g.paintProduct, sheen: g.sheen, paintId: g.paintId, primerPaintId: g.primerPaintId, primerCoats: g.primerCoats, primerSqftAdjust: g.primerSqftAdjust, materials: parseMats(g.materials), sortOrder: g.sortOrder })),
    customAreas: estimate.customAreas.map((c) => ({ id: c.id, label: c.label, measureType: c.measureType, amount: c.amount, rate: c.rate, coats: c.coats, paintProduct: c.paintProduct, sheen: c.sheen, paintId: c.paintId, primerPaintId: c.primerPaintId, primerCoats: c.primerCoats, primerSqftAdjust: c.primerSqftAdjust, materials: parseMats(c.materials), sortOrder: c.sortOrder })),
    lineItems: estimate.lineItems.map((li) => ({ id: li.id, description: li.description, category: li.category, quantity: li.quantity, unitCost: li.unitCost, markup: li.markup, taxable: li.taxable, unit: li.unit, priceBookItemId: li.priceBookItemId, sortOrder: li.sortOrder })),
    overheadItems: estimate.overheadItems.map((o) => ({ id: o.id, description: o.description, cost: o.cost, markup: o.markup, sortOrder: o.sortOrder })),
    photos: estimate.photos.map((p) => ({ id: p.id, url: p.url, caption: p.caption, sortOrder: p.sortOrder })),
  };

  const customerOptions = customers.map((c) => ({
    id: c.id,
    label: `${customerName(c)}${c.company ? ` · ${c.company}` : ""} (${c.customerNumber})`,
  }));

  return (
    <EstimateBuilder
      estimateId={estimate.id}
      estimateNumber={estimate.estimateNumber}
      initial={initial}
      customers={customerOptions}
      tierConfig={{
        midDepositPercent: settings?.midDepositPercent ?? 15,
        midDepositDiscount: settings?.midDepositDiscount ?? 3,
        maxDepositPercent: settings?.maxDepositPercent ?? 30,
        maxDepositDiscount: settings?.maxDepositDiscount ?? 6,
      }}
      hasProposal={!!estimate.proposal}
      proposalId={estimate.proposal?.id ?? null}
      paintItems={paintItems}
      materialItems={materialItems}
      currentRates={rd.rates}
      defaults={defaults}
      warrantyMonths={settings?.warrantyMonths ?? 24}
    />
  );
}
