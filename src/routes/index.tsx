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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
    <div className="dark-canvas min-h-screen bg-canvas-dark text-canvas-light">
      <header className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">
        <span className="font-display text-xl font-semibold">
          Kylio<span className="text-primary">.</span>
        </span>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button asChild variant="secondary" size="sm">
            <Link to={signedIn ? "/leads" : "/auth"}>{signedIn ? "Otevřít CRM" : "Přihlásit se"}</Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-6 pb-28 pt-20 lg:px-10 lg:pb-32 lg:pt-28">
        <p className="text-sm font-semibold text-on-dark-mute">
          Cold calling CRM
        </p>
        <h1 className="mt-5 max-w-5xl text-5xl font-medium leading-none sm:text-7xl lg:text-[104px]">
          Volejte rychleji.<br />Prodávejte chytřeji.
        </h1>
        <p className="mt-8 max-w-xl text-lg leading-relaxed text-on-dark-mute">
          Žádné klikací peklo. Jeden řádek = jeden lead. Zapisuješ během hovoru,
          všechno se ukládá samo.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg" className="bg-canvas-light text-canvas-dark hover:bg-canvas-light/85">
            <Link to={signedIn ? "/leads" : "/auth"}>
              {signedIn ? "Otevřít CRM" : "Začít volat"}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        </section>
        <section className="light-workspace bg-canvas-light px-6 py-20 text-foreground lg:px-10 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-[20px] border border-border bg-surface p-8">
              <f.icon className="size-6 text-primary" />
              <h2 className="mt-12 text-xl font-medium">{f.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div></section>
      </main>
    </div>
  );
}
