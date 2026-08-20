export type DealStage =
  | "nova_schuzka"
  | "uvodni_probehla"
  | "v_jednani"
  | "nedostavil_se"
  | "vyhrano"
  | "prohrano";

export type Deal = {
  id: string;
  user_id: string;
  lead_id: string | null;
  caller_id: string | null;
  caller_name: string;
  company_name: string;
  website_url: string;
  contact_name: string;
  phone: string;
  email: string;
  cold_note: string;
  stage: DealStage;
  position: number;
  followup_at: string | null;
  followup_note: string;
  followup_done: boolean;
  created_at: string;
  updated_at: string;
};

export type DealNote = {
  id: string;
  deal_id: string;
  user_id: string;
  author: string;
  body: string;
  created_at: string;
};

export const STAGES: { value: DealStage; label: string; accent: string }[] = [
  { value: "nova_schuzka", label: "Nové / Schůzka domluvena", accent: "bg-primary" },
  { value: "uvodni_probehla", label: "Úvodní schůzka proběhla", accent: "bg-sky-500" },
  { value: "v_jednani", label: "V jednání / Nabídka", accent: "bg-warning" },
  { value: "nedostavil_se", label: "Nedostavil se", accent: "bg-muted-foreground" },
  { value: "vyhrano", label: "Vyhráno", accent: "bg-success" },
  { value: "prohrano", label: "Prohráno", accent: "bg-destructive" },
];

export const STAGE_LABEL = Object.fromEntries(
  STAGES.map((s) => [s.value, s.label]),
) as Record<DealStage, string>;

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

export function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function dealCalendarUrl(deal: {
  company_name: string;
  contact_name: string;
  phone: string;
  followup_note: string;
  followup_at: string | null;
}) {
  if (!deal.followup_at) return null;
  const start = new Date(deal.followup_at);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const who = deal.company_name?.trim() || deal.contact_name?.trim() || "kontakt";
  const details = [
    deal.followup_note?.trim() || null,
    deal.phone?.trim() ? `Telefon: ${deal.phone.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Follow-up: ${who}`,
    dates: `${toGoogleDate(start)}/${toGoogleDate(end)}`,
    details,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function isDueOrOverdue(iso: string | null): boolean {
  if (!iso) return false;
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return new Date(iso).getTime() <= end.getTime();
}

export const DEALS_CHANGED = "kylio:deals-changed";

export const DEFAULT_HOST = {
  name: "Šimon Dočkal",
  email: "dockal.digital@gmail.com",
};

export function meetingCalendarUrl(input: {
  company_name: string;
  contact_name: string;
  phone: string;
  website_url: string;
  startIso: string;
  endIso: string;
  guests: string[];
}) {
  const who = input.company_name?.trim() || input.contact_name?.trim() || "kontakt";
  const details = [
    input.contact_name?.trim() ? `Kontakt: ${input.contact_name.trim()}` : null,
    input.phone?.trim() ? `Telefon: ${input.phone.trim()}` : null,
    input.website_url?.trim() ? `Web: ${input.website_url.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Ukázka nové webové stránky (${who})`,
    dates: `${toGoogleDate(new Date(input.startIso))}/${toGoogleDate(new Date(input.endIso))}`,
    details,
  });
  input.guests.filter(Boolean).forEach((g) => params.append("add", g));
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function notifyDealsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DEALS_CHANGED));
}
