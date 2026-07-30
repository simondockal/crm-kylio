import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, LogOut, Plus, Search } from "lucide-react";
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
import { ThemeToggle } from "@/components/theme-toggle";
import { LeadsGrid } from "@/components/crm/leads-grid";
import { ImportCsvDialog, type ImportRow } from "@/components/crm/import-csv-dialog";
import {
  STATUSES,
  fromLocalInputValue,
  googleCalendarUrl,
  toLocalInputValue,
  type Lead,
  type LeadStatus,
} from "@/lib/leads";
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [followupLead, setFollowupLead] = useState<Lead | null>(null);
  const [followupValue, setFollowupValue] = useState("");
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

  const patchLead = useCallback(
    (id: string, patch: Partial<Lead>) => {
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
      const key = `${id}:${Object.keys(patch).join(",")}`;
      clearTimeout(timers.current[key]);
      timers.current[key] = setTimeout(() => void flush(id, patch), 450);
    },
    [flush],
  );

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

  const deleteRow = async (id: string) => {
    const prev = leads;
    setLeads((l) => l.filter((x) => x.id !== id));
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) {
      setLeads(prev);
      toast.error("Smazání se nezdařilo.");
    }
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

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3 px-5 py-3">
          <span className="font-display text-base font-bold tracking-tight">
            Kylio<span className="text-primary">.</span>
          </span>
          <div className="relative ml-2 w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hledat firmu, jméno, telefon…"
              className="h-8 pl-8 text-sm"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ImportCsvDialog onImport={importRows} />
            <Button size="sm" onClick={addRow}>
              <Plus className="size-4" />
              Nový řádek
            </Button>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Odhlásit se">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>

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
      </header>

      <main className="p-5">
        {loading ? (
          <div className="py-24 text-center text-sm text-muted-foreground">Načítám…</div>
        ) : (
          <LeadsGrid
            leads={visible}
            onPatch={patchLead}
            onDelete={deleteRow}
            onRequestFollowup={openFollowup}
          />
        )}
      </main>

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
    </div>
  );
}