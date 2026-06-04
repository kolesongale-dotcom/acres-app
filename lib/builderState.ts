import { FullEstimateInput, PaintCatalog, JobRates, DEFAULT_JOB_RATES, PrimerInput } from "@/lib/calculations";
import {
  RoomPayload, CabinetPayload, DeckPayload, ExteriorHousePayload, DoorPayload, ShutterPayload,
  GaragePayload, CustomAreaPayload, LineItemPayload, OverheadPayload, PhotoPayload,
  EstimateSetupPayload, PaintDefaults, ItemMaterialPayload,
} from "@/lib/types";

export interface BuilderState {
  setup: EstimateSetupPayload;
  rates: JobRates;
  rooms: RoomPayload[];
  cabinetSets: CabinetPayload[];
  deckAreas: DeckPayload[];
  exteriorHouses: ExteriorHousePayload[];
  exteriorDoors: DoorPayload[];
  exteriorShutters: ShutterPayload[];
  garageDoors: GaragePayload[];
  customAreas: CustomAreaPayload[];
  lineItems: LineItemPayload[];
  overheadItems: OverheadPayload[];
  photos: PhotoPayload[];
}

export function blankRoom(): RoomPayload {
  return {
    name: "Room", length: 12, width: 12, height: 8,
    paintWalls: true, paintCeiling: false, paintTrim: false,
    wallCoats: 2, ceilingCoats: 2, trimCoats: 2,
    wallSqftAdjust: 0, ceilingSqftAdjust: 0, trimLfAdjust: 0,
    wallProduct: "", ceilingProduct: "", trimProduct: "",
    wallSheen: "Unsure", ceilingSheen: "Unsure", trimSheen: "Unsure",
    wallPaintId: null, ceilingPaintId: null, trimPaintId: null,
    wallPrimerPaintId: null, wallPrimerCoats: 1, wallPrimerSqftAdjust: 0,
    ceilingPrimerPaintId: null, ceilingPrimerCoats: 1, ceilingPrimerSqftAdjust: 0,
    trimPrimerPaintId: null, trimPrimerCoats: 1, trimPrimerSqftAdjust: 0,
    materials: [], sortOrder: 0, deductions: [], accentWalls: [],
  };
}
export function blankCabinet(): CabinetPayload {
  return { name: "Cabinet Set", doorCount: 0, drawerCount: 0, frameCount: 0, coats: 2, primerCoats: 1, primerProduct: "", paintProduct: "", sheen: "Unsure", paintId: null, primerId: null, materials: [], sortOrder: 0 };
}
export function blankDeck(): DeckPayload {
  return { name: "Deck", floorLength: 0, floorWidth: 0, includeRailing: true, railingLinFt: 0, stepCount: 0, includeLattice: true, latticeSqFt: 0, coats: 2, powerWashCost: 0, woodReplCost: 0, floorSheen: "Unsure", railSheen: "Unsure", floorStainId: null, railStainId: null, primerPaintId: null, primerCoats: 1, primerSqftAdjust: 0, materials: [], sortOrder: 0 };
}
export function blankExteriorHouse(): ExteriorHousePayload {
  return { name: "Exterior", sidingLength: 0, sidingWidth: 0, sidingHeight: 0, sidingSqftAdjust: 0, sidingMaterial: "Vinyl", coats: 2, paintProduct: "", sheen: "Unsure", paintId: null, primerPaintId: null, primerCoats: 1, primerSqftAdjust: 0, materials: [], sortOrder: 0, deductions: [], replacements: [] };
}
export function blankDoor(): DoorPayload {
  return { name: "Door", count: 1, width: 3, height: 7, paintedSides: 1, coats: 2, paintProduct: "", sheen: "Unsure", paintId: null, primerPaintId: null, primerCoats: 1, primerSqftAdjust: 0, materials: [], sortOrder: 0 };
}
export function blankShutter(): ShutterPayload {
  return { name: "House Shutters", story1: 0, story2: 0, story3: 0, customQty: 0, customRate: 0, coats: 2, paintProduct: "", sheen: "Unsure", paintId: null, primerPaintId: null, primerCoats: 1, primerSqftAdjust: 0, materials: [], sortOrder: 0 };
}
export function blankGarage(): GaragePayload {
  return { name: "Garage Door", count: 1, width: 16, height: 7, coats: 2, paintProduct: "", sheen: "Unsure", paintId: null, primerPaintId: null, primerCoats: 1, primerSqftAdjust: 0, materials: [], sortOrder: 0 };
}
export function blankCustomArea(): CustomAreaPayload {
  return { label: "Custom Area", measureType: "area", amount: 0, rate: 0, coats: 2, paintProduct: "", sheen: "Unsure", paintId: null, primerPaintId: null, primerCoats: 1, primerSqftAdjust: 0, materials: [], sortOrder: 0 };
}
export function blankLineItem(): LineItemPayload {
  return { description: "", category: "Material", quantity: 1, unitCost: 0, markup: 0, taxable: true, unit: "", priceBookItemId: null, sortOrder: 0 };
}
export function blankOverhead(): OverheadPayload {
  return { description: "", cost: 0, markup: 0, sortOrder: 0 };
}
export function blankMaterial(): ItemMaterialPayload {
  return { priceBookItemId: null, name: "", unit: "each", quantity: 1, unitCost: 0, markup: 0 };
}

const eff = (id: number | null, def: number | null): number | null => (id != null ? id : def ?? null);
const primer = (paintId: number | null, coats: number, adj: number): PrimerInput => ({ paintId, coats, sqftAdjust: adj });
const mats = (m: ItemMaterialPayload[]) => (m ?? []).map((x) => ({ priceBookItemId: x.priceBookItemId, name: x.name, unit: x.unit, quantity: x.quantity, unitCost: x.unitCost, markup: x.markup }));

export function buildCalcInput(s: BuilderState, paintCatalog: PaintCatalog, defaults: PaintDefaults): FullEstimateInput {
  return {
    rates: s.rates ?? DEFAULT_JOB_RATES,
    taxRate: s.setup.taxRate,
    discountType: s.setup.discountType,
    discountValue: s.setup.discountValue,
    paintCatalog,
    rooms: s.rooms.map((r) => ({
      id: r.id, name: r.name, length: r.length, width: r.width, height: r.height,
      paintWalls: r.paintWalls, paintCeiling: r.paintCeiling, paintTrim: r.paintTrim,
      wallCoats: r.wallCoats, ceilingCoats: r.ceilingCoats, trimCoats: r.trimCoats,
      wallSqftAdjust: r.wallSqftAdjust, ceilingSqftAdjust: r.ceilingSqftAdjust, trimLfAdjust: r.trimLfAdjust,
      wallPaintId: eff(r.wallPaintId, defaults.defaultWallPaintId),
      ceilingPaintId: eff(r.ceilingPaintId, defaults.defaultCeilingPaintId),
      trimPaintId: eff(r.trimPaintId, defaults.defaultTrimPaintId),
      wallPrimer: primer(r.wallPrimerPaintId, r.wallPrimerCoats, r.wallPrimerSqftAdjust),
      ceilingPrimer: primer(r.ceilingPrimerPaintId, r.ceilingPrimerCoats, r.ceilingPrimerSqftAdjust),
      trimPrimer: primer(r.trimPrimerPaintId, r.trimPrimerCoats, r.trimPrimerSqftAdjust),
      deductions: r.deductions.map((d) => ({ kind: d.kind, width: d.width, height: d.height, includeTrim: d.includeTrim })),
      accentWalls: r.accentWalls.map((a) => ({ label: a.label, length: a.length, height: a.height, coats: a.coats, paintId: eff(a.paintId, defaults.defaultWallPaintId) })),
      materials: mats(r.materials),
    })),
    cabinetSets: s.cabinetSets.map((c) => ({ id: c.id, name: c.name, doorCount: c.doorCount, drawerCount: c.drawerCount, frameCount: c.frameCount, coats: c.coats, primerCoats: c.primerCoats, paintId: c.paintId, primerId: c.primerId, materials: mats(c.materials) })),
    deckAreas: s.deckAreas.map((d) => ({ id: d.id, name: d.name, floorLength: d.floorLength, floorWidth: d.floorWidth, includeRailing: d.includeRailing, railingLinFt: d.railingLinFt, stepCount: d.stepCount, includeLattice: d.includeLattice, latticeSqFt: d.latticeSqFt, coats: d.coats, powerWashCost: d.powerWashCost, woodReplCost: d.woodReplCost, floorStainId: eff(d.floorStainId, defaults.defaultDeckFloorStainId), railStainId: eff(d.railStainId, defaults.defaultDeckRailStainId), primer: primer(d.primerPaintId, d.primerCoats, d.primerSqftAdjust), materials: mats(d.materials) })),
    exteriorHouses: s.exteriorHouses.map((h) => ({ id: h.id, name: h.name, sidingLength: h.sidingLength, sidingWidth: h.sidingWidth, sidingHeight: h.sidingHeight, sidingSqftAdjust: h.sidingSqftAdjust, sidingMaterial: h.sidingMaterial, coats: h.coats, paintId: eff(h.paintId, defaults.defaultSidingPaintId), primer: primer(h.primerPaintId, h.primerCoats, h.primerSqftAdjust), deductions: h.deductions.map((d) => ({ width: d.width, height: d.height })), replacements: h.replacements.map((r) => ({ description: r.description, cost: r.cost })), materials: mats(h.materials) })),
    exteriorDoors: s.exteriorDoors.map((d) => ({ id: d.id, name: d.name, count: d.count, width: d.width, height: d.height, paintedSides: d.paintedSides, coats: d.coats, paintId: eff(d.paintId, defaults.defaultDoorPaintId), primer: primer(d.primerPaintId, d.primerCoats, d.primerSqftAdjust), materials: mats(d.materials) })),
    exteriorShutters: s.exteriorShutters.map((sh) => ({ id: sh.id, name: sh.name, story1: sh.story1, story2: sh.story2, story3: sh.story3, customQty: sh.customQty, customRate: sh.customRate, coats: sh.coats, paintId: eff(sh.paintId, defaults.defaultShutterPaintId), primer: primer(sh.primerPaintId, sh.primerCoats, sh.primerSqftAdjust), materials: mats(sh.materials) })),
    garageDoors: s.garageDoors.map((g) => ({ id: g.id, name: g.name, count: g.count, width: g.width, height: g.height, coats: g.coats, paintId: eff(g.paintId, defaults.defaultGaragePaintId), primer: primer(g.primerPaintId, g.primerCoats, g.primerSqftAdjust), materials: mats(g.materials) })),
    customAreas: s.customAreas.map((c) => ({ id: c.id, label: c.label, measureType: c.measureType, amount: c.amount, rate: c.rate, coats: c.coats, paintId: c.paintId, primer: primer(c.primerPaintId, c.primerCoats, c.primerSqftAdjust), materials: mats(c.materials) })),
    lineItems: s.lineItems.map((li) => ({ description: li.description, category: li.category, quantity: li.quantity, unitCost: li.unitCost, markup: li.markup, taxable: li.taxable })),
    overheadItems: s.overheadItems.map((o) => ({ description: o.description, cost: o.cost, markup: o.markup })),
  };
}
