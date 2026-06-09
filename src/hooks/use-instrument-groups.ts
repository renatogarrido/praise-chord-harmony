import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { MusicianGroup } from "@/lib/musician-roles";

type Kind = "instrument" | "vocal" | "technical";

export function useTaxonomyGroups(kind: Kind) {
  const [groups, setGroups] = useState<MusicianGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const catTable = kind === "instrument" ? "instrument_categories" : kind === "vocal" ? "vocal_categories" : "technical_categories";
  const itemTable = kind === "instrument" ? "instruments" : kind === "vocal" ? "vocals" : "technical_roles";

  const load = useCallback(async () => {
    setLoading(true);
    const { data: cats } = await supabase
      .from(catTable as any)
      .select("id,name,sort_order")
      .order("sort_order");
    const { data: items } = await supabase
      .from(itemTable as any)
      .select("category_id,value,label,sort_order")
      .order("sort_order");
    const byCat = new Map<string, { value: string; label: string }[]>();
    (items ?? []).forEach((i: any) => {
      const arr = byCat.get(i.category_id) ?? [];
      arr.push({ value: i.value, label: i.label });
      byCat.set(i.category_id, arr);
    });
    setGroups(
      (cats ?? []).map((c: any) => ({ label: c.name, options: byCat.get(c.id) ?? [] }))
    );
    setLoading(false);
  }, [catTable, itemTable]);

  useEffect(() => {
    load();
  }, [load]);

  return { groups, loading, reload: load };
}

export function useInstrumentGroups() {
  return useTaxonomyGroups("instrument");
}

export function useVocalGroups() {
  return useTaxonomyGroups("vocal");
}

export function useTechnicalGroups() {
  return useTaxonomyGroups("technical");
}
