export type LeadStatus =
  | "nevolano"
  | "zavolat_pozdeji"
  | "domluvena_schuzka"
  | "odmitnul";

export type Lead = {
  id: string;
  user_id: string;
  company_name: string;
  website_url: string;
  contact_name: string;
  phone: string;
  email: string;
  call_answered: boolean;
  status: LeadStatus;
  note: string;
  followup_at: string | null;
  list_id: string | null;
  rejected_at: string | null;
  reengage_at: string | null;
  previous_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadList = {
  id: string;
  user_id: string;
  name: string;
  position: number;
  created_at: string;
};

export type LeadEvent = {
  id: string;
  lead_id: string | null;
  deal_id: string | null;
  actor_id: string | null;
  actor_name: string;
  type: string;
  detail: string;
  created_at: string;
};

export const LEAD_EVENT_LABEL: Record<string, string> = {
  created: "Vytvořeno",
  booked: "Schůzka domluvena",
  rejected: "Odmítnuto",
  no_show: "Nedostavil se",
  rebooked: "Přebukováno",
  note: "Poznámka",
};

/** Re-engagement cooldown state for a rejected lead. */
export function reengageState(lead: Pick<Lead, "reengage_at">): {
  ready: boolean;
  label: string;
} | null {
  if (!lead.reengage_at) return null;
  const target = new Date(lead.reengage_at).getTime();
  const diff = target - Date.now();
  if (diff <= 0) return { ready: true, label: "Připraveno k obvolání" };
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(hours / 24);
  return {
    ready: false,
    label: days > 0 ? `Zbývá ${days} d ${hours % 24} h` : `Zbývá ${hours} h`,
  };
}

export const STATUSES: { value: LeadStatus; label: string; tone: string }[] = [
  { value: "nevolano", label: "Nevoláno", tone: "muted" },
  { value: "zavolat_pozdeji", label: "Zavolat později", tone: "warning" },
  { value: "domluvena_schuzka", label: "Domluvená schůzka", tone: "success" },
  { value: "odmitnul", label: "Odmítnul", tone: "destructive" },
];

export const STATUS_LABEL: Record<LeadStatus, string> = Object.fromEntries(
  STATUSES.map((s) => [s.value, s.label]),
) as Record<LeadStatus, string>;

export const FIELD_LABELS: { key: LeadField; label: string }[] = [
  { key: "company_name", label: "Název firmy" },
  { key: "website_url", label: "Web" },
  { key: "contact_name", label: "Kontaktní osoba" },
  { key: "phone", label: "Telefon" },
  { key: "email", label: "E-mail" },
  { key: "note", label: "Poznámka" },
];

export type LeadField =
  | "company_name"
  | "website_url"
  | "contact_name"
  | "phone"
  | "email"
  | "note";

/** Minimal RFC4180-ish CSV parser supporting quotes, commas, semicolons and tabs. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(clean);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (inQuotes) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const counts = [",", ";", "\t"].map((d) => ({
    d,
    n: firstLine.split(d).length,
  }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 1 ? counts[0].d : ",";
}

const AUTO_MAP: Record<LeadField, string[]> = {
  company_name: ["nazev", "název", "firma", "company", "obchodni", "obchodní", "jmeno firmy", "legal"],
  website_url: ["web", "www", "url", "stranky", "stránky", "domain"],
  contact_name: ["kontakt", "osoba", "jednatel", "majitel", "owner", "contact", "jmeno", "jméno"],
  phone: ["telefon", "tel", "phone", "mobil"],
  email: ["email", "e-mail", "mail"],
  note: ["poznamka", "poznámka", "note", "popis"],
};

export function guessMapping(headers: string[]): Record<LeadField, number> {
  const result = {} as Record<LeadField, number>;
  const norm = headers.map((h) => h.toLowerCase().trim());
  (Object.keys(AUTO_MAP) as LeadField[]).forEach((field) => {
    const idx = norm.findIndex((h) =>
      AUTO_MAP[field].some((needle) => h.includes(needle)),
    );
    result[field] = idx;
  });
  return result;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toGoogleDate(date: Date) {
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

export function googleCalendarUrl(lead: {
  company_name: string;
  contact_name: string;
  phone: string;
  note: string;
  followup_at: string | null;
}) {
  if (!lead.followup_at) return null;
  const start = new Date(lead.followup_at);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const who = lead.contact_name?.trim() || lead.company_name?.trim() || "kontakt";
  const details = [
    lead.note?.trim() ? `Poznámka: ${lead.note.trim()}` : null,
    lead.phone?.trim() ? `Telefon: ${lead.phone.trim()}` : null,
    lead.company_name?.trim() ? `Firma: ${lead.company_name.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Zavolat: ${who}`,
    dates: `${toGoogleDate(start)}/${toGoogleDate(end)}`,
    details,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Converts an ISO timestamp to the value format of <input type="datetime-local">. */
export function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInputValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatFollowup(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}