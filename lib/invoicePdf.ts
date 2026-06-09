import { promises as fs } from "fs";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { ESTIMATE_INCLUDE } from "@/lib/estimateCalc";
import { formatCurrency } from "@/lib/calculations";
import { customerName } from "@/lib/format";
import { resolveUploadPath } from "@/lib/uploads";

const ACCENT = "#16a34a";
const DARK = "#0f172a";
const MUTED = "#64748b";

async function loadLogo(url?: string | null): Promise<Buffer | null> {
  if (!url || !url.trim()) return null;
  try {
    if (/^https?:\/\//i.test(url)) {
      const res = await fetch(url);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    }
    const p = resolveUploadPath(url);
    if (!p) return null;
    return await fs.readFile(p);
  } catch {
    return null;
  }
}

/** Generate a client-facing invoice PDF. Returns null if the invoice is missing. */
export async function generateInvoicePdf(
  invoiceId: number
): Promise<{ buffer: Buffer; filename: string } | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: { orderBy: { paidAt: "asc" } } },
  });
  if (!invoice) return null;

  const [company, estimate] = await Promise.all([
    prisma.companyProfile.findUnique({ where: { id: 1 } }),
    prisma.estimate.findUnique({ where: { id: invoice.estimateId }, include: ESTIMATE_INCLUDE }),
  ]);

  const client = estimate ? customerName(estimate.customer) : "Customer";
  const projectName = estimate?.projectName || "Project";
  const addr = estimate
    ? [estimate.street, estimate.city, estimate.state, estimate.zip].filter(Boolean).join(", ")
    : "";

  let lineItems: { name: string; total: number }[] = [];
  try {
    const parsed = JSON.parse(invoice.lineItemsJson);
    if (Array.isArray(parsed)) lineItems = parsed;
  } catch {
    /* ignore */
  }

  const paid = invoice.payments.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, invoice.total - paid);
  const discount = Math.max(0, invoice.subtotal - invoice.total);

  const doc = new PDFDocument({ size: "LETTER", margin: 50, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const contentWidth = right - left;
  const money = (v: number) => formatCurrency(v);
  const ensure = (h: number) => { if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage(); };

  // ---- Header ----
  const logoBuf = await loadLogo(company?.logoUrl);
  const headerTop = doc.y;
  const textW = logoBuf ? contentWidth - 166 : contentWidth;
  if (logoBuf) {
    try { doc.image(logoBuf, right - 150, headerTop, { fit: [150, 56] }); } catch { /* skip */ }
  }
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(24).text(company?.name ?? "Acres Painting Co.", left, headerTop, { width: textW });
  doc.fillColor(ACCENT).font("Helvetica").fontSize(10).text((company?.tagline || "Painting Co.").toUpperCase(), { characterSpacing: 1, width: textW });
  const contactBits = [company?.phone, company?.email, company?.website].filter(Boolean).join("  ·  ");
  if (contactBits) doc.fillColor(MUTED).fontSize(9).text(contactBits, { width: textW });
  if (logoBuf && doc.y < headerTop + 56) doc.y = headerTop + 56;

  // ---- Invoice meta ----
  doc.moveDown(0.8);
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(22).text("INVOICE", left, doc.y);
  const metaY = doc.y - 22;
  doc.font("Helvetica").fontSize(10).fillColor(MUTED);
  doc.text(`Invoice ${invoice.invoiceNumber}`, left, metaY + 26, { width: contentWidth, align: "right" });
  doc.text(`Date: ${invoice.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, { width: contentWidth, align: "right" });
  doc.fillColor(remaining > 0 ? "#b91c1c" : ACCENT).font("Helvetica-Bold").text(`Due: ${invoice.dueDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, { width: contentWidth, align: "right" });

  doc.moveDown(0.6);
  doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(9).text("BILL TO", left, doc.y);
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(13).text(client, left, doc.y);
  doc.fillColor(MUTED).font("Helvetica").fontSize(10).text(projectName);
  if (addr) doc.fillColor(MUTED).fontSize(9.5).text(addr);

  // ---- Line items ----
  doc.moveDown(0.8);
  doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(12).text("SUMMARY OF WORK", left, doc.y);
  doc.moveTo(left, doc.y + 2).lineTo(right, doc.y + 2).strokeColor("#e2e8f0").lineWidth(1).stroke();
  doc.moveDown(0.6);
  for (const li of lineItems) {
    ensure(20);
    const y = doc.y;
    doc.fillColor(DARK).font("Helvetica").fontSize(10.5).text(li.name, left, y, { width: contentWidth - 110 });
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10.5).text(money(li.total), left, y, { width: contentWidth, align: "right" });
    doc.moveDown(0.3);
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#eef2f7").lineWidth(0.5).stroke();
    doc.moveDown(0.3);
  }

  // ---- Totals ----
  const totalsRow = (label: string, value: string, opts?: { bold?: boolean; color?: string; size?: number }) => {
    ensure(18);
    const y = doc.y;
    doc.fillColor(opts?.color ?? MUTED).font(opts?.bold ? "Helvetica-Bold" : "Helvetica").fontSize(opts?.size ?? 10.5).text(label, left, y, { width: contentWidth - 120 });
    doc.fillColor(opts?.color ?? DARK).font("Helvetica-Bold").fontSize(opts?.size ?? 10.5).text(value, left, y, { width: contentWidth, align: "right" });
    doc.y = y + (opts?.size ? opts.size + 6 : 16);
  };
  doc.moveDown(0.4);
  if (discount > 0) {
    totalsRow("Subtotal", money(invoice.subtotal));
    totalsRow(`Deposit discount (${invoice.tierLabel})`, `− ${money(discount)}`, { color: ACCENT });
  }
  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#cbd5e1").lineWidth(1).stroke();
  doc.moveDown(0.4);
  totalsRow("Total Due", money(invoice.total), { bold: true, color: DARK, size: 13 });
  if (paid > 0) {
    totalsRow("Paid to date", `− ${money(paid)}`, { color: ACCENT });
    totalsRow("Balance Remaining", money(remaining), { bold: true, color: remaining > 0 ? "#b91c1c" : ACCENT, size: 13 });
  }

  // ---- Payments ----
  if (invoice.payments.length) {
    doc.moveDown(0.8);
    doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(12).text("PAYMENTS RECEIVED", left, doc.y);
    doc.moveTo(left, doc.y + 2).lineTo(right, doc.y + 2).strokeColor("#e2e8f0").lineWidth(1).stroke();
    doc.moveDown(0.5);
    for (const pmt of invoice.payments) {
      ensure(16);
      const y = doc.y;
      const desc = `${pmt.paidAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}${pmt.note ? ` — ${pmt.note}` : ""}`;
      doc.fillColor("#475569").font("Helvetica").fontSize(10).text(desc, left, y, { width: contentWidth - 110 });
      doc.fillColor(DARK).font("Helvetica").fontSize(10).text(money(pmt.amount), left, y, { width: contentWidth, align: "right" });
      doc.y = y + 15;
    }
  }

  // ---- Note ----
  if (invoice.notes.trim()) {
    doc.moveDown(0.8);
    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(9.5).text("Notes.", left, doc.y, { continued: true });
    doc.fillColor("#475569").font("Helvetica").fontSize(9.5).text(" " + invoice.notes);
  }

  // ---- Pay online ----
  if (invoice.paymentLink.trim() && remaining > 0) {
    const link = invoice.paymentLink.trim();
    doc.moveDown(0.8);
    ensure(18);
    doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(10.5).text("Pay online: ", left, doc.y, { continued: true });
    doc.fillColor("#1d4ed8").font("Helvetica").fontSize(10).text(link, { link, underline: true });
  }

  doc.moveDown(1.2);
  doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(9).text("Thank you for your business!", left, doc.y, { width: contentWidth, align: "center" });

  doc.end();
  const buffer = await done;
  const safe = (projectName || "invoice").replace(/[^a-z0-9]+/gi, "_").slice(0, 40);
  return { buffer, filename: `${invoice.invoiceNumber}_${safe}.pdf` };
}
