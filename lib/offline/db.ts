"use client";

// =====================================================================
// Offline-First storage layer (IndexedDB via the `idb` package).
// npm install idb
//
// Stores tasks locally so the app is fully usable offline, plus a
// mutation outbox queue that the sync engine (syncEngine.ts) flushes
// to Supabase once connectivity returns.
// =====================================================================
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Task } from "../types";

const DB_NAME = "life-optimizer-offline";
const DB_VERSION = 1;

export type OutboxOperation = "insert" | "update" | "delete";

export interface OutboxEntry {
  id: string; // uuid, generated client-side
  table: "tasks" | "habit_logs" | "focus_sessions" | "energy_logs";
  operation: OutboxOperation;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
}

interface AppDBSchema extends DBSchema {
  tasks: {
    key: string;
    value: Task;
    indexes: { "by-status": string; "by-scheduled-start": string };
  };
  outbox: {
    key: string;
    value: OutboxEntry;
    indexes: { "by-created": string };
  };
}

let dbPromise: Promise<IDBPDatabase<AppDBSchema>> | null = null;

export function getDb(): Promise<IDBPDatabase<AppDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<AppDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const taskStore = db.createObjectStore("tasks", { keyPath: "id" });
        taskStore.createIndex("by-status", "status");
        taskStore.createIndex("by-scheduled-start", "scheduledStart");

        const outboxStore = db.createObjectStore("outbox", { keyPath: "id" });
        outboxStore.createIndex("by-created", "createdAt");
      },
    });
  }
  return dbPromise;
}

// ---- Task cache reads/writes -----------------------------------------

export async function cacheTasks(tasks: Task[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("tasks", "readwrite");
  await Promise.all(tasks.map((t) => tx.store.put(t)));
  await tx.done;
}

export async function getCachedTasks(): Promise<Task[]> {
  const db = await getDb();
  return db.getAll("tasks");
}

export async function upsertCachedTask(task: Task): Promise<void> {
  const db = await getDb();
  await db.put("tasks", task);
}

export async function deleteCachedTask(taskId: string): Promise<void> {
  const db = await getDb();
  await db.delete("tasks", taskId);
}

// ---- Outbox (pending mutations made while offline) --------------------

export async function enqueueOutboxEntry(
  entry: Omit<OutboxEntry, "id" | "createdAt" | "attempts">
): Promise<void> {
  const db = await getDb();
  await db.put("outbox", {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
}

export async function getOutboxEntries(): Promise<OutboxEntry[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("outbox", "by-created");
  return all;
}

export async function removeOutboxEntry(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("outbox", id);
}

export async function incrementOutboxAttempts(id: string): Promise<void> {
  const db = await getDb();
  const entry = await db.get("outbox", id);
  if (entry) {
    entry.attempts += 1;
    await db.put("outbox", entry);
  }
}
