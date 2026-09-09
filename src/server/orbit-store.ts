import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export type OrbitTool = "WEATHER" | "SEARCH" | "CALCULATOR" | "TIMER" | "NOTES";

export type OrbitNote = {
  id: string;
  content: string;
  createdAt: string;
};

export type OrbitTimer = {
  id: string;
  durationSeconds: number;
  endsAt: string;
  status: "active" | "completed" | "cancelled";
  createdAt: string;
};

export type OrbitRun = {
  id: string;
  requestId: string;
  sessionId: string;
  tool: OrbitTool;
  query: string;
  answer?: string;
  error?: string;
  meta?: string;
  elapsedMs: number;
  status: "success" | "failed" | "cancelled" | "stale";
  createdAt: string;
};

type OrbitSession = {
  activeRequestId: string | null;
  activeTool?: OrbitTool;
  activeQuery?: string;
  updatedAt: string;
};

export type OrbitStats = {
  requests: number;
  successful: number;
  failed: number;
  cancelled: number;
  stale: number;
};

type OrbitDatabase = {
  version: 1;
  notes: OrbitNote[];
  timers: OrbitTimer[];
  runs: OrbitRun[];
  sessions: Record<string, OrbitSession>;
  stats: OrbitStats;
};

export type OrbitPublicState = {
  notes: OrbitNote[];
  timers: OrbitTimer[];
  runs: OrbitRun[];
  activeRequestId: string | null;
  stats: OrbitStats;
};

type CommitInput = {
  sessionId: string;
  requestId: string;
  tool: OrbitTool;
  query: string;
  answer: string;
  meta?: string;
  elapsedMs: number;
  noteContent?: string;
  timerSeconds?: number;
};

const databaseFile = process.env.ORBIT_DATA_FILE
  ? path.resolve(process.env.ORBIT_DATA_FILE)
  : path.join(process.cwd(), "data", "orbit.json");

const emptyDatabase = (): OrbitDatabase => ({
  version: 1,
  notes: [],
  timers: [],
  runs: [],
  sessions: {},
  stats: { requests: 0, successful: 0, failed: 0, cancelled: 0, stale: 0 },
});

let mutationQueue: Promise<unknown> = Promise.resolve();

function isDatabase(value: unknown): value is OrbitDatabase {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<OrbitDatabase>;
  return candidate.version === 1 && Array.isArray(candidate.notes) && Array.isArray(candidate.timers) && Array.isArray(candidate.runs) && Boolean(candidate.sessions) && Boolean(candidate.stats);
}

async function readDatabase() {
  try {
    const value = JSON.parse(await readFile(databaseFile, "utf8")) as unknown;
    if (!isDatabase(value)) throw new Error("The ORBIT data store has an invalid shape.");
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyDatabase();
    throw error;
  }
}

async function writeDatabase(database: OrbitDatabase) {
  await mkdir(path.dirname(databaseFile), { recursive: true });
  const temporaryFile = `${databaseFile}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(database, null, 2)}\n`, "utf8");
  await rename(temporaryFile, databaseFile);
}

function withMutation<T>(operation: (database: OrbitDatabase) => Promise<T> | T): Promise<T> {
  const result = mutationQueue.then(async () => {
    const database = await readDatabase();
    const value = await operation(database);
    await writeDatabase(database);
    return value;
  });
  mutationQueue = result.catch(() => undefined);
  return result;
}

function normalizeTimers(database: OrbitDatabase) {
  const now = Date.now();
  for (const timer of database.timers) {
    if (timer.status === "active" && Date.parse(timer.endsAt) <= now) timer.status = "completed";
  }
}

function publicState(database: OrbitDatabase, sessionId = ""): OrbitPublicState {
  normalizeTimers(database);
  return {
    notes: database.notes.slice(0, 20),
    timers: database.timers.slice(0, 20),
    runs: database.runs.slice(0, 30),
    activeRequestId: database.sessions[sessionId]?.activeRequestId || null,
    stats: { ...database.stats },
  };
}

function addRun(database: OrbitDatabase, run: Omit<OrbitRun, "id" | "createdAt">) {
  database.runs.unshift({ ...run, id: randomUUID(), createdAt: new Date().toISOString() });
  database.runs = database.runs.slice(0, 100);
}

export async function getOrbitState(sessionId = "") {
  return withMutation((database) => publicState(database, sessionId));
}

export async function beginOrbitRequest(sessionId: string, requestId: string, tool: OrbitTool, query: string) {
  return withMutation((database) => {
    database.sessions[sessionId] = { activeRequestId: requestId, activeTool: tool, activeQuery: query, updatedAt: new Date().toISOString() };
    database.stats.requests += 1;
  });
}

export async function commitOrbitRequest(input: CommitInput) {
  return withMutation((database) => {
    const session = database.sessions[input.sessionId];
    if (!session || session.activeRequestId !== input.requestId) {
      database.stats.stale += 1;
      addRun(database, { ...input, status: "stale" });
      return { committed: false as const, state: publicState(database, input.sessionId) };
    }

    let note: OrbitNote | undefined;
    let timer: OrbitTimer | undefined;
    if (input.noteContent) {
      note = { id: randomUUID(), content: input.noteContent, createdAt: new Date().toISOString() };
      database.notes.unshift(note);
      database.notes = database.notes.slice(0, 100);
    }
    if (input.timerSeconds) {
      timer = {
        id: randomUUID(),
        durationSeconds: input.timerSeconds,
        endsAt: new Date(Date.now() + input.timerSeconds * 1000).toISOString(),
        status: "active",
        createdAt: new Date().toISOString(),
      };
      for (const existing of database.timers) if (existing.status === "active") existing.status = "cancelled";
      database.timers.unshift(timer);
      database.timers = database.timers.slice(0, 50);
    }

    session.activeRequestId = null;
    session.updatedAt = new Date().toISOString();
    database.stats.successful += 1;
    addRun(database, { ...input, status: "success" });
    return { committed: true as const, note, timer, state: publicState(database, input.sessionId) };
  });
}

export async function failOrbitRequest(input: { sessionId: string; requestId: string; tool: OrbitTool; query: string; error: string; elapsedMs: number }) {
  return withMutation((database) => {
    const session = database.sessions[input.sessionId];
    if (session?.activeRequestId === input.requestId) {
      session.activeRequestId = null;
      session.updatedAt = new Date().toISOString();
      database.stats.failed += 1;
      addRun(database, { ...input, status: "failed" });
    }
    return publicState(database, input.sessionId);
  });
}

export async function cancelOrbitRequest(sessionId: string, requestId: string) {
  return withMutation((database) => {
    const session = database.sessions[sessionId];
    if (session?.activeRequestId === requestId) {
      session.activeRequestId = null;
      session.updatedAt = new Date().toISOString();
      database.stats.cancelled += 1;
      addRun(database, {
        requestId,
        sessionId,
        tool: session.activeTool || "SEARCH",
        query: session.activeQuery || "Interrupted request",
        elapsedMs: 0,
        status: "cancelled",
      });
    }
    return publicState(database, sessionId);
  });
}

export async function deleteOrbitResource(sessionId: string, resource: "note" | "timer" | "history", id?: string) {
  return withMutation((database) => {
    if (resource === "note" && id) database.notes = database.notes.filter((note) => note.id !== id);
    if (resource === "timer" && id) database.timers = database.timers.filter((timer) => timer.id !== id);
    if (resource === "history") database.runs = [];
    return publicState(database, sessionId);
  });
}

export async function completeOrbitTimer(sessionId: string, id: string) {
  return withMutation((database) => {
    const timer = database.timers.find((item) => item.id === id);
    if (timer?.status === "active") timer.status = "completed";
    return publicState(database, sessionId);
  });
}

export function getOrbitDatabaseFile() {
  return databaseFile;
}
