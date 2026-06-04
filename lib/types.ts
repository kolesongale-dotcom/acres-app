// Shared types for Acres Painting Co.
import type { JobRates } from "@/lib/calculations";

export type { JobRates };

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

export const ESTIMATE_STATUSES = [
  "Draft",
  "Sent",
  "Pending",
  "Viewed",
  "Accepted",
  "Scheduled",
  "Rejected",
] as const;

export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

export const PROPOSAL_STATUSES = [
  "Draft",
  "Sent",
  "Pending",
  "Accepted",
  "Rejected",
] as const;

export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const CUSTOMER_STATUSES = ["lead", "active", "past", "inactive"] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const LEAD_SOURCES = [
  "Unknown",
  "Referral",
  "Google",
  "Website",
  "Facebook",
  "Instagram",
  "Yard Sign",
  "Repeat Client",
  "Angi / HomeAdvisor",
  "Nextdoor",
  "Other",
] as const;

// Paint categories (PriceBookItem.category). A surface's selected paint carries
// its category; on the client proposal the client may swap to any paint sharing
// that category — EXCEPT "Primer", which is locked.
export const PAINT_CATEGORIES = [
  "Interior Wall/Ceiling",
  "Interior Trim/Door",
  "Exterior",
  "Cabinet",
  "Deck/Stain",
  "Primer",
] as const;
export type PaintCategory = (typeof PAINT_CATEGORIES)[number];

/** Categories a client is allowed to change on the proposal (everything but Primer). */
export const CLIENT_SELECTABLE_CATEGORIES: readonly string[] = PAINT_CATEGORIES.filter(
  (c) => c !== "Primer"
);

// Sheen / finish per painted surface. Purely informational (does NOT affect price)
// — shown in the builder and on the client proposal. Default "Unsure".
export const SHEEN_OPTIONS = [
  "Flat",
  "Matte",
  "Eggshell",
  "Satin",
  "Semi-gloss",
  "Gloss",
  "Unsure",
] as const;
export type Sheen = (typeof SHEEN_OPTIONS)[number];
export const DEFAULT_SHEEN = "Unsure";

// Paint providers offered on the client Color/Sheen sheet. "Other" reveals a
// free-text field. (Stored value is just the chosen/typed brand string.)
export const COLOR_PROVIDERS = [
  "Sherwin-Williams",
  "Benjamin Moore",
  "Home Depot",
  "Lowe's",
  "Other",
] as const;

export const SIDING_MATERIALS = [
  "Vinyl",
  "Stucco",
  "Brick",
  "FiberCement",
  "Wood",
  "Aluminum",
] as const;

export const LINE_CATEGORIES = [
  "Labor",
  "Material",
  "Equipment",
  "Subcontractor",
  "Other",
] as const;

export const PRICEBOOK_UNITS = [
  "gallon",
  "quart",
  "each",
  "roll",
  "tube",
  "box",
  "pack",
  "sqft",
  "linear ft",
  "hour",
] as const;

// Payload shapes used when saving the full estimate from the builder.
export interface ItemMaterialPayload {
  priceBookItemId: number | null;
  name: string;
  unit: string;
  quantity: number;
  unitCost: number;
  markup: number;
}

export interface PrimerFields {
  primerPaintId: number | null;
  primerCoats: number;
  primerSqftAdjust: number;
}

export interface DeductionPayload {
  label: string;
  kind: string; // "door" | "window" | "custom"
  width: number;
  height: number;
  includeTrim: boolean;
}

export interface RoomPayload {
  id?: number;
  name: string;
  length: number;
  width: number;
  height: number;
  paintWalls: boolean;
  paintCeiling: boolean;
  paintTrim: boolean;
  wallCoats: number;
  ceilingCoats: number;
  trimCoats: number;
  wallSqftAdjust: number;
  ceilingSqftAdjust: number;
  trimLfAdjust: number;
  wallProduct: string;
  ceilingProduct: string;
  trimProduct: string;
  wallSheen: string;
  ceilingSheen: string;
  trimSheen: string;
  wallPaintId: number | null;
  ceilingPaintId: number | null;
  trimPaintId: number | null;
  wallPrimerPaintId: number | null;
  wallPrimerCoats: number;
  wallPrimerSqftAdjust: number;
  ceilingPrimerPaintId: number | null;
  ceilingPrimerCoats: number;
  ceilingPrimerSqftAdjust: number;
  trimPrimerPaintId: number | null;
  trimPrimerCoats: number;
  trimPrimerSqftAdjust: number;
  materials: ItemMaterialPayload[];
  sortOrder: number;
  deductions: DeductionPayload[];
  accentWalls: {
    label: string;
    length: number;
    height: number;
    coats: number;
    product: string;
    paintId: number | null;
  }[];
}

export interface CabinetPayload {
  id?: number;
  name: string;
  doorCount: number;
  drawerCount: number;
  frameCount: number;
  coats: number;
  primerCoats: number;
  primerProduct: string;
  paintProduct: string;
  sheen: string;
  paintId: number | null;
  primerId: number | null;
  materials: ItemMaterialPayload[];
  sortOrder: number;
}

export interface DeckPayload {
  id?: number;
  name: string;
  floorLength: number;
  floorWidth: number;
  includeRailing: boolean;
  railingLinFt: number;
  stepCount: number;
  includeLattice: boolean;
  latticeSqFt: number;
  coats: number;
  powerWashCost: number;
  woodReplCost: number;
  floorSheen: string;
  railSheen: string;
  floorStainId: number | null;
  railStainId: number | null;
  primerPaintId: number | null;
  primerCoats: number;
  primerSqftAdjust: number;
  materials: ItemMaterialPayload[];
  sortOrder: number;
}

export interface ExteriorHousePayload {
  id?: number;
  name: string;
  sidingLength: number;
  sidingWidth: number;
  sidingHeight: number;
  sidingSqftAdjust: number;
  sidingMaterial: string;
  coats: number;
  paintProduct: string;
  sheen: string;
  paintId: number | null;
  primerPaintId: number | null;
  primerCoats: number;
  primerSqftAdjust: number;
  materials: ItemMaterialPayload[];
  sortOrder: number;
  deductions: { label: string; width: number; height: number }[];
  replacements: { description: string; cost: number }[];
}

export interface DoorPayload {
  id?: number;
  name: string;
  count: number;
  width: number;
  height: number;
  paintedSides: number;
  coats: number;
  paintProduct: string;
  sheen: string;
  paintId: number | null;
  primerPaintId: number | null;
  primerCoats: number;
  primerSqftAdjust: number;
  materials: ItemMaterialPayload[];
  sortOrder: number;
}

export interface ShutterPayload {
  id?: number;
  name: string;
  story1: number;
  story2: number;
  story3: number;
  customQty: number;
  customRate: number;
  coats: number;
  paintProduct: string;
  sheen: string;
  paintId: number | null;
  primerPaintId: number | null;
  primerCoats: number;
  primerSqftAdjust: number;
  materials: ItemMaterialPayload[];
  sortOrder: number;
}

export interface GaragePayload {
  id?: number;
  name: string;
  count: number;
  width: number;
  height: number;
  coats: number;
  paintProduct: string;
  sheen: string;
  paintId: number | null;
  primerPaintId: number | null;
  primerCoats: number;
  primerSqftAdjust: number;
  materials: ItemMaterialPayload[];
  sortOrder: number;
}

export interface CustomAreaPayload {
  id?: number;
  label: string;
  measureType: string; // "area" | "trim"
  amount: number;
  rate: number;
  coats: number;
  paintProduct: string;
  sheen: string;
  paintId: number | null;
  primerPaintId: number | null;
  primerCoats: number;
  primerSqftAdjust: number;
  materials: ItemMaterialPayload[];
  sortOrder: number;
}

export interface LineItemPayload {
  id?: number;
  description: string;
  category: string;
  quantity: number;
  unitCost: number;
  markup: number;
  taxable: boolean;
  unit: string;
  priceBookItemId: number | null;
  sortOrder: number;
}

export interface OverheadPayload {
  id?: number;
  description: string;
  cost: number;
  markup: number;
  sortOrder: number;
}

export interface PhotoPayload {
  id?: number;
  url: string;
  caption: string;
  sortOrder: number;
}

export interface EstimateSetupPayload {
  projectName: string;
  customerId: number | null;
  street: string;
  city: string;
  state: string;
  zip: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  durationDays: number;
  taxRate: number;
  discountType: string;
  discountValue: number;
  notes: string;
}

export interface PaintDefaults {
  defaultWallPaintId: number | null;
  defaultCeilingPaintId: number | null;
  defaultTrimPaintId: number | null;
  defaultDeckFloorStainId: number | null;
  defaultDeckRailStainId: number | null;
  defaultSidingPaintId: number | null;
  defaultDoorPaintId: number | null;
  defaultShutterPaintId: number | null;
  defaultGaragePaintId: number | null;
}

export interface FullEstimatePayload {
  id: number;
  setup: EstimateSetupPayload;
  rates: JobRates; // snapshot persisted to Estimate.ratesSnapshot
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

export interface PaintCatalogEntry {
  id: number;
  name: string;
  brand: string;
  unitCost: number;
  markup: number;
  coverage: number;
}

export interface MaterialCatalogEntry {
  id: number;
  name: string;
  brand: string;
  unit: string;
  unitCost: number;
  markup: number;
}
