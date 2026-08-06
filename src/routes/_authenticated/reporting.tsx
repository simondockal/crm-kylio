import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppShell } from "@/components/crm/app-shell";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { Lead } from "@/lib/leads";
import type { Deal, DealStage } from "@/lib/deals";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/reporting")({
  head: () => ({
    meta: [
      { title: "Reporting & Analytics — Kylio CRM" },
      {
        name: "description",
        content:
          "Prodejní funnel, konverzní poměry, výkon cold callerů a analýza ztrát v pipeline.",
      },
      { property: "og:title", content: "Reporting & Analytics — Kylio CRM" },
      { property: "og:description", content: "Prodejní funnel a metriky výkonu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportingPage,
});

type RangeKey = "dnes" | "tyden" | "mesic" | "vse" | "custom";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "dnes", label: "Dnes" },
  { key: "tyden", label: "Tento týden" },
  { key: "mesic", label: "Tento měsíc" },
  { key: "vse", label: "Vše" },
  { key: "custom", label: "Vlastní rozsah" },
];

function rangeBounds(key: RangeKey, from: string, to: string): [number, number] {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  if (key === "dnes") return [start.getTime(), end.getTime()];
  if (key === "tyden") {
    const day = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - day);
    return [start.getTime(), end.getTime()];
  }
  if (key === "mesic") {
    start.setDate(1);
    return [start.getTime(), end.getTime()];
  }
  if (key === "custom") {
    const s = from ? new Date(`${from}T00:00:00`).getTime() : 0;
    const e = to ? new Date(`${to}T23:59:59`).getTime() : Number.MAX_SAFE_INTEGER;
    return [s, e];
  }
  return [0, Number.MAX_SAFE_INTEGER];
}

const HELD_STAGES: DealStage[] = ["uvodni_probehla", "v_jednani", "vyhrano", "prohrano"];
const PROPOSAL_STAGES: DealStage[] = ["v_jednani", "vyhrano"];

function pct(a: number, b: number) {
  if (!b) return 0;
  return (a / b) * 100;
}

function fmtPct(v: number) {
  return `${v.toFixed(v >= 10 ? 0 : 1)} %`;
}

function ReportingPage() {
  const { loading: roleLoading, isAdmin } = useCurrentUser();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [noteCount, setNoteCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeKey>("mesic");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (roleLoading || !isAdmin) return;
    void (async () => {
      const [l, d, n] = await Promise.all([
        supabase.from("leads").select("*"),
        supabase.from("deals").select("*"),
        supabase.from("deal_notes").select("id", { count: "exact", head: true }),
      ]);
      if (l.error || d.error) toast.error("Nepodařilo se načíst data pro reporting.");
      setLeads((l.data ?? []) as Lead[]);
      setDeals((d.data ?? []) as Deal[]);
      setNoteCount(n.count ?? 0);
      setLoading(false);
    })();
  }, [roleLoading, isAdmin]);

  const [start, end] = useMemo(() => rangeBounds(range, from, to), [range, from, to]);

  const inRange = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= start && t <= end;
  };

  const fLeads = useMemo(() => leads.filter((l) => inRange(l.created_at)), [leads, start, end]);
  const fDeals = useMemo(() => deals.filter((d) => inRange(d.created_at)), [deals, start, end]);

  const imported = fLeads.length;
  const answered = fLeads.filter((l) => l.call_answered).length;
  const booked = fLeads.filter((l) => l.status === "domluvena_schuzka").length;
  const rejected = fLeads.filter((l) => l.status === "odmitnul").length;
  const withNote = fLeads.filter((l) => (l.note ?? "").trim().length > 0).length;

  const held = fDeals.filter((d) => HELD_STAGES.includes(d.stage)).length;
  const proposals = fDeals.filter((d) => PROPOSAL_STAGES.includes(d.stage)).length;
  const won = fDeals.filter((d) => d.stage === "vyhrano").length;
  const lost = fDeals.filter((d) => d.stage === "prohrano").length;
  const noShow = fDeals.filter((d) => d.stage === "nedostavil_se").length;

  const stages = [
    { label: "Importované leady", value: imported },
    { label: "Dovoláno", value: answered },
    { label: "Domluvené schůzky", value: booked },
    { label: "Proběhlé schůzky", value: held },
    { label: "V jednání / Nabídka", value: proposals },
    { label: "Vyhráno", value: won },
  ];

  const drops = stages.map((s, i) => (i === 0 ? 0 : stages[i - 1].value - s.value));
  const maxDropIdx = drops.indexOf(Math.max(...drops.slice(1)));

  const wonDeals = fDeals.filter((d) => d.stage === "vyhrano");
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const durations = wonDeals.map((d) => {
    const origin = (d.lead_id && leadById.get(d.lead_id)?.created_at) || d.created_at;
    return (new Date(d.updated_at).getTime() - new Date(origin).getTime()) / 86_400_000;
  });
  const avgDays = durations.length
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;

  const leakage = [
    { name: "Nedostavil se", value: noShow, color: "hsl(215 15% 55%)" },
    { name: "Prohráno po schůzce", value: lost, color: "hsl(0 72% 55%)" },
    { name: "Odmítnuto v cold callu", value: rejected, color: "hsl(35 90% 55%)" },
  ].filter((x) => x.value > 0);

  if (!roleLoading && !isAdmin) {
    return (
      <AppShell>
        <div className="mx-auto mt-16 max-w-md rounded-xl border border-border bg-surface p-6 text-center">
          <h1 className="font-display text-lg font-semibold">Nemáte přístup</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Reporting & Analytics je dostupný pouze pro roli Admin.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      actions={
        <div className="flex flex-wrap items-center gap-1.5">
          {RANGES.map((r) => (
            <Button
              key={r.key}
              size="sm"
              variant={range === r.key ? "default" : "outline"}
              className="h-7 px-2.5 text-xs"
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </Button>
          ))}
          {range === "custom" ? (
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-7 w-[9.5rem] text-xs"
              />
              <span className="text-xs text-muted-foreground">–</span>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-7 w-[9.5rem] text-xs"
              />
            </div>
          ) : null}
        </div>
      }
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Načítám data…</p>
      ) : (
        <div className="space-y-6">
          <section className="rounded-[20px] bg-canvas-dark p-6 text-canvas-light sm:p-8">
            <h1 className="font-display text-3xl font-medium">Prodejní funnel</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Konverze krok po kroku od importovaných leadů po uzavřené obchody.
            </p>
            <div className="mt-5 space-y-2">
              {stages.map((s, i) => {
                const width = imported ? Math.max((s.value / Math.max(imported, 1)) * 100, 6) : 6;
                const stepRate = i === 0 ? 100 : pct(s.value, stages[i - 1].value);
                const totalRate = pct(s.value, imported);
                const dropped = i === 0 ? 0 : Math.max(stages[i - 1].value - s.value, 0);
                const isWorst = i > 0 && i === maxDropIdx && dropped > 0;
                return (
                  <div key={s.label}>
                    <div className="flex items-center gap-3">
                      <div className="w-52 shrink-0 text-xs font-medium">{s.label}</div>
                       <div className="relative h-11 flex-1 overflow-hidden rounded-full bg-surface-elevated">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${width}%` }}
                        />
                        <div className="absolute inset-0 flex items-center justify-between px-3">
                          <span className="font-mono text-sm font-semibold">{s.value}</span>
                          <span className="text-[11px] text-muted-foreground">
                            krok {fmtPct(stepRate)} · celkem {fmtPct(totalRate)}
                          </span>
                        </div>
                      </div>
                    </div>
                    {i > 0 && dropped > 0 ? (
                      <div
                        className={cn(
                          "ml-[13.75rem] mt-1 text-[11px]",
                          isWorst ? "font-semibold text-destructive" : "text-muted-foreground",
                        )}
                      >
                        −{dropped} ztraceno {isWorst ? "· největší propad" : ""}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="mt-6 rounded-xl border border-white/10 bg-surface-elevated p-4 text-xs">
              End-to-end konverze:{" "}
              <span className="font-mono font-semibold text-primary">{fmtPct(pct(won, imported))}</span>{" "}
              ({won} z {imported} leadů)
            </div>
          </section>

          <section>
            <h2 className="mb-3 font-display text-sm font-semibold">Výkon cold callera</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Celkem kontaktů" value={String(imported)} hint={`${answered} dovoláno`} />
              <Metric label="Dovolatelnost" value={fmtPct(pct(answered, imported))} hint="Dovoláno / kontakty" />
              <Metric label="Booking rate" value={fmtPct(pct(booked, answered))} hint="Schůzky / dovoláno" />
              <Metric label="Rejection rate" value={fmtPct(pct(rejected, answered))} hint="Odmítnutí / dovoláno" />
              <Metric
                label="Poznámky u leadů"
                value={fmtPct(pct(withNote, imported))}
                hint={`${withNote} z ${imported} má poznámku`}
              />
              <Metric
                label="Průměr poznámek / deal"
                value={fDeals.length ? (noteCount / fDeals.length).toFixed(1) : "0"}
                hint="Aktivita v deal kartách"
              />
            </div>
          </section>

          <section>
            <h2 className="mb-3 font-display text-sm font-semibold">Uzavírání obchodů a ztráty</h2>
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
                <Metric label="No-show rate" value={fmtPct(pct(noShow, booked || fDeals.length))} hint="Nedostavil se / schůzky" />
                <Metric label="Close rate" value={fmtPct(pct(won, held))} hint="Vyhráno / proběhlé schůzky" />
                <Metric label="Prohráno" value={String(lost)} hint="Deals ve fázi Prohráno" />
                <Metric
                  label="Čas ve funnelu"
                  value={`${avgDays.toFixed(1)} dní`}
                  hint="Import → Vyhráno (průměr)"
                />
              </div>
               <div className="rounded-[20px] border border-border bg-surface p-6">
                <h3 className="text-xs font-medium text-muted-foreground">Kde ztrácíme obchody</h3>
                <div className="mt-2 h-56">
                  {leakage.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={leakage} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75}>
                          {leakage.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <RTooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      Zatím žádné ztracené obchody
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[20px] border border-border bg-surface p-6">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-3 font-display text-3xl font-medium">{value}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}