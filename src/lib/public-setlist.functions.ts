import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getPublicSetlist = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        token: z.string().min(8).max(128).regex(/^[a-zA-Z0-9_-]+$/),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: setlist, error } = await supabaseAdmin.rpc("get_public_setlist", {
      p_token: data.token,
    });

    if (error) throw new Error("Não foi possível carregar o repertório.");
    return setlist ?? null;
  });