import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, Plus, Search } from "lucide-react";
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
import { ImportCsvDialog, type ImportRow } from "@/components/crm/import-csv-dialog";
import { MeetingDialog, type MeetingResult } from "@/components/crm/meeting-dialog";
import {
  STATUSES,
  fromLocalInputValue,
  googleCalendarUrl,
  toLocalInputValue,
  type Lead,
  type LeadStatus,
} from "@/lib/leads";
import { notifyDealsChanged, type Deal } from "@/lib/deals";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useTeamMembers } from "@/hooks/use-team-members";
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

type FilterKey = "all" | LeadStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Všechny kontakty" },
  { key: "nevolano", label: "Nevoláno" },
  { key: "zavolat_pozdeji", label: "Zavolat později" },
  { key: "domluvena_schuzka", label: "Domluvené schůzky" },
  { key: "odmitnul", label: "Odmítnuto" },
];

function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [owner, setOwner] = useState<string>("all");
  const [search, setSearch] = useState("");
  const { user, isAdmin } = useCurrentUser();
  const { members } = useTeamMembers(isAdmin);
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
    const { data: existing } = await supabase
      .from("deals")
      .select("id, cold_note")
      .eq("lead_id", lead.id)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("deals")
        .update({ cold_note: lead.note ?? "" })
        .eq("id", existing.id);
      if (meetingNote?.trim()) {
        const { data: u } = await supabase.auth.getUser();
        if (u.user) {
          await supabase.from("deal_notes").insert({
            deal_id: existing.id,
            user_id: u.user.id,
            author: u.user.email ?? "Já",
            body: meetingNote.trim(),
          });
        }
      }
      notifyDealsChanged();
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data: created, error } = await supabase
      .from("deals")
      .insert({
      user_id: userData.user.id,
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
        user_id: userData.user.id,
        author: userData.user.email ?? "Já",
        body: meetingNote.trim(),
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
      .insert({ user_id: targetUserId })
      .select()
      .single();
    if (error || !data) {
      toast.error("Řádek se nepodařilo přidat.");
      return;
    }
    setLeads((prev) => [...prev, data as Lead]);
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

  const importRows = async (rows: ImportRow[]) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const targetUserId = isAdmin && owner !== "all" ? owner : userData.user.id;
    const payload = rows.map((r) => ({ ...r, user_id: targetUserId }));
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
    if (inserted.length) {
      setLeads((prev) => [...prev, ...inserted]);
      toast.success(`Naimportováno ${inserted.length} kontaktů.`);
    }
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
      if (filter !== "all" && l.status !== filter) return false;
      if (!q) return true;
      return [l.company_name, l.contact_name, l.phone, l.email]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [ownerLeads, filter, search]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: ownerLeads.length };
    STATUSES.forEach((s) => {
      map[s.value] = ownerLeads.filter((l) => l.status === s.value).length;
    });
    return map;
  }, [ownerLeads]);

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
          <ImportCsvDialog onImport={importRows} />
          <Button size="sm" onClick={addRow}>
            <Plus className="size-4" />
            Nový řádek
          </Button>
        </>
      }
      filters={
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
      }
    >
      {loading ? (
        <div className="py-24 text-center text-sm text-muted-foreground">Načítám…</div>
      ) : (
        <LeadsGrid
          leads={visible}
          onPatch={patchLead}
          onDelete={deleteRows}
          onRequestFollowup={openFollowup}
          onRequestMeeting={(lead) => setMeetingLead(lead)}
        />
      )}

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