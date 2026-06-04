/**
 * Acres Painting Co. — Calculation Engine (pure, server + client safe).
 *
 * Rates come from a JobRates snapshot. Paint & primer are priced PER SURFACE
 * (gallons rounded up each), primer also adds labor at `primerRate`. Each item
 * carries its own materials (per-item). The engine exposes both flat line items
 * (for category totals) and grouped "services" (one row per item: name + total +
 * descriptive subtitle) used for client-facing quotes.
 */

export const GALLON_COVERAGE = 400;
export const CABINET_GALLONS_PER_COAT = { door: 0.05, drawer: 0.025, frame: 0.075 };

export interface JobRates {
  wallRate: number;
  ceilingRate: number;
  trimRate: number;
  cabinetDoorRate: number;
  cabinetDrawerRate: number;
  cabinetFrameRate: number;
  deckFloorRate: number;
  deckRailingRate: number;
  deckStepRate: number;
  deckLatticeRate: number;
  sidingRate: number;
  powerWashRate: number;
  doorRate: number;
  shutterStory1Rate: number;
  shutterStory2Rate: number;
  shutterStory3Rate: number;
  shutterSqFtEach: number;
  garageRate: number;
  primerRate: number;
  laborMarkup: number;
}

export const DEFAULT_JOB_RATES: JobRates = {
  wallRate: 0.65, ceilingRate: 0.45, trimRate: 1.5,
  cabinetDoorRate: 45, cabinetDrawerRate: 25, cabinetFrameRate: 60,
  deckFloorRate: 2.5, deckRailingRate: 3, deckStepRate: 12, deckLatticeRate: 2,
  sidingRate: 1.5, powerWashRate: 0.15, doorRate: 2.5,
  shutterStory1Rate: 35, shutterStory2Rate: 45, shutterStory3Rate: 55, shutterSqFtEach: 6,
  garageRate: 2, primerRate: 0.5, laborMarkup: 30,
};

export interface CalcLineItem {
  description: string;
  category: string;
  quantity: number;
  unitCost: number;
  markup: number;
  taxable?: boolean;
  source?: string;
  // Optional metadata used by the shopping list (paint/stain/primer lines only):
  paintId?: number;                                  // Price Book paint id
  slot?: { kind: string; id: number; field: string }; // colorable surface slot
}

export type PaintCatalog = Record<number, { name: string; unitCost: number; coverage: number; markup: number; category?: string }>;

export interface PrimerInput {
  paintId: number | null;
  coats: number;
  sqftAdjust: number;
}
export interface ItemMaterialInput {
  priceBookItemId: number | null;
  name: string;
  unit: string;
  quantity: number;
  unitCost: number;
  markup: number;
}

/** One row per item in the client-facing quote. */
export interface ServiceRow {
  key: string;
  name: string;
  qtyLabel: string;
  subtitle: string;
  total: number;
  category: string;
}

// --- geometry ---
export function wallArea(l: number, w: number, h: number): number { return 2 * (n(l) + n(w)) * n(h); }
export function ceilingArea(l: number, w: number): number { return n(l) * n(w); }
export function perimeter(l: number, w: number): number { return 2 * (n(l) + n(w)); }
export function deductionArea(d: { width: number; height: number }[]): number {
  return (d ?? []).reduce((s, x) => s + n(x.width) * n(x.height), 0);
}
export function gallonsFor(area: number, coats: number, coverage = GALLON_COVERAGE): number {
  const raw = rawGallons(area, coats, coverage);
  return raw <= 0 ? 0 : Math.ceil(raw);
}
export function rawGallons(area: number, coats: number, coverage = GALLON_COVERAGE): number {
  const a = Math.max(0, n(area)), c = Math.max(0, n(coats));
  const cov = n(coverage) > 0 ? n(coverage) : GALLON_COVERAGE;
  return a <= 0 || c <= 0 ? 0 : (a * c) / cov;
}
function cov(paintId: number | null | undefined, catalog: PaintCatalog): number {
  return paintId != null && catalog[paintId] ? catalog[paintId].coverage || GALLON_COVERAGE : GALLON_COVERAGE;
}
function paintName(paintId: number | null | undefined, catalog: PaintCatalog): string {
  return paintId != null && catalog[paintId] ? catalog[paintId].name : "";
}
export function openingTrim(kind: string, width: number, height: number): number {
  if (kind === "door") return n(width) + 2 * n(height);
  return 2 * (n(width) + n(height));
}

// --- per-surface paint + primer pricing ---
// baseArea is the sqft used for paint gallons (for trim, pass linearFt/2).
function surfaceMaterials(opts: {
  baseArea: number;
  paintId: number | null;
  coats: number;
  primer: PrimerInput;
  catalog: PaintCatalog;
  rates: JobRates;
  source: string;
  label: string;
  slot?: { kind: string; id: number; field: string };
}): { lines: CalcLineItem[]; paintGallons: number; primerGallons: number } {
  const { baseArea, paintId, coats, primer, catalog, rates, source, label, slot } = opts;
  const lines: CalcLineItem[] = [];
  let paintGallons = 0, primerGallons = 0;
  const pm = n(rates.laborMarkup);

  if (paintId != null && baseArea > 0) {
    paintGallons = gallonsFor(baseArea, coats, cov(paintId, catalog));
    if (paintGallons > 0) {
      const item = catalog[paintId];
      if (item) lines.push({ description: `Paint — ${item.name} (${label})`, category: "Material", quantity: paintGallons, unitCost: item.unitCost, markup: item.markup, source, paintId, slot });
    }
  }
  if (primer && primer.paintId != null) {
    const primerArea = Math.max(0, baseArea + n(primer.sqftAdjust));
    primerGallons = gallonsFor(primerArea, primer.coats, cov(primer.paintId, catalog));
    const item = catalog[primer.paintId];
    if (primerGallons > 0 && item) {
      lines.push({ description: `Primer — ${item.name} (${label})`, category: "Material", quantity: primerGallons, unitCost: item.unitCost, markup: item.markup, source, paintId: primer.paintId });
    }
    // primer labor on the primed area
    if (primerArea > 0 && n(rates.primerRate) > 0) {
      lines.push({ description: `${label} — Primer Application`, category: "Labor", quantity: round2(primerArea), unitCost: n(rates.primerRate), markup: pm, source });
    }
  }
  return { lines, paintGallons, primerGallons };
}

function materialLines(materials: ItemMaterialInput[], source: string): CalcLineItem[] {
  return (materials ?? [])
    .filter((m) => n(m.quantity) > 0 && (n(m.unitCost) > 0 || m.name))
    .map((m) => ({ description: m.name || "Material", category: "Material", quantity: n(m.quantity), unitCost: n(m.unitCost), markup: n(m.markup), source }));
}

// ---------------------------------------------------------------------------
// Component inputs
// ---------------------------------------------------------------------------
export interface RoomInput {
  id?: number; name: string; length: number; width: number; height: number;
  paintWalls: boolean; paintCeiling: boolean; paintTrim: boolean;
  wallCoats: number; ceilingCoats: number; trimCoats: number;
  wallSqftAdjust: number; ceilingSqftAdjust: number; trimLfAdjust: number;
  wallPaintId?: number | null; ceilingPaintId?: number | null; trimPaintId?: number | null;
  wallPrimer: PrimerInput; ceilingPrimer: PrimerInput; trimPrimer: PrimerInput;
  deductions?: { kind: string; width: number; height: number; includeTrim: boolean }[];
  accentWalls?: { label: string; length: number; height: number; coats: number; paintId?: number | null }[];
  materials: ItemMaterialInput[];
}
export interface CabinetInput {
  id?: number; name: string; doorCount: number; drawerCount: number; frameCount: number;
  coats: number; primerCoats: number; paintId?: number | null; primerId?: number | null; materials: ItemMaterialInput[];
}
export interface DeckInput {
  id?: number; name: string; floorLength: number; floorWidth: number; includeRailing: boolean; railingLinFt: number;
  stepCount: number; includeLattice: boolean; latticeSqFt: number; coats: number; powerWashCost: number; woodReplCost: number;
  floorStainId?: number | null; railStainId?: number | null; primer: PrimerInput; materials: ItemMaterialInput[];
}
export interface ExteriorHouseInput {
  id?: number; name: string; sidingLength: number; sidingWidth: number; sidingHeight: number; sidingSqftAdjust: number;
  sidingMaterial: string; coats: number; paintId?: number | null; primer: PrimerInput;
  deductions?: { width: number; height: number }[]; replacements?: { description: string; cost: number }[]; materials: ItemMaterialInput[];
}
export interface DoorInput {
  id?: number; name: string; count: number; width: number; height: number; paintedSides: number; coats: number;
  paintId?: number | null; primer: PrimerInput; materials: ItemMaterialInput[];
}
export interface ShutterInput {
  id?: number; name: string; story1: number; story2: number; story3: number; customQty: number; customRate: number;
  coats: number; paintId?: number | null; primer: PrimerInput; materials: ItemMaterialInput[];
}
export interface GarageInput {
  id?: number; name: string; count: number; width: number; height: number; coats: number;
  paintId?: number | null; primer: PrimerInput; materials: ItemMaterialInput[];
}
export interface CustomAreaInput {
  id?: number; label: string; measureType: string; amount: number; rate: number; coats: number;
  paintId?: number | null; primer: PrimerInput; materials: ItemMaterialInput[];
}

// --- helpers to build a single component's lines + service row ---
function laborLine(description: string, quantity: number, unitCost: number, markup: number, source: string): CalcLineItem {
  return { description, category: "Labor", quantity: round2(quantity), unitCost: n(unitCost), markup, source };
}
function retail(li: { quantity: number; unitCost: number; markup: number }): number {
  return n(li.quantity) * n(li.unitCost) * (1 + n(li.markup) / 100);
}
function coatsTxt(c: number): string { const x = Math.max(0, Math.round(n(c))); return `${x} coat${x === 1 ? "" : "s"}`; }
function galTxt(g: number, name: string): string { return g > 0 ? ` (${g} gal${name ? ` ${name}` : ""})` : ""; }

interface Built { lines: CalcLineItem[]; service: ServiceRow }
function buildService(key: string, name: string, qtyLabel: string, subtitle: string, lines: CalcLineItem[], category = "Service"): Built {
  const total = lines.reduce((s, l) => s + retail(l), 0);
  return { lines, service: { key, name, qtyLabel, subtitle, total: round2(total), category } };
}

// ---------------------------------------------------------------------------
function roomBuilt(r: RoomInput, rates: JobRates, catalog: PaintCatalog): Built {
  const src = `room:${r.id ?? r.name}`;
  const gross = wallArea(r.length, r.width, r.height);
  const netWall = Math.max(0, gross - deductionArea(r.deductions ?? []) + n(r.wallSqftAdjust));
  const ceiling = Math.max(0, ceilingArea(r.length, r.width) + n(r.ceilingSqftAdjust));
  const openings = (r.deductions ?? []).reduce((s, d) => s + (d.includeTrim ? openingTrim(d.kind, d.width, d.height) : 0), 0);
  const trimLf = Math.max(0, perimeter(r.length, r.width) + openings + n(r.trimLfAdjust));
  const m = n(rates.laborMarkup);
  const lines: CalcLineItem[] = [];
  const parts: string[] = [];

  if (r.paintWalls && netWall > 0) {
    lines.push(laborLine(`${r.name} — Walls`, netWall, rates.wallRate, m, src));
    const sm = surfaceMaterials({ baseArea: netWall, paintId: r.wallPaintId ?? null, coats: r.wallCoats, primer: r.wallPrimer, catalog, rates, source: src, label: `${r.name} Walls`, slot: r.id != null ? { kind: "room", id: r.id, field: "wallPaintId" } : undefined });
    lines.push(...sm.lines);
    parts.push(`Walls: ${coatsTxt(r.wallCoats)}${galTxt(sm.paintGallons, paintName(r.wallPaintId, catalog))}`);
  }
  if (r.paintCeiling && ceiling > 0) {
    lines.push(laborLine(`${r.name} — Ceiling`, ceiling, rates.ceilingRate, m, src));
    const sm = surfaceMaterials({ baseArea: ceiling, paintId: r.ceilingPaintId ?? null, coats: r.ceilingCoats, primer: r.ceilingPrimer, catalog, rates, source: src, label: `${r.name} Ceiling`, slot: r.id != null ? { kind: "room", id: r.id, field: "ceilingPaintId" } : undefined });
    lines.push(...sm.lines);
    parts.push(`Ceiling: ${coatsTxt(r.ceilingCoats)}${galTxt(sm.paintGallons, paintName(r.ceilingPaintId, catalog))}`);
  }
  if (r.paintTrim && trimLf > 0) {
    lines.push(laborLine(`${r.name} — Trim (${formatNumber(trimLf)} lf)`, trimLf, rates.trimRate, m, src));
    const sm = surfaceMaterials({ baseArea: trimLf / 2, paintId: r.trimPaintId ?? null, coats: r.trimCoats, primer: r.trimPrimer, catalog, rates, source: src, label: `${r.name} Trim`, slot: r.id != null ? { kind: "room", id: r.id, field: "trimPaintId" } : undefined });
    lines.push(...sm.lines);
    parts.push(`Trim: ${coatsTxt(r.trimCoats)}${galTxt(sm.paintGallons, paintName(r.trimPaintId, catalog))}`);
  }
  for (const a of r.accentWalls ?? []) {
    const area = n(a.length) * n(a.height);
    if (area > 0) {
      lines.push(laborLine(`${r.name} — ${a.label || "Accent Wall"}`, area, rates.wallRate, m, src));
      const sm = surfaceMaterials({ baseArea: area, paintId: a.paintId ?? null, coats: a.coats, primer: { paintId: null, coats: 1, sqftAdjust: 0 }, catalog, rates, source: src, label: a.label || "Accent Wall" });
      lines.push(...sm.lines);
    }
  }
  const hasPrimer = [r.wallPrimer, r.ceilingPrimer, r.trimPrimer].some((p) => p && p.paintId != null);
  if (hasPrimer) parts.push("Primer applied");
  lines.push(...materialLines(r.materials, src));
  const subtitle = `${parts.join(", ")}. Dimensions: ${formatNumber(r.length)}'×${formatNumber(r.width)}'×${formatNumber(r.height)}'.`;
  return buildService(src, r.name, "1 room", subtitle, lines, "Interior");
}

function cabinetBuilt(c: CabinetInput, rates: JobRates, catalog: PaintCatalog): Built {
  const src = `cabinet:${c.id ?? c.name}`;
  const m = n(rates.laborMarkup);
  const lines: CalcLineItem[] = [];
  if (n(c.doorCount) > 0) lines.push(laborLine(`${c.name} — Doors`, n(c.doorCount), rates.cabinetDoorRate, m, src));
  if (n(c.drawerCount) > 0) lines.push(laborLine(`${c.name} — Drawers`, n(c.drawerCount), rates.cabinetDrawerRate, m, src));
  if (n(c.frameCount) > 0) lines.push(laborLine(`${c.name} — Frames`, n(c.frameCount), rates.cabinetFrameRate, m, src));
  const perPiece = n(c.doorCount) * CABINET_GALLONS_PER_COAT.door + n(c.drawerCount) * CABINET_GALLONS_PER_COAT.drawer + n(c.frameCount) * CABINET_GALLONS_PER_COAT.frame;
  let paintGal = 0, primerGal = 0;
  if (c.paintId != null) {
    paintGal = Math.ceil(perPiece * Math.max(1, n(c.coats)));
    const item = catalog[c.paintId];
    if (paintGal > 0 && item) lines.push({ description: `Paint — ${item.name} (${c.name})`, category: "Material", quantity: paintGal, unitCost: item.unitCost, markup: item.markup, source: src, paintId: c.paintId ?? undefined, slot: c.id != null ? { kind: "cabinet", id: c.id, field: "paintId" } : undefined });
  }
  if (c.primerId != null) {
    primerGal = Math.ceil(perPiece * Math.max(1, n(c.primerCoats)));
    const item = catalog[c.primerId];
    if (primerGal > 0 && item) lines.push({ description: `Primer — ${item.name} (${c.name})`, category: "Material", quantity: primerGal, unitCost: item.unitCost, markup: item.markup, source: src, paintId: c.primerId ?? undefined });
  }
  lines.push(...materialLines(c.materials, src));
  const pieces = n(c.doorCount) + n(c.drawerCount) + n(c.frameCount);
  const subtitle = `${n(c.doorCount)} doors, ${n(c.drawerCount)} drawers, ${n(c.frameCount)} frames (${pieces} pieces). ${coatsTxt(c.coats)}${galTxt(paintGal, paintName(c.paintId, catalog))}.${c.primerId != null ? ` Primer ${coatsTxt(c.primerCoats)}.` : ""}`;
  return buildService(src, c.name, "1 cabinet set", subtitle, lines, "Cabinets");
}

function deckBuilt(d: DeckInput, rates: JobRates, catalog: PaintCatalog): Built {
  const src = `deck:${d.id ?? d.name}`;
  const m = n(rates.laborMarkup);
  const floor = n(d.floorLength) * n(d.floorWidth);
  const lattice = d.includeLattice ? n(d.latticeSqFt) : 0;
  const railing = d.includeRailing ? n(d.railingLinFt) : 0;
  const lines: CalcLineItem[] = [];
  if (floor > 0) lines.push(laborLine(`${d.name} — Deck Floor`, floor, rates.deckFloorRate, m, src));
  if (railing > 0) lines.push(laborLine(`${d.name} — Railing`, railing, rates.deckRailingRate, m, src));
  if (n(d.stepCount) > 0) lines.push(laborLine(`${d.name} — Steps`, n(d.stepCount), rates.deckStepRate, m, src));
  if (lattice > 0) lines.push(laborLine(`${d.name} — Lattice`, lattice, rates.deckLatticeRate, m, src));
  if (n(d.powerWashCost) > 0) lines.push({ description: `${d.name} — Power Washing`, category: "Labor", quantity: 1, unitCost: n(d.powerWashCost), markup: m, source: src });
  if (n(d.woodReplCost) > 0) lines.push({ description: `${d.name} — Wood Replacement`, category: "Material", quantity: 1, unitCost: n(d.woodReplCost), markup: m, source: src });
  let floorGal = 0;
  if (d.floorStainId != null) {
    floorGal = gallonsFor(floor + lattice, d.coats, cov(d.floorStainId, catalog));
    const item = catalog[d.floorStainId];
    if (floorGal > 0 && item) lines.push({ description: `Stain — ${item.name} (${d.name} floor)`, category: "Material", quantity: floorGal, unitCost: item.unitCost, markup: item.markup, source: src, paintId: d.floorStainId ?? undefined, slot: d.id != null ? { kind: "deck", id: d.id, field: "floorStainId" } : undefined });
  }
  if (d.railStainId != null && railing > 0) {
    const rg = gallonsFor(railing, d.coats, cov(d.railStainId, catalog));
    const item = catalog[d.railStainId];
    if (rg > 0 && item) lines.push({ description: `Stain — ${item.name} (${d.name} rails)`, category: "Material", quantity: rg, unitCost: item.unitCost, markup: item.markup, source: src, paintId: d.railStainId ?? undefined, slot: d.id != null ? { kind: "deck", id: d.id, field: "railStainId" } : undefined });
  }
  // primer on floor
  if (d.primer && d.primer.paintId != null) {
    const sm = surfaceMaterials({ baseArea: floor, paintId: null, coats: 0, primer: d.primer, catalog, rates, source: src, label: `${d.name} Floor` });
    lines.push(...sm.lines);
  }
  lines.push(...materialLines(d.materials, src));
  const subtitle = `Floor ${formatNumber(floor)} sf${railing ? `, railing ${formatNumber(railing)} lf` : ""}${d.stepCount ? `, ${n(d.stepCount)} steps` : ""}. ${coatsTxt(d.coats)} stain${galTxt(floorGal, paintName(d.floorStainId, catalog))}.${n(d.powerWashCost) > 0 ? " Power washed." : ""}`;
  return buildService(src, d.name, "1 deck", subtitle, lines, "Deck");
}

function exteriorBuilt(h: ExteriorHouseInput, rates: JobRates, catalog: PaintCatalog): Built {
  const src = `exterior:${h.id ?? h.name}`;
  const m = n(rates.laborMarkup);
  const net = Math.max(0, wallArea(h.sidingLength, h.sidingWidth, h.sidingHeight) - deductionArea(h.deductions ?? []) + n(h.sidingSqftAdjust));
  const lines: CalcLineItem[] = [];
  if (net > 0) {
    lines.push(laborLine(`${h.name} — Siding (${h.sidingMaterial})`, net, rates.sidingRate, m, src));
    if (n(rates.powerWashRate) > 0) lines.push(laborLine(`${h.name} — Power Washing`, net, rates.powerWashRate, m, src));
  }
  for (const rp of h.replacements ?? []) if (n(rp.cost) > 0) lines.push({ description: `${h.name} — ${rp.description || "Material Replacement"}`, category: "Material", quantity: 1, unitCost: n(rp.cost), markup: m, source: src });
  const sm = surfaceMaterials({ baseArea: net, paintId: h.paintId ?? null, coats: h.coats, primer: h.primer, catalog, rates, source: src, label: `${h.name} Siding`, slot: h.id != null ? { kind: "exterior", id: h.id, field: "paintId" } : undefined });
  lines.push(...sm.lines);
  lines.push(...materialLines(h.materials, src));
  const subtitle = `Siding ${h.sidingMaterial}, ${formatNumber(net)} sf. ${coatsTxt(h.coats)}${galTxt(sm.paintGallons, paintName(h.paintId, catalog))}.${h.primer && h.primer.paintId != null ? " Primer applied." : ""} Power washed.`;
  return buildService(src, h.name, "1 exterior", subtitle, lines, "Exterior");
}

function doorBuilt(d: DoorInput, rates: JobRates, catalog: PaintCatalog): Built {
  const src = `door:${d.id ?? d.name}`;
  const m = n(rates.laborMarkup);
  const area = n(d.width) * n(d.height) * Math.max(1, n(d.paintedSides)) * Math.max(1, n(d.count));
  const lines: CalcLineItem[] = [];
  if (area > 0) lines.push(laborLine(`${d.name} — Door`, area, rates.doorRate, m, src));
  const sm = surfaceMaterials({ baseArea: area, paintId: d.paintId ?? null, coats: d.coats, primer: d.primer, catalog, rates, source: src, label: d.name, slot: d.id != null ? { kind: "door", id: d.id, field: "paintId" } : undefined });
  lines.push(...sm.lines);
  lines.push(...materialLines(d.materials, src));
  const subtitle = `${n(d.count)} door${n(d.count) === 1 ? "" : "s"}, ${n(d.paintedSides)} side${n(d.paintedSides) === 1 ? "" : "s"} (${formatNumber(area)} sf). ${coatsTxt(d.coats)}${galTxt(sm.paintGallons, paintName(d.paintId, catalog))}.`;
  return buildService(src, d.name, `${n(d.count)} door${n(d.count) === 1 ? "" : "s"}`, subtitle, lines, "Doors");
}

function shutterBuilt(s: ShutterInput, rates: JobRates, catalog: PaintCatalog): Built {
  const src = `shutter:${s.id ?? s.name}`;
  const m = n(rates.laborMarkup);
  const units = n(s.story1) + n(s.story2) + n(s.story3) + n(s.customQty);
  const paintSqFt = units * n(rates.shutterSqFtEach);
  const lines: CalcLineItem[] = [];
  if (n(s.story1) > 0) lines.push(laborLine(`${s.name} — 1st Story`, n(s.story1), rates.shutterStory1Rate, m, src));
  if (n(s.story2) > 0) lines.push(laborLine(`${s.name} — 2nd Story`, n(s.story2), rates.shutterStory2Rate, m, src));
  if (n(s.story3) > 0) lines.push(laborLine(`${s.name} — 3rd Story`, n(s.story3), rates.shutterStory3Rate, m, src));
  if (n(s.customQty) > 0) lines.push(laborLine(`${s.name} — Custom`, n(s.customQty), s.customRate, m, src));
  const sm = surfaceMaterials({ baseArea: paintSqFt, paintId: s.paintId ?? null, coats: s.coats, primer: s.primer, catalog, rates, source: src, label: s.name, slot: s.id != null ? { kind: "shutter", id: s.id, field: "paintId" } : undefined });
  lines.push(...sm.lines);
  lines.push(...materialLines(s.materials, src));
  const subtitle = `${units} shutters (${n(s.story1)}/${n(s.story2)}/${n(s.story3)} by story). ${coatsTxt(s.coats)}${galTxt(sm.paintGallons, paintName(s.paintId, catalog))}.`;
  return buildService(src, s.name, `${units} shutters`, subtitle, lines, "Shutters");
}

function garageBuilt(g: GarageInput, rates: JobRates, catalog: PaintCatalog): Built {
  const src = `garage:${g.id ?? g.name}`;
  const m = n(rates.laborMarkup);
  const area = n(g.width) * n(g.height) * 2 * Math.max(1, n(g.count));
  const lines: CalcLineItem[] = [];
  if (area > 0) lines.push(laborLine(`${g.name} — Garage Door`, area, rates.garageRate, m, src));
  const sm = surfaceMaterials({ baseArea: area, paintId: g.paintId ?? null, coats: g.coats, primer: g.primer, catalog, rates, source: src, label: g.name, slot: g.id != null ? { kind: "garage", id: g.id, field: "paintId" } : undefined });
  lines.push(...sm.lines);
  lines.push(...materialLines(g.materials, src));
  const subtitle = `${n(g.count)} garage door${n(g.count) === 1 ? "" : "s"}, both sides (${formatNumber(area)} sf). ${coatsTxt(g.coats)}${galTxt(sm.paintGallons, paintName(g.paintId, catalog))}.`;
  return buildService(src, g.name, `${n(g.count)} garage door${n(g.count) === 1 ? "" : "s"}`, subtitle, lines, "Garage");
}

function customBuilt(c: CustomAreaInput, rates: JobRates, catalog: PaintCatalog): Built {
  const src = `custom:${c.id ?? c.label}`;
  const m = n(rates.laborMarkup);
  const unit = c.measureType === "trim" ? "lf" : "sf";
  const base = c.measureType === "trim" ? n(c.amount) / 2 : n(c.amount);
  const lines: CalcLineItem[] = [];
  if (n(c.amount) > 0 && n(c.rate) > 0) lines.push(laborLine(`${c.label}`, n(c.amount), c.rate, m, src));
  const sm = surfaceMaterials({ baseArea: base, paintId: c.paintId ?? null, coats: c.coats, primer: c.primer, catalog, rates, source: src, label: c.label, slot: c.id != null ? { kind: "custom", id: c.id, field: "paintId" } : undefined });
  lines.push(...sm.lines);
  lines.push(...materialLines(c.materials, src));
  const subtitle = `${formatNumber(n(c.amount))} ${unit}. ${coatsTxt(c.coats)}${galTxt(sm.paintGallons, paintName(c.paintId, catalog))}.`;
  return buildService(src, c.label, `1 area`, subtitle, lines, "Custom");
}

// ---------------------------------------------------------------------------
// Totals & tiers
// ---------------------------------------------------------------------------
export interface OverheadInput { description: string; cost: number; markup: number }
export function overheadRetail(o: OverheadInput): number { return n(o.cost) * (1 + n(o.markup) / 100); }
export function lineRetail(li: { quantity: number; unitCost: number; markup: number }): number { return retail(li); }

export interface Totals {
  laborTotal: number; materialTotal: number; otherTotal: number; overheadTotal: number;
  subtotal: number; discountAmount: number; preTaxTotal: number; taxAmount: number; grandTotal: number;
}
export function calcTotals(input: { lineItems: CalcLineItem[]; overheadItems?: OverheadInput[]; discountType: string; discountValue: number; taxRate: number }): Totals {
  let laborTotal = 0, materialTotal = 0, otherTotal = 0;
  for (const li of input.lineItems) {
    const r = retail(li);
    if (li.category === "Labor") laborTotal += r;
    else if (li.category === "Material") materialTotal += r;
    else otherTotal += r;
  }
  const overheadTotal = (input.overheadItems ?? []).reduce((s, o) => s + overheadRetail(o), 0);
  const subtotal = laborTotal + materialTotal + otherTotal + overheadTotal;
  let discountAmount = 0;
  if (input.discountType === "percent") discountAmount = subtotal * (n(input.discountValue) / 100);
  else if (input.discountType === "flat") discountAmount = n(input.discountValue);
  discountAmount = Math.min(discountAmount, subtotal);
  const preTaxTotal = subtotal - discountAmount;
  const taxAmount = preTaxTotal * (n(input.taxRate) / 100);
  return {
    laborTotal: round2(laborTotal), materialTotal: round2(materialTotal), otherTotal: round2(otherTotal),
    overheadTotal: round2(overheadTotal), subtotal: round2(subtotal), discountAmount: round2(discountAmount),
    preTaxTotal: round2(preTaxTotal), taxAmount: round2(taxAmount), grandTotal: round2(preTaxTotal + taxAmount),
  };
}

export interface TierSettings { midDepositPercent: number; midDepositDiscount: number; maxDepositPercent: number; maxDepositDiscount: number }
export interface TierPricing {
  full: { label: string; total: number; deposit: number; savings: number };
  mid: { label: string; total: number; deposit: number; savings: number; depositPercent: number; discountPercent: number };
  max: { label: string; total: number; deposit: number; savings: number; depositPercent: number; discountPercent: number };
}
export function calcTiers(grandTotal: number, s: TierSettings): TierPricing {
  const g = n(grandTotal);
  const midTotal = g * (1 - n(s.midDepositDiscount) / 100), midDeposit = midTotal * (n(s.midDepositPercent) / 100);
  const maxTotal = g * (1 - n(s.maxDepositDiscount) / 100), maxDeposit = maxTotal * (n(s.maxDepositPercent) / 100);
  return {
    full: { label: "Full Price", total: round2(g), deposit: 0, savings: 0 },
    mid: { label: `${n(s.midDepositPercent)}% Deposit`, total: round2(midTotal), deposit: round2(midDeposit), savings: round2(g - midTotal), depositPercent: n(s.midDepositPercent), discountPercent: n(s.midDepositDiscount) },
    max: { label: `${n(s.maxDepositPercent)}% Deposit`, total: round2(maxTotal), deposit: round2(maxDeposit), savings: round2(g - maxTotal), depositPercent: n(s.maxDepositPercent), discountPercent: n(s.maxDepositDiscount) },
  };
}

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------
export interface FullEstimateInput {
  rates: JobRates; taxRate: number; discountType: string; discountValue: number;
  rooms: RoomInput[]; cabinetSets: CabinetInput[]; deckAreas: DeckInput[]; exteriorHouses: ExteriorHouseInput[];
  exteriorDoors: DoorInput[]; exteriorShutters: ShutterInput[]; garageDoors: GarageInput[]; customAreas: CustomAreaInput[];
  lineItems: CalcLineItem[]; overheadItems: OverheadInput[]; paintCatalog?: PaintCatalog;
}

export function computeAll(est: FullEstimateInput): { services: ServiceRow[]; lines: CalcLineItem[]; totals: Totals } {
  const rates = est.rates ?? DEFAULT_JOB_RATES;
  const catalog = est.paintCatalog ?? {};
  const built: Built[] = [];
  for (const r of est.rooms ?? []) built.push(roomBuilt(r, rates, catalog));
  for (const c of est.cabinetSets ?? []) built.push(cabinetBuilt(c, rates, catalog));
  for (const d of est.deckAreas ?? []) built.push(deckBuilt(d, rates, catalog));
  for (const h of est.exteriorHouses ?? []) built.push(exteriorBuilt(h, rates, catalog));
  for (const d of est.exteriorDoors ?? []) built.push(doorBuilt(d, rates, catalog));
  for (const s of est.exteriorShutters ?? []) built.push(shutterBuilt(s, rates, catalog));
  for (const g of est.garageDoors ?? []) built.push(garageBuilt(g, rates, catalog));
  for (const c of est.customAreas ?? []) built.push(customBuilt(c, rates, catalog));

  const services: ServiceRow[] = [];
  const lines: CalcLineItem[] = [];
  for (const b of built) {
    if (b.service.total !== 0 || b.lines.length) {
      services.push(b.service);
      lines.push(...b.lines);
    }
  }

  // Project-level custom line items become their own service rows.
  (est.lineItems ?? []).forEach((li, i) => {
    if (!li.description && n(li.quantity) * n(li.unitCost) === 0) return;
    lines.push(li);
    services.push({ key: `line:${i}`, name: li.description || "Additional Item", qtyLabel: `${formatNumber(n(li.quantity), 0)}`, subtitle: "", total: round2(retail(li)), category: li.category || "Other" });
  });

  const totals = calcTotals({ lineItems: lines, overheadItems: est.overheadItems ?? [], discountType: est.discountType, discountValue: est.discountValue, taxRate: est.taxRate });
  return { services, lines, totals };
}

// Back-compat shim: some callers used calcEstimateTotals → keep returning generated/allItems/totals.
export function calcEstimateTotals(est: FullEstimateInput): { generated: CalcLineItem[]; allItems: CalcLineItem[]; totals: Totals; services: ServiceRow[] } {
  const { services, lines, totals } = computeAll(est);
  return { generated: lines, allItems: lines, totals, services };
}

// --- utils ---
function n(v: unknown): number { const x = typeof v === "number" ? v : parseFloat(String(v ?? 0)); return Number.isFinite(x) ? x : 0; }
export function round2(v: number): number { return Math.round((v + Number.EPSILON) * 100) / 100; }
export function formatCurrency(v: number): string { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n(v)); }
export function formatNumber(v: number, digits = 0): string { return new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n(v)); }
