import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, ShieldOff, UserPlus, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/users")({ component: AdminUsers });

function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    churchName: "",
    role: "user",
  });

  const load = async () => {
    const { data: profiles } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    const { data: roles } = await supabase.from("user_roles").select("*");
    const roleMap = new Map<string, string[]>();
    roles?.forEach((r) => { const a = roleMap.get(r.user_id) || []; a.push(r.role); roleMap.set(r.user_id, a); });
    setUsers((profiles ?? []).map((p) => ({ ...p, roles: roleMap.get(p.id) ?? [] })));
  };
  useEffect(() => { load(); }, []);

  const toggleAdmin = async (userId: string, isAdmin: boolean) => {
    if (isAdmin) {
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
    } else {
      await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
    }
    toast.success("Atualizado!"); load();
  };

  return (
    <div className="px-6 md:px-12 py-8 md:py-12 max-w-4xl mx-auto">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-gold mb-2">Gestão</p>
          <h1 className="font-serif text-4xl">Usuários</h1>
          <p className="mt-2 text-sm text-muted-foreground">Total: {users.length}</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gold hover:bg-gold/90 text-white gap-2">
              <UserPlus className="h-4 w-4" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Cadastrar Novo Usuário</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo</Label>
                <Input
                  id="fullName"
                  placeholder="Nome do usuário"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="******"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="churchName">Igreja</Label>
                <Input
                  id="churchName"
                  placeholder="Nome da igreja"
                  value={formData.churchName}
                  onChange={(e) => setFormData({ ...formData, churchName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Função</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a função" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário Comum</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-gold hover:bg-gold/90 text-white" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cadastrar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        {users.map((u) => {
          const isAdmin = u.roles.includes("admin");
          return (
            <div key={u.id} className="flex items-center gap-4 p-4">
              <div className="grid size-10 place-items-center rounded-full bg-gold-soft text-gold text-sm font-semibold">{(u.full_name?.[0] || "?").toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{u.full_name || "—"}</p>
                <p className="text-xs text-muted-foreground">desde {new Date(u.created_at).toLocaleDateString("pt-BR")}</p>
              </div>
              {isAdmin && <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-gold-soft text-gold">Admin</span>}
              <button onClick={() => toggleAdmin(u.id, isAdmin)} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[10px] uppercase tracking-widest hover:bg-accent">
                {isAdmin ? <><ShieldOff className="h-3 w-3" /> Remover</> : <><Shield className="h-3 w-3" /> Tornar admin</>}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
