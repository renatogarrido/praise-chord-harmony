import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { MusicianGroup } from "@/lib/musician-roles";

export function useInstrumentGroups() {
  const [groups, setGroups] = useState<MusicianGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: cats } = await supabase
      .from("instrument_categories")
      .select("id,name,sort_order")
      .order("sort_order");
    const { data: items } = await supabase
      .from("instruments")
      .select("category_id,value,label,sort_order")
      .order("sort_order");
    const byCat = new Map<string, { value: string; label: string }[]>();
    (items ?? []).forEach((i) => {
      const arr = byCat.get(i.category_id) ?? [];
      arr.push({ value: i.value, label: i.label });
      byCat.set(i.category_id, arr);
    });
    setGroups(
      (cats ?? []).map((c) => ({ label: c.name, options: byCat.get(c.id) ?? [] }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { groups, loading, reload: load };
}
