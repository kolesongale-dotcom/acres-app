import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";
import { WORKER_COOKIE_NAME } from "@/lib/workerAuth";
import { prisma } from "@/lib/prisma";

/**
 * Back-office login gate.
 *
 * Auth is OFF when APP_PASSWORD is empty (the local-dev default) and ON when it
 * is set (the cloud deployment). Public, client-facing routes are always allowed
 * without a login:
 *   - /proposals/<id>/sign  (clients open + e-sign their proposal)
 *   - /uploads/...          (photos + logo shown on the sign page)
 *   - /login                (the login form itself)
 *   - Next.js internals / static assets
 *
 * Separately, /worker/* is a distinct crew-facing area gated by its own
 * per-worker login (independent of APP_PASSWORD), checked against the
 * WorkerSession table since worker accounts can be individually deactivated.
 *
 * Proxy (formerly "middleware") always runs on the Node.js runtime, so it can
 * query Prisma/SQLite directly here.
 */

function isPublicPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  if (pathname.startsWith("/uploads/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico" || pathname === "/robots.txt") return true;
  // Public client signing page + color/sheen sheet (and their server-action POSTs).
  if (/^\/proposals\/\d+\/sign\/?$/.test(pathname)) return true;
  if (/^\/proposals\/\d+\/colors\/?$/.test(pathname)) return true;
  if (/^\/change-orders\/\d+\/sign\/?$/.test(pathname)) return true;
  return false;
}

async function handleWorkerArea(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  if (pathname === "/worker/login") return NextResponse.next();

  const token = req.cookies.get(WORKER_COOKIE_NAME)?.value;
  if (token) {
    const session = await prisma.workerSession.findUnique({
      where: { token },
      include: { worker: true },
    });
    if (session && session.expiresAt > new Date() && session.worker.active) {
      return NextResponse.next();
    }
  }

  const url = req.nextUrl.clone();
  url.pathname = "/worker/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Worker area has its own login system, independent of APP_PASSWORD.
  if (pathname === "/worker" || pathname.startsWith("/worker/")) {
    return handleWorkerArea(req);
  }

  const password = process.env.APP_PASSWORD;
  // Auth disabled (no password configured) — let everything through.
  if (!password) return NextResponse.next();

  if (isPublicPath(pathname)) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (token && token === process.env.AUTH_SECRET) return NextResponse.next();

  // Workers also upload job photos through this shared endpoint — let a valid
  // worker session through even when the owner login gate (APP_PASSWORD) is on.
  if (pathname === "/api/upload") {
    const workerToken = req.cookies.get(WORKER_COOKIE_NAME)?.value;
    if (workerToken) {
      const session = await prisma.workerSession.findUnique({
        where: { token: workerToken },
        include: { worker: true },
      });
      if (session && session.expiresAt > new Date() && session.worker.active) {
        return NextResponse.next();
      }
    }
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except static asset files; path-level rules above handle
  // the public exceptions.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
