import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const SUNDAY_SERVICES = ["08:00", "10:00", "16:00", "18:00"] as const;
export const WEEKDAY_KEYS = ["1", "2", "3", "4", "5", "6"] as const; // ISO: 1=Mon..6=Sat

const TimeRange = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

const WeekdaysSchema = z.record(z.enum(WEEKDAY_KEYS), TimeRange.nullable()).default({});
const SundaySchema = z.array(z.enum(SUNDAY_SERVICES)).default([]);

const MANAGER_ROLES = ["admin", "lider_nacional", "lider_estadual", "lider_local"] as const;

async function isManager(supabase: any, uid: string) {
  const { data } = await supabase
    .from("user_roles").select("role").eq("user_id", uid)
    .in("role", MANAGER_ROLES as unknown as string[]);
  return !!(data && data.length > 0);
}

// ---------- GET MINE ----------
export const getMyAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      year: z.number().int().min(2024).max(2100),
      month: z.number().int().min(1).max(12),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("monthly_availability")
      .select("id, year, month, weekdays, sunday_services, notes, updated_at")
      .eq("user_id", userId)
      .eq("year", data.year)
      .eq("month", data.month)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { availability: row };
  });

// ---------- SAVE MINE ----------
export const saveMyAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      year: z.number().int().min(2024).max(2100),
      month: z.number().int().min(1).max(12),
      weekdays: WeekdaysSchema,
      sunday_services: SundaySchema,
      notes: z.string().max(500).optional().nullable(),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      user_id: userId,
      year: data.year,
      month: data.month,
      weekdays: data.weekdays as any,
      sunday_services: data.sunday_services as any,
      notes: data.notes || null,
    };
    const { error } = await supabase
      .from("monthly_availability")
      .upsert(payload, { onConflict: "user_id,year,month" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- LIST AVAILABLE USERS FOR A DATE ----------
// Returns user_ids available on the given service date/time.
export const listAvailableUserIdsFor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ isoDate: z.string().min(8).max(64) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const d = new Date(data.isoDate);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const dow = d.getDay(); // 0=Sun..6=Sat
    const hhmm = d.toTimeString().slice(0, 5);

    const { data: rows, error } = await supabase
      .from("monthly_availability")
      .select("user_id, weekdays, sunday_services")
      .eq("year", year)
      .eq("month", month);
    if (error) throw new Error(error.message);

    const ids = new Set<string>();
    for (const r of rows ?? []) {
      if (dow === 0) {
        const list: string[] = (r.sunday_services as any) ?? [];
        // Match by service time prefix
        if (list.some((t) => t === hhmm)) ids.add(r.user_id);
      } else {
        const wk = (r.weekdays as any) ?? {};
        const slot = wk[String(dow)];
        if (slot && slot.start && slot.end && slot.start <= hhmm && hhmm <= slot.end) {
          ids.add(r.user_id);
        }
      }
    }
    return { userIds: Array.from(ids) };
  });

// ---------- AUTO-GENERATE MONTH (Sundays × 4 services) ----------
export const generateMonthlySundays = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      year: z.number().int().min(2024).max(2100),
      month: z.number().int().min(1).max(12),
      churchName: z.string().max(255).optional().nullable(),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!(await isManager(supabase, userId))) {
      throw new Error("Apenas administradores e líderes podem gerar a escala.");
    }

    // 1. Read all availabilities for the month
    const { data: avs, error: avErr } = await supabase
      .from("monthly_availability")
      .select("user_id, sunday_services")
      .eq("year", data.year)
      .eq("month", data.month);
    if (avErr) throw new Error(avErr.message);

    // Map service time -> [userIds]
    const byService = new Map<string, string[]>();
    for (const t of SUNDAY_SERVICES) byService.set(t, []);
    for (const a of avs ?? []) {
      const list: string[] = (a.sunday_services as any) ?? [];
      for (const t of list) {
        if (byService.has(t)) byService.get(t)!.push(a.user_id);
      }
    }

    // 2. Read profiles for those users (for role labels)
    const allIds = Array.from(new Set((avs ?? []).map((a: any) => a.user_id)));
    let profileMap = new Map<string, { instruments: string[]; vocal_types: string[] }>();
    if (allIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, instruments, vocal_types")
        .in("id", allIds);
      (profs ?? []).forEach((p: any) =>
        profileMap.set(p.id, {
          instruments: p.instruments ?? [],
          vocal_types: p.vocal_types ?? [],
        })
      );
    }

    // 3. Build list of Sundays in the month
    const sundays: Date[] = [];
    const last = new Date(data.year, data.month, 0).getDate();
    for (let d = 1; d <= last; d++) {
      const dt = new Date(data.year, data.month - 1, d);
      if (dt.getDay() === 0) sundays.push(dt);
    }

    let createdSchedules = 0;
    let createdAssignments = 0;

    for (const sun of sundays) {
      for (const time of SUNDAY_SERVICES) {
        const [hh, mm] = time.split(":").map(Number);
        const serviceDate = new Date(sun);
        serviceDate.setHours(hh, mm, 0, 0);
        const iso = serviceDate.toISOString();

        // Skip if a schedule already exists for that exact date+time+churchName
        const { data: existing } = await supabase
          .from("worship_schedules")
          .select("id")
          .eq("service_date", iso)
          .eq("church_name", data.churchName || null as any)
          .maybeSingle();

        let scheduleId: string;
        if (existing?.id) {
          scheduleId = existing.id;
        } else {
          const title = `Culto ${time} — ${sun.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}`;
          const { data: ins, error: insErr } = await supabase
            .from("worship_schedules")
            .insert({
              title,
              service_date: iso,
              church_name: data.churchName || null,
              created_by: userId,
            } as any)
            .select("id")
            .single();
          if (insErr) throw new Error(insErr.message);
          scheduleId = ins!.id;
          createdSchedules++;
        }

        // Auto-assign available users by their profile roles
        const userIds = byService.get(time) ?? [];
        for (const uid of userIds) {
          const prof = profileMap.get(uid);
          const roles = Array.from(
            new Set([...(prof?.instruments ?? []), ...(prof?.vocal_types ?? [])])
          ).filter(Boolean);
          if (roles.length === 0) continue;
          for (const role of roles) {
            // ignore unique conflicts silently
            const { error: aerr } = await supabase
              .from("worship_schedule_assignments")
              .insert({ schedule_id: scheduleId, user_id: uid, role_label: role } as any);
            if (!aerr) createdAssignments++;
          }
        }
      }
    }

    return { createdSchedules, createdAssignments, sundayCount: sundays.length };
  });
