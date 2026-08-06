import { useState } from "react";
import { CalendarClock, Maximize2, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  STATUSES,
  formatFollowup,
  type Lead,
  type LeadField,
  type LeadStatus,
} from "@/lib/leads";

const COLUMNS = "76px 230px 190px 180px 150px 210px 96px 180px 280px 170px 44px";

const TEXT_COLS: { key: LeadField; placeholder: string; mono?: boolean }[] = [
  { key: "company_name", placeholder: "Název firmy" },
  { key: "website_url", placeholder: "www…" },
  { key: "contact_name", placeholder: "Jméno" },
  { key: "phone", placeholder: "+420…", mono: true },
  { key: "email", placeholder: "@" },
];

const STATUS_CLASS: Record<LeadStatus, string> = {
  nevolano: "text-muted-foreground",
  zavolat_pozdeji: "text-warning",
  domluvena_schuzka: "text-success",
  odmitnul: "text-destructive",
};

export function LeadsGrid({
  leads,
  onPatch,
  onDelete,
  onRequestFollowup,
  onRequestMeeting,
}: {
  leads: Lead[];
  onPatch: (id: string, patch: Partial<Lead>) => void;
  onDelete: (ids: string[]) => Promise<boolean>;
  onRequestFollowup: (lead: Lead) => void;
  onRequestMeeting: (lead: Lead) => void;
}) {
  const [noteLead, setNoteLead] = useState<Lead | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);

  const allSelected = leads.length > 0 && selected.length === leads.length;
  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const deleted = await onDelete(pendingDelete);
    if (deleted) {
      setSelected((prev) => prev.filter((id) => !pendingDelete.includes(id)));
    }
    setPendingDelete(null);
  };

  const focusCell = (row: number, col: number) => {
    const el = document.querySelector<HTMLInputElement>(
      `[data-cell="${row}-${col}"]`,
    );
    el?.focus();
    el?.select();
  };

  return (
    <>
    {selected.length > 0 ? (
      <div className="mb-4 flex items-center gap-3 rounded-[20px] border border-primary/40 bg-primary/5 px-5 py-3 text-sm">
        <span className="font-medium">Vybráno {selected.length}</span>
        <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
          Zrušit výběr
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="ml-auto"
          onClick={() => setPendingDelete(selected)}
        >
          <Trash2 className="size-4" />
          Smazat vybrané
        </Button>
      </div>
    ) : null}
    <div className="scroll-slim overflow-x-auto rounded-[20px] border border-border bg-surface">
      <div className="min-w-max">
        <div
           className="grid border-b border-grid-line bg-surface-2 text-[11px] font-semibold uppercase text-muted-foreground"
          style={{ gridTemplateColumns: COLUMNS }}
        >
          <div className="flex items-center gap-2 px-2.5 py-2.5">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(v) => setSelected(v ? leads.map((l) => l.id) : [])}
              aria-label="Vybrat vše"
            />
            <span>#</span>
          </div>
          {["Firma", "Web", "Kontakt", "Telefon", "E-mail", "Dovolal", "Stav", "Poznámka", "Follow-up", ""].map(
            (h, i) => (
              <div key={i} className="truncate px-2.5 py-2.5">
                {h}
              </div>
            ),
          )}
        </div>

        {leads.map((lead, rowIndex) => (
          <div
            key={lead.id}
            className="group grid min-h-11 items-center border-b border-grid-line last:border-b-0 hover:bg-surface-2/70"
            style={{ gridTemplateColumns: COLUMNS }}
          >
            <div className="flex items-center gap-2 px-2.5 font-mono text-[11px] text-muted-foreground">
              <Checkbox
                checked={selected.includes(lead.id)}
                onCheckedChange={() => toggle(lead.id)}
                aria-label="Vybrat řádek"
              />
              {rowIndex + 1}
            </div>

            {TEXT_COLS.map((col, colIndex) => (
              <input
                key={col.key}
                data-cell={`${rowIndex}-${colIndex}`}
                className={cn("grid-cell grid-cell-focus truncate", col.mono && "font-mono")}
                placeholder={col.placeholder}
                value={lead[col.key] ?? ""}
                onChange={(e) => onPatch(lead.id, { [col.key]: e.target.value } as Partial<Lead>)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    focusCell(rowIndex + 1, colIndex);
                  } else if (e.key === "ArrowUp" && e.altKey) {
                    e.preventDefault();
                    focusCell(rowIndex - 1, colIndex);
                  } else if (e.key === "ArrowDown" && e.altKey) {
                    e.preventDefault();
                    focusCell(rowIndex + 1, colIndex);
                  }
                }}
              />
            ))}

            <div className="flex justify-center px-2.5">
              <Switch
                checked={lead.call_answered}
                onCheckedChange={(v) => onPatch(lead.id, { call_answered: v })}
                aria-label="Dovolal se"
              />
            </div>

            <div className="px-1.5">
              <Select
                value={lead.status}
                onValueChange={(v) => {
                  const status = v as LeadStatus;
                  if (status === "domluvena_schuzka") {
                    onRequestMeeting(lead);
                    return;
                  }
                  onPatch(lead.id, { status });
                  if (status === "zavolat_pozdeji") {
                    onRequestFollowup({ ...lead, status });
                  }
                }}
              >
                <SelectTrigger
                  className={cn(
                    "h-7 w-full border-0 bg-transparent text-xs font-medium shadow-none focus-visible:ring-1",
                    STATUS_CLASS[lead.status],
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value} className="text-xs">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative flex items-center">
              <input
                data-cell={`${rowIndex}-5`}
                className="grid-cell grid-cell-focus pr-7"
                placeholder="Poznámka z hovoru…"
                value={lead.note ?? ""}
                onChange={(e) => onPatch(lead.id, { note: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    focusCell(rowIndex + 1, 5);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => setNoteLead(lead)}
                className="absolute right-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                aria-label="Rozbalit poznámku"
              >
                <Maximize2 className="size-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => onRequestFollowup(lead)}
              className={cn(
                "flex h-9 items-center gap-1.5 px-2.5 text-left text-xs hover:text-foreground",
                lead.followup_at ? "font-mono text-foreground" : "text-muted-foreground",
              )}
            >
              <CalendarClock className="size-3.5 shrink-0" />
              {lead.followup_at ? formatFollowup(lead.followup_at) : "Naplánovat"}
            </button>

            <button
              type="button"
              onClick={() => setPendingDelete([lead.id])}
              className="flex h-9 items-center justify-center text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              aria-label="Smazat řádek"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}

        {leads.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">
            Žádné kontakty. Naimportujte CSV nebo přidejte řádek.
          </div>
        ) : null}
      </div>

      <Dialog open={!!noteLead} onOpenChange={(o) => !o && setNoteLead(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Poznámka — {noteLead?.company_name || noteLead?.contact_name || "lead"}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            autoFocus
            rows={8}
            value={noteLead?.note ?? ""}
            onChange={(e) => {
              if (!noteLead) return;
              setNoteLead({ ...noteLead, note: e.target.value });
              onPatch(noteLead.id, { note: e.target.value });
            }}
          />
          <Button onClick={() => setNoteLead(null)}>Hotovo</Button>
        </DialogContent>
      </Dialog>
    </div>

    <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Smazat {pendingDelete?.length === 1 ? "kontakt" : `${pendingDelete?.length ?? 0} kontaktů`}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Tuto akci nelze vrátit zpět. Data budou trvale odstraněna.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Zrušit</AlertDialogCancel>
          <AlertDialogAction onClick={() => void confirmDelete()}>Smazat trvale</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}