import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FIELD_LABELS, guessMapping, parseCsv, type LeadField } from "@/lib/leads";

export type ImportRow = Record<LeadField, string>;
export type DuplicateMode = "skip" | "update";

export function ImportCsvDialog({
  onImport,
  existingNames,
}: {
  onImport: (rows: ImportRow[], mode: DuplicateMode) => Promise<void>;
  existingNames: string[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<LeadField, number>>(
    {} as Record<LeadField, number>,
  );
  const [hasHeader, setHasHeader] = useState(true);
  const [dupMode, setDupMode] = useState<DuplicateMode>("skip");
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length === 0) {
      toast.error("Soubor je prázdný.");
      return;
    }
    const head = parsed[0];
    setHeaders(head);
    setRows(parsed.slice(1));
    setMapping(guessMapping(head));
    setHasHeader(true);
    setOpen(true);
  };

  const dataRows = hasHeader ? rows : [headers, ...rows];

  const mapRows = (): ImportRow[] =>
    dataRows.map((r) => {
      const out = {} as ImportRow;
      FIELD_LABELS.forEach(({ key }) => {
        const idx = mapping[key];
        out[key] = idx >= 0 && r[idx] ? r[idx].trim() : "";
      });
      return out;
    });

  const existing = new Set(existingNames.map((n) => n.trim().toLowerCase()).filter(Boolean));
  const preview = mapRows().filter((r) => Object.values(r).some((v) => v.trim() !== ""));
  const duplicates = preview.filter((r) =>
    existing.has(r.company_name.trim().toLowerCase()),
  ).length;
  const fresh = preview.length - duplicates;

  const runImport = async () => {
    const usable = preview;
    if (usable.length === 0) {
      toast.error("Nenamapovali jste žádná data.");
      return;
    }
    setBusy(true);
    try {
      await onImport(usable, dupMode);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv,text/plain"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        <Upload className="size-4" />
        Import CSV
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Mapování sloupců</DialogTitle>
            <DialogDescription>
              Přiřaďte sloupce z vašeho CSV (např. export z Merku) k polím v CRM.
            </DialogDescription>
          </DialogHeader>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hasHeader}
              onChange={(e) => setHasHeader(e.target.checked)}
              className="size-4 accent-primary"
            />
            První řádek obsahuje názvy sloupců
          </label>

          <div className="grid max-h-[45vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
            {FIELD_LABELS.map(({ key, label }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Select
                  value={String(mapping[key] ?? -1)}
                  onValueChange={(v) =>
                    setMapping((m) => ({ ...m, [key]: Number(v) }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-1">— nemapovat —</SelectItem>
                    {headers.map((h, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {hasHeader ? h || `Sloupec ${i + 1}` : `Sloupec ${i + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-surface-2 p-3">
            <Label className="text-xs">
              Duplicity podle názvu firmy (bez ohledu na velikost písmen)
            </Label>
            <Select value={dupMode} onValueChange={(v) => setDupMode(v as DuplicateMode)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skip">Přeskočit duplicitní záznamy</SelectItem>
                <SelectItem value="update">Aktualizovat stávající data</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Nových kontaktů: <strong>{fresh}</strong> · duplicit:{" "}
              <strong>{duplicates}</strong>
            </p>
          </div>

          <DialogFooter className="items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">
              {preview.length} řádků k importu
            </span>
            <Button onClick={runImport} disabled={busy}>
              {busy ? "Importuji…" : "Importovat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}