import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


const MANAGER_ROLES = ["admin", "lider_nacional", "lider_estadual", "lider_local"] as const;

async function assertCanManage(supabase: any, callerId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .in("role", MANAGER_ROLES as unknown as string[]);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Acesso negado: apenas administradores e líderes podem gerenciar a escala.");
  }
}

// ---------- LIST ----------
export const listSchedules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("worship_schedules")
      .select("id, title, service_date, church_name, setlist_id, setlist_name, notes, worship_schedule_assignments(id, user_id, role_label)")
      .order("service_date", { ascending: false });
    if (error) throw new Error(error.message);
    return { schedules: data ?? [] };
  });

// ---------- GET ONE ----------
export const getSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: schedule, error } = await supabase
      .from("worship_schedules")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!schedule) throw new Error("Escala não encontrada.");

    const { data: assignments } = await supabase
      .from("worship_schedule_assignments")
      .select("id, user_id, role_label")
      .eq("schedule_id", data.id);

    const userIds = (assignments ?? []).map((a: any) => a.user_id);
    let profileMap = new Map<string, { full_name: string | null; church_name: string | null }>();
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, church_name")
        .in("id", userIds);
      (profs ?? []).forEach((p: any) => profileMap.set(p.id, { full_name: p.full_name, church_name: p.church_name }));
    }

    // Fetch setlist songs via admin (setlist owner-only RLS)
    let setlistSongs: any[] = [];
    if (schedule.setlist_id) {
      const { data: ss } = await supabaseAdmin
        .from("setlist_songs")
        .select("id, position, custom_key, songs(id, title, original_key)")
        .eq("setlist_id", schedule.setlist_id)
        .order("position");
      setlistSongs = ss ?? [];
    }

    return {
      schedule,
      assignments: (assignments ?? []).map((a: any) => ({
        ...a,
        full_name: profileMap.get(a.user_id)?.full_name ?? null,
        church_name: profileMap.get(a.user_id)?.church_name ?? null,
      })),
      setlistSongs,
    };
  });

// ---------- CREATE ----------
export const createSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      title: z.string().min(1).max(255),
      serviceDate: z.string().min(8).max(64),
      notes: z.string().max(2000).optional().nullable(),
      churchName: z.string().max(255).optional().nullable(),
      setlistId: z.string().uuid().optional().nullable(),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);

    let setlistName: string | null = null;
    if (data.setlistId) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: sl } = await supabaseAdmin.from("setlists").select("name").eq("id", data.setlistId).maybeSingle();
      setlistName = sl?.name ?? null;
    }

    const { data: created, error } = await supabase
      .from("worship_schedules")
      .insert({
        title: data.title,
        service_date: data.serviceDate,
        notes: data.notes || null,
        church_name: data.churchName || null,
        setlist_id: data.setlistId || null,
        setlist_name: setlistName,
        created_by: userId,
      } as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created!.id };
  });

// ---------- UPDATE ----------
export const updateSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(255),
      serviceDate: z.string().min(8).max(64),
      notes: z.string().max(2000).optional().nullable(),
      churchName: z.string().max(255).optional().nullable(),
      setlistId: z.string().uuid().optional().nullable(),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);

    let setlistName: string | null = null;
    if (data.setlistId) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: sl } = await supabaseAdmin.from("setlists").select("name").eq("id", data.setlistId).maybeSingle();
      setlistName = sl?.name ?? null;
    }

    const { error } = await supabase
      .from("worship_schedules")
      .update({
        title: data.title,
        service_date: data.serviceDate,
        notes: data.notes || null,
        church_name: data.churchName || null,
        setlist_id: data.setlistId || null,
        setlist_name: setlistName,
      } as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- DELETE ----------
export const deleteSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const { error } = await supabase.from("worship_schedules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- LIST USERS for assignment picker ----------
export const listAssignableUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, church_name, instruments, vocal_types")
      .order("full_name", { ascending: true });
    if (error) throw new Error(error.message);
    return { users: data ?? [] };
  });

// ---------- ASSIGN (and email) ----------
export const assignUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      scheduleId: z.string().uuid(),
      userId: z.string().uuid(),
      roleLabel: z.string().min(1).max(120),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId: callerId } = context;
    await assertCanManage(supabase, callerId);

    const { error } = await supabase
      .from("worship_schedule_assignments")
      .insert({ schedule_id: data.scheduleId, user_id: data.userId, role_label: data.roleLabel } as any);
    if (error) {
      if (error.code === "23505") throw new Error("Esse usuário já está escalado para essa função.");
      throw new Error(error.message);
    }

    // Send email (best-effort; do not fail the assignment if email fails)
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: schedule } = await supabaseAdmin
        .from("worship_schedules")
        .select("title, service_date, notes, setlist_name")
        .eq("id", data.scheduleId)
        .maybeSingle();
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("full_name").eq("id", data.userId).maybeSingle();
      const { data: userRow } = await supabaseAdmin.auth.admin.getUserById(data.userId);
      const email = userRow?.user?.email;
      if (email && schedule) {
        const formattedDate = new Date(schedule.service_date as any).toLocaleString("pt-BR", {
          dateStyle: "full", timeStyle: "short",
        });
        const origin = process.env.SITE_URL || "https://cifraspraise.com.br";
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          console.error("Missing email service API key");
          return { ok: true };
        }
        await fetch(`${origin}/lovable/email/transactional/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },

          body: JSON.stringify({
            templateName: "worship-schedule-assignment",
            recipientEmail: email,
            idempotencyKey: `assign-${data.scheduleId}-${data.userId}-${data.roleLabel}`,
            templateData: {
              recipientName: profile?.full_name ?? "Olá",
              scheduleTitle: schedule.title,
              serviceDate: formattedDate,
              roleLabel: data.roleLabel,
              setlistName: schedule.setlist_name ?? undefined,
              notes: schedule.notes ?? undefined,
              scheduleUrl: `${origin}/app/scale/${data.scheduleId}`,
              siteName: "Cifras Praise",
            },
          }),
        });
      }
    } catch (e) {
      console.error("Failed to send assignment email", e);
    }

    return { ok: true };
  });

// ---------- UNASSIGN ----------
export const unassignUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ assignmentId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const { error } = await supabase.from("worship_schedule_assignments").delete().eq("id", data.assignmentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- LIST SETLISTS (for picker) ----------
export const listMySetlists = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("setlists")
      .select("id, name")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { setlists: data ?? [] };
  });
