import { CalendarClock, CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/deals";
import { isTaskDue, type Task } from "@/lib/tasks";
import { cn } from "@/lib/utils";

/** Follow-up tasks (e.g. "Přebukovat schůzku") with a daily calling cadence. */
export function TasksPanel({
  tasks,
  onComplete,
  onSnooze,
}: {
  tasks: Task[];
  onComplete: (id: string) => void;
  onSnooze: (id: string, cadenceDays: number) => void;
}) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-[20px] border border-border bg-surface px-6 py-16 text-center text-sm text-muted-foreground">
        Žádné otevřené úkoly.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {tasks.map((t) => {
        const due = isTaskDue(t);
        return (
          <li
            key={t.id}
            className={cn(
              "flex flex-wrap items-center gap-3 rounded-[20px] border bg-surface px-5 py-4",
              due ? "border-warning/50 bg-warning/5" : "border-border",
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-canvas-dark">{t.title}</p>
              <p className="truncate text-xs text-muted-foreground">{t.detail}</p>
            </div>
            <span
              className={cn(
                "flex items-center gap-1.5 font-mono text-xs",
                due ? "text-warning" : "text-muted-foreground",
              )}
            >
              <CalendarClock className="size-3.5" />
              {formatDateTime(t.due_at)}
            </span>
            <Button size="sm" variant="ghost" onClick={() => onSnooze(t.id, t.cadence_days)}>
              <RotateCcw className="size-4" />
              Zavoláno — další den
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onComplete(t.id)}>
              <CheckCircle2 className="size-4" />
              Hotovo
            </Button>
          </li>
        );
      })}
    </ul>
  );
}