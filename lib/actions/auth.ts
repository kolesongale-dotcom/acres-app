"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME } from "@/lib/auth";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Validate the back-office password and set the session cookie. Returns an error
 * string on failure (so the login form can show it); redirects on success.
 */
export async function login(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const password = process.env.APP_PASSWORD;
  // If auth is disabled, just go home.
  if (!password) redirect("/");

  const entered = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/dashboard");

  if (entered !== password) {
    return "Incorrect password.";
  }

  const secret = process.env.AUTH_SECRET || "";
  const jar = await cookies();
  jar.set(COOKIE_NAME, secret, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });

  // Only allow same-site relative redirects.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

/** Clear the session cookie and return to the login screen. */
export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
  redirect("/login");
}
