import { redirect } from "next/navigation";
import { getWorkerSession } from "@/lib/workerAuth";
import { workerLogout } from "@/lib/actions/workers";

export default async function CrewLayout({ children }: { children: React.ReactNode }) {
  const session = await getWorkerSession();
  if (!session) redirect("/worker/login");

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div>
          <div className="font-display" style={{ fontSize: 20, color: "var(--text-primary)" }}>ACRES</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Hi, {session.name}</div>
        </div>
        <form action={workerLogout}>
          <button className="btn" type="submit">Sign Out</button>
        </form>
      </header>
      <main style={{ padding: "20px", maxWidth: 720, margin: "0 auto" }} className="animate-fade-in">
        {children}
      </main>
    </div>
  );
}
