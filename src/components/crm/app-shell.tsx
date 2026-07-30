import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { FollowupBanner } from "@/components/crm/followup-banner";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/leads", label: "Cold Calling" },
  { to: "/pipeline", label: "Sales Pipeline" },
] as const;

export function AppShell({
  actions,
  filters,
  children,
}: {
  actions?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3 px-5 py-3">
          <span className="font-display text-base font-bold tracking-tight">
            Kylio<span className="text-primary">.</span>
          </span>
          <nav className="flex items-center gap-1 rounded-lg bg-surface-2 p-1">
            {TABS.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
              >
                {t.label}
              </Link>
            ))}
          </nav>
          {actions ? <div className={cn("flex flex-1 items-center gap-2")}>{actions}</div> : null}
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Odhlásit se">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
        {filters}
        <FollowupBanner />
      </header>
      <main className="p-5">{children}</main>
    </div>
  );
}
