import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { resolveUploadPath, contentTypeFor } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serves uploaded photos/logos from UPLOAD_DIR (local ./uploads or the cloud
 * volume). Replaces serving them as static files out of /public, so the same
 * code path works in both environments.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const abs = resolveUploadPath((segments || []).join("/"));
  if (!abs) return new NextResponse("Not found", { status: 404 });

  try {
    const bytes = await readFile(abs);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(abs),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
