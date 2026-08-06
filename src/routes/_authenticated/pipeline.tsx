import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, GripVertical, Phone, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AppShell } from "@/components/crm/app-shell";
import { DealDrawer } from "@/components/crm/deal-drawer";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  DEALS_CHANGED,
  STAGES,
  formatDateTime,
  notifyDealsChanged,
  type Deal,
  type DealStage,
} from "@/lib/deals";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pipeline")({
  head: () => ({
    meta: [
      { title: "Sales Pipeline — Kylio CRM" },
      {
        name: "description",
        content: "Kanban pipeline domluvených schůzek: fáze obchodu, poznámky a follow-upy.",
      },
      { property: "og:title", content: "Sales Pipeline — Kylio CRM" },
      { property: "og:description", content: "Kanban pipeline domluvených schůzek." },
    ],
  }),
  component: PipelinePage,
});

function PipelinePage() {
  const { loading: roleLoading, isAdmin } = useCurrentUser();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openDealId, setOpenDealId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<DealStage | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("deals")
      .select("*")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) toast.error("Nepodařilo se načíst pipeline.");
    setDeals((data ?? []) as Deal[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const handler = () => void load();
    window.addEventListener(DEALS_CHANGED, handler);
    return () => window.removeEventListener(DEALS_CHANGED, handler);
  }, [load]);

  const patchDeal = useCallback((id: string, patch: Partial<Deal>) => {
    setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }, []);

  const moveTo = async (id: string, stage: DealStage) => {
    const current = deals.find((d) => d.id === id);
    if (!current || current.stage === stage) return;
    const position = Date.now();
    patchDeal(id, { stage, position });
    const { error } = await supabase.from("deals").update({ stage, position }).eq("id", id);
    if (error) {
      toast.error("Přesun se nezdařil.");
      void load();
      return;
    }
    toast.success(`Přesunuto: ${STAGES.find((s) => s.value === stage)?.label}`);
  };

  const deleteDeal = async (id: string) => {
    setDeals((prev) => prev.filter((d) => d.id !== id));
    setOpenDealId(null);
    setConfirmDelete(null);
    const { error } = await supabase.from("deals").delete().eq("id", id);
    if (error) {
      toast.error("Smazání se nezdařilo.");
      void load();
    } else {
      notifyDealsChanged();
    }
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deals;
    return deals.filter((d) =>
      [d.company_name, d.contact_name, d.phone, d.email].join(" ").toLowerCase().includes(q),
    );
  }, [deals, search]);

  const openDeal = deals.find((d) => d.id === openDealId) ?? null;

  if (!roleLoading && !isAdmin) {
    return (
      <AppShell>
        <div className="mx-auto mt-16 max-w-md rounded-[20px] border border-border bg-surface p-8 text-center">
          <h1 className="font-display text-lg font-semibold">Nemáte přístup</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sales Pipeline je dostupná pouze pro roli Admin.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      actions={
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hledat v pipeline…"
          className="h-10 rounded-full border-grid-line bg-surface-elevated pl-9 text-sm text-canvas-light placeholder:text-on-dark-mute"
          />
        </div>
      }
    >
      {loading ? (
        <div className="py-24 text-center text-sm text-muted-foreground">Načítám…</div>
      ) : (
        <div className="scroll-slim flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const items = visible.filter((d) => d.stage === stage.value);
            return (
              <div
                key={stage.value}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverStage(stage.value);
                }}
                onDragLeave={() => setOverStage((s) => (s === stage.value ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOverStage(null);
                  if (dragId) void moveTo(dragId, stage.value);
                  setDragId(null);
                }}
                className={cn(
                  "flex w-[300px] shrink-0 flex-col rounded-[20px] border border-border bg-surface transition-colors",
                  overStage === stage.value && "border-primary bg-primary/5",
                )}
              >
                <div className="flex items-center gap-2 border-b border-grid-line px-3 py-2.5">
                  <span className={cn("size-2 rounded-full", stage.accent)} />
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    {stage.label}
                  </span>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">
                    {items.length}
                  </span>
                </div>
                <div className="flex min-h-[120px] flex-col gap-2 p-2">
                  {items.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      draggable
                      onDragStart={() => setDragId(d.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverStage(null);
                      }}
                      onClick={() => setOpenDealId(d.id)}
                      className={cn(
                        "group cursor-grab rounded-xl border border-border bg-surface-2 p-4 text-left transition-colors hover:border-primary/40 active:cursor-grabbing",
                        dragId === d.id && "opacity-50",
                      )}
                    >
                      <div className="flex items-start gap-1.5">
                        <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {d.company_name || "Bez názvu"}
                          </p>
                          {d.contact_name ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {d.contact_name}
                            </p>
                          ) : null}
                          {d.phone ? (
                            <p className="mt-1 flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                              <Phone className="size-3" />
                              {d.phone}
                            </p>
                          ) : null}
                          {d.followup_at && !d.followup_done ? (
                            <p
                              className={cn(
                                "mt-1 flex items-center gap-1 font-mono text-[11px]",
                                new Date(d.followup_at).getTime() < Date.now()
                                  ? "text-destructive"
                                  : "text-warning",
                              )}
                            >
                              <CalendarClock className="size-3" />
                              {formatDateTime(d.followup_at)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  ))}
                  {items.length === 0 ? (
                    <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                      Přetáhněte sem kartu
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DealDrawer
        deal={openDeal}
        onClose={() => setOpenDealId(null)}
        onPatch={patchDeal}
        onDelete={(id) => setConfirmDelete(id)}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat deal?</AlertDialogTitle>
            <AlertDialogDescription>
              Karta i všechny její poznámky budou trvale odstraněny.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && void deleteDeal(confirmDelete)}>
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
