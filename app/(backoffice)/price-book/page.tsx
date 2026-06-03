import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import PriceBookClient, { PriceItem } from "./PriceBookClient";

export const dynamic = "force-dynamic";

export default async function PriceBookPage() {
  const items = await prisma.priceBookItem.findMany({
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
  });

  const rows: PriceItem[] = items.map((i) => ({
    id: i.id,
    type: i.type,
    name: i.name,
    brand: i.brand,
    unit: i.unit,
    unitCost: i.unitCost,
    markup: i.markup,
    coverage: i.coverage,
    category: i.category,
    notes: i.notes,
  }));

  return (
    <div>
      <PageHeader
        title="Price Book"
        subtitle="Your paint products and materials. Enter your cost + a per-item markup; estimates pull these prices in."
      />
      <PriceBookClient items={rows} />
    </div>
  );
}
