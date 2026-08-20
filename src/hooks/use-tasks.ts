import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TASKS_CHANGED, nextBusinessDay, notifyTasksChanged, type Task } from "@/lib/tasks";

/** Loads open follow-up tasks visible to the current user (assignee or admin). */
export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("done", false)
      .order("due_at", { ascending: true });
    setTasks((data ?? []) as Task[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const handler = () => void load();
    window.addEventListener(TASKS_CHANGED, handler);
    return () => window.removeEventListener(TASKS_CHANGED, handler);
  }, [load]);

  const completeTask = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("tasks").update({ done: true }).eq("id", id);
    notifyTasksChanged();
  }, []);

  /** Pushes the task to the next business day (daily calling cadence). */
  const snoozeTask = useCallback(async (id: string, cadenceDays = 1) => {
    const due = nextBusinessDay(cadenceDays);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, due_at: due } : t)));
    await supabase.from("tasks").update({ due_at: due }).eq("id", id);
    notifyTasksChanged();
  }, []);

  return { tasks, loading, reload: load, completeTask, snoozeTask };
}