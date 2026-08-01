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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({
    meta: [
      { title: "Kontakty — Kylio CRM" },
      { name: "description", content: "Tabulka leadů pro cold calling: stavy hovorů, poznámky a follow-upy." },
      { property: "og:title", content: "Kontakty — Kylio CRM" },
      { property: "og:description", content: "Tabulka leadů pro cold calling." },
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
  const [search, setSearch] = useState("");
  const [followupLead, setFollowupLead] = useState<Lead | null>(null);
  const [followupValue, setFollowupValue] = useState("");
  const [meetingLead, setMeetingLead] = useState<Lead | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    let active = true;
    supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) toast.error("Nepodařilo se načíst kontakty.");
        setLeads((data ?? []) as Lead[]);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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
    const { data, error } = await supabase
      .from("leads")
      .insert({ user_id: userData.user.id })
      .select()
      .single();
    if (error || !data) {
      toast.error("Řádek se nepodařilo přidat.");
      return;
    }
    setLeads((prev) => [...prev, data as Lead]);
  };

  const deleteRows = async (ids: string[]) => {
    const prev = leads;
    setLeads((l) => l.filter((x) => !ids.includes(x.id)));
    // Detach related deals first (FK) and delete in chunks so long URLs don't fail.
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      await supabase.from("deals").update({ lead_id: null }).in("lead_id", chunk);
      const { error } = await supabase.from("leads").delete().in("id", chunk);
      if (error) {
        setLeads(prev);
        toast.error("Smazání se nezdařilo: " + error.message);
        return;
      }
    }
    toast.success(ids.length === 1 ? "Kontakt smazán." : `Smazáno ${ids.length} kontaktů.`);
  };

  const importRows = async (rows: ImportRow[]) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const payload = rows.map((r) => ({ ...r, user_id: userData.user!.id }));
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

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (filter !== "all" && l.status !== filter) return false;
      if (!q) return true;
      return [l.company_name, l.contact_name, l.phone, l.email]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [leads, filter, search]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: leads.length };
    STATUSES.forEach((s) => {
      map[s.value] = leads.filter((l) => l.status === s.value).length;
    });
    return map;
  }, [leads]);

  return (
    <AppShell
      actions={
        <>
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hledat firmu, jméno, telefon…"
              className="h-8 pl-8 text-sm"
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
        <div className="scroll-slim flex gap-1 overflow-x-auto px-5 pb-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
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