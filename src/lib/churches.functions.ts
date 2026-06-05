import { createServerFn } from "@tanstack/react-start";

export type ChurchOption = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string | null;
};

export const listChurchesPublic = createServerFn({ method: "GET" }).handler(
  async (): Promise<ChurchOption[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("churches")
      .select("id,name,city,state,country")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as ChurchOption[];
  }
);
