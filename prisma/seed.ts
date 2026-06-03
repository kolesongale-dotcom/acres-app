import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PROPOSAL_EMAIL_TEMPLATE = `Subject: Your Acres Painting Co. Proposal – [Project Name]

Hi [Client Name],

Thank you for the opportunity to provide an estimate for your project. I've attached your personalized proposal for your review.

Inside, you'll find:
- A full breakdown of the work to be performed
- Your pricing options (including deposit discount tiers)
- Our standard operating procedures and quality guarantees
- A digital signature for easy acceptance

Please don't hesitate to reach out with any questions. I'm happy to walk through the proposal with you over the phone.

Looking forward to working with you,

Koleson
Acres Painting Co.`;

const STANDARD_TERMS = `All work performed by Acres Painting Co. is guaranteed for two (2) years against peeling, blistering, and excessive fading under normal conditions. A signed proposal and agreed-upon deposit are required to schedule work. Final balance is due upon completion and customer walk-through approval. Acres Painting Co. carries full liability insurance. Color selections must be finalized at least 48 hours prior to the project start date.`;

const STANDARD_EXCLUSIONS = `This proposal excludes: repair of structural or water damage; mold/mildew remediation; lead paint abatement (homes pre-1978 may require separate certified handling); removal/reinstallation of large furniture or electronics; wallpaper removal unless explicitly itemized; and any work not specifically listed in the project scope. Unforeseen conditions discovered after work begins may require a written change order.`;

const PROCEDURES: {
  category: string;
  title: string;
  description: string;
  isDefault: boolean;
}[] = [
  {
    category: "Preparation",
    title: "Surface Cleaning & Degreasing",
    description:
      "All surfaces are washed and degreased to remove dirt, oils, and contaminants, ensuring proper paint adhesion and a flawless finish.",
    isDefault: true,
  },
  {
    category: "Preparation",
    title: "Masking & Surface Protection",
    description:
      "We carefully mask trim, fixtures, and adjacent surfaces with professional-grade tape and film to deliver crisp, clean paint lines.",
    isDefault: true,
  },
  {
    category: "Preparation",
    title: "Caulking & Gap Sealing",
    description:
      "Cracks, gaps, and seams are filled with premium paintable caulk for a seamless, weather-tight, professional appearance.",
    isDefault: true,
  },
  {
    category: "Preparation",
    title: "Surface Sanding & Patching",
    description:
      "Imperfections, nail holes, and rough spots are patched and sanded smooth so the finished coat looks even and uniform.",
    isDefault: false,
  },
  {
    category: "Application",
    title: "Priming All Bare Surfaces",
    description:
      "Bare wood, drywall repairs, and stained areas receive a quality primer coat to seal the surface and promote lasting adhesion.",
    isDefault: true,
  },
  {
    category: "Application",
    title: "Two-Coat Application Standard",
    description:
      "Unless otherwise noted, all surfaces receive a minimum of two full coats of premium paint for complete, durable coverage.",
    isDefault: true,
  },
  {
    category: "Application",
    title: "Trim & Detail Work",
    description:
      "Trim, doors, and detail areas are hand-finished with precision brushes and rollers for a smooth, factory-quality look.",
    isDefault: true,
  },
  {
    category: "Application",
    title: "Paint Product Quality Standard",
    description:
      "We use only premium Sherwin-Williams and Benjamin Moore products selected for durability, color retention, and washability.",
    isDefault: true,
  },
  {
    category: "Protection",
    title: "Customer Property Protection",
    description:
      "Floors, furniture, and landscaping are covered and protected throughout the project to keep your home clean and damage-free.",
    isDefault: true,
  },
  {
    category: "Protection",
    title: "Daily Cleanup Protocol",
    description:
      "At the end of each work day, the site is organized and cleaned, with tools stored safely and debris removed.",
    isDefault: true,
  },
  {
    category: "Cleanup",
    title: "Post-Job Site Cleanup",
    description:
      "Upon completion, all materials, masking, and debris are removed and the work area is left clean and ready to enjoy.",
    isDefault: true,
  },
  {
    category: "Cleanup",
    title: "Final Walk-Through Inspection",
    description:
      "We conduct a detailed walk-through with you to confirm every detail meets the Acres Painting Co. standard before sign-off.",
    isDefault: true,
  },
  {
    category: "Cleanup",
    title: "Touch-Up Guarantee",
    description:
      "Any touch-ups identified during the final walk-through are completed before the project is considered finished.",
    isDefault: true,
  },
];

async function main() {
  // CompanyProfile
  await prisma.companyProfile.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "Acres Painting Co.",
      email: "koleson@acrespainting.co",
      phone: "(610) 555-0142",
      address: "Philadelphia Suburbs, PA",
      website: "www.acrespainting.co",
      tagline: "Painting Co.",
      logoUrl: "",
    },
  });

  // BusinessSettings
  await prisma.businessSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      globalTaxRate: 0,
      globalMarkupDefault: 30,
      standardTerms: STANDARD_TERMS,
      standardExclusions: STANDARD_EXCLUSIONS,
      midDepositPercent: 15,
      midDepositDiscount: 3,
      maxDepositPercent: 30,
      maxDepositDiscount: 6,
      proposalEmailTemplate: PROPOSAL_EMAIL_TEMPLATE,
    },
  });

  // JobRateSettings singleton (master labor rates). User edits real values in Settings.
  await prisma.jobRateSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  // ProcedureTemplates — only seed if none exist
  const existingCount = await prisma.procedureTemplate.count();
  if (existingCount === 0) {
    await prisma.procedureTemplate.createMany({
      data: PROCEDURES.map((p, i) => ({ ...p, sortOrder: i })),
    });
  }

  // PriceBook — only seed if empty. Costs are illustrative starting points.
  const priceCount = await prisma.priceBookItem.count();
  if (priceCount === 0) {
    await prisma.priceBookItem.createMany({
      data: [
        // Paint (unit = gallon, coverage = sq ft per gallon)
        { type: "paint", name: "Cashmere Interior — Eggshell", brand: "Sherwin-Williams", unit: "gallon", unitCost: 58, markup: 35, coverage: 400, sortOrder: 0 },
        { type: "paint", name: "Emerald Interior — Matte", brand: "Sherwin-Williams", unit: "gallon", unitCost: 72, markup: 35, coverage: 400, sortOrder: 1 },
        { type: "paint", name: "Regal Select Interior — Eggshell", brand: "Benjamin Moore", unit: "gallon", unitCost: 64, markup: 35, coverage: 400, sortOrder: 2 },
        { type: "paint", name: "Aura Interior — Matte", brand: "Benjamin Moore", unit: "gallon", unitCost: 85, markup: 35, coverage: 400, sortOrder: 3 },
        { type: "paint", name: "ProClassic Trim Enamel", brand: "Sherwin-Williams", unit: "gallon", unitCost: 78, markup: 35, coverage: 400, sortOrder: 4 },
        { type: "paint", name: "Duration Exterior — Satin", brand: "Sherwin-Williams", unit: "gallon", unitCost: 82, markup: 35, coverage: 350, sortOrder: 5 },
        { type: "paint", name: "PrepRite ProBlock Primer", brand: "Sherwin-Williams", unit: "gallon", unitCost: 42, markup: 30, coverage: 400, sortOrder: 6 },
        { type: "paint", name: "SuperDeck Deck Stain", brand: "Sherwin-Williams", unit: "gallon", unitCost: 55, markup: 35, coverage: 200, sortOrder: 7 },
        // Materials / supplies
        { type: "material", name: "Plastic Sheeting (.7 mil, 400 sf roll)", brand: "", unit: "roll", unitCost: 12, markup: 40, coverage: 400, sortOrder: 0 },
        { type: "material", name: "Painter's Tape (1.88 in)", brand: "ScotchBlue", unit: "roll", unitCost: 7, markup: 40, coverage: 400, sortOrder: 1 },
        { type: "material", name: "Rosin Paper (floor protection, roll)", brand: "", unit: "roll", unitCost: 18, markup: 40, coverage: 400, sortOrder: 2 },
        { type: "material", name: "Painter's Caulk (10 oz tube)", brand: "DAP", unit: "tube", unitCost: 4, markup: 50, coverage: 400, sortOrder: 3 },
        { type: "material", name: "Spackle / Patching Compound (qt)", brand: "", unit: "each", unitCost: 9, markup: 45, coverage: 400, sortOrder: 4 },
        { type: "material", name: "Sandpaper Pack (assorted grit)", brand: "", unit: "pack", unitCost: 11, markup: 45, coverage: 400, sortOrder: 5 },
        { type: "material", name: "Roller Covers (3/8 in, 2-pack)", brand: "", unit: "pack", unitCost: 9, markup: 40, coverage: 400, sortOrder: 6 },
        { type: "material", name: "Drop Cloth (9x12 canvas)", brand: "", unit: "each", unitCost: 16, markup: 40, coverage: 400, sortOrder: 7 },
      ],
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
