"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ActionResult } from "@/lib/types";
import {
  WORKER_COOKIE_NAME,
  createWorkerSession,
  destroyWorkerSession,
  getWorkerSession,
} from "@/lib/workerAuth";

const ONE_MONTH = 60 * 60 * 24 * 30;

/** Worker login. Returns an error string on failure (for the login form); redirects on success. */
export async function workerLogin(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const username = String(formData.get("username") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  const worker = await prisma.worker.findUnique({ where: { username } });
  if (!worker || !worker.active) return "Incorrect username or password.";

  const ok = await bcrypt.compare(password, worker.passwordHash);
  if (!ok) return "Incorrect username or password.";

  const token = await createWorkerSession(worker.id);
  const jar = await cookies();
  jar.set(WORKER_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_MONTH,
  });

  redirect("/worker");
}

export async function workerLogout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(WORKER_COOKIE_NAME)?.value;
  if (token) await destroyWorkerSession(token);
  jar.delete(WORKER_COOKIE_NAME);
  redirect("/worker/login");
}

/** Owner-side: update this job's job-site notes, or mark it complete/incomplete. */
async function requireAssignedWorker(estimateId: number) {
  const session = await getWorkerSession();
  if (!session) throw new Error("Not logged in.");
  const assignment = await prisma.workerAssignment.findUnique({
    where: { workerId_estimateId: { workerId: session.id, estimateId } },
  });
  if (!assignment) throw new Error("Not assigned to this job.");
  return session;
}

/** Worker-facing: update job-site notes (not the owner's internal notes) and/or mark complete. */
export async function updateJobProgress(
  estimateId: number,
  input: { workerNotes?: string; completed?: boolean }
): Promise<ActionResult> {
  try {
    await requireAssignedWorker(estimateId);
    const data: { workerNotes?: string; completedAt?: Date | null } = {};
    if (input.workerNotes !== undefined) data.workerNotes = input.workerNotes;
    if (input.completed !== undefined) data.completedAt = input.completed ? new Date() : null;
    await prisma.estimate.update({ where: { id: estimateId }, data });
    revalidatePath(`/worker/jobs/${estimateId}`);
    revalidatePath("/worker");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: e instanceof Error ? e.message : "Failed to update job." };
  }
}

export async function addWorkerJobPhoto(
  estimateId: number,
  input: { url: string; caption?: string }
): Promise<ActionResult> {
  try {
    await requireAssignedWorker(estimateId);
    const count = await prisma.estimatePhoto.count({ where: { estimateId } });
    await prisma.estimatePhoto.create({
      data: { estimateId, url: input.url, caption: input.caption ?? "", sortOrder: count },
    });
    revalidatePath(`/worker/jobs/${estimateId}`);
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: e instanceof Error ? e.message : "Failed to add photo." };
  }
}

export async function deleteWorkerJobPhoto(estimateId: number, photoId: number): Promise<ActionResult> {
  try {
    await requireAssignedWorker(estimateId);
    await prisma.estimatePhoto.delete({ where: { id: photoId } });
    revalidatePath(`/worker/jobs/${estimateId}`);
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: e instanceof Error ? e.message : "Failed to delete photo." };
  }
}

// ---- Owner-side management (Settings → Workers) ----

export async function createWorker(input: {
  name: string;
  username: string;
  password: string;
}): Promise<ActionResult> {
  try {
    const username = input.username.trim().toLowerCase();
    if (!input.name.trim() || !username || input.password.length < 6) {
      return { success: false, error: "Name, username, and a password of at least 6 characters are required." };
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
    await prisma.worker.create({ data: { name: input.name.trim(), username, passwordHash } });
    revalidatePath("/settings");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to create worker (username may already be taken)." };
  }
}

export async function updateWorker(
  id: number,
  input: { name?: string; username?: string; active?: boolean }
): Promise<ActionResult> {
  try {
    const data: { name?: string; username?: string; active?: boolean } = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.username !== undefined) data.username = input.username.trim().toLowerCase();
    if (input.active !== undefined) data.active = input.active;
    await prisma.worker.update({ where: { id }, data });
    revalidatePath("/settings");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to update worker." };
  }
}

export async function resetWorkerPassword(id: number, password: string): Promise<ActionResult> {
  try {
    if (password.length < 6) return { success: false, error: "Password must be at least 6 characters." };
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.worker.update({ where: { id }, data: { passwordHash } });
    // Log the worker out everywhere on a password reset.
    await prisma.workerSession.deleteMany({ where: { workerId: id } });
    revalidatePath("/settings");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to reset password." };
  }
}

export async function deleteWorker(id: number): Promise<ActionResult> {
  try {
    await prisma.worker.delete({ where: { id } });
    revalidatePath("/settings");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to delete worker." };
  }
}

/** Replaces the full set of job assignments for a worker. */
export async function setWorkerAssignments(workerId: number, estimateIds: number[]): Promise<ActionResult> {
  try {
    await prisma.$transaction([
      prisma.workerAssignment.deleteMany({ where: { workerId } }),
      prisma.workerAssignment.createMany({
        data: estimateIds.map((estimateId) => ({ workerId, estimateId })),
      }),
    ]);
    revalidatePath("/settings");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to update assignments." };
  }
}
