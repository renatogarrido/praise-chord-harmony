import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

export type ChurchOption = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string | null;
};

export const listChurchesPublic = createServerFn({ method: "GET" }).handler(
  async (): Promise<ChurchOption[]> => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !publishableKey) throw new Error("Configuração do servidor indisponível.");

    const supabase = createClient(supabaseUrl, publishableKey);
    const { data, error } = await supabase
      .from("churches")
      .select("id,name,city,state,country")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as ChurchOption[];
  }
);
