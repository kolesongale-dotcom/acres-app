import { NextResponse } from "next/server";
import { exportAllData } from "@/lib/backup";

// Full-database JSON backup. Gated by the back-office login (middleware) like the
// rest of the app — not public.
export const dynamic = "force-dynamic";

export async function GET() {
  const dump = await exportAllData();
  const json = JSON.stringify(dump, null, 2);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `acres-backup-${stamp}.json`;

  return new NextResponse(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
