import { useEffect, useState, createContext, useContext, type ReactNode, useRef, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({ session: null, user: null, isAdmin: false, loading: true, signOut: async () => {} });

const INACTIVITY_LIMIT = 60 * 60 * 1000; // 1 hour in ms

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const signOut = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    await supabase.auth.signOut();
  }, []);

  const resetInactivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    const checkAdmin = async (userId: string) => {
      try {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle();

        const { data: profileData } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle();

        return (roleData?.role === "admin") || (profileData?.role === "admin");
      } catch {
        return false;
      }
    };

    const initializeAuth = async () => {
      try {
        const { data: { session: s }, error } = await supabase.auth.getSession();
        if (error) throw error;
        setSession(s);
        if (s?.user) {
          const isUserAdmin = await checkAdmin(s.user.id);
          setIsAdmin(isUserAdmin);
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);
      if (s?.user) {
        const isUserAdmin = await checkAdmin(s.user.id);
        setIsAdmin(isUserAdmin);
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user || isAdmin) {
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
    <Ctx.Provider value={{ session, user: session?.user ?? null, isAdmin, loading, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
