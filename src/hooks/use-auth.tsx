import { useEffect, useState, createContext, useContext, type ReactNode, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { enforceDeviceLimit } from "@/lib/device-limit.functions";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  acceptedTerms: boolean;
  canViewUsers: boolean;
  canManageLocalLeaders: boolean;
  canManageSchedule: boolean;
  roles: string[];
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
  roles: [],
  loading: true, 
  refreshProfile: async () => {},
  signOut: async () => {} 
});

const SESSION_STORAGE_KEY = "cifras-praise-session";

function saveSession(session: Session | null) {
  if (typeof window === "undefined") return;
  if (!session?.access_token || !session.refresh_token) {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }
  window.sessionStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token }),
  );
}

function getSavedSessionTokens(): { access_token: string; refresh_token: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { access_token?: string; refresh_token?: string };
    if (!parsed.access_token || !parsed.refresh_token) return null;
    return { access_token: parsed.access_token, refresh_token: parsed.refresh_token };
  } catch {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [canViewUsers, setCanViewUsers] = useState(false);
  const [canManageLocalLeaders, setCanManageLocalLeaders] = useState(false);
  const [canManageSchedule, setCanManageSchedule] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);


  const [loading, setLoading] = useState(true);

  const signOut = useCallback(async () => {
    saveSession(null);
    // Use 'local' if you don't want to kick out other devices by default,
    // or keep 'global' if that was intended.
    await supabase.auth.signOut({ scope: 'local' });
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
        roles,
        acceptedTerms: profile?.accepted_terms ?? false
      };
    } catch {
      return { admin: false, viewUsers: false, canManage: false, manageSchedule: false, roles: [], acceptedTerms: true };
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { admin, viewUsers, canManage, manageSchedule, roles, acceptedTerms } = await checkRolesAndProfile(user.id);
      setIsAdmin(admin);
      setCanViewUsers(viewUsers);
      setCanManageLocalLeaders(canManage);
      setCanManageSchedule(manageSchedule);
      setRoles(roles);
      setAcceptedTerms(acceptedTerms);
    }
  }, [checkRolesAndProfile]);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const savedTokens = getSavedSessionTokens();
        if (savedTokens) {
          await supabase.auth.setSession(savedTokens);
        }

        const { data: { session: s }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!s) {
          saveSession(null);
          setSession(null);
          setIsAdmin(false);
          setCanViewUsers(false);
          setCanManageLocalLeaders(false);
          setAcceptedTerms(true);
          return;
        }

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          saveSession(null);
          setSession(null);
          setIsAdmin(false);
          setCanViewUsers(false);
          setCanManageLocalLeaders(false);
          setAcceptedTerms(true);
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
          return;
        }

        setSession(s);
        saveSession(s);
        const { admin, viewUsers, canManage, manageSchedule, roles, acceptedTerms } = await checkRolesAndProfile(user.id);
        setIsAdmin(admin);
        setCanViewUsers(viewUsers);
        setCanManageLocalLeaders(canManage);
        setCanManageSchedule(manageSchedule);
        setRoles(roles);
        setAcceptedTerms(acceptedTerms);
      } catch (err) {
        console.error("Auth initialization error:", err);
        saveSession(null);
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
      
      console.log(`[useAuth] event: ${event}`);

      if (s?.user) {
        setLoading(true);
        setSession(s);
        saveSession(s);
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
          const { admin, viewUsers, canManage, manageSchedule, roles, acceptedTerms } = await checkRolesAndProfile(s.user.id);
          setIsAdmin(admin);
          setCanViewUsers(viewUsers);
          setCanManageLocalLeaders(canManage);
          setCanManageSchedule(manageSchedule);
          setRoles(roles);
          setAcceptedTerms(acceptedTerms);

          // Limita usuários comuns a 2 dispositivos ativos (admins ilimitados)
          if (event === "SIGNED_IN") {
            enforceDeviceLimit().catch((e) => console.error("[device-limit]", e));
          }
          setLoading(false);
        }, 0);
      } else {
        saveSession(null);
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
  }, [checkRolesAndProfile]);

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, isAdmin, acceptedTerms, canViewUsers, canManageLocalLeaders, canManageSchedule, loading, refreshProfile, signOut }}>
      {children}

    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
