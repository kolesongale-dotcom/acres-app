import { promises as fs } from "fs";
import PDFDocument from "pdfkit";
import { resolveUploadPath } from "@/lib/uploads";
import { prisma } from "@/lib/prisma";
import { ESTIMATE_INCLUDE, computeEstimate } from "@/lib/estimateCalc";
import { getPaintCatalog } from "@/lib/priceCatalog";
import { getCurrentRatesAndDefaults } from "@/lib/jobRates";
import { calcTiers, formatCurrency } from "@/lib/calculations";
import { customerName } from "@/lib/format";

const ACCENT = "#16a34a";
const DARK = "#0f172a";
const MUTED = "#64748b";

/**
 * Load a logo into a Buffer for pdfkit. Handles both locally-uploaded images
 * (e.g. /uploads/branding/x.png served from /public) and absolute http(s) URLs.
 * Returns null on any failure so the header silently falls back to text only.
 * Note: pdfkit only decodes PNG and JPEG — other formats (webp/svg) return null.
 */
async function loadLogoBuffer(url?: string | null): Promise<Buffer | null> {
  if (!url || !url.trim()) return null;
  try {
    if (/^https?:\/\//i.test(url)) {
      const res = await fetch(url);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    }
    const filePath = resolveUploadPath(url);
    if (!filePath) return null;
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

/** Generate a client-facing proposal PDF. Returns null if the proposal is missing. */
export async function generateProposalPdf(
  proposalId: number
): Promise<{ buffer: Buffer; filename: string } | null> {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: { estimate: { include: ESTIMATE_INCLUDE } },
  });
  if (!proposal) return null;

  const [company, settings, catalog, rd] = await Promise.all([
    prisma.companyProfile.findUnique({ where: { id: 1 } }),
    prisma.businessSettings.findUnique({ where: { id: 1 } }),
    getPaintCatalog(),
    getCurrentRatesAndDefaults(),
  ]);

  const { services, totals } = computeEstimate(proposal.estimate as any, catalog, rd.defaults);
  const tiers = calcTiers(totals.grandTotal, {
    midDepositPercent: settings?.midDepositPercent ?? 15,
    midDepositDiscount: settings?.midDepositDiscount ?? 3,
    maxDepositPercent: settings?.maxDepositPercent ?? 30,
    maxDepositDiscount: settings?.maxDepositDiscount ?? 6,
  });

  let sopIds: number[] = [];
  try {
    const parsed = JSON.parse(proposal.includedSOPs);
    if (Array.isArray(parsed)) sopIds = parsed;
  } catch {
    /* ignore */
  }
  const procedures = sopIds.length
    ? await prisma.procedureTemplate.findMany({ where: { id: { in: sopIds } }, orderBy: { sortOrder: "asc" } })
    : [];

  const client = customerName(proposal.estimate.customer);
  const projectName = proposal.estimate.projectName || "Your Project";
  const addr = [proposal.estimate.street, proposal.estimate.city, proposal.estimate.state, proposal.estimate.zip].filter(Boolean).join(", ");

  const doc = new PDFDocument({ size: "LETTER", margin: 50, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const contentWidth = right - left;

  const ensure = (h: number) => {
    if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage();
  };
  const sectionHeader = (title: string) => {
    ensure(40);
    doc.moveDown(0.6);
    doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(12).text(title.toUpperCase(), left, doc.y);
    doc.moveTo(left, doc.y + 2).lineTo(right, doc.y + 2).strokeColor("#e2e8f0").lineWidth(1).stroke();
    doc.moveDown(0.6);
  };
  const money = (v: number) => formatCurrency(v);

  // ---- Header ----
  const logoBuf = await loadLogoBuffer(company?.logoUrl);
  const logoBoxW = 150;
  const logoBoxH = 56;
  const headerTop = doc.y;
  // When a logo is present, reserve space on the right so long company names
  // don't run underneath it.
  const headerTextW = logoBuf ? contentWidth - logoBoxW - 16 : contentWidth;
  if (logoBuf) {
    try {
      doc.image(logoBuf, right - logoBoxW, headerTop, { fit: [logoBoxW, logoBoxH] });
    } catch {
      /* unsupported image format — skip, header stays text-only */
    }
  }
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(24).text(company?.name ?? "Acres Painting Co.", left, headerTop, { width: headerTextW });
  doc.fillColor(ACCENT).font("Helvetica").fontSize(10).text((company?.tagline || "Painting Co.").toUpperCase(), { characterSpacing: 1, width: headerTextW });
  const contactBits = [company?.phone, company?.email, company?.website].filter(Boolean).join("  ·  ");
  if (contactBits) doc.fillColor(MUTED).fontSize(9).text(contactBits, { width: headerTextW });
  // Ensure following content clears the logo even if the text block is shorter.
  if (logoBuf && doc.y < headerTop + logoBoxH) doc.y = headerTop + logoBoxH;

  doc.moveDown(0.8);
  doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(10).text(`PROPOSAL ${proposal.proposalNumber}`, left, doc.y);
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(20).text(projectName);
  doc.fillColor(MUTED).font("Helvetica").fontSize(10).text(`Prepared for ${client}`);
  if (addr) doc.fillColor(MUTED).fontSize(9.5).text(addr);
  doc.fillColor(MUTED).fontSize(9).text(`Date: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`);

  // ---- Scope (one row per service: name + subtitle + total) ----
  sectionHeader("Services Breakdown");
  for (const s of services) {
    const nameH = doc.font("Helvetica-Bold").fontSize(10.5).heightOfString(s.name, { width: contentWidth - 100 });
    const subH = s.subtitle ? doc.font("Helvetica-Oblique").fontSize(8.5).heightOfString(s.subtitle, { width: contentWidth - 100 }) : 0;
    ensure(nameH + subH + 10);
    const y = doc.y;
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10.5).text(s.name, left, y, { width: contentWidth - 100 });
    doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(11).text(money(s.total), left, y, { width: contentWidth, align: "right" });
    if (s.subtitle) doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(8.5).text(s.subtitle, left, doc.y + 1, { width: contentWidth - 100 });
    doc.moveDown(0.5);
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#eef2f7").lineWidth(0.5).stroke();
    doc.moveDown(0.4);
  }
  // Overhead (project-wide)
  if (proposal.estimate.overheadItems.length > 0) {
    for (const o of proposal.estimate.overheadItems) {
      const price = o.cost * (1 + o.markup / 100);
      const y = doc.y;
      ensure(16);
      doc.fillColor("#334155").font("Helvetica").fontSize(10).text(o.description || "Project cost", left, y, { width: contentWidth - 100 });
      doc.fillColor(DARK).font("Helvetica-Bold").text(money(price), left, y, { width: contentWidth, align: "right" });
      doc.y = y + 16;
    }
  }
  // Total
  ensure(30);
  doc.moveTo(left, doc.y + 2).lineTo(right, doc.y + 2).strokeColor("#cbd5e1").lineWidth(1).stroke();
  doc.moveDown(0.5);
  const ty = doc.y;
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(13).text("Project Total", left, ty);
  doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(13).text(money(totals.grandTotal), left, ty, { width: contentWidth, align: "right" });
  doc.y = ty + 18;

  // ---- Pricing options ----
  sectionHeader("Pricing Options");
  const tierList = [
    { key: "full", title: "Full Price", sub: "Paid at completion", total: tiers.full.total, deposit: 0, savings: 0 },
    { key: "mid", title: `${tiers.mid.depositPercent}% Deposit`, sub: `Save ${tiers.mid.discountPercent}%`, total: tiers.mid.total, deposit: tiers.mid.deposit, savings: tiers.mid.savings },
    { key: "max", title: `${tiers.max.depositPercent}% Deposit`, sub: `Save ${tiers.max.discountPercent}% — best value`, total: tiers.max.total, deposit: tiers.max.deposit, savings: tiers.max.savings },
  ];
  for (const t of tierList) {
    ensure(40);
    const selected = proposal.selectedTier === t.key;
    const y = doc.y;
    if (selected) {
      doc.rect(left, y - 2, contentWidth, 34).fill("#f0fdf4");
    }
    doc.fillColor(selected ? ACCENT : DARK).font("Helvetica-Bold").fontSize(11).text(`${t.title}${selected ? "  ✓ selected" : ""}`, left + 6, y + 4, { width: contentWidth - 130 });
    doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(t.sub + (t.deposit > 0 ? `  ·  deposit ${money(t.deposit)}` : ""), left + 6, y + 18, { width: contentWidth - 130 });
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(13).text(money(t.total), left, y + 8, { width: contentWidth - 6, align: "right" });
    doc.y = y + 38;
  }

  // ---- SOPs ----
  if (procedures.length) {
    sectionHeader("Our Standard Operating Procedures");
    for (const p of procedures) {
      const titleH = doc.font("Helvetica-Bold").fontSize(10).heightOfString(p.title, { width: contentWidth - 18 });
      const descH = doc.font("Helvetica").fontSize(9).heightOfString(p.description, { width: contentWidth - 18 });
      ensure(titleH + descH + 8);
      const y = doc.y;
      doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(10).text("✓", left, y);
      doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10).text(p.title, left + 16, y, { width: contentWidth - 18 });
      doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(p.description, left + 16, doc.y, { width: contentWidth - 18 });
      doc.moveDown(0.4);
    }
  }

  // ---- Terms & Exclusions ----
  if (settings?.standardTerms || settings?.standardExclusions) {
    sectionHeader("Terms & Exclusions");
    if (settings?.standardTerms) {
      ensure(40);
      doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9.5).text("Terms.", { continued: true });
      doc.fillColor("#475569").font("Helvetica").fontSize(9.5).text(" " + settings.standardTerms);
      doc.moveDown(0.4);
    }
    if (settings?.standardExclusions) {
      ensure(40);
      doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9.5).text("Exclusions.", { continued: true });
      doc.fillColor("#475569").font("Helvetica").fontSize(9.5).text(" " + settings.standardExclusions);
    }
  }

  // ---- Custom note ----
  if (proposal.customNotes.trim()) {
    sectionHeader("A Note From Us");
    doc.fillColor("#475569").font("Helvetica").fontSize(10).text(proposal.customNotes, { width: contentWidth });
  }

  // ---- Photos ----
  const photos = proposal.estimate.photos ?? [];
  if (photos.length) {
    sectionHeader("Project Photos");
    for (const ph of photos) {
      try {
        const filePath = resolveUploadPath(ph.url);
        if (!filePath) continue;
        const bytes = await fs.readFile(filePath);
        const imgH = 200;
        const capH = ph.caption ? doc.font("Helvetica").fontSize(9).heightOfString(ph.caption, { width: contentWidth }) + 4 : 0;
        ensure(imgH + capH + 12);
        doc.image(bytes, left, doc.y, { fit: [contentWidth, imgH], align: "center" });
        doc.y += imgH + 4;
        if (ph.caption) {
          doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(9).text(ph.caption, left, doc.y, { width: contentWidth });
        }
        doc.moveDown(0.6);
      } catch {
        /* skip unreadable image */
      }
    }
  }

  // ---- Signature ----
  sectionHeader("Acceptance");
  if (proposal.signedAt && proposal.signatureData) {
    ensure(110);
    doc.fillColor("#475569").font("Helvetica").fontSize(10).text(`Accepted by ${proposal.signatureName} on ${proposal.signedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, left, doc.y);
    doc.moveDown(0.4);
    try {
      const b64 = proposal.signatureData.split(",")[1] ?? "";
      if (b64) doc.image(Buffer.from(b64, "base64"), left, doc.y, { fit: [220, 80] });
    } catch {
      /* ignore */
    }
  } else {
    ensure(70);
    doc.fillColor("#475569").font("Helvetica").fontSize(10).text("To accept this proposal, please reply to this email or sign and return.", left, doc.y);
    doc.moveDown(1.6);
    const y = doc.y;
    doc.moveTo(left, y).lineTo(left + 240, y).strokeColor("#94a3b8").lineWidth(1).stroke();
    doc.moveTo(right - 160, y).lineTo(right, y).strokeColor("#94a3b8").lineWidth(1).stroke();
    doc.fillColor(MUTED).fontSize(9).text("Signature", left, y + 4);
    doc.fillColor(MUTED).fontSize(9).text("Date", right - 160, y + 4);
  }

  doc.end();
  const buffer = await done;
  const safeProject = (projectName || "proposal").replace(/[^a-z0-9]+/gi, "_").slice(0, 40);
  return { buffer, filename: `${proposal.proposalNumber}_${safeProject}.pdf` };
}
