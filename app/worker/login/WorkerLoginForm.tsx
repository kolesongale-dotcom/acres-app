"use client";

import { useActionState } from "react";
import { workerLogin } from "@/lib/actions/workers";

export default function WorkerLoginForm() {
  const [error, formAction, pending] = useActionState(workerLogin, null);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <label className="label" htmlFor="username">Username</label>
      <input
        id="username"
        name="username"
        type="text"
        className="input"
        autoFocus
        autoComplete="username"
        placeholder="Enter your username"
      />
      <label className="label" htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        className="input"
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
