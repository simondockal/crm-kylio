import { useState, type KeyboardEvent } from "react";
import { CalendarClock, Check, Copy, Maximize2, PhoneMissed, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
  reengageState,
  type Lead,
  type LeadField,
  type LeadStatus,
} from "@/lib/leads";
import { useCallAttempts } from "@/hooks/use-call-attempts";

const COLUMNS = "76px 230px 190px 180px 150px 210px 96px 180px 280px 170px 44px";

const TEXT_COLS: {
  key: LeadField;
  placeholder: string;
  mono?: boolean;
  addMore?: boolean;
  copyable?: boolean;
}[] = [
  { key: "company_name", placeholder: "Název firmy", copyable: true },
  { key: "website_url", placeholder: "www…" },
  { key: "contact_name", placeholder: "Jméno", addMore: true },
  { key: "phone", placeholder: "+420…", mono: true, addMore: true, copyable: true },
  { key: "email", placeholder: "@" },
];

/** Note is the last keyboard-navigable cell, one past the last TEXT_COLS index. */
const LAST_COL_INDEX = TEXT_COLS.length;

const STATUS_CLASS: Record<LeadStatus, string> = {
  nevolano: "bg-muted text-muted-foreground",
  zavolat_pozdeji: "bg-warning/15 text-warning",
  domluvena_schuzka: "bg-success/15 text-success",
  odmitnul: "bg-destructive/15 text-destructive",
};

const STATUS_DOT_CLASS: Record<LeadStatus, string> = {
  nevolano: "bg-muted-foreground",
  zavolat_pozdeji: "bg-warning",
  domluvena_schuzka: "bg-success",
  odmitnul: "bg-destructive",
};

export function LeadsGrid({
  leads,
  onPatch,
  onDelete,
  onRequestFollowup,
  onRequestMeeting,
  onRequestReject,
}: {
  leads: Lead[];
  onPatch: (id: string, patch: Partial<Lead>) => void;
  onDelete: (ids: string[]) => Promise<boolean>;
  onRequestFollowup: (lead: Lead) => void;
  onRequestMeeting: (lead: Lead) => void;
  onRequestReject: (lead: Lead) => void;
}) {
  const [noteLead, setNoteLead] = useState<Lead | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const { attempts, bump, clear } = useCallAttempts();

  const copyValue = async (cellId: string, value: string) => {
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value.trim());
      setCopiedCell(cellId);
      setTimeout(() => setCopiedCell((c) => (c === cellId ? null : c)), 1200);
    } catch {
      toast.error("Kopírování se nezdařilo.");
    }
  };

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

  const focusCellAtEnd = (row: number, col: number) => {
    const el = document.querySelector<HTMLInputElement>(
      `[data-cell="${row}-${col}"]`,
    );
    el?.focus();
    el?.setSelectionRange(el.value.length, el.value.length);
  };

  const handleCellKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    row: number,
    col: number,
  ) => {
    const input = e.currentTarget;
    const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
    const atEnd =
      input.selectionStart === input.value.length && input.selectionEnd === input.value.length;

    if (e.key === "Enter") {
      e.preventDefault();
      focusCell(row + 1, col);
    } else if (e.key === "Escape") {
      input.blur();
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        if (col > 0) focusCell(row, col - 1);
        else if (row > 0) focusCell(row - 1, LAST_COL_INDEX);
      } else if (col < LAST_COL_INDEX) {
        focusCell(row, col + 1);
      } else {
        focusCell(row + 1, 0);
      }
    } else if (e.key === "ArrowUp" && e.altKey) {
      e.preventDefault();
      focusCell(row - 1, col);
    } else if (e.key === "ArrowDown" && e.altKey) {
      e.preventDefault();
      focusCell(row + 1, col);
    } else if (e.key === "ArrowLeft" && atStart && col > 0) {
      e.preventDefault();
      focusCellAtEnd(row, col - 1);
    } else if (e.key === "ArrowRight" && atEnd && col < LAST_COL_INDEX) {
      e.preventDefault();
      focusCell(row, col + 1);
    }
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
            className="group grid min-h-11 items-center border-b border-grid-line text-foreground last:border-b-0 hover:bg-surface-2/70"
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

            {TEXT_COLS.map((col, colIndex) => {
              const buttonCount = (col.addMore ? 1 : 0) + (col.copyable ? 1 : 0);
              const input = (
                <input
                  key={col.key}
                  data-cell={`${rowIndex}-${colIndex}`}
                  className={cn(
                    "grid-cell grid-cell-focus truncate",
                    col.mono && "font-mono",
                    buttonCount === 1 && "pr-7",
                    buttonCount === 2 && "pr-12",
                  )}
                  placeholder={col.placeholder}
                  value={lead[col.key] ?? ""}
                  onChange={(e) => onPatch(lead.id, { [col.key]: e.target.value } as Partial<Lead>)}
                  onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colIndex)}
                />
              );
              if (buttonCount === 0) return input;
              const cellId = `${lead.id}-${col.key}`;
              const isCopied = copiedCell === cellId;
              return (
                <div key={col.key} className="group/cell relative flex items-center">
                  {input}
                  <div className="absolute right-1.5 flex items-center gap-0.5">
                    {col.copyable ? (
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => void copyValue(cellId, lead[col.key] ?? "")}
                        title="Kopírovat"
                        className={cn(
                          "text-muted-foreground transition-opacity hover:text-foreground",
                          isCopied ? "text-success opacity-100" : "opacity-0 group-hover/cell:opacity-100",
                        )}
                      >
                        {isCopied ? (
                          <Check className="size-3.5" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </button>
                    ) : null}
                    {col.addMore ? (
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => {
                          const current = lead[col.key] ?? "";
                          const next = current.trim() ? `${current.trim()} / ` : "";
                          onPatch(lead.id, { [col.key]: next } as Partial<Lead>);
                          requestAnimationFrame(() => focusCellAtEnd(rowIndex, colIndex));
                        }}
                        title={col.key === "phone" ? "Přidat další číslo" : "Přidat další kontakt"}
                        className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/cell:opacity-100"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}

            <div className="flex items-center justify-center gap-1.5 px-2.5">
              <Switch
                checked={lead.call_answered}
                onCheckedChange={(v) => {
                  onPatch(lead.id, { call_answered: v });
                  if (v) clear(lead.id);
                }}
                aria-label="Dovolal se"
              />
              {!lead.call_answered ? (
                <button
                  type="button"
                  onClick={() => bump(lead.id)}
                  title="Zaznamenat nedovolaný pokus"
                  className={cn(
                    "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold transition-colors",
                    attempts[lead.id]
                      ? "bg-warning/15 text-warning hover:bg-warning/25"
                      : "text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100",
                  )}
                >
                  <PhoneMissed className="size-3" />
                  {attempts[lead.id] ? `${attempts[lead.id]}×` : null}
                </button>
              ) : null}
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
                  if (status === "odmitnul") {
                    onRequestReject(lead);
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
                    "h-6 w-fit max-w-full justify-start gap-1.5 rounded-full border-0 px-2.5 py-0 text-[11px] font-semibold shadow-none ring-offset-0 ring-current focus:ring-0 focus-visible:ring-1 focus-visible:ring-offset-0 [&>svg]:ml-1 [&>svg]:size-3",
                    STATUS_CLASS[lead.status],
                  )}
                >
                  <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT_CLASS[lead.status])} />
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
              {(() => {
                const state = reengageState(lead);
                if (!state) return null;
                return (
                  <span
                    className={cn(
                      "mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      state.ready
                        ? "bg-success/15 text-success"
                        : "bg-warning/15 text-warning",
                    )}
                    title={`Ve frontě od ${lead.rejected_at ? formatFollowup(lead.rejected_at) : "—"}`}
                  >
                    {state.label}
                  </span>
                );
              })()}
            </div>

            <div className="relative flex items-center">
              <input
                data-cell={`${rowIndex}-5`}
                className="grid-cell grid-cell-focus pr-7"
                placeholder="Poznámka z hovoru…"
                value={lead.note ?? ""}
                onChange={(e) => onPatch(lead.id, { note: e.target.value })}
                onKeyDown={(e) => handleCellKeyDown(e, rowIndex, 5)}
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
                "flex h-9 items-center gap-1.5 px-2.5 text-left text-xs text-muted-foreground hover:text-foreground",
                lead.followup_at && "font-mono",
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