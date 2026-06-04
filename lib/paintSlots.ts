/**
 * Shared (client + server safe) helpers for client-selectable paints on a proposal.
 *
 * A "paint slot" is one painted surface whose paint the client may swap on the
 * sign page (e.g. a room's walls, a deck's floor). The slot's *current* paint
 * defines its category; the client may switch to any Price Book paint sharing
 * that category. Primer slots are never included.
 */
import type { FullEstimateInput, PaintCatalog } from "@/lib/calculations";
import { CLIENT_SELECTABLE_CATEGORIES } from "@/lib/types";

export type PaintSlotKind =
  | "room" | "cabinet" | "deck" | "exterior" | "door" | "shutter" | "garage" | "custom";

export interface PaintSlotRef {
  kind: PaintSlotKind;
  id: number;       // component row id
  field: string;    // DB column / input field being changed
}

export interface PaintSlot {
  ref: PaintSlotRef;
  label: string;        // e.g. "Master Bedroom — Walls"
  currentPaintId: number;
  category: string;
}

// Which input fields are paint slots, per component kind, with a human suffix.
// Order matters for display.
const FIELD_MAP: Record<PaintSlotKind, { field: string; suffix: string }[]> = {
  room: [
    { field: "wallPaintId", suffix: "Walls" },
    { field: "ceilingPaintId", suffix: "Ceiling" },
    { field: "trimPaintId", suffix: "Trim" },
  ],
  cabinet: [{ field: "paintId", suffix: "Cabinets" }],
  deck: [
    { field: "floorStainId", suffix: "Deck Floor" },
    { field: "railStainId", suffix: "Deck Railing" },
  ],
  exterior: [{ field: "paintId", suffix: "Siding" }],
  door: [{ field: "paintId", suffix: "" }],
  shutter: [{ field: "paintId", suffix: "" }],
  garage: [{ field: "paintId", suffix: "" }],
  custom: [{ field: "paintId", suffix: "" }],
};

/** All valid (kind → fields) pairs — used by the server to validate a write target. */
export function isValidSlotField(kind: string, field: string): boolean {
  const fields = FIELD_MAP[kind as PaintSlotKind];
  return !!fields && fields.some((f) => f.field === field);
}

// Maps a paint slot (kind + paint field) to the matching sheen column on the model.
const SHEEN_FIELD: Record<string, string> = {
  "room:wallPaintId": "wallSheen",
  "room:ceilingPaintId": "ceilingSheen",
  "room:trimPaintId": "trimSheen",
  "cabinet:paintId": "sheen",
  "deck:floorStainId": "floorSheen",
  "deck:railStainId": "railSheen",
  "exterior:paintId": "sheen",
  "door:paintId": "sheen",
  "shutter:paintId": "sheen",
  "garage:paintId": "sheen",
  "custom:paintId": "sheen",
};

/** The DB sheen column for a given paint slot, or null if none. */
export function sheenFieldFor(kind: string, field: string): string | null {
  return SHEEN_FIELD[`${kind}:${field}`] ?? null;
}

/** Stable key for a slot, matching extractPaintSlots refs: "kind:id:field". */
export function slotKey(ref: PaintSlotRef): string {
  return `${ref.kind}:${ref.id}:${ref.field}`;
}

function collections(input: FullEstimateInput): { kind: PaintSlotKind; items: any[] }[] {
  return [
    { kind: "room", items: input.rooms ?? [] },
    { kind: "cabinet", items: input.cabinetSets ?? [] },
    { kind: "deck", items: input.deckAreas ?? [] },
    { kind: "exterior", items: input.exteriorHouses ?? [] },
    { kind: "door", items: input.exteriorDoors ?? [] },
    { kind: "shutter", items: input.exteriorShutters ?? [] },
    { kind: "garage", items: input.garageDoors ?? [] },
    { kind: "custom", items: input.customAreas ?? [] },
  ];
}

function itemName(kind: PaintSlotKind, item: any): string {
  return (kind === "custom" ? item.label : item.name) || "Item";
}

/** Build the list of client-selectable paint slots from a calc input + catalog. */
export function extractPaintSlots(input: FullEstimateInput, catalog: PaintCatalog): PaintSlot[] {
  const slots: PaintSlot[] = [];
  for (const { kind, items } of collections(input)) {
    for (const item of items) {
      if (item.id == null) continue;
      for (const { field, suffix } of FIELD_MAP[kind]) {
        const paintId = item[field];
        if (paintId == null) continue;
        const cat = catalog[paintId]?.category;
        if (!cat || !CLIENT_SELECTABLE_CATEGORIES.includes(cat)) continue;
        const base = itemName(kind, item);
        slots.push({
          ref: { kind, id: item.id, field },
          label: suffix ? `${base} — ${suffix}` : base,
          currentPaintId: paintId,
          category: cat,
        });
      }
    }
  }
  return slots;
}

/** Return a new calc input with one slot's paint changed (for client-side recompute). */
export function applyPaintSelection(
  input: FullEstimateInput,
  ref: PaintSlotRef,
  paintId: number
): FullEstimateInput {
  const key: Record<PaintSlotKind, keyof FullEstimateInput> = {
    room: "rooms", cabinet: "cabinetSets", deck: "deckAreas", exterior: "exteriorHouses",
    door: "exteriorDoors", shutter: "exteriorShutters", garage: "garageDoors", custom: "customAreas",
  };
  const listKey = key[ref.kind];
  const list = (input[listKey] as any[]) ?? [];
  const next = list.map((it) => (it.id === ref.id ? { ...it, [ref.field]: paintId } : it));
  return { ...input, [listKey]: next } as FullEstimateInput;
}

/** Retail price per gallon a client effectively pays (cost × markup). */
export function retailPerGallon(entry: { unitCost: number; markup: number }): number {
  return entry.unitCost * (1 + (entry.markup || 0) / 100);
}
