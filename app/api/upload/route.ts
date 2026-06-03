import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { UPLOAD_DIR, UPLOAD_FOLDERS } from "@/lib/uploads";

export const runtime = "nodejs";

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB safety cap (images are downscaled client-side)

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed." }, { status: 415 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length > MAX_BYTES) {
      return NextResponse.json({ error: "Image is too large." }, { status: 413 });
    }

    const folderRaw = String(form.get("folder") || "estimates");
    const folder = UPLOAD_FOLDERS.has(folderRaw) ? folderRaw : "estimates";
    const dir = path.join(UPLOAD_DIR, folder);
    await mkdir(dir, { recursive: true });

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
    await writeFile(path.join(dir, name), bytes);

    return NextResponse.json({ url: `/uploads/${folder}/${name}` });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
