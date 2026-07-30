import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, PhoneCall, Table2, CalendarClock, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kylio — tabulkové CRM pro cold calling" },
      {
        name: "description",
        content:
          "Volejte rychleji. Kylio je minimalistické tabulkové CRM: import CSV z Merku, inline editace, stavy hovorů a follow-upy v Google Kalendáři.",
      },
      { property: "og:title", content: "Kylio — tabulkové CRM pro cold calling" },
      {
        property: "og:description",
        content: "Import CSV, inline editace jako v Excelu, stavy hovorů a follow-upy.",
      },
    ],
  }),
  component: Index,
});

const FEATURES = [
  { icon: Table2, title: "Tabulka jako Excel", text: "Klikni do buňky a piš. Enter a Tab tě posunou dál." },
  { icon: Upload, title: "Import z Merku", text: "Nahraj CSV a namapuj sloupce během pár vteřin." },
  { icon: PhoneCall, title: "Stavy hovorů", text: "Dovolal se / nedovolal, odmítnul, schůzka — jedním klikem." },
  { icon: CalendarClock, title: "Follow-up", text: "Zavolat později? Termín putuje rovnou do Google Kalendáře." },
];

function Index() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setSignedIn(!!session),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="font-display text-lg font-bold tracking-tight">
          Kylio<span className="text-primary">.</span>
        </span>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm">
            <Link to={signedIn ? "/leads" : "/auth"}>{signedIn ? "Otevřít CRM" : "Přihlásit se"}</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24 pt-16">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
          Cold calling CRM
        </p>
        <h1 className="mt-4 max-w-2xl text-5xl font-bold leading-[1.05] sm:text-6xl">
          Tabulka, která drží
          <br />
          tempo tvého telefonu.
        </h1>
        <p className="mt-6 max-w-xl text-base text-muted-foreground">
          Žádné klikací peklo. Jeden řádek = jeden lead. Zapisuješ během hovoru,
          všechno se ukládá samo.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to={signedIn ? "/leads" : "/auth"}>
              {signedIn ? "Otevřít CRM" : "Začít volat"}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-20 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-surface p-6">
              <f.icon className="size-5 text-primary" />
              <h2 className="mt-4 text-base font-semibold">{f.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
