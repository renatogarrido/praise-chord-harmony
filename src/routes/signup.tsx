import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [name, setName] = useState("");
  const [churchName, setChurchName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (!authLoading && session) navigate({ to: "/app/albums" }); }, [authLoading, session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/app/albums`,
        data: { 
          full_name: name,
          church_name: churchName 
        },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Verifique seu email se for solicitado.");
    navigate({ to: "/app/albums" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="block text-center mb-10">
          <span className="font-serif text-3xl text-gold">Cifras Praise</span>
          <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Renascer Collection</p>
        </Link>
        <div className="rounded-2xl border border-border bg-card p-8">
          <h1 className="font-serif text-2xl mb-6">Criar conta</h1>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Nome</label>
              <input required value={name} onChange={(e) => setName(e.target.value)}
                className="mt-2 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-gold/50 focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Igreja</label>
              <input required value={churchName} onChange={(e) => setChurchName(e.target.value)}
                placeholder="Ex: Renascer em Cristo"
                className="mt-2 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-gold/50 focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-gold/50 focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Senha</label>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-gold/50 focus:outline-none" />
            </div>
            <button type="submit" disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-gold py-3 text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-50">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Criar conta
            </button>
          </form>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Já tem conta? <Link to="/login" className="text-gold hover:underline">Entrar</Link>
          </p>
          <p className="mt-3 text-center text-[10px] text-muted-foreground/70">
            O primeiro usuário cadastrado torna-se admin automaticamente.
          </p>
        </div>
      </div>
    </div>
  );
}
