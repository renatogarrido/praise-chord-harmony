import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://cifraspraise.com.br",
  "https://www.cifraspraise.com.br",
  "https://praise-chord-harmony.lovable.app",
]);

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://cifraspraise.com.br",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify if requester is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user: requester }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !requester) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", requester.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, password, fullName, churchName, role } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Create the user in Auth
    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, church_name: churchName },
    });

    if (authError) throw authError;

    const userId = authData.user.id;

    // 2. Profile and role should be handled by triggers, but let's be safe and update if needed
    // The handle_new_user_role trigger will add 'user' role automatically.
    // If the admin chose 'admin', we add it.
    if (role === "admin") {
      const { error: roleError } = await supabaseClient
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });
      if (roleError) console.error("Error setting admin role:", roleError);
    }

    // Update profile with church_name if trigger didn't catch metadata (sometimes it takes a sec)
    await supabaseClient
      .from("profiles")
      .update({ full_name: fullName, church_name: churchName })
      .eq("id", userId);

    return new Response(JSON.stringify({ user: authData.user }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[create-user-admin] request failed", error);
    return new Response(JSON.stringify({ error: "Não foi possível criar o usuário." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
