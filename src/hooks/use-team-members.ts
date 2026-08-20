import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/use-current-user";

export type TeamMember = {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
};

/** Loads all team members (admins + cold callers). Only admins can read every profile. */
export function useTeamMembers(enabled: boolean) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setMembers([]);
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, email, full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (!active) return;
      const roleMap = new Map<string, AppRole>();
      (roles ?? []).forEach((r) => {
        if (r.role === "admin") roleMap.set(r.user_id, "admin");
        else if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, "cold_caller");
      });
      setMembers(
        (profiles ?? [])
          .map((p) => ({
            id: p.id,
            email: p.email ?? "",
            fullName: p.full_name || (p.email ?? "").split("@")[0],
            role: roleMap.get(p.id) ?? ("cold_caller" as AppRole),
          }))
          .sort((a, b) => a.fullName.localeCompare(b.fullName, "cs")),
      );
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [enabled]);

  return { members, loading };
}
