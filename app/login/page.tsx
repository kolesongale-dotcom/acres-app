import { redirect } from "next/navigation";
import { authEnabled } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // No password configured → nothing to log into.
  if (!authEnabled()) redirect("/");

  const { next } = await searchParams;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--bg-primary)",
      }}
    >
      <div className="card" style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div className="font-display" style={{ fontSize: 30, color: "var(--text-primary)", letterSpacing: "0.04em" }}>
            ACRES
          </div>
          <div style={{ color: "var(--accent)", fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", marginTop: 2 }}>
            Painting Co.
          </div>
        </div>
        <LoginForm next={next ?? "/"} />
      </div>
    </div>
  );
}
