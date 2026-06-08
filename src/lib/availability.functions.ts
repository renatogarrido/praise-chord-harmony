import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireVerifiedSupabaseAuth as requireSupabaseAuth } from "@/lib/verified-auth-middleware";

export const SUNDAY_SERVICES = ["08:00", "10:00", "16:00", "18:00"] as const;
export const WEEKDAY_KEYS = ["1", "2", "3", "4", "5", "6"] as const; // ISO: 1=Mon..6=Sat

function throwSafe(label: string, error: unknown): never {
  console.error(`[availability] ${label}`, error);
  throw new Error("Não foi possível concluir a operação. Tente novamente.");
}

const TimeRange = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

const WeekdaysSchema = z.record(z.enum(WEEKDAY_KEYS), TimeRange.nullable()).default({});
// Sunday availability can be either:
//  - legacy: string[] of service times that apply to EVERY Sunday in the month
//  - new:    Record<"YYYY-MM-DD", string[]> for per-Sunday selection
const SundaySchema = z.union([
  z.array(z.enum(SUNDAY_SERVICES)),
  z.record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.array(z.enum(SUNDAY_SERVICES))),
]).default({} as any);

function sundayTimesFor(
  sundayServices: any,
  isoDateYMD: string,
): string[] {
  if (Array.isArray(sundayServices)) return sundayServices as string[];
  if (sundayServices && typeof sundayServices === "object") {
    return (sundayServices[isoDateYMD] as string[]) ?? [];
  }
  return [];
}

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
    if (error) throwSafe("get own availability", error);
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
    if (error) throwSafe("save own availability", error);
    return { ok: true };
  });

// ---------- LIST AVAILABLE USERS FOR A DATE ----------
// Returns user_ids available on the given service date/time.
export const listAvailableUserIdsFor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ isoDate: z.string().min(8).max(64) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!(await isManager(supabase, userId))) {
      throw new Error("Acesso negado: apenas administradores e líderes podem consultar disponibilidade.");
    }

    const d = new Date(data.isoDate);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const dow = d.getDay(); // 0=Sun..6=Sat
    const hhmm = d.toTimeString().slice(0, 5);

    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const { data: rows, error } = await supabase
      .from("monthly_availability")
      .select("user_id, weekdays, sunday_services")
      .eq("year", year)
      .eq("month", month);
    if (error) throwSafe("list available users", error);

    const ids = new Set<string>();
    for (const r of rows ?? []) {
      if (dow === 0) {
        const list = sundayTimesFor(r.sunday_services, ymd);
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
      sundaySetlists: z
        .record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.string().uuid().nullable())
        .optional()
        .default({}),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!(await isManager(supabase, userId))) {
      throw new Error("Apenas administradores e líderes podem gerar a escala.");
    }


    // Determine caller scope (church / estadual) based on role
    const { data: roleRows } = await supabase
      .from("user_roles").select("role").eq("user_id", userId);
    const callerRoles = (roleRows ?? []).map((r: any) => r.role as string);
    const isLocal = callerRoles.includes("lider_local")
      && !callerRoles.includes("admin")
      && !callerRoles.includes("lider_nacional")
      && !callerRoles.includes("lider_estadual");
    const isEstadual = callerRoles.includes("lider_estadual")
      && !callerRoles.includes("admin")
      && !callerRoles.includes("lider_nacional");

    const { data: myProfile } = await supabase
      .from("profiles").select("church_name").eq("id", userId).maybeSingle();
    const myChurch = (myProfile as any)?.church_name ?? null;

    let allowedChurchNames: string[] | null = null; // null = no church restriction
    if (isLocal) {
      if (!myChurch) throw new Error("Defina sua igreja no perfil antes de gerar a escala.");
      allowedChurchNames = [myChurch];
    } else if (isEstadual) {
      if (!myChurch) throw new Error("Defina sua igreja no perfil antes de gerar a escala.");
      const { data: myC } = await supabase
        .from("churches").select("estadual").eq("name", myChurch).maybeSingle();
      const estadual = (myC as any)?.estadual ?? null;
      if (!estadual) throw new Error("Sua igreja não está vinculada a um agrupamento estadual.");
      const { data: regionChurches } = await supabase
        .from("churches").select("name").eq("estadual", estadual);
      allowedChurchNames = (regionChurches ?? []).map((c: any) => c.name);
    }

    const effectiveChurchName = isLocal ? myChurch : (data.churchName || null);
    if (isEstadual && effectiveChurchName && !(allowedChurchNames ?? []).includes(effectiveChurchName)) {
      throw new Error("Você só pode gerar escalas de igrejas do seu estadual.");
    }

    // 1. Read availabilities for the month
    const { data: avsRaw, error: avErr } = await supabase
      .from("monthly_availability")
      .select("user_id, sunday_services")
      .eq("year", data.year)
      .eq("month", data.month);
    if (avErr) throwSafe("read monthly availability", avErr);

    const allIds = Array.from(new Set((avsRaw ?? []).map((a: any) => a.user_id)));
    let profileMap = new Map<string, { instruments: string[]; vocal_types: string[]; church_name: string | null }>();
    if (allIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, instruments, vocal_types, church_name")
        .in("id", allIds);
      (profs ?? []).forEach((p: any) =>
        profileMap.set(p.id, {
          instruments: p.instruments ?? [],
          vocal_types: p.vocal_types ?? [],
          church_name: p.church_name ?? null,
        })
      );
    }

    // Filter availabilities by church scope
    const scopedAvs = (avsRaw ?? []).filter((a: any) => {
      const ch = profileMap.get(a.user_id)?.church_name ?? null;
      if (effectiveChurchName) return ch === effectiveChurchName;
      if (!allowedChurchNames) return true;
      return !!ch && allowedChurchNames.includes(ch);
    });

    // 3. Build list of Sundays in the month
    const sundays: Date[] = [];
    const last = new Date(data.year, data.month, 0).getDate();
    for (let d = 1; d <= last; d++) {
      const dt = new Date(data.year, data.month - 1, d);
      if (dt.getDay() === 0) sundays.push(dt);
    }

    // Resolve setlist names (admin client — setlists are owner-scoped via RLS)
    const setlistNameByDate = new Map<string, { id: string; name: string | null }>();
    const sundaySetlists = (data.sundaySetlists ?? {}) as Record<string, string | null>;
    const distinctSetlistIds = Array.from(
      new Set(Object.values(sundaySetlists).filter((v): v is string => !!v))
    );
    if (distinctSetlistIds.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: sls } = await supabaseAdmin
        .from("setlists").select("id, name").in("id", distinctSetlistIds);
      const nameById = new Map<string, string | null>();
      (sls ?? []).forEach((s: any) => nameById.set(s.id, s.name ?? null));
      for (const [ymd, sid] of Object.entries(sundaySetlists)) {
        if (sid) setlistNameByDate.set(ymd, { id: sid, name: nameById.get(sid) ?? null });
      }
    }

    let createdSchedules = 0;
    let createdAssignments = 0;

    for (const sun of sundays) {
      const ymd = `${sun.getFullYear()}-${String(sun.getMonth() + 1).padStart(2, "0")}-${String(sun.getDate()).padStart(2, "0")}`;
      const sundaySetlist = setlistNameByDate.get(ymd) ?? null;

      // Map service time -> [userIds] FOR THIS SUNDAY
      const byService = new Map<string, string[]>();
      for (const t of SUNDAY_SERVICES) byService.set(t, []);
      for (const a of scopedAvs) {
        const list = sundayTimesFor((a as any).sunday_services, ymd);
        for (const t of list) {
          if (byService.has(t)) byService.get(t)!.push(a.user_id);
        }
      }

      for (const time of SUNDAY_SERVICES) {
        const [hh, mm] = time.split(":").map(Number);
        const serviceDate = new Date(sun);
        serviceDate.setHours(hh, mm, 0, 0);
        const iso = serviceDate.toISOString();

        // Skip if a schedule already exists for that exact date+time+churchName
        const { data: existing } = await supabase
          .from("worship_schedules")
          .select("id, setlist_id")
          .eq("service_date", iso)
          .eq("church_name", effectiveChurchName || null as any)
          .maybeSingle();

        let scheduleId: string;
        if (existing?.id) {
          scheduleId = existing.id;
          // Apply the chosen Sunday setlist if the existing schedule has none
          if (sundaySetlist && !existing.setlist_id) {
            await supabase
              .from("worship_schedules")
              .update({ setlist_id: sundaySetlist.id, setlist_name: sundaySetlist.name } as any)
              .eq("id", scheduleId);
          }
        } else {
          const title = `Culto ${time} — ${sun.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}`;
          const { data: ins, error: insErr } = await supabase
            .from("worship_schedules")
            .insert({
              title,
              service_date: iso,
              church_name: effectiveChurchName || null,
              setlist_id: sundaySetlist?.id ?? null,
              setlist_name: sundaySetlist?.name ?? null,
              created_by: userId,
            } as any)
            .select("id")
            .single();
          if (insErr) throwSafe("create generated schedule", insErr);
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
