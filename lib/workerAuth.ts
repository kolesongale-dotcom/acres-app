import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/** Worker login session — separate cookie/table from the owner's shared APP_PASSWORD. */
export const WORKER_COOKIE_NAME = "acres_worker_session";
const SESSION_DAYS = 30;

export function newSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createWorkerSession(workerId: number): Promise<string> {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.workerSession.create({ data: { token, workerId, expiresAt } });
  return token;
}

export async function destroyWorkerSession(token: string): Promise<void> {
  await prisma.workerSession.deleteMany({ where: { token } });
}

export interface WorkerSessionInfo {
  id: number;
  name: string;
  username: string;
}

/** Reads the worker cookie and returns the active worker, or null if not logged in / expired / deactivated. */
export async function getWorkerSession(): Promise<WorkerSessionInfo | null> {
  const jar = await cookies();
  const token = jar.get(WORKER_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.workerSession.findUnique({
    where: { token },
    include: { worker: true },
  });
  if (!session || session.expiresAt < new Date() || !session.worker.active) return null;

  return { id: session.worker.id, name: session.worker.name, username: session.worker.username };
}
