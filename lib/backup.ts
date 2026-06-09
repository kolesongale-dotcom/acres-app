/**
 * Full-database backup & restore (Settings → Data Backup).
 *
 * `exportAllData()` dumps every table to a single plain object (→ JSON file).
 * `importAllData()` restores it with **upsert** (preserving original ids) inside
 * one transaction, in an order that respects foreign keys.
 *
 * Date columns are stored as ISO strings in the JSON and revived to `Date`s on
 * import. `@updatedAt` columns may be re-stamped by Prisma on restore (Prisma
 * manages them) — ids and all other data are preserved exactly.
 */
import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";

/** Bump when the table set / shape changes. Used to flag version mismatches. */
export const SCHEMA_VERSION = "2026-06-08";

interface TableSpec {
  /** JSON key in the backup file. */
  key: string;
  /** Prisma model delegate name (camelCase). */
  model: string;
  /** DateTime columns to revive from ISO string → Date on import. */
  dateFields: string[];
}

/**
 * Tables in **dependency order** — parents before children. Import walks this
 * list top-to-bottom so foreign keys always resolve; export uses the same list
 * so the file is self-documenting.
 */
const TABLES: TableSpec[] = [
  // Singletons & independent reference data (no FKs).
  { key: "companyProfile", model: "companyProfile", dateFields: [] },
  { key: "businessSettings", model: "businessSettings", dateFields: [] },
  { key: "jobRateSettings", model: "jobRateSettings", dateFields: ["updatedAt"] },
  { key: "zohoConfig", model: "zohoConfig", dateFields: ["updatedAt"] },
  { key: "procedureTemplates", model: "procedureTemplate", dateFields: [] },
  { key: "priceBookItems", model: "priceBookItem", dateFields: ["createdAt", "updatedAt"] },
  // Customers → Estimates → estimate children.
  { key: "customers", model: "customer", dateFields: ["createdAt", "updatedAt"] },
  { key: "estimates", model: "estimate", dateFields: ["startDate", "endDate", "completedAt", "createdAt", "updatedAt"] },
  { key: "rooms", model: "room", dateFields: [] },
  { key: "roomDeductions", model: "roomDeduction", dateFields: [] },
  { key: "accentWalls", model: "accentWall", dateFields: [] },
  { key: "cabinetSets", model: "cabinetSet", dateFields: [] },
  { key: "deckAreas", model: "deckArea", dateFields: [] },
  { key: "exteriorHouses", model: "exteriorHouse", dateFields: [] },
  { key: "exteriorDeductions", model: "exteriorDeduction", dateFields: [] },
  { key: "exteriorReplacements", model: "exteriorReplacement", dateFields: [] },
  { key: "exteriorDoors", model: "exteriorDoor", dateFields: [] },
  { key: "exteriorShutters", model: "exteriorShutter", dateFields: [] },
  { key: "garageDoors", model: "exteriorGarageDoor", dateFields: [] },
  { key: "overheadItems", model: "overheadItem", dateFields: [] },
  { key: "customAreas", model: "customArea", dateFields: [] },
  { key: "specialProjects", model: "specialProject", dateFields: [] },
  { key: "specialProjectFiles", model: "specialProjectFile", dateFields: ["createdAt"] },
  { key: "estimateLineItems", model: "estimateLineItem", dateFields: [] },
  { key: "estimatePhotos", model: "estimatePhoto", dateFields: ["createdAt"] },
  // References customers + estimates (estimateId is nullable / SetNull).
  { key: "followUpReminders", model: "followUpReminder", dateFields: ["dueDate", "createdAt"] },
  // Documents tied to an estimate.
  { key: "proposals", model: "proposal", dateFields: ["signedAt", "sentAt", "viewedAt", "createdAt", "updatedAt"] },
  { key: "budgetEntries", model: "budgetEntry", dateFields: ["createdAt", "updatedAt"] },
  { key: "invoices", model: "invoice", dateFields: ["dueDate", "createdAt", "updatedAt"] },
  { key: "payments", model: "payment", dateFields: ["paidAt"] },
  { key: "changeOrders", model: "changeOrder", dateFields: ["signedAt", "createdAt", "updatedAt"] },
  { key: "colorSelections", model: "colorSelection", dateFields: ["updatedAt"] },
];

/** All table keys (for the UI summary order + shape validation). */
export const BACKUP_TABLE_KEYS = TABLES.map((t) => t.key);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDelegate = { findMany: (args?: any) => Promise<any[]>; upsert: (args: any) => Promise<any> };
const delegate = (client: PrismaClient | Prisma.TransactionClient, model: string): AnyDelegate =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any)[model];

export interface BackupDump {
  schemaVersion: string;
  exportedAt: string;
  [table: string]: unknown;
}

/** Dump every table (ordered by id) into a single serializable object. */
export async function exportAllData(): Promise<BackupDump> {
  const dump: BackupDump = { schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString() };
  for (const t of TABLES) {
    dump[t.key] = await delegate(prisma, t.model).findMany({ orderBy: { id: "asc" } });
  }
  return dump;
}

/** Quick structural check that an uploaded object is one of our backups. */
export function isValidBackup(data: unknown): data is Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.schemaVersion !== "string") return false;
  // Every present table key must be an array, and at least one must exist.
  let sawTable = false;
  for (const key of BACKUP_TABLE_KEYS) {
    if (key in obj) {
      if (!Array.isArray(obj[key])) return false;
      sawTable = true;
    }
  }
  return sawTable;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reviveDates(row: any, dateFields: string[]): any {
  const out = { ...row };
  for (const f of dateFields) {
    if (out[f] != null) out[f] = new Date(out[f]);
  }
  return out;
}

export interface ImportResult {
  counts: Record<string, number>;
  total: number;
  schemaVersion: string | null;
  schemaMatch: boolean;
}

/**
 * Restore a backup. Upserts every row by id inside one transaction so a partial
 * re-import never duplicates and either fully applies or rolls back.
 */
export async function importAllData(data: Record<string, unknown>): Promise<ImportResult> {
  const counts: Record<string, number> = {};

  await prisma.$transaction(
    async (tx) => {
      for (const t of TABLES) {
        const rows = Array.isArray(data[t.key]) ? (data[t.key] as unknown[]) : [];
        let n = 0;
        for (const raw of rows) {
          if (!raw || typeof raw !== "object") continue;
          const rec = reviveDates(raw, t.dateFields);
          if (typeof rec.id !== "number") continue;
          const { id, ...rest } = rec;
          await delegate(tx, t.model).upsert({ where: { id }, create: rec, update: rest });
          n++;
        }
        counts[t.key] = n;
      }
    },
    { timeout: 120_000, maxWait: 15_000 }
  );

  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const schemaVersion = typeof data.schemaVersion === "string" ? data.schemaVersion : null;
  return { counts, total, schemaVersion, schemaMatch: schemaVersion === SCHEMA_VERSION };
}
