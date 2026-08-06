import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Přihlášení — Kylio CRM" },
      { name: "description", content: "Přihlaste se do Kylio, tabulkového CRM pro cold calling." },
      { property: "og:title", content: "Přihlášení — Kylio CRM" },
      { property: "og:description", content: "Přihlaste se do svého Kylio účtu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentConfirmation, setSentConfirmation] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/leads", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/leads", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          setSentConfirmation(true);
          toast.success("Účet vytvořen — potvrďte e-mail v doručené poště.");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Něco se pokazilo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas-dark text-canvas-light">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>
      <main className="flex flex-1 items-center justify-center px-6 pb-24">
        <div className="w-full max-w-md rounded-[20px] bg-surface-elevated p-8 sm:p-10">
          <span className="font-display text-2xl font-semibold">
            Kylio<span className="text-primary">.</span>
          </span>
          <h1 className="mt-10 text-4xl font-medium leading-none">
            {mode === "signin" ? "Přihlášení" : "Vytvořit účet"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Zadejte e-mail a heslo a pokračujte k volání."
              : "Založte si účet a začněte importem kontaktů."}
          </p>

          {sentConfirmation ? (
            <div className="mt-6 rounded-lg border border-border bg-surface p-4 text-sm">
              Poslali jsme potvrzovací odkaz na <strong>{email}</strong>. Po
              potvrzení se můžete přihlásit.
            </div>
          ) : null}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Heslo</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full bg-canvas-light text-canvas-dark hover:bg-canvas-light/85" disabled={loading}>
              {loading ? "Pracuji…" : mode === "signin" ? "Přihlásit se" : "Vytvořit účet"}
            </Button>
          </form>

          <button
            type="button"
            className="mt-4 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setSentConfirmation(false);
            }}
          >
            {mode === "signin" ? "Nemáte účet? Zaregistrovat se" : "Už máte účet? Přihlásit se"}
          </button>
        </div>
      </main>
    </div>
  );
}