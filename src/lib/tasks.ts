export type Task = {
  id: string;
  user_id: string;
  created_by: string | null;
  lead_id: string | null;
  deal_id: string | null;
  kind: string;
  title: string;
  detail: string;
  due_at: string;
  cadence_days: number;
  done: boolean;
  created_at: string;
  updated_at: string;
};

export const TASKS_CHANGED = "kylio:tasks-changed";

export function notifyTasksChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(TASKS_CHANGED));
}

/** Next business day at 09:00 local time, `days` business days ahead. */
export function nextBusinessDay(days = 1, from: Date = new Date()): string {
  const d = new Date(from);
  d.setHours(9, 0, 0, 0);
  let left = Math.max(1, days);
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) left -= 1;
  }
  return d.toISOString();
}

export function isTaskDue(task: Pick<Task, "due_at" | "done">): boolean {
  if (task.done) return false;
  return new Date(task.due_at).getTime() <= Date.now();
}