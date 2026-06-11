import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading, isAdmin, canViewUsers, canManageSchedule } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const isReturningFromClose = localStorage.getItem("was_closed") === "true";
    
    if (!authLoading && session) {
      if (isReturningFromClose) {
        // Se fechou a aba recentemente, força o logout para exigir login manual
        localStorage.removeItem("was_closed");
        supabase.auth.signOut({ scope: "local" });
        return;
      }
      navigate({ to: (isAdmin || canViewUsers || canManageSchedule) ? "/app/admin/" : "/app/albums" });
    }
  }, [authLoading, session, isAdmin, navigate]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      localStorage.setItem("was_closed", "true");
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo!");
    // Navigation handled by useEffect once roles are loaded
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="block text-center mb-10">
          <span className="font-serif text-3xl text-gold">Cifras Praise</span>
          <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Renascer Collection</p>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-8">
          <h1 className="font-serif text-2xl mb-6">Entrar</h1>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Email</label>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-gold/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Senha</label>
              <input
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-gold/50 focus:outline-none"
              />
            </div>
            <button type="submit" disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-gold py-3 text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-50">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Entrar
            </button>
          </form>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Ainda não tem conta?{" "}
            <Link to="/signup" className="text-gold hover:underline">Criar conta</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
