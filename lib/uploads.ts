import path from "path";

/**
 * Root directory where uploaded photos/logos are stored.
 * - Local dev: <project>/uploads (gitignored).
 * - Cloud (Railway): set UPLOAD_DIR=/data/uploads so files live on the persistent
 *   volume and survive redeploys.
 *
 * Files are served back to the browser by app/uploads/[...path]/route.ts, so they
 * do NOT live under /public — that keeps local and cloud behavior identical.
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), "uploads");

/** Allowed upload sub-folders (prevents writing outside the upload root). */
export const UPLOAD_FOLDERS = new Set(["estimates", "branding", "resources"]);

/**
 * Map a stored URL like "/uploads/branding/abc.png" to an absolute filesystem
 * path inside UPLOAD_DIR. Returns null if the path is malformed or attempts to
 * escape the upload root (path traversal).
 */
export function resolveUploadPath(url: string): string | null {
  if (!url) return null;
  // strip a leading slash and an optional leading "uploads/" segment
  const rel = url.replace(/^\/+/, "").replace(/^uploads\//, "");
  if (!rel || rel.includes("\0")) return null;
  const abs = path.normalize(path.join(UPLOAD_DIR, rel));
  // ensure the resolved path stays within UPLOAD_DIR
  const root = UPLOAD_DIR.endsWith(path.sep) ? UPLOAD_DIR : UPLOAD_DIR + path.sep;
  if (abs !== UPLOAD_DIR && !abs.startsWith(root)) return null;
  return abs;
}

/** Best-effort content type from a file extension (for the serving route). */
export function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".jpg":
    case ".jpeg":
    default:
      return "image/jpeg";
  }
}
