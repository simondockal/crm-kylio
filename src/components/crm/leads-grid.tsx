import { useState } from "react";
import { CalendarClock, Maximize2, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

const COLUMNS = "44px 230px 190px 180px 150px 210px 96px 180px 280px 170px 44px";

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
}: {
  leads: Lead[];
  onPatch: (id: string, patch: Partial<Lead>) => void;
  onDelete: (id: string) => void;
  onRequestFollowup: (lead: Lead) => void;
}) {
  const [noteLead, setNoteLead] = useState<Lead | null>(null);

  const focusCell = (row: number, col: number) => {
    const el = document.querySelector<HTMLInputElement>(
      `[data-cell="${row}-${col}"]`,
    );
    el?.focus();
    el?.select();
  };

  return (
    <div className="scroll-slim overflow-x-auto rounded-xl border border-border bg-surface">
      <div className="min-w-max">
        <div
          className="grid border-b border-grid-line bg-surface-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
          style={{ gridTemplateColumns: COLUMNS }}
        >
          {["#", "Firma", "Web", "Kontakt", "Telefon", "E-mail", "Dovolal", "Stav", "Poznámka", "Follow-up", ""].map(
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
            className="group grid items-center border-b border-grid-line last:border-b-0 hover:bg-surface-2/60"
            style={{ gridTemplateColumns: COLUMNS }}
          >
            <div className="px-2.5 font-mono text-[11px] text-muted-foreground">
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
                  onPatch(lead.id, { status });
                  if (status === "zavolat_pozdeji") {
                    onRequestFollowup({ ...lead, status });
                  }
                }}
              >
                <SelectTrigger
                  size="sm"
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
              onClick={() => onDelete(lead.id)}
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
  );
}