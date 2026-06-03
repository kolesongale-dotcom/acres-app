/**
 * Bridges a Prisma estimate (with relations) into the calc engine.
 * Rates from the snapshot; default paints from PaintDefaults; per-item materials
 * parsed from each component's `materials` JSON column.
 */
import {
  computeAll, FullEstimateInput, CalcLineItem, Totals, ServiceRow, PaintCatalog, PrimerInput, ItemMaterialInput,
} from "@/lib/calculations";
import { PaintDefaults } from "@/lib/types";
import { parseRatesSnapshot } from "@/lib/jobRates";

export const ESTIMATE_INCLUDE = {
  customer: true,
  rooms: { orderBy: { sortOrder: "asc" as const }, include: { deductions: true, accentWalls: true } },
  cabinetSets: { orderBy: { sortOrder: "asc" as const } },
  deckAreas: { orderBy: { sortOrder: "asc" as const } },
  exteriorHouses: { orderBy: { sortOrder: "asc" as const }, include: { deductions: true, replacements: true } },
  exteriorDoors: { orderBy: { sortOrder: "asc" as const } },
  exteriorShutters: { orderBy: { sortOrder: "asc" as const } },
  garageDoors: { orderBy: { sortOrder: "asc" as const } },
  customAreas: { orderBy: { sortOrder: "asc" as const } },
  photos: { orderBy: { sortOrder: "asc" as const } },
  lineItems: { orderBy: { sortOrder: "asc" as const } },
  overheadItems: { orderBy: { sortOrder: "asc" as const } },
};

const NO_DEFAULTS: PaintDefaults = {
  defaultWallPaintId: null, defaultCeilingPaintId: null, defaultTrimPaintId: null,
  defaultDeckFloorStainId: null, defaultDeckRailStainId: null, defaultSidingPaintId: null,
  defaultDoorPaintId: null, defaultShutterPaintId: null, defaultGaragePaintId: null,
};

const eff = (id: number | null | undefined, def: number | null): number | null => (id != null ? id : def ?? null);
const primer = (paintId: number | null | undefined, coats: number | undefined, adj: number | undefined): PrimerInput => ({ paintId: paintId ?? null, coats: coats ?? 1, sqftAdjust: adj ?? 0 });

function parseMaterials(json: string | null | undefined): ItemMaterialInput[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr.map((m: any) => ({ priceBookItemId: m.priceBookItemId ?? null, name: m.name ?? "", unit: m.unit ?? "", quantity: Number(m.quantity) || 0, unitCost: Number(m.unitCost) || 0, markup: Number(m.markup) || 0 }));
  } catch {
    return [];
  }
}

export function toFullEstimateInput(est: any, paintCatalog: PaintCatalog = {}, defaults: PaintDefaults = NO_DEFAULTS): FullEstimateInput {
  return {
    rates: parseRatesSnapshot(est.ratesSnapshot),
    taxRate: est.taxRate, discountType: est.discountType, discountValue: est.discountValue,
    paintCatalog,
    rooms: (est.rooms ?? []).map((r: any) => ({
      id: r.id, name: r.name, length: r.length, width: r.width, height: r.height,
      paintWalls: r.paintWalls, paintCeiling: r.paintCeiling, paintTrim: r.paintTrim,
      wallCoats: r.wallCoats, ceilingCoats: r.ceilingCoats, trimCoats: r.trimCoats,
      wallSqftAdjust: r.wallSqftAdjust ?? 0, ceilingSqftAdjust: r.ceilingSqftAdjust ?? 0, trimLfAdjust: r.trimLfAdjust ?? 0,
      wallPaintId: eff(r.wallPaintId, defaults.defaultWallPaintId),
      ceilingPaintId: eff(r.ceilingPaintId, defaults.defaultCeilingPaintId),
      trimPaintId: eff(r.trimPaintId, defaults.defaultTrimPaintId),
      wallPrimer: primer(r.wallPrimerPaintId, r.wallPrimerCoats, r.wallPrimerSqftAdjust),
      ceilingPrimer: primer(r.ceilingPrimerPaintId, r.ceilingPrimerCoats, r.ceilingPrimerSqftAdjust),
      trimPrimer: primer(r.trimPrimerPaintId, r.trimPrimerCoats, r.trimPrimerSqftAdjust),
      deductions: (r.deductions ?? []).map((d: any) => ({ kind: d.kind ?? "window", width: d.width, height: d.height, includeTrim: d.includeTrim ?? false })),
      accentWalls: (r.accentWalls ?? []).map((a: any) => ({ label: a.label, length: a.length, height: a.height, coats: a.coats ?? 2, paintId: eff(a.paintId, defaults.defaultWallPaintId) })),
      materials: parseMaterials(r.materials),
    })),
    cabinetSets: (est.cabinetSets ?? []).map((c: any) => ({ id: c.id, name: c.name, doorCount: c.doorCount, drawerCount: c.drawerCount, frameCount: c.frameCount, coats: c.coats ?? 2, primerCoats: c.primerCoats ?? 1, paintId: c.paintId, primerId: c.primerId, materials: parseMaterials(c.materials) })),
    deckAreas: (est.deckAreas ?? []).map((d: any) => ({ id: d.id, name: d.name, floorLength: d.floorLength, floorWidth: d.floorWidth, includeRailing: d.includeRailing ?? true, railingLinFt: d.railingLinFt, stepCount: d.stepCount, includeLattice: d.includeLattice ?? true, latticeSqFt: d.latticeSqFt, coats: d.coats ?? 2, powerWashCost: d.powerWashCost, woodReplCost: d.woodReplCost, floorStainId: eff(d.floorStainId, defaults.defaultDeckFloorStainId), railStainId: eff(d.railStainId, defaults.defaultDeckRailStainId), primer: primer(d.primerPaintId, d.primerCoats, d.primerSqftAdjust), materials: parseMaterials(d.materials) })),
    exteriorHouses: (est.exteriorHouses ?? []).map((h: any) => ({ id: h.id, name: h.name, sidingLength: h.sidingLength, sidingWidth: h.sidingWidth, sidingHeight: h.sidingHeight, sidingSqftAdjust: h.sidingSqftAdjust ?? 0, sidingMaterial: h.sidingMaterial, coats: h.coats ?? 2, paintId: eff(h.paintId, defaults.defaultSidingPaintId), primer: primer(h.primerPaintId, h.primerCoats, h.primerSqftAdjust), deductions: (h.deductions ?? []).map((d: any) => ({ width: d.width, height: d.height })), replacements: (h.replacements ?? []).map((r: any) => ({ description: r.description, cost: r.cost })), materials: parseMaterials(h.materials) })),
    exteriorDoors: (est.exteriorDoors ?? []).map((d: any) => ({ id: d.id, name: d.name, count: d.count, width: d.width, height: d.height, paintedSides: d.paintedSides ?? 1, coats: d.coats ?? 2, paintId: eff(d.paintId, defaults.defaultDoorPaintId), primer: primer(d.primerPaintId, d.primerCoats, d.primerSqftAdjust), materials: parseMaterials(d.materials) })),
    exteriorShutters: (est.exteriorShutters ?? []).map((s: any) => ({ id: s.id, name: s.name, story1: s.story1 ?? 0, story2: s.story2 ?? 0, story3: s.story3 ?? 0, customQty: s.customQty ?? 0, customRate: s.customRate ?? 0, coats: s.coats ?? 2, paintId: eff(s.paintId, defaults.defaultShutterPaintId), primer: primer(s.primerPaintId, s.primerCoats, s.primerSqftAdjust), materials: parseMaterials(s.materials) })),
    garageDoors: (est.garageDoors ?? []).map((g: any) => ({ id: g.id, name: g.name, count: g.count, width: g.width, height: g.height, coats: g.coats ?? 2, paintId: eff(g.paintId, defaults.defaultGaragePaintId), primer: primer(g.primerPaintId, g.primerCoats, g.primerSqftAdjust), materials: parseMaterials(g.materials) })),
    customAreas: (est.customAreas ?? []).map((c: any) => ({ id: c.id, label: c.label, measureType: c.measureType, amount: c.amount, rate: c.rate, coats: c.coats ?? 2, paintId: c.paintId, primer: primer(c.primerPaintId, c.primerCoats, c.primerSqftAdjust), materials: parseMaterials(c.materials) })),
    lineItems: (est.lineItems ?? []).map((li: any) => ({ description: li.description, category: li.category, quantity: li.quantity, unitCost: li.unitCost, markup: li.markup, taxable: li.taxable })),
    overheadItems: (est.overheadItems ?? []).map((o: any) => ({ description: o.description, cost: o.cost, markup: o.markup })),
  };
}

export function computeEstimate(est: any, paintCatalog: PaintCatalog = {}, defaults: PaintDefaults = NO_DEFAULTS): {
  generated: CalcLineItem[]; allItems: CalcLineItem[]; totals: Totals; services: ServiceRow[];
} {
  const { services, lines, totals } = computeAll(toFullEstimateInput(est, paintCatalog, defaults));
  return { generated: lines, allItems: lines, totals, services };
}
