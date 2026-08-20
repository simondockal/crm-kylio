import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppShell } from "@/components/crm/app-shell";
import { LeadsGrid } from "@/components/crm/leads-grid";
import {
  ImportCsvDialog,
  type DuplicateMode,
  type ImportRow,
} from "@/components/crm/import-csv-dialog";
import { MeetingDialog, type MeetingResult } from "@/components/crm/meeting-dialog";
import { TasksPanel } from "@/components/crm/tasks-panel";
import {
  STATUSES,
  fromLocalInputValue,
  googleCalendarUrl,
  reengageState,
  toLocalInputValue,
  type Lead,
  type LeadStatus,
} from "@/lib/leads";
import { notifyDealsChanged, type Deal } from "@/lib/deals";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useTeamMembers } from "@/hooks/use-team-members";
import { useLeadLists } from "@/hooks/use-lead-lists";
import { useTasks } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({
    meta: [
      { title: "Kontakty — Kylio CRM" },
      { name: "description", content: "Tabulka leadů pro cold calling: stavy hovorů, poznámky a follow-upy." },
      { property: "og:title", content: "Kontakty — Kylio CRM" },
      { property: "og:description", content: "Tabulka leadů pro cold calling." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeadsPage,
});

type FilterKey = "all" | LeadStatus | "reengage" | "tasks";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Všechny kontakty" },
  { key: "nevolano", label: "Nevoláno" },
  { key: "zavolat_pozdeji", label: "Zavolat později" },
  { key: "domluvena_schuzka", label: "Domluvené schůzky" },
  { key: "odmitnul", label: "Odmítnuto" },
  { key: "reengage", label: "Re-engagement fronta" },
  { key: "tasks", label: "Úkoly" },
];

function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [owner, setOwner] = useState<string>("all");
  const [search, setSearch] = useState("");
  const { user, isAdmin } = useCurrentUser();
  const { members } = useTeamMembers(isAdmin);
  const listOwnerId = owner !== "all" ? owner : (user?.id ?? null);
  const { lists, createList, deleteList } = useLeadLists(listOwnerId);
  const [listId, setListId] = useState<string>("all");
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const { tasks, completeTask, snoozeTask } = useTasks();
  const [followupLead, setFollowupLead] = useState<Lead | null>(null);
  const [followupValue, setFollowupValue] = useState("");
  const [meetingLead, setMeetingLead] = useState<Lead | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const deletingIds = useRef(new Set<string>());

  const loadLeads = useCallback(async () => {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    const loaded = (data ?? []) as Lead[];
    setLeads(loaded);
    return loaded;
  }, []);

  useEffect(() => {
    let active = true;
    loadLeads()
      .catch(() => {
        if (!active) return;
        toast.error("Nepodařilo se načíst kontakty.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
      Object.values(timers.current).forEach(clearTimeout);
    };
  }, [loadLeads]);

  const flush = useCallback(async (id: string, patch: Partial<Lead>) => {
    const { error } = await supabase.from("leads").update(patch).eq("id", id);
    if (error) toast.error("Uložení se nezdařilo.");
  }, []);

  const ensureDeal = useCallback(async (lead: Lead, meetingNote?: string) => {
    const { data: authData } = await supabase.auth.getUser();
    const actor = authData.user;
    const callerName = actor
      ? ((
          await supabase.from("profiles").select("full_name, email").eq("id", actor.id).maybeSingle()
        ).data?.full_name ||
          actor.email ||
          "")
      : "";
    const { data: existing } = await supabase
      .from("deals")
      .select("id, cold_note")
      .eq("lead_id", lead.id)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("deals")
        .update({ cold_note: lead.note ?? "", caller_id: actor?.id ?? null, caller_name: callerName })
        .eq("id", existing.id);
      if (meetingNote?.trim()) {
        if (actor) {
          await supabase.from("deal_notes").insert({
            deal_id: existing.id,
            user_id: actor.id,
            author: actor.email ?? "Já",
            body: meetingNote.trim(),
          });
        }
      }
      if (actor) {
        await supabase.from("lead_events").insert({
          lead_id: lead.id,
          deal_id: existing.id,
          actor_id: actor.id,
          actor_name: callerName,
          type: "rebooked",
          detail: "Schůzka znovu domluvena",
        });
      }
      notifyDealsChanged();
      return;
    }
    if (!actor) return;
    const { data: created, error } = await supabase
      .from("deals")
      .insert({
      user_id: actor.id,
      caller_id: actor.id,
      caller_name: callerName,
      lead_id: lead.id,
      company_name: lead.company_name,
      website_url: lead.website_url,
      contact_name: lead.contact_name,
      phone: lead.phone,
      email: lead.email,
      cold_note: lead.note,
      stage: "nova_schuzka",
      position: Date.now(),
      } satisfies Partial<Deal> & { user_id: string })
      .select()
      .single();
    if (error) {
      toast.error("Deal se nepodařilo vytvořit.");
      return;
    }
    if (created && meetingNote?.trim()) {
      await supabase.from("deal_notes").insert({
        deal_id: created.id,
        user_id: actor.id,
        author: actor.email ?? "Já",
        body: meetingNote.trim(),
      });
    }
    if (created) {
      await supabase.from("lead_events").insert({
        lead_id: lead.id,
        deal_id: created.id,
        actor_id: actor.id,
        actor_name: callerName,
        type: "booked",
        detail: "Schůzka domluvena při cold callu",
      });
    }
    notifyDealsChanged();
    toast.success("Přidáno do pipeline: Nové / Schůzka domluvena");
  }, []);

  const patchLead = useCallback(
    (id: string, patch: Partial<Lead>) => {
      if (deletingIds.current.has(id)) return;
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
      const key = `${id}:${Object.keys(patch).join(",")}`;
      clearTimeout(timers.current[key]);
      timers.current[key] = setTimeout(() => void flush(id, patch), 450);
    },
    [flush],
  );

  const confirmMeeting = async (result: MeetingResult) => {
    if (!meetingLead) return;
    const updated: Lead = {
      ...meetingLead,
      status: "domluvena_schuzka",
      note: result.notes,
      followup_at: result.startIso,
    };
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    await flush(updated.id, {
      status: "domluvena_schuzka",
      note: result.notes,
      followup_at: result.startIso,
    });
    await ensureDeal(updated);
    setMeetingLead(null);
    toast.success("Schůzka naplánována a deal je v pipeline.");
  };

  const addRow = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const targetUserId = isAdmin && owner !== "all" ? owner : userData.user.id;
    const { data, error } = await supabase
      .from("leads")
      .insert({ user_id: targetUserId, list_id: listId === "all" ? null : listId })
      .select()
      .single();
    if (error || !data) {
      toast.error("Řádek se nepodařilo přidat.");
      return;
    }
    setLeads((prev) => [...prev, data as Lead]);
  };

  /** Rejected leads roll over to another caller with a 3-day cooldown. */
  const rejectLead = async (lead: Lead) => {
    const { data, error } = await supabase.rpc("reject_lead", { _lead_id: lead.id });
    if (error) {
      toast.error("Odmítnutí se nezdařilo: " + error.message);
      return;
    }
    const updated = (Array.isArray(data) ? data[0] : data) as Lead | null;
    if (updated) {
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    } else {
      await loadLeads();
    }
    const handedOver = updated && updated.user_id !== lead.user_id;
    toast.success(
      handedOver
        ? "Odmítnuto — lead předán dalšímu volajícímu, cooldown 3 dny."
        : "Odmítnuto — lead je ve frontě, cooldown 3 dny.",
    );
  };

  const deleteRows = async (ids: string[]) => {
    if (ids.length === 0) return false;

    ids.forEach((id) => deletingIds.current.add(id));
    for (const [key, timer] of Object.entries(timers.current)) {
      if (ids.some((id) => key.startsWith(`${id}:`))) {
        clearTimeout(timer);
        delete timers.current[key];
      }
    }

    let deletedCount = 0;
    try {
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        const { data: deleted, error } = await supabase
          .from("leads")
          .delete()
          .in("id", chunk)
          .select("id");
        if (error) throw error;
        if ((deleted?.length ?? 0) !== chunk.length) {
          throw new Error("Databáze nepotvrdila smazání všech kontaktů.");
        }
        deletedCount += deleted?.length ?? 0;
      }

      const refreshed = await loadLeads();
      if (refreshed.some((lead) => ids.includes(lead.id))) {
        throw new Error("Kontrolní načtení našlo některé smazané kontakty.");
      }
      toast.success(deletedCount === 1 ? "Kontakt byl trvale smazán." : `Trvale smazáno ${deletedCount} kontaktů.`);
      return true;
    } catch (error) {
      try {
        await loadLeads();
      } catch {
        // Keep the currently visible rows when the verification reload also fails.
      }
      const message = error instanceof Error ? error.message : "Neznámá chyba";
      toast.error(`Smazání se nezdařilo: ${message}`);
      return false;
    } finally {
      ids.forEach((id) => deletingIds.current.delete(id));
    }
  };

  const importRows = async (rows: ImportRow[], mode: DuplicateMode) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const targetUserId = isAdmin && owner !== "all" ? owner : userData.user.id;
    const key = (name: string) => name.trim().toLowerCase();
    const existing = new Map<string, Lead>();
    leads.forEach((l) => {
      const k = key(l.company_name ?? "");
      if (k && !existing.has(k)) existing.set(k, l);
    });

    const fresh: ImportRow[] = [];
    const dupes: { row: ImportRow; lead: Lead }[] = [];
    const seen = new Set<string>();
    rows.forEach((r) => {
      const k = key(r.company_name);
      const match = k ? existing.get(k) : undefined;
      if (match || (k && seen.has(k))) {
        if (match) dupes.push({ row: r, lead: match });
        return;
      }
      if (k) seen.add(k);
      fresh.push(r);
    });

    let updated = 0;
    if (mode === "update") {
      for (const { row, lead } of dupes) {
        const patch = Object.fromEntries(
          Object.entries(row).filter(([, v]) => String(v).trim() !== ""),
        );
        const { error } = await supabase.from("leads").update(patch).eq("id", lead.id);
        if (!error) updated += 1;
      }
    }

    const payload = fresh.map((r) => ({
      ...r,
      user_id: targetUserId,
      list_id: listId === "all" ? null : listId,
    }));
    const inserted: Lead[] = [];
    for (let i = 0; i < payload.length; i += 500) {
      const { data, error } = await supabase
        .from("leads")
        .insert(payload.slice(i, i + 500))
        .select();
      if (error) {
        toast.error("Import selhal: " + error.message);
        break;
      }
      inserted.push(...((data ?? []) as Lead[]));
    }
    if (updated > 0) await loadLeads();
    else if (inserted.length) setLeads((prev) => [...prev, ...inserted]);
    toast.success(
      `Import hotov: ${inserted.length} nových kontaktů, ${dupes.length} duplicit ` +
        (mode === "update" ? `(aktualizováno ${updated}).` : "(přeskočeno)."),
    );
  };

  const openFollowup = (lead: Lead) => {
    setFollowupLead(lead);
    setFollowupValue(toLocalInputValue(lead.followup_at));
  };

  const saveFollowup = async (openCalendar: boolean) => {
    if (!followupLead) return;
    const iso = fromLocalInputValue(followupValue);
    const patch: Partial<Lead> = { followup_at: iso };
    if (iso && followupLead.status !== "zavolat_pozdeji") patch.status = "zavolat_pozdeji";
    setLeads((prev) =>
      prev.map((l) => (l.id === followupLead.id ? { ...l, ...patch } : l)),
    );
    await flush(followupLead.id, patch);
    if (openCalendar) {
      const url = googleCalendarUrl({ ...followupLead, followup_at: iso });
      if (url) window.open(url, "_blank", "noopener");
    }
    setFollowupLead(null);
  };

  const ownerLeads = useMemo(
    () => (owner === "all" ? leads : leads.filter((l) => l.user_id === owner)),
    [leads, owner],
  );

  const ownerTabs = useMemo(() => {
    if (!isAdmin) return [];
    const known = new Map(members.map((m) => [m.id, m.fullName]));
    const ids = Array.from(new Set(leads.map((l) => l.user_id)));
    ids.forEach((id) => {
      if (!known.has(id)) known.set(id, id === user?.id ? user.fullName : "Neznámý uživatel");
    });
    return Array.from(known.entries()).map(([id, name]) => ({
      id,
      name: id === user?.id ? `${name} (já)` : name,
      count: leads.filter((l) => l.user_id === id).length,
    }));
  }, [isAdmin, members, leads, user]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ownerLeads.filter((l) => {
      if (listId !== "all" && l.list_id !== listId) return false;
      if (filter === "reengage") {
        if (!l.reengage_at) return false;
      } else if (filter !== "all" && filter !== "tasks" && l.status !== filter) {
        return false;
      }
      if (!q) return true;
      return [l.company_name, l.contact_name, l.phone, l.email]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [ownerLeads, filter, search, listId]);

  const counts = useMemo(() => {
    const scoped =
      listId === "all" ? ownerLeads : ownerLeads.filter((l) => l.list_id === listId);
    const map: Record<string, number> = { all: scoped.length };
    STATUSES.forEach((s) => {
      map[s.value] = scoped.filter((l) => l.status === s.value).length;
    });
    map["reengage"] = scoped.filter((l) => l.reengage_at).length;
    map["tasks"] = tasks.length;
    return map;
  }, [ownerLeads, listId, tasks]);

  return (
    <AppShell
      actions={
        <>
          <div className="relative w-full min-w-52 sm:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hledat firmu, jméno, telefon…"
              className="h-10 rounded-full border-grid-line bg-surface-elevated pl-9 text-sm text-canvas-light placeholder:text-on-dark-mute"
            />
          </div>
          <ImportCsvDialog
            onImport={importRows}
            existingNames={leads.map((l) => l.company_name ?? "")}
          />
          <Button size="sm" onClick={addRow}>
            <Plus className="size-4" />
            Nový řádek
          </Button>
        </>
      }
      filters={
        <>
        {isAdmin && ownerTabs.length > 0 ? (
          <div className="scroll-slim flex items-center gap-2 overflow-x-auto border-t border-grid-line bg-canvas-dark px-6 pb-2 pt-2">
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-on-dark-mute">
              Tabulka
            </span>
            {[{ id: "all", name: "Všichni", count: leads.length }, ...ownerTabs].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setOwner(t.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                  owner === t.id
                    ? "bg-primary text-primary-foreground"
                    : "text-on-dark-mute hover:bg-surface-elevated hover:text-canvas-light",
                )}
              >
                {t.name}
                <span className="font-mono opacity-70">{t.count}</span>
              </button>
            ))}
          </div>
        ) : null}
        <div className="scroll-slim flex items-center gap-2 overflow-x-auto border-t border-grid-line bg-canvas-dark px-6 pb-2 pt-2">
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-on-dark-mute">
            Listy
          </span>
          {[{ id: "all", name: "Vše" }, ...lists].map((l) => (
            <span
              key={l.id}
              className={cn(
                "group flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                listId === l.id
                  ? "bg-canvas-light text-canvas-dark"
                  : "text-on-dark-mute hover:bg-surface-elevated hover:text-canvas-light",
              )}
            >
              <button type="button" onClick={() => setListId(l.id)}>
                {l.name}
              </button>
              {l.id !== "all" ? (
                <button
                  type="button"
                  aria-label="Smazat list"
                  onClick={() => {
                    void deleteList(l.id);
                    if (listId === l.id) setListId("all");
                  }}
                  className="opacity-0 transition-opacity group-hover:opacity-70 hover:opacity-100"
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </span>
          ))}
          <button
            type="button"
            onClick={() => setListDialogOpen(true)}
            className="flex shrink-0 items-center gap-1 rounded-full border border-grid-line px-3 py-1.5 text-xs font-semibold text-on-dark-mute hover:text-canvas-light"
          >
            <Plus className="size-3" />
            Nový list
          </button>
        </div>
        <div className="scroll-slim flex gap-2 overflow-x-auto border-t border-grid-line bg-canvas-dark px-6 pb-3 pt-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-colors",
                filter === f.key
                  ? "bg-canvas-light text-canvas-dark"
                  : "text-on-dark-mute hover:bg-surface-elevated hover:text-canvas-light",
              )}
            >
              {f.label}
              <span className="font-mono opacity-70">{counts[f.key] ?? 0}</span>
            </button>
          ))}
        </div>
        </>
      }
    >
      {loading ? (
        <div className="py-24 text-center text-sm text-muted-foreground">Načítám…</div>
      ) : filter === "tasks" ? (
        <TasksPanel tasks={tasks} onComplete={completeTask} onSnooze={snoozeTask} />
      ) : (
        <>
          {filter === "reengage" ? (
            <p className="mb-3 text-xs text-muted-foreground">
              Odmítnuté leady předané dalšímu volajícímu. Obvolávejte je až po uplynutí
              třídenního cooldownu ({visible.filter((l) => reengageState(l)?.ready).length}{" "}
              připraveno).
            </p>
          ) : null}
          <LeadsGrid
            leads={visible}
            onPatch={patchLead}
            onDelete={deleteRows}
            onRequestFollowup={openFollowup}
            onRequestMeeting={(lead) => setMeetingLead(lead)}
            onRequestReject={(lead) => void rejectLead(lead)}
          />
        </>
      )}

      <Dialog open={listDialogOpen} onOpenChange={setListDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nový list</DialogTitle>
            <DialogDescription>
              Vlastní list pro segmentaci kontaktů — vlastní filtrování i řazení.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="Např. Restaurace Praha"
            autoFocus
          />
          <DialogFooter>
            <Button
              disabled={!newListName.trim()}
              onClick={async () => {
                const created = await createList(newListName.trim());
                if (created) setListId(created.id);
                setNewListName("");
                setListDialogOpen(false);
              }}
            >
              Vytvořit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MeetingDialog
        target={meetingLead}
        onClose={() => setMeetingLead(null)}
        onConfirm={confirmMeeting}
      />

      <Dialog open={!!followupLead} onOpenChange={(o) => !o && setFollowupLead(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Zavolat později</DialogTitle>
            <DialogDescription>
              Nastavte termín pro {followupLead?.contact_name || followupLead?.company_name || "kontakt"}.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="datetime-local"
            value={followupValue}
            onChange={(e) => setFollowupValue(e.target.value)}
            autoFocus
          />
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" onClick={() => void saveFollowup(false)}>
              Jen uložit
            </Button>
            <Button onClick={() => void saveFollowup(true)} disabled={!followupValue}>
              <CalendarPlus className="size-4" />
              Uložit + Google Kalendář
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}