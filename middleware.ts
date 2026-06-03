import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";

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
 */

function isPublicPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  if (pathname.startsWith("/uploads/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico" || pathname === "/robots.txt") return true;
  // Public client signing page (and its server-action POSTs on the same path).
  if (/^\/proposals\/\d+\/sign\/?$/.test(pathname)) return true;
  return false;
}

export function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  // Auth disabled (no password configured) — let everything through.
  if (!password) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (token && token === process.env.AUTH_SECRET) return NextResponse.next();

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
