import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, CalendarClock, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEALS_CHANGED,
  formatDateTime,
  notifyDealsChanged,
  type Deal,
} from "@/lib/deals";
import { fromLocalInputValue, toLocalInputValue } from "@/lib/leads";

export function FollowupBanner() {
  const [due, setDue] = useState<Deal[]>([]);
  const [open, setOpen] = useState(true);
  const [reschedule, setReschedule] = useState<Deal | null>(null);
  const [value, setValue] = useState("");

  const load = useCallback(async () => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const { data } = await supabase
      .from("deals")
      .select("*")
      .eq("followup_done", false)
      .not("followup_at", "is", null)
      .lte("followup_at", end.toISOString())
      .order("followup_at", { ascending: true });
    setDue((data ?? []) as Deal[]);
  }, []);

  useEffect(() => {
    void load();
    const handler = () => void load();
    window.addEventListener(DEALS_CHANGED, handler);
    return () => window.removeEventListener(DEALS_CHANGED, handler);
  }, [load]);

  const markDone = async (deal: Deal) => {
    setDue((prev) => prev.filter((d) => d.id !== deal.id));
    const { error } = await supabase
      .from("deals")
      .update({ followup_done: true })
      .eq("id", deal.id);
    if (error) {
      toast.error("Nepodařilo se uložit.");
      void load();
      return;
    }
    toast.success("Follow-up vyřízen.");
    notifyDealsChanged();
  };

  const saveReschedule = async () => {
    if (!reschedule) return;
    const iso = fromLocalInputValue(value);
    const { error } = await supabase
      .from("deals")
      .update({ followup_at: iso, followup_done: false })
      .eq("id", reschedule.id);
    if (error) toast.error("Nepodařilo se uložit.");
    else toast.success("Termín přeložen.");
    setReschedule(null);
    void load();
    notifyDealsChanged();
  };

  if (due.length === 0) return null;

  return (
    <>
      <div className="border-b border-warning/40 bg-warning/10">
        <div className="flex flex-wrap items-center gap-3 px-5 py-2 text-sm">
          <AlertCircle className="size-4 shrink-0 text-warning" />
          <span className="font-medium">
            Dnešní follow-upy: <span className="font-mono">{due.length}</span>
          </span>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            {open ? "Skrýt seznam" : "Zobrazit seznam"}
          </button>
          <Link
            to="/pipeline"
            className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Otevřít pipeline
          </Link>
        </div>

        {open ? (
          <ul className="space-y-1 px-5 pb-2">
            {due.map((d) => {
              const overdue = new Date(d.followup_at!).getTime() < Date.now();
              return (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center gap-2 rounded-md bg-surface px-3 py-1.5 text-xs"
                >
                  <CalendarClock
                    className={overdue ? "size-3.5 text-destructive" : "size-3.5 text-warning"}
                  />
                  <span className="font-medium">
                    {d.company_name || d.contact_name || "Kontakt"}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {formatDateTime(d.followup_at)}
                  </span>
                  {d.followup_note ? (
                    <span className="truncate text-muted-foreground">— {d.followup_note}</span>
                  ) : null}
                  <div className="ml-auto flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => {
                      setReschedule(d);
                      setValue(toLocalInputValue(d.followup_at));
                    }}>
                      Přeložit
                    </Button>
                    <Button size="sm" className="h-7 px-2" onClick={() => void markDone(d)}>
                      <Check className="size-3.5" />
                      Hotovo
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <Dialog open={!!reschedule} onOpenChange={(o) => !o && setReschedule(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Přeložit follow-up</DialogTitle>
          </DialogHeader>
          <Input
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReschedule(null)}>
              <X className="size-4" />
              Zrušit
            </Button>
            <Button onClick={() => void saveReschedule()} disabled={!value}>
              Uložit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
