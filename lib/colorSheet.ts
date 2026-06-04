import { prisma } from "@/lib/prisma";
import { ESTIMATE_INCLUDE, toFullEstimateInput } from "@/lib/estimateCalc";
import { getPaintCatalog } from "@/lib/priceCatalog";
import { getCurrentRatesAndDefaults } from "@/lib/jobRates";
import { extractPaintSlots, sheenFieldFor, slotKey, type PaintSlotRef } from "@/lib/paintSlots";
import { customerName } from "@/lib/format";

export interface ColorSurface {
  ref: PaintSlotRef;
  key: string;
  label: string;       // "Master Bedroom — Walls"
  paintName: string;   // the paint line chosen (reference)
  sheen: string;       // current sheen from the estimate component
  colorName: string;
  colorCode: string;
  provider: string;
}

export interface ColorSheetData {
  proposalId: number;
  estimateId: number;
  client: string;
  project: string;
  surfaces: ColorSurface[];
}

/**
 * Build the color/sheen sheet for a proposal: one row per painted surface (same
 * slots as the proposal paint picker), with the chosen paint line + current
 * sheen + any saved color selection. Used by the public form and the owner view.
 */
export async function getColorSheetData(proposalId: number): Promise<ColorSheetData | null> {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: { estimate: { include: ESTIMATE_INCLUDE } },
  });
  if (!proposal) return null;
  const est = proposal.estimate as any;

  const [catalog, rd, colors] = await Promise.all([
    getPaintCatalog(),
    getCurrentRatesAndDefaults(),
    prisma.colorSelection.findMany({ where: { estimateId: est.id } }),
  ]);
  const colorByKey = Object.fromEntries(colors.map((c) => [c.slotKey, c]));

  // Index raw components by "kind:id" so we can read their sheen column.
  const comp: Record<string, any> = {};
  for (const r of est.rooms ?? []) comp[`room:${r.id}`] = r;
  for (const c of est.cabinetSets ?? []) comp[`cabinet:${c.id}`] = c;
  for (const d of est.deckAreas ?? []) comp[`deck:${d.id}`] = d;
  for (const h of est.exteriorHouses ?? []) comp[`exterior:${h.id}`] = h;
  for (const d of est.exteriorDoors ?? []) comp[`door:${d.id}`] = d;
  for (const s of est.exteriorShutters ?? []) comp[`shutter:${s.id}`] = s;
  for (const g of est.garageDoors ?? []) comp[`garage:${g.id}`] = g;
  for (const c of est.customAreas ?? []) comp[`custom:${c.id}`] = c;

  const slots = extractPaintSlots(toFullEstimateInput(est, catalog, rd.defaults), catalog);
  const surfaces: ColorSurface[] = slots.map((s) => {
    const key = slotKey(s.ref);
    const component = comp[`${s.ref.kind}:${s.ref.id}`];
    const sheenCol = sheenFieldFor(s.ref.kind, s.ref.field);
    const sheen = component && sheenCol ? component[sheenCol] ?? "Unsure" : "Unsure";
    const existing = colorByKey[key];
    return {
      ref: s.ref,
      key,
      label: s.label,
      paintName: catalog[s.currentPaintId]?.name ?? "",
      sheen,
      colorName: existing?.colorName ?? "",
      colorCode: existing?.colorCode ?? "",
      provider: existing?.provider ?? "",
    };
  });

  return {
    proposalId: proposal.id,
    estimateId: est.id,
    client: customerName(est.customer),
    project: est.projectName || "Your Project",
    surfaces,
  };
}
