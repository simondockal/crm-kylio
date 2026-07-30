import { useEffect, useRef, useState } from "react";
import { CalendarPlus, MessageSquarePlus, PhoneCall, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  STAGES,
  dealCalendarUrl,
  formatDateTime,
  notifyDealsChanged,
  type Deal,
  type DealNote,
  type DealStage,
} from "@/lib/deals";
import { fromLocalInputValue, toLocalInputValue } from "@/lib/leads";
import { MeetingDialog, type MeetingResult } from "@/components/crm/meeting-dialog";

type StringField =
  | "company_name"
  | "contact_name"
  | "phone"
  | "email"
  | "website_url"
  | "cold_note"
  | "followup_note";

const FIELDS: { key: StringField; label: string }[] = [
  { key: "company_name", label: "Název firmy" },
  { key: "contact_name", label: "Kontaktní osoba" },
  { key: "phone", label: "Telefon" },
  { key: "email", label: "E-mail" },
  { key: "website_url", label: "Web" },
];

export function DealDrawer({
  deal,
  onClose,
  onPatch,
  onDelete,
}: {
  deal: Deal | null;
  onClose: () => void;
  onPatch: (id: string, patch: Partial<Deal>) => void;
  onDelete: (id: string) => void;
}) {
  const [notes, setNotes] = useState<DealNote[]>([]);
  const [draft, setDraft] = useState("");
  const [followupValue, setFollowupValue] = useState("");
  const [meetingOpen, setMeetingOpen] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!deal) return;
    setFollowupValue(toLocalInputValue(deal.followup_at));
    let active = true;
    supabase
      .from("deal_notes")
      .select("*")
      .eq("deal_id", deal.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (active) setNotes((data ?? []) as DealNote[]);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal?.id]);

  if (!deal) return null;

  const patchField = (key: StringField, value: string) => {
    const patch = { [key]: value } as Partial<Deal>;
    onPatch(deal.id, patch);
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(async () => {
      const { error } = await supabase
        .from("deals")
        .update(patch)
        .eq("id", deal.id);
      if (error) toast.error("Uložení se nezdařilo.");
    }, 450);
  };

  const addNote = async () => {
    const body = draft.trim();
    if (!body) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const author = userData.user.email ?? "Já";
    const { data, error } = await supabase
      .from("deal_notes")
      .insert({ deal_id: deal.id, user_id: userData.user.id, author, body })
      .select()
      .single();
    if (error || !data) {
      toast.error("Poznámku se nepodařilo uložit.");
      return;
    }
    setNotes((prev) => [data as DealNote, ...prev]);
    setDraft("");
  };

  const saveFollowup = async (openCalendar: boolean) => {
    const iso = fromLocalInputValue(followupValue);
    const patch: Partial<Deal> = { followup_at: iso, followup_done: false };
    onPatch(deal.id, patch);
    const { error } = await supabase.from("deals").update(patch).eq("id", deal.id);
    if (error) {
      toast.error("Uložení se nezdařilo.");
      return;
    }
    notifyDealsChanged();
    toast.success("Follow-up naplánován.");
    if (openCalendar) {
      const url = dealCalendarUrl({ ...deal, followup_at: iso });
      if (url) window.open(url, "_blank", "noopener");
    }
  };

  return (
    <>
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="scroll-slim w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="font-display">
            {deal.company_name || deal.contact_name || "Deal"}
          </SheetTitle>
          <SheetDescription>
            Vytvořeno {formatDateTime(deal.created_at)}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-8">
          <div className="rounded-lg border border-primary/40 bg-primary/10 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
              <PhoneCall className="size-3.5" />
              Poznámka z cold callu
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm">
              {deal.cold_note?.trim() || "— bez poznámky —"}
            </p>
          </div>

          <Button size="sm" variant="secondary" onClick={() => setMeetingOpen(true)}>
            <CalendarPlus className="size-4" />
            Naplánovat schůzku
          </Button>

          <div className="space-y-1.5">
            <Label className="text-xs">Fáze</Label>
            <Select
              value={deal.stage}
              onValueChange={async (v) => {
                onPatch(deal.id, { stage: v as DealStage });
                await supabase.from("deals").update({ stage: v }).eq("id", deal.id);
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key as string} className="space-y-1.5">
                <Label className="text-xs">{f.label}</Label>
                <Input
                  className="h-9"
                  value={deal[f.key] ?? ""}
                  onChange={(e) => patchField(f.key, e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Upravit poznámku z cold callu</Label>
            <Textarea
              rows={3}
              value={deal.cold_note ?? ""}
              onChange={(e) => patchField("cold_note", e.target.value)}
            />
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-surface-2 p-3">
            <Label className="text-xs">Naplánovat follow-up</Label>
            <Input
              type="datetime-local"
              className="h-9"
              value={followupValue}
              onChange={(e) => setFollowupValue(e.target.value)}
            />
            <Textarea
              rows={2}
              placeholder="Poznámka k follow-upu…"
              value={deal.followup_note ?? ""}
              onChange={(e) => patchField("followup_note", e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => void saveFollowup(false)} disabled={!followupValue}>
                Uložit
              </Button>
              <Button size="sm" onClick={() => void saveFollowup(true)} disabled={!followupValue}>
                <CalendarPlus className="size-4" />
                Uložit + Google Kalendář
              </Button>
              {deal.followup_at ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    onPatch(deal.id, { followup_done: true });
                    await supabase.from("deals").update({ followup_done: true }).eq("id", deal.id);
                    notifyDealsChanged();
                  }}
                >
                  Označit jako hotové
                </Button>
              ) : null}
            </div>
            {deal.followup_at ? (
              <p className="text-xs text-muted-foreground">
                Termín: <span className="font-mono">{formatDateTime(deal.followup_at)}</span>
                {deal.followup_done ? " · hotovo" : ""}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Aktivita</Label>
            <Textarea
              rows={3}
              placeholder="Zapsat průběh jednání…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <Button size="sm" onClick={() => void addNote()} disabled={!draft.trim()}>
              <MessageSquarePlus className="size-4" />
              Přidat poznámku
            </Button>

            <ul className="mt-3 space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">{n.author}</span>
                    <span className="font-mono">{formatDateTime(n.created_at)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{n.body}</p>
                </li>
              ))}
              {notes.length === 0 ? (
                <li className="py-4 text-center text-xs text-muted-foreground">
                  Zatím žádné poznámky.
                </li>
              ) : null}
            </ul>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(deal.id)}
          >
            <Trash2 className="size-4" />
            Smazat deal
          </Button>
        </div>
      </SheetContent>
    </Sheet>

    <MeetingDialog
      target={
        meetingOpen
          ? {
              company_name: deal.company_name,
              contact_name: deal.contact_name,
              phone: deal.phone,
              email: deal.email,
              website_url: deal.website_url,
              note: deal.cold_note ?? "",
            }
          : null
      }
      onClose={() => setMeetingOpen(false)}
      onConfirm={async (result: MeetingResult) => {
        const patch: Partial<Deal> = {
          stage: "nova_schuzka",
          followup_at: result.startIso,
          followup_note: result.notes,
          followup_done: false,
        };
        onPatch(deal.id, patch);
        await supabase.from("deals").update(patch).eq("id", deal.id);
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user && result.notes.trim()) {
          const { data } = await supabase
            .from("deal_notes")
            .insert({
              deal_id: deal.id,
              user_id: userData.user.id,
              author: userData.user.email ?? "Já",
              body: `Schůzka naplánována: ${formatDateTime(result.startIso)}\n${result.notes.trim()}`,
            })
            .select()
            .single();
          if (data) setNotes((prev) => [data as DealNote, ...prev]);
        }
        notifyDealsChanged();
        setMeetingOpen(false);
        toast.success("Schůzka naplánována.");
      }}
    />
    </>
  );
}
