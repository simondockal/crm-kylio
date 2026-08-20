import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { LeadList } from "@/lib/leads";

/** Loads the custom lead lists (worksheet tabs) of a given owner. */
export function useLeadLists(ownerId: string | null) {
  const [lists, setLists] = useState<LeadList[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!ownerId) {
      setLists([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("lead_lists")
      .select("*")
      .eq("user_id", ownerId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    setLists((data ?? []) as LeadList[]);
    setLoading(false);
  }, [ownerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createList = useCallback(
    async (name: string) => {
      if (!ownerId) return null;
      const { data, error } = await supabase
        .from("lead_lists")
        .insert({ user_id: ownerId, name, position: Date.now() })
        .select()
        .single();
      if (error || !data) return null;
      const created = data as LeadList;
      setLists((prev) => [...prev, created]);
      return created;
    },
    [ownerId],
  );

  const renameList = useCallback(async (id: string, name: string) => {
    setLists((prev) => prev.map((l) => (l.id === id ? { ...l, name } : l)));
    await supabase.from("lead_lists").update({ name }).eq("id", id);
  }, []);

  const deleteList = useCallback(async (id: string) => {
    setLists((prev) => prev.filter((l) => l.id !== id));
    await supabase.from("lead_lists").delete().eq("id", id);
  }, []);

  return { lists, loading, reload: load, createList, renameList, deleteList };
}