"use client";

// =====================================================================
// useTaskRealtimeSync()
// Subscribes to Postgres changes on the `tasks` table (via Supabase
// Realtime/WebSockets) scoped to the current user, and mirrors every
// insert/update/delete into both React state and the IndexedDB cache
// so other open tabs/devices — and the offline store — stay consistent.
// =====================================================================
import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Task } from "../types";
import { cacheTasks, upsertCachedTask, deleteCachedTask, getCachedTasks } from "../offline/db";

interface UseTaskRealtimeSyncOptions {
  supabase: SupabaseClient;
  userId: string;
  initialTasks: Task[];
}

export function useTaskRealtimeSync({
  supabase,
  userId,
  initialTasks,
}: UseTaskRealtimeSyncOptions) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const hydratedRef = useRef(false);

  // Hydrate from IndexedDB first (instant, works offline), then seed
  // the cache with the server-provided initial tasks.
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    (async () => {
      const cached = await getCachedTasks();
      if (cached.length > 0 && (typeof navigator === "undefined" || !navigator.onLine)) {
        setTasks(cached);
      }
      await cacheTasks(initialTasks);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`tasks-user-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tasks", filter: `user_id=eq.${userId}` },
        (payload) => {
          const task = payload.new as Task;
          setTasks((prev) => [...prev, task]);
          void upsertCachedTask(task);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tasks", filter: `user_id=eq.${userId}` },
        (payload) => {
          const task = payload.new as Task;
          setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
          void upsertCachedTask(task);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "tasks", filter: `user_id=eq.${userId}` },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id;
          setTasks((prev) => prev.filter((t) => t.id !== deletedId));
          void deleteCachedTask(deletedId);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  return { tasks, setTasks };
}
