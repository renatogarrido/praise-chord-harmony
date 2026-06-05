import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Loader2, UserPlus, Trash2 } from "lucide-react";
import { createLocalLeaderUser, listLocalLeaders } from "@/lib/leader-users.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/leader/local-leaders")({
  component: LocalLeadersPage,
});

function LocalLeadersPage() {
  const { canManageLocalLeaders, loading } = useAuth();
  const nav = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", fullName: "", churchName: "" });

  useEffect(() => {
    if (!loading && !canManageLocalLeaders) nav({ to: "/app/albums" });
  }, [loading, canManageLocalLeaders, nav]);

  const load = async () => {
    try {
      const { users } = await listLocalLeaders();
      setUsers(users);
    } catch (e: any) {
      toast.error("Erro ao carregar líderes locais: " + (e?.message || ""));
    }
  };

  useEffect(() => { if (canManageLocalLeaders) load(); }, [canManageLocalLeaders]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createLocalLeaderUser({ data: form });
      toast.success("Líder local cadastrado!");
      setIsOpen(false);
      setForm({ email: "", password: "", fullName: "", churchName: "" });
      load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao cadastrar");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div>;
  }
  if (!canManageLocalLeaders) return null;

  return (
    <div className="px-6 md:px-12 py-8 md:py-12 max-w-4xl mx-auto">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-gold mb-2">Liderança</p>
          <h1 className="font-serif text-4xl">Líderes Locais</h1>
          <p className="mt-2 text-sm text-muted-foreground">Total: {users.length}</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gold hover:bg-gold/90 text-white gap-2">
              <UserPlus className="h-4 w-4" />
              Novo Líder Local
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Cadastrar Líder Local</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo</Label>
                <Input id="fullName" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="churchName">Igreja</Label>
                <Input id="churchName" value={form.churchName} onChange={(e) => setForm({ ...form, churchName: e.target.value })} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                <Button type="submit" className="bg-gold hover:bg-gold/90 text-white" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cadastrar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        {users.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground text-center">Nenhum líder local cadastrado ainda.</p>
        )}
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-4 p-4">
            <div className="grid size-10 place-items-center rounded-full bg-gold-soft text-gold text-sm font-semibold">
              {(u.full_name?.[0] || "?").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{u.full_name || "—"}</p>
              {u.email && <p className="text-xs text-muted-foreground truncate">{u.email}</p>}
              {u.church_name && <p className="text-xs text-muted-foreground truncate">{u.church_name}</p>}
            </div>
            <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-gold-soft text-gold whitespace-nowrap">Líder Local</span>
          </div>
        ))}
      </div>
    </div>
  );
}
