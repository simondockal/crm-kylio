import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "cold_caller";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
};

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin",
  cold_caller: "Cold Caller",
};

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const authUser = auth.user;
      if (!authUser) {
        if (active) {
          setUser(null);
          setLoading(false);
        }
        return;
      }
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("full_name, email").eq("id", authUser.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", authUser.id),
      ]);
      if (!active) return;
      const isAdmin = (roles ?? []).some((r) => r.role === "admin");
      setUser({
        id: authUser.id,
        email: profile?.email || authUser.email || "",
        fullName: profile?.full_name || (authUser.email ?? "").split("@")[0],
        role: isAdmin ? "admin" : "cold_caller",
      });
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return { user, loading, isAdmin: user?.role === "admin" };
}
