import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getWorkerSession } from "@/lib/workerAuth";
import { customerName } from "@/lib/format";
import JobProgressClient from "./JobProgressClient";

export const dynamic = "force-dynamic";

export default async function CrewJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const estimateId = parseInt(id, 10);
  const session = await getWorkerSession();
  if (!session) return null; // layout already redirects

  const assignment = await prisma.workerAssignment.findUnique({
    where: { workerId_estimateId: { workerId: session.id, estimateId } },
  });
  if (!assignment) notFound();

  const job = await prisma.estimate.findUnique({
    where: { id: estimateId },
    include: { customer: true, photos: { orderBy: { sortOrder: "asc" } } },
  });
  if (!job) notFound();

  return (
    <div>
      <Link href="/worker" style={{ color: "var(--text-dim)", fontSize: 13, textDecoration: "none" }}>
        ← My Jobs
      </Link>
      <h1 className="font-display" style={{ fontSize: 22, margin: "8px 0 2px", color: "var(--text-primary)" }}>
        {job.projectName || customerName(job.customer)}
      </h1>
      <div style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 8 }}>
        {[job.street, job.city, job.state, job.zip].filter(Boolean).join(", ")}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>Customer</div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>{customerName(job.customer)}</div>
        {job.customer?.phone && (
          <div style={{ fontSize: 14, marginTop: 4 }}>
            <a href={`tel:${job.customer.phone}`} style={{ color: "var(--accent)" }}>{job.customer.phone}</a>
          </div>
        )}
        {job.customer?.email && (
          <div style={{ fontSize: 14, marginTop: 2 }}>
            <a href={`mailto:${job.customer.email}`} style={{ color: "var(--accent)" }}>{job.customer.email}</a>
          </div>
        )}
      </div>

      <JobProgressClient
        estimateId={job.id}
        initialNotes={job.workerNotes}
        completed={!!job.completedAt}
        photos={job.photos.map((p) => ({ id: p.id, url: p.url, caption: p.caption }))}
      />
    </div>
  );
}
