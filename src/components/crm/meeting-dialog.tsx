import { useEffect, useState } from "react";
import { CalendarPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fromLocalInputValue, toLocalInputValue } from "@/lib/leads";
import { DEFAULT_HOST, meetingCalendarUrl } from "@/lib/deals";

export type MeetingTarget = {
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  website_url: string;
  note: string;
};

export type MeetingResult = {
  startIso: string;
  endIso: string;
  notes: string;
  clientEmail: string;
  guests: string[];
};

function plusMinutes(value: string, minutes: number) {
  const d = value ? new Date(value) : new Date();
  return toLocalInputValue(new Date(d.getTime() + minutes * 60000).toISOString());
}

export function MeetingDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: MeetingTarget | null;
  onClose: () => void;
  onConfirm: (result: MeetingResult) => void | Promise<void>;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [hostIncluded, setHostIncluded] = useState(true);
  const [mode, setMode] = useState<"lead" | "manual">("lead");
  const [manualEmail, setManualEmail] = useState("");

  useEffect(() => {
    if (!target) return;
    const base = new Date(Date.now() + 24 * 60 * 60 * 1000);
    base.setMinutes(0, 0, 0);
    const s = toLocalInputValue(base.toISOString());
    setStart(s);
    setEnd(plusMinutes(s, 60));
    setNotes("");
    setHostIncluded(true);
    setMode(target.email?.trim() ? "lead" : "manual");
    setManualEmail("");
  }, [target]);

  if (!target) return null;

  const clientEmail = (mode === "lead" ? target.email : manualEmail).trim();
  const guests = [hostIncluded ? DEFAULT_HOST.email : null, clientEmail || null].filter(
    Boolean,
  ) as string[];

  const submit = async () => {
    const startIso = fromLocalInputValue(start);
    const endIso = fromLocalInputValue(end) ?? (startIso ? new Date(new Date(startIso).getTime() + 3600000).toISOString() : null);
    if (!startIso || !endIso) return;
    const url = meetingCalendarUrl({
      ...target,
      startIso,
      endIso,
      guests,
    });
    window.open(url, "_blank", "noopener");
    await onConfirm({ startIso, endIso, notes, clientEmail, guests });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Naplánovat schůzku</DialogTitle>
          <DialogDescription>
            {target.company_name || target.contact_name || "Kontakt"} — vytvoří událost v Google Kalendáři.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Začátek</Label>
              <Input
                type="datetime-local"
                className="h-9"
                value={start}
                onChange={(e) => {
                  setStart(e.target.value);
                  setEnd(plusMinutes(e.target.value, 60));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Konec</Label>
              <Input
                type="datetime-local"
                className="h-9"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-surface-2 p-3">
            <Label className="text-xs">Účastníci</Label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={hostIncluded}
                onCheckedChange={(v) => setHostIncluded(!!v)}
              />
              <span>
                {DEFAULT_HOST.name}{" "}
                <span className="font-mono text-xs text-muted-foreground">
                  {DEFAULT_HOST.email}
                </span>
              </span>
            </label>

            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  className="accent-primary"
                  checked={mode === "lead"}
                  onChange={() => setMode("lead")}
                  disabled={!target.email?.trim()}
                />
                <span>
                  E-mail z řádku{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    {target.email?.trim() || "— není vyplněn"}
                  </span>
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  className="accent-primary"
                  checked={mode === "manual"}
                  onChange={() => setMode("manual")}
                />
                <span>Jiný e-mail</span>
              </label>
              {mode === "manual" ? (
                <Input
                  className="h-9"
                  type="email"
                  placeholder="klient@firma.cz"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                />
              ) : null}
            </div>

            {guests.length ? (
              <p className="flex flex-wrap gap-1 pt-1">
                {guests.map((g) => (
                  <span
                    key={g}
                    className="rounded-md bg-primary/15 px-1.5 py-0.5 font-mono text-[11px] text-primary"
                  >
                    {g}
                  </span>
                ))}
              </p>
            ) : (
              <p className="flex items-center gap-1 pt-1 text-[11px] text-muted-foreground">
                <X className="size-3" /> Bez hostů
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Interní poznámka k dealu (nejde do kalendáře)</Label>
            <Textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Interní poznámka — do Google události se nepropíše…"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={onClose}>
            Zrušit
          </Button>
          <Button onClick={() => void submit()} disabled={!start}>
            <CalendarPlus className="size-4" />
            Vytvořit v Google Kalendáři
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
