import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { FollowupBanner } from "@/components/crm/followup-banner";
import { ROLE_LABEL, useCurrentUser } from "@/hooks/use-current-user";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/leads", label: "Cold Calling", adminOnly: false },
  { to: "/pipeline", label: "Sales Pipeline", adminOnly: true },
  { to: "/reporting", label: "Reporting & Analytics", adminOnly: true },
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
  const { user, isAdmin } = useCurrentUser();

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-canvas-light">
      <header className="dark-canvas sticky top-0 z-20 bg-canvas-dark text-canvas-light">
        <div className="flex min-h-16 flex-wrap items-center gap-4 px-6 py-3 lg:px-8">
          <span className="font-display text-xl font-semibold">
            Kylio<span className="text-primary">.</span>
          </span>
          <nav className="scroll-slim flex items-center gap-1 overflow-x-auto rounded-full bg-surface-elevated p-1">
            {TABS.filter((t) => !t.adminOnly || isAdmin).map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className="rounded-full px-4 py-2 text-xs font-semibold text-on-dark-mute transition-colors hover:text-canvas-light data-[status=active]:bg-canvas-light data-[status=active]:text-canvas-dark"
              >
                {t.label}
              </Link>
            ))}
          </nav>
          {actions ? <div className={cn("flex flex-1 items-center gap-2")}>{actions}</div> : null}
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <div className="mr-1 hidden text-right leading-tight sm:block">
                <div className="text-xs font-medium">{user.fullName}</div>
                <div className="text-[11px] text-on-dark-mute">{ROLE_LABEL[user.role]}</div>
              </div>
            ) : null}
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Odhlásit se">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
        {filters}
        <FollowupBanner />
      </header>
      <main className="min-h-[calc(100vh-4rem)] bg-background p-4 text-foreground sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
