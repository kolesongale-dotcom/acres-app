"use client";

import { useActionState } from "react";
import { login } from "@/lib/actions/auth";

export default function LoginForm({ next }: { next: string }) {
  const [error, formAction, pending] = useActionState(login, null);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input type="hidden" name="next" value={next} />
      <label className="label" htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        className="input"
        autoFocus
        autoComplete="current-password"
        placeholder="Enter your password"
      />
      {error && (
        <div style={{ color: "var(--danger, #ef4444)", fontSize: 13 }}>{error}</div>
      )}
      <button className="btn btn-primary" type="submit" disabled={pending} style={{ marginTop: 4 }}>
        {pending ? "Signing in…" : "Sign In"}
      </button>
    </form>
  );
}
