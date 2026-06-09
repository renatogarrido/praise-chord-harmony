import { useEffect, useState, createContext, useContext, type ReactNode, useRef, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { enforceDeviceLimit } from "@/lib/device-limit.functions";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  acceptedTerms: boolean;
  canViewUsers: boolean;
  canManageLocalLeaders: boolean;
  canManageSchedule: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({ 
  session: null, 
  user: null, 
  isAdmin: false, 
  acceptedTerms: true,
  canViewUsers: false, 
  canManageLocalLeaders: false, 
  canManageSchedule: false, 
  loading: true, 
  refreshProfile: async () => {},
  signOut: async () => {} 
});


const INACTIVITY_LIMIT = 60 * 60 * 1000; // 1 hour in ms

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(true);
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

  const checkRolesAndProfile = useCallback(async (userId: string) => {
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

      const { data: profile } = await supabase
        .from("profiles")
        .select("accepted_terms")
        .eq("id", userId)
        .single();

      return { 
        admin, 
        viewUsers, 
        canManage, 
        manageSchedule,
        acceptedTerms: profile?.accepted_terms ?? false
      };
    } catch {
      return { admin: false, viewUsers: false, canManage: false, manageSchedule: false, acceptedTerms: true };
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { admin, viewUsers, canManage, manageSchedule, acceptedTerms } = await checkRolesAndProfile(user.id);
      setIsAdmin(admin);
      setCanViewUsers(viewUsers);
      setCanManageLocalLeaders(canManage);
      setCanManageSchedule(manageSchedule);
      setAcceptedTerms(acceptedTerms);
    }
  }, [checkRolesAndProfile]);

  useEffect(() => {
    const initializeAuth = async () => {


    const initializeAuth = async () => {
      try {
        const { data: { session: s }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!s) {
          setSession(null);
          setIsAdmin(false);
          setCanViewUsers(false);
          setCanManageLocalLeaders(false);
          setAcceptedTerms(true);
          return;
        }

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          setSession(null);
          setIsAdmin(false);
          setCanViewUsers(false);
          setCanManageLocalLeaders(false);
          setAcceptedTerms(true);
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
          return;
        }

        setSession(s);
        const { admin, viewUsers, canManage, manageSchedule, acceptedTerms } = await checkRolesAndProfile(user.id);
        setIsAdmin(admin);
        setCanViewUsers(viewUsers);
        setCanManageLocalLeaders(canManage);
        setCanManageSchedule(manageSchedule);
        setAcceptedTerms(acceptedTerms);
      } catch (err) {
        console.error("Auth initialization error:", err);
        setSession(null);
        setIsAdmin(false);
        setCanViewUsers(false);
        setCanManageLocalLeaders(false);
        setCanManageSchedule(false);
        setAcceptedTerms(true);

      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "INITIAL_SESSION") return;

      if (s?.user) {
        setLoading(true);
        setSession(s);
        // Defer Supabase calls to evitar deadlock dentro do callback de auth
        setTimeout(async () => {
          const { data: { user }, error } = await supabase.auth.getUser();
          if (error || !user) {
            setSession(null);
            setIsAdmin(false);
            setCanViewUsers(false);
            setCanManageLocalLeaders(false);
            setCanManageSchedule(false);
            setAcceptedTerms(true);
            setLoading(false);
            await supabase.auth.signOut({ scope: "local" }).catch(() => {});
            return;
          }
          const { admin, viewUsers, canManage, manageSchedule, acceptedTerms } = await checkRolesAndProfile(s.user.id);
          setIsAdmin(admin);
          setCanViewUsers(viewUsers);
          setCanManageLocalLeaders(canManage);
          setCanManageSchedule(manageSchedule);
          setAcceptedTerms(acceptedTerms);

          // Limita usuários comuns a 2 dispositivos ativos (admins ilimitados)
          if (event === "SIGNED_IN") {
            enforceDeviceLimit().catch((e) => console.error("[device-limit]", e));
          }
          setLoading(false);
        }, 0);
      } else {
        setSession(null);
        setIsAdmin(false);
        setCanViewUsers(false);
        setCanManageLocalLeaders(false);
        setCanManageSchedule(false);
        setAcceptedTerms(true);
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
    <Ctx.Provider value={{ session, user: session?.user ?? null, isAdmin, acceptedTerms, canViewUsers, canManageLocalLeaders, canManageSchedule, loading, refreshProfile, signOut }}>
      {children}

    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
