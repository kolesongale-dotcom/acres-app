import { prisma } from "@/lib/prisma";
import { PaintCatalog } from "@/lib/calculations";

/** Build the paint pricing catalog (keyed by PriceBookItem id) for calculations. */
export async function getPaintCatalog(): Promise<PaintCatalog> {
  const paints = await prisma.priceBookItem.findMany({ where: { type: "paint" } });
  const catalog: PaintCatalog = {};
  for (const p of paints) {
    catalog[p.id] = {
      name: p.name,
      unitCost: p.unitCost,
      coverage: p.coverage,
      markup: p.markup,
    };
  }
  return catalog;
}
