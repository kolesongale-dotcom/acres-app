import { NextRequest, NextResponse } from "next/server";
import { importAllData, isValidBackup } from "@/lib/backup";

// Restore a full-database JSON backup (upsert by id, preserves original ids).
// Gated by the back-office login (middleware).
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let data: unknown;
  try {
    const ctype = req.headers.get("content-type") || "";
    if (ctype.includes("application/json")) {
      data = await req.json();
    } else {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No backup file was provided." }, { status: 400 });
      }
      data = JSON.parse(await file.text());
    }
  } catch {
    return NextResponse.json({ error: "Could not read the file — is it a valid JSON backup?" }, { status: 400 });
  }

  if (!isValidBackup(data)) {
    return NextResponse.json(
      { error: "This doesn't look like an Acres backup file (missing schemaVersion or table data)." },
      { status: 400 }
    );
  }

  try {
    const result = await importAllData(data);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: `Import failed and was rolled back: ${message}` }, { status: 500 });
  }
}
