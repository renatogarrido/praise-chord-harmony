import { useEffect, useState, createContext, useContext, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({ session: null, user: null, isAdmin: false, loading: true, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async (userId: string) => {
      try {
        console.log("Checking admin status for user:", userId);
        
        // Try reading from user_roles first
        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle();
        
        if (roleError) {
          console.error("Error checking user_roles:", roleError);
        }

        // Fallback: Try reading from profiles table (we added a role column there too)
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle();
        
        if (profileError) {
          console.error("Error checking profile role:", profileError);
        }

        const isUserAdmin = (roleData?.role === "admin") || (profileData?.role === "admin");
        console.log("Admin check result for", userId, ":", isUserAdmin, { roleData, profileData });
        return isUserAdmin;
      } catch (err) {
        console.error("Unexpected error in admin check:", err);
        return false;
      }
    };

    const initializeAuth = async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      setSession(s);
      if (s?.user) {
        const isUserAdmin = await checkAdmin(s.user.id);
        setIsAdmin(isUserAdmin);
      }
      setLoading(false);
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, s) => {
      console.log("Auth state changed:", _e, s?.user?.id);
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

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, isAdmin, loading, signOut: async () => { await supabase.auth.signOut(); } }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
