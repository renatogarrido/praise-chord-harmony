import { useEffect, useState, createContext, useContext, type ReactNode, useRef, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { enforceDeviceLimit } from "@/lib/device-limit.functions";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  canViewUsers: boolean;
  canManageLocalLeaders: boolean;
  canManageSchedule: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({ session: null, user: null, isAdmin: false, canViewUsers: false, canManageLocalLeaders: false, canManageSchedule: false, loading: true, signOut: async () => {} });


const INACTIVITY_LIMIT = 60 * 60 * 1000; // 1 hour in ms

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canViewUsers, setCanViewUsers] = useState(false);
  const [canManageLocalLeaders, setCanManageLocalLeaders] = useState(false);
  const [canManageSchedule, setCanManageSchedule] = useState(false);

  const [loading, setLoading] = useState(true);
  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const signOut = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    // scope: 'global' invalida o token em TODOS os dispositivos/navegadores
    await supabase.auth.signOut({ scope: 'global' });
  }, []);

  const resetInactivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    const checkRoles = async (userId: string) => {
      try {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);
        const roles = (roleData ?? []).map((r: any) => r.role as string);
        const admin = roles.includes("admin");
        const viewUsers = admin || roles.includes("lider_nacional") || roles.includes("lider_estadual") || roles.includes("lider_local");
        const canManage = admin || roles.includes("lider_nacional") || roles.includes("lider_estadual");
        const manageSchedule = admin || roles.includes("lider_nacional") || roles.includes("lider_estadual") || roles.includes("lider_local");
        return { admin, viewUsers, canManage, manageSchedule };
      } catch {
        return { admin: false, viewUsers: false, canManage: false, manageSchedule: false };
      }
    };


    const initializeAuth = async () => {
      try {
        const { data: { session: s }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!s) {
          setSession(null);
          setIsAdmin(false);
          setCanViewUsers(false);
          setCanManageLocalLeaders(false);
          return;
        }

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          setSession(null);
          setIsAdmin(false);
          setCanViewUsers(false);
          setCanManageLocalLeaders(false);
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
          return;
        }

        setSession(s);
        const { admin, viewUsers, canManage, manageSchedule } = await checkRoles(user.id);
        setIsAdmin(admin);
        setCanViewUsers(viewUsers);
        setCanManageLocalLeaders(canManage);
        setCanManageSchedule(manageSchedule);
      } catch (err) {
        console.error("Auth initialization error:", err);
        setSession(null);
        setIsAdmin(false);
        setCanViewUsers(false);
        setCanManageLocalLeaders(false);
        setCanManageSchedule(false);

      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "INITIAL_SESSION") return;

      setSession(s);
      if (s?.user) {
        // Defer Supabase calls to evitar deadlock dentro do callback de auth
        setTimeout(async () => {
          const { data: { user }, error } = await supabase.auth.getUser();
          if (error || !user) {
            setSession(null);
            setIsAdmin(false);
            setCanViewUsers(false);
            setCanManageLocalLeaders(false);
            setCanManageSchedule(false);
            setLoading(false);
            await supabase.auth.signOut({ scope: "local" }).catch(() => {});
            return;
          }
          const { admin, viewUsers, canManage, manageSchedule } = await checkRoles(s.user.id);
          setIsAdmin(admin);
          setCanViewUsers(viewUsers);
          setCanManageLocalLeaders(canManage);
          setCanManageSchedule(manageSchedule);

          // Limita usuários comuns a 2 dispositivos ativos (admins ilimitados)
          if (event === "SIGNED_IN") {
            enforceDeviceLimit().catch((e) => console.error("[device-limit]", e));
          }
          setLoading(false);
        }, 0);
      } else {
        setIsAdmin(false);
        setCanViewUsers(false);
        setCanManageLocalLeaders(false);
        setCanManageSchedule(false);
        setLoading(false);
      }
    });


    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    events.forEach(e => window.addEventListener(e, resetInactivityTimer));

    timerRef.current = setInterval(() => {
      const now = Date.now();
      if (now - lastActivityRef.current > INACTIVITY_LIMIT) {
        signOut();
        toast.info("Sessão encerrada por inatividade.");
      }
    }, 60000); // Check every minute

    return () => {
      events.forEach(e => window.removeEventListener(e, resetInactivityTimer));
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session, isAdmin, signOut, resetInactivityTimer]);

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, isAdmin, canViewUsers, canManageLocalLeaders, canManageSchedule, loading, signOut }}>
      {children}

    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
