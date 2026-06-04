import { prisma } from "@/lib/prisma";
import { ESTIMATE_INCLUDE, computeEstimate } from "@/lib/estimateCalc";
import { getPaintCatalog } from "@/lib/priceCatalog";
import { getCurrentRatesAndDefaults } from "@/lib/jobRates";
import { sheenFieldFor } from "@/lib/paintSlots";
import { customerName } from "@/lib/format";

export interface PaintBuyRow {
  paintName: string;
  colorName: string;
  colorCode: string;
  provider: string;
  sheen: string;
  gallons: number;
  unitCost: number;
  lineCost: number;
}
export interface SupplyBuyRow { name: string; quantity: number; unitCost: number; lineCost: number }

export interface ShoppingList {
  estimateId: number;
  estimateNumber: string;
  client: string;
  project: string;
  paints: PaintBuyRow[];   // colorable paints/stains (with the client's chosen color)
  primers: PaintBuyRow[];  // primers (no color)
  supplies: SupplyBuyRow[];
  totalCost: number;
}

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

/** Build the "what to buy" list for a job: paints (by color) + primers + supplies, at unit cost. */
export async function buildShoppingList(estimateId: number): Promise<ShoppingList | null> {
  const est = await prisma.estimate.findUnique({ where: { id: estimateId }, include: ESTIMATE_INCLUDE });
  if (!est) return null;

  const [catalog, rd, colors] = await Promise.all([
    getPaintCatalog(),
    getCurrentRatesAndDefaults(),
    prisma.colorSelection.findMany({ where: { estimateId } }),
  ]);
  const colorByKey = Object.fromEntries(colors.map((c) => [c.slotKey, c]));

  // Index raw components by "kind:id" for sheen lookup.
  const comp: Record<string, any> = {};
  for (const r of (est as any).rooms ?? []) comp[`room:${r.id}`] = r;
  for (const c of (est as any).cabinetSets ?? []) comp[`cabinet:${c.id}`] = c;
  for (const d of (est as any).deckAreas ?? []) comp[`deck:${d.id}`] = d;
  for (const h of (est as any).exteriorHouses ?? []) comp[`exterior:${h.id}`] = h;
  for (const d of (est as any).exteriorDoors ?? []) comp[`door:${d.id}`] = d;
  for (const s of (est as any).exteriorShutters ?? []) comp[`shutter:${s.id}`] = s;
  for (const g of (est as any).garageDoors ?? []) comp[`garage:${g.id}`] = g;
  for (const c of (est as any).customAreas ?? []) comp[`custom:${c.id}`] = c;

  const { generated } = computeEstimate(est as any, catalog, rd.defaults);

  const paintMap = new Map<string, PaintBuyRow>();
  const primerMap = new Map<string, PaintBuyRow>();
  const supplyMap = new Map<string, SupplyBuyRow>();

  for (const l of generated) {
    if (l.category !== "Material") continue;
    const name = catalog[l.paintId ?? -1]?.name ?? l.description.replace(/^(Paint|Stain|Primer) — /, "").replace(/\s*\([^)]*\)\s*$/, "");

    if (l.slot && l.paintId != null) {
      // Colorable paint/stain
      const sk = `${l.slot.kind}:${l.slot.id}:${l.slot.field}`;
      const col = colorByKey[sk];
      const sheenCol = sheenFieldFor(l.slot.kind, l.slot.field);
      const sheen = sheenCol && comp[`${l.slot.kind}:${l.slot.id}`] ? (comp[`${l.slot.kind}:${l.slot.id}`][sheenCol] ?? "Unsure") : "Unsure";
      const key = `${l.paintId}|${col?.colorName ?? ""}|${col?.colorCode ?? ""}|${sheen}`;
      const row = paintMap.get(key) ?? { paintName: name, colorName: col?.colorName ?? "", colorCode: col?.colorCode ?? "", provider: col?.provider ?? "", sheen, gallons: 0, unitCost: l.unitCost, lineCost: 0 };
      row.gallons += l.quantity;
      paintMap.set(key, row);
    } else if (/^Primer — /.test(l.description)) {
      const key = `${l.paintId ?? name}`;
      const row = primerMap.get(key) ?? { paintName: name, colorName: "", colorCode: "", provider: "", sheen: "", gallons: 0, unitCost: l.unitCost, lineCost: 0 };
      row.gallons += l.quantity;
      primerMap.set(key, row);
    } else {
      // Other supplies/materials
      const key = l.description;
      const row = supplyMap.get(key) ?? { name: l.description, quantity: 0, unitCost: l.unitCost, lineCost: 0 };
      row.quantity += l.quantity;
      supplyMap.set(key, row);
    }
  }

  const finalizePaint = (m: Map<string, PaintBuyRow>) =>
    [...m.values()].map((r) => { r.lineCost = round2(r.gallons * r.unitCost); return r; });
  const paints = finalizePaint(paintMap);
  const primers = finalizePaint(primerMap);
  const supplies = [...supplyMap.values()].map((r) => { r.lineCost = round2(r.quantity * r.unitCost); return r; });

  const totalCost = round2(
    [...paints, ...primers].reduce((s, r) => s + r.lineCost, 0) + supplies.reduce((s, r) => s + r.lineCost, 0)
  );

  return {
    estimateId,
    estimateNumber: est.estimateNumber,
    client: customerName((est as any).customer),
    project: est.projectName || "Project",
    paints,
    primers,
    supplies,
    totalCost,
  };
}
