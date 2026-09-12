import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatFollowup, type Lead } from "@/lib/leads";
import { cn } from "@/lib/utils";

function pct(a: number, b: number) {
  if (!b) return 0;
  return (a / b) * 100;
}

function fmtPct(v: number) {
  return `${v.toFixed(v >= 10 ? 0 : 1)} %`;
}

function endOfToday(): number {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** Compact personal stats for cold callers — the reporting page is admin-only. */
export function MyStatsPanel({ leads }: { leads: Lead[] }) {
  const [open, setOpen] = useState(false);

  const stats = useMemo(() => {
    const total = leads.length;
    const answered = leads.filter((l) => l.call_answered).length;
    const booked = leads.filter((l) => l.status === "domluvena_schuzka").length;
    const rejected = leads.filter((l) => l.status === "odmitnul").length;
    const later = leads.filter((l) => l.status === "zavolat_pozdeji").length;
    const uncalled = leads.filter((l) => l.status === "nevolano").length;

    const now = Date.now();
    const todayEnd = endOfToday();
    const upcomingMeetings = leads
      .filter((l) => l.status === "domluvena_schuzka" && l.followup_at)
      .filter((l) => new Date(l.followup_at as string).getTime() >= now)
      .sort((a, b) => new Date(a.followup_at as string).getTime() - new Date(b.followup_at as string).getTime());

    const todaysFollowups = leads
      .filter((l) => l.status === "zavolat_pozdeji" && l.followup_at)
      .filter((l) => new Date(l.followup_at as string).getTime() <= todayEnd)
      .sort((a, b) => new Date(a.followup_at as string).getTime() - new Date(b.followup_at as string).getTime());

    return { total, answered, booked, rejected, later, uncalled, upcomingMeetings, todaysFollowups };
  }, [leads]);

  return (
    <div className="mb-4 rounded-[20px] border border-border bg-surface text-foreground">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <div className="flex items-center gap-4 text-sm">
          <span className="font-semibold text-foreground">Moje statistiky</span>
          <span className="text-xs text-muted-foreground">
            {stats.total} kontaktů · {fmtPct(pct(stats.answered, stats.total))} dovolatelnost ·{" "}
            {stats.booked} schůzek
            {stats.todaysFollowups.length > 0 ? (
              <> · <span className="font-semibold text-warning">{stats.todaysFollowups.length} k obvolání dnes</span></>
            ) : null}
          </span>
        </div>
        {open ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>
      {open ? (
        <div className="border-t border-grid-line px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Celkem" value={String(stats.total)} />
            <Stat label="Dovoláno" value={String(stats.answered)} hint={fmtPct(pct(stats.answered, stats.total))} />
            <Stat label="Nevoláno" value={String(stats.uncalled)} />
            <Stat label="Zavolat později" value={String(stats.later)} />
            <Stat
              label="Schůzky"
              value={String(stats.booked)}
              hint={fmtPct(pct(stats.booked, stats.answered))}
              tone="success"
            />
            <Stat
              label="Odmítnuto"
              value={String(stats.rejected)}
              hint={fmtPct(pct(stats.rejected, stats.answered))}
              tone="destructive"
            />
          </div>

          {stats.todaysFollowups.length > 0 || stats.upcomingMeetings.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {stats.todaysFollowups.length > 0 ? (
                <UpcomingList
                  title="K obvolání dnes"
                  tone="warning"
                  items={stats.todaysFollowups.slice(0, 5).map((l) => ({
                    id: l.id,
                    label: l.company_name || l.contact_name || "Kontakt",
                    when: formatFollowup(l.followup_at),
                  }))}
                  overflow={stats.todaysFollowups.length - 5}
                />
              ) : null}
              {stats.upcomingMeetings.length > 0 ? (
                <UpcomingList
                  title="Nadcházející schůzky"
                  tone="success"
                  items={stats.upcomingMeetings.slice(0, 5).map((l) => ({
                    id: l.id,
                    label: l.company_name || l.contact_name || "Kontakt",
                    when: formatFollowup(l.followup_at),
                  }))}
                  overflow={stats.upcomingMeetings.length - 5}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function UpcomingList({
  title,
  tone,
  items,
  overflow,
}: {
  title: string;
  tone: "warning" | "success";
  items: { id: string; label: string; when: string }[];
  overflow: number;
}) {
  return (
    <div className="rounded-2xl bg-surface-2 p-3">
      <div className={cn("text-[11px] font-semibold", tone === "warning" ? "text-warning" : "text-success")}>
        {title}
      </div>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-foreground">{item.label}</span>
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{item.when}</span>
          </li>
        ))}
      </ul>
      {overflow > 0 ? (
        <div className="mt-1.5 text-[11px] text-muted-foreground">+ {overflow} dalších</div>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "success" | "destructive";
}) {
  return (
    <div className="rounded-2xl bg-surface-2 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 font-display text-xl font-semibold text-foreground",
          tone === "success" && "text-success",
          tone === "destructive" && "text-destructive",
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
