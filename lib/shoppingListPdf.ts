import { promises as fs } from "fs";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/calculations";
import { resolveUploadPath } from "@/lib/uploads";
import { buildShoppingList } from "@/lib/shoppingList";

const ACCENT = "#16a34a";
const DARK = "#0f172a";
const MUTED = "#64748b";

async function loadLogo(url?: string | null): Promise<Buffer | null> {
  if (!url || !url.trim()) return null;
  try {
    if (/^https?:\/\//i.test(url)) {
      const res = await fetch(url);
      return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    }
    const p = resolveUploadPath(url);
    return p ? await fs.readFile(p) : null;
  } catch {
    return null;
  }
}

/** Internal "what to buy" sheet for a job. Returns null if the estimate is missing. */
export async function generateShoppingListPdf(
  estimateId: number
): Promise<{ buffer: Buffer; filename: string } | null> {
  const data = await buildShoppingList(estimateId);
  if (!data) return null;
  const company = await prisma.companyProfile.findUnique({ where: { id: 1 } });

  const doc = new PDFDocument({ size: "LETTER", margin: 50, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const contentWidth = right - left;
  const money = (v: number) => formatCurrency(v);
  const ensure = (h: number) => { if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage(); };

  // Header
  const logo = await loadLogo(company?.logoUrl);
  const top = doc.y;
  const textW = logo ? contentWidth - 166 : contentWidth;
  if (logo) { try { doc.image(logo, right - 150, top, { fit: [150, 56] }); } catch { /* skip */ } }
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(22).text(company?.name ?? "Acres Painting Co.", left, top, { width: textW });
  doc.fillColor(ACCENT).font("Helvetica").fontSize(10).text("MATERIALS / SHOPPING LIST", { characterSpacing: 1, width: textW });
  if (logo && doc.y < top + 56) doc.y = top + 56;
  doc.moveDown(0.6);
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(15).text(`${data.project}`, left, doc.y);
  doc.fillColor(MUTED).font("Helvetica").fontSize(10).text(`${data.client}  ·  ${data.estimateNumber}  ·  ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`);

  // Column layout helper
  const section = (title: string) => {
    ensure(40);
    doc.moveDown(0.8);
    doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(12).text(title.toUpperCase(), left, doc.y);
    doc.moveTo(left, doc.y + 2).lineTo(right, doc.y + 2).strokeColor("#e2e8f0").lineWidth(1).stroke();
    doc.moveDown(0.5);
  };

  const COLR = right; // right edge for cost
  const QTYX = right - 150;
  const paintRow = (label: string, sub: string, qty: string, cost: string, bold = false) => {
    ensure(20);
    const y = doc.y;
    doc.fillColor(DARK).font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10.5).text(label, left, y, { width: QTYX - left - 8 });
    if (sub) doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(8.5).text(sub, left, doc.y, { width: QTYX - left - 8 });
    doc.fillColor(MUTED).font("Helvetica").fontSize(10).text(qty, QTYX, y, { width: 90, align: "right" });
    doc.fillColor(DARK).font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10.5).text(cost, COLR - 90, y, { width: 90, align: "right" });
    doc.y = Math.max(doc.y, y) + 4;
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#f1f5f9").lineWidth(0.5).stroke();
    doc.moveDown(0.25);
  };

  if (data.paints.length) {
    section("Paint");
    for (const p of data.paints) {
      const color = [p.colorName, p.colorCode].filter(Boolean).join(" ");
      const sub = [color || "color TBD", p.provider, p.sheen].filter(Boolean).join(" · ");
      paintRow(p.paintName, sub, `${p.gallons} gal`, money(p.lineCost));
    }
  }
  if (data.primers.length) {
    section("Primer");
    for (const p of data.primers) paintRow(p.paintName, "", `${p.gallons} gal`, money(p.lineCost));
  }
  if (data.supplies.length) {
    section("Materials & Supplies");
    for (const s of data.supplies) paintRow(s.name, "", `${s.quantity}`, money(s.lineCost));
  }

  // Total
  ensure(30);
  doc.moveDown(0.4);
  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#cbd5e1").lineWidth(1).stroke();
  doc.moveDown(0.4);
  const ty = doc.y;
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(13).text("Estimated Total", left, ty);
  doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(13).text(money(data.totalCost), left, ty, { width: contentWidth, align: "right" });
  doc.moveDown(1);
  doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(8.5).text("Quantities are rounded up per area; verify against actual coverage. Costs are your unit costs.", left, doc.y, { width: contentWidth });

  doc.end();
  const buffer = await done;
  const safe = (data.project || "job").replace(/[^a-z0-9]+/gi, "_").slice(0, 40);
  return { buffer, filename: `ShoppingList_${data.estimateNumber}_${safe}.pdf` };
}
