import { prisma } from "@/lib/prisma";
import { JobRates, DEFAULT_JOB_RATES } from "@/lib/calculations";
import { PaintDefaults } from "@/lib/types";

const RATE_KEYS: (keyof JobRates)[] = [
  "wallRate", "ceilingRate", "trimRate",
  "cabinetDoorRate", "cabinetDrawerRate", "cabinetFrameRate",
  "deckFloorRate", "deckRailingRate", "deckStepRate", "deckLatticeRate",
  "sidingRate", "powerWashRate", "doorRate",
  "shutterStory1Rate", "shutterStory2Rate", "shutterStory3Rate", "shutterSqFtEach",
  "garageRate", "primerRate", "laborMarkup",
];

export function rowToJobRates(row: any): JobRates {
  if (!row) return { ...DEFAULT_JOB_RATES };
  const out = { ...DEFAULT_JOB_RATES };
  for (const k of RATE_KEYS) if (typeof row[k] === "number") out[k] = row[k];
  return out;
}

export function rowToPaintDefaults(row: any): PaintDefaults {
  return {
    defaultWallPaintId: row?.defaultWallPaintId ?? null,
    defaultCeilingPaintId: row?.defaultCeilingPaintId ?? null,
    defaultTrimPaintId: row?.defaultTrimPaintId ?? null,
    defaultDeckFloorStainId: row?.defaultDeckFloorStainId ?? null,
    defaultDeckRailStainId: row?.defaultDeckRailStainId ?? null,
    defaultSidingPaintId: row?.defaultSidingPaintId ?? null,
    defaultDoorPaintId: row?.defaultDoorPaintId ?? null,
    defaultShutterPaintId: row?.defaultShutterPaintId ?? null,
    defaultGaragePaintId: row?.defaultGaragePaintId ?? null,
  };
}

export function parseRatesSnapshot(snapshot: string | null | undefined): JobRates {
  if (!snapshot) return { ...DEFAULT_JOB_RATES };
  try {
    const obj = JSON.parse(snapshot);
    return { ...DEFAULT_JOB_RATES, ...obj };
  } catch {
    return { ...DEFAULT_JOB_RATES };
  }
}

export async function getJobRateSettings() {
  return prisma.jobRateSettings.findUnique({ where: { id: 1 } });
}

/** Current master rates + paint defaults from Settings. */
export async function getCurrentRatesAndDefaults(): Promise<{ rates: JobRates; defaults: PaintDefaults }> {
  const row = await getJobRateSettings();
  return { rates: rowToJobRates(row), defaults: rowToPaintDefaults(row) };
}
