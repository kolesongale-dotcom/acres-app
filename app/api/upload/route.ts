import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { UPLOAD_DIR, UPLOAD_FOLDERS, safeExt } from "@/lib/uploads";

export const runtime = "nodejs";

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB safety cap (images are downscaled client-side)

// Folders that accept arbitrary file attachments (not just images). Everything
// else stays image-only (logos, photos, resource charts).
const FILE_FOLDERS = new Set(["special"]);

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    const folderRaw = String(form.get("folder") || "estimates");
    const folder = UPLOAD_FOLDERS.has(folderRaw) ? folderRaw : "estimates";
    const isImage = file.type.startsWith("image/");
    if (!isImage && !FILE_FOLDERS.has(folder)) {
      return NextResponse.json({ error: "Only image files are allowed." }, { status: 415 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length > MAX_BYTES) {
      return NextResponse.json({ error: "File is too large (12 MB max)." }, { status: 413 });
    }

    const dir = path.join(UPLOAD_DIR, folder);
    await mkdir(dir, { recursive: true });

    const ext = isImage
      ? (file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg")
      : safeExt(file.name);
    const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
    await writeFile(path.join(dir, name), bytes);

    return NextResponse.json({ url: `/uploads/${folder}/${name}`, fileType: isImage ? "image" : "file", fileName: file.name });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
