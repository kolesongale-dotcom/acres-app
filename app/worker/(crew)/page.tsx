import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getWorkerSession } from "@/lib/workerAuth";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { customerName } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CrewJobListPage() {
  const session = await getWorkerSession();
  if (!session) return null; // layout already redirects

  const assignments = await prisma.workerAssignment.findMany({
    where: { workerId: session.id },
    include: { estimate: { include: { customer: true } } },
    orderBy: { estimate: { updatedAt: "desc" } },
  });

  const jobs = assignments.map((a) => a.estimate);

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 24, marginBottom: 4, color: "var(--text-primary)" }}>
        My Jobs
      </h1>
      <p style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 20 }}>
        Jobs assigned to you. Tap a job to see the address, update notes, mark it complete, or add photos.
      </p>

      {jobs.length === 0 && (
        <EmptyState title="No jobs assigned yet" description="Check back once your next job is scheduled." />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {jobs.map((job) => (
          <Link key={job.id} href={`/worker/jobs/${job.id}`} className="card" style={{ display: "block", textDecoration: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  {job.projectName || customerName(job.customer)}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 2 }}>
                  {[job.street, job.city, job.state].filter(Boolean).join(", ")}
                </div>
              </div>
              {job.completedAt ? (
                <span className="badge" style={{ background: "#166534", color: "#22c55e" }}>Complete</span>
              ) : (
                <StatusBadge status={job.status} />
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
