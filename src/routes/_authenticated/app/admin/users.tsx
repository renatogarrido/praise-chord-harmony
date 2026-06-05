import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, ShieldOff, UserPlus, X, Loader2, Pencil, Trash2, Download } from "lucide-react";
import { createUserAdmin, deleteUserAdmin, listUsersAdmin, toggleAdminRole, updateUserAdmin } from "@/lib/admin-users.functions";
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
import { MusicianMultiSelect } from "@/components/musician-multi-select";
import { useInstrumentGroups, useVocalGroups } from "@/hooks/use-instrument-groups";

export const Route = createFileRoute("/_authenticated/app/admin/users")({ component: AdminUsers });

function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [instruments, setInstruments] = useState<string[]>([]);
  const [vocalTypes, setVocalTypes] = useState<string[]>([]);
  const { groups: instrumentGroups } = useInstrumentGroups();
  const { groups: vocalGroups } = useVocalGroups();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    churchName: "",
    role: "user",
  });

  const load = async () => {
    try {
      const { users } = await listUsersAdmin();
      setUsers(users);
    } catch (e: any) {
      toast.error("Erro ao carregar usuários: " + (e?.message || ""));
    }
  };

  const exportCsv = () => {
    const headers = ["Nome", "Email", "Igreja", "Função", "Cadastro", "Último acesso"];
    const rows = users.map((u) => [
      u.full_name || "",
      u.email || "",
      u.church_name || "",
      u.roles.includes("admin") ? "Admin" : "Usuário",
      u.created_at ? new Date(u.created_at).toLocaleString("pt-BR") : "",
      u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("pt-BR") : "",
    ]);
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usuarios-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => { load(); }, []);

  const deleteUser = async (userId: string) => {
    if (!confirm("Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.")) return;

    try {
      await deleteUserAdmin({ data: { userId } });
      toast.success("Usuário removido!");
      load();
    } catch (error: any) {
      toast.error("Erro ao remover usuário: " + (error?.message || "falha desconhecida"));
    }
  };

  const handleEditUser = async (user: any) => {
    setFormData({
      email: user.email || "",
      password: "", // Don't show password
      fullName: user.full_name || "",
      churchName: user.church_name || "",
      role: user.roles.includes("admin") ? "admin" : "user",
    });
    setInstruments(user.instruments ?? []);
    setVocalTypes(user.vocal_types ?? []);
    setEditingId(user.id);
    setIsDialogOpen(true);
  };

  const toggleAdmin = async (userId: string, isAdmin: boolean) => {
    try {
      await toggleAdminRole({ data: { userId, isAdmin } });
      toast.success("Atualizado!");
      load();
    } catch (error: any) {
      toast.error(error.message || "Erro ao alterar função");
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingId) {
        await updateUserAdmin({
          data: {
            userId: editingId,
            fullName: formData.fullName,
            churchName: formData.churchName,
            role: formData.role as "user" | "admin",
            instruments,
            vocalTypes,
          },
        });
        toast.success("Usuário atualizado com sucesso!");
      } else {
        // Create new user
        await createUserAdmin({
          data: {
            email: formData.email,
            password: formData.password,
            fullName: formData.fullName,
            churchName: formData.churchName,
            role: formData.role as "user" | "admin",
            instruments,
            vocalTypes,
          },
        });
        toast.success("Usuário criado com sucesso!");
      }

      setIsDialogOpen(false);
      setFormData({ email: "", password: "", fullName: "", churchName: "", role: "user" });
      setInstruments([]);
      setVocalTypes([]);
      setEditingId(null);
      load();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao salvar usuário");
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="px-6 md:px-12 py-8 md:py-12 max-w-4xl mx-auto">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-gold mb-2">Gestão</p>
          <h1 className="font-serif text-4xl">Usuários</h1>
          <p className="mt-2 text-sm text-muted-foreground">Total: {users.length}</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={exportCsv} disabled={!users.length}>
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingId(null);
              setFormData({ email: "", password: "", fullName: "", churchName: "", role: "user" });
            }
          }}>
            <DialogTrigger asChild>
              <Button className="bg-gold hover:bg-gold/90 text-white gap-2">
                <UserPlus className="h-4 w-4" />
                Novo Usuário
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Usuário" : "Cadastrar Novo Usuário"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveUser} className="space-y-4 pt-4">
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
                  disabled={!!editingId}
                />
              </div>
              {!editingId && (
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
              )}
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
              <div className="space-y-2">
                <Label>Instrumentos</Label>
                <MusicianMultiSelect
                  groups={instrumentGroups}
                  value={instruments}
                  onChange={setInstruments}
                  placeholder="Escolher instrumentos…"
                />
              </div>
              <div className="space-y-2">
                <Label>Vocal</Label>
                <MusicianMultiSelect
                  groups={vocalGroups}
                  value={vocalTypes}
                  onChange={setVocalTypes}
                  placeholder="Escolher tipo vocal…"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-gold hover:bg-gold/90 text-white" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? "Salvar" : "Cadastrar"}
                </Button>
              </div>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        {users.map((u) => {
          const isAdmin = u.roles.includes("admin");
          return (
            <div key={u.id} className="flex items-center gap-4 p-4">
              <div className="grid size-10 place-items-center rounded-full bg-gold-soft text-gold text-sm font-semibold">{(u.full_name?.[0] || "?").toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{u.full_name || "—"}</p>
                {u.email && <p className="text-xs text-muted-foreground truncate">{u.email}</p>}
                <p className="text-xs text-muted-foreground">desde {new Date(u.created_at).toLocaleDateString("pt-BR")}</p>
              </div>
              {isAdmin && <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-gold-soft text-gold">Admin</span>}
              <button onClick={() => toggleAdmin(u.id, isAdmin)} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[10px] uppercase tracking-widest hover:bg-accent" title={isAdmin ? "Remover Admin" : "Tornar Admin"}>
                {isAdmin ? <ShieldOff className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
              </button>
              <button onClick={() => handleEditUser(u)} className="p-2 text-muted-foreground hover:text-gold transition-colors" title="Editar Usuário">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => deleteUser(u.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors" title="Excluir Usuário">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
