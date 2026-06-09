import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Shield, ShieldOff, UserPlus, Loader2, Pencil, Trash2, Download, LogIn } from "lucide-react";
import { createUserAdmin, deleteUserAdmin, listUsersAdmin, toggleAdminRole, updateUserAdmin, impersonateUserAdmin } from "@/lib/admin-users.functions";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MusicianMultiSelect } from "@/components/musician-multi-select";
import { useInstrumentGroups, useVocalGroups, useTechnicalGroups } from "@/hooks/use-instrument-groups";
import { ChurchSelect } from "@/components/church-select";

export const Route = createFileRoute("/_authenticated/app/admin/users")({ component: AdminUsers });

function AdminUsers() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [instruments, setInstruments] = useState<string[]>([]);
  const [vocalTypes, setVocalTypes] = useState<string[]>([]);
  const [technicalRoles, setTechnicalRoles] = useState<string[]>([]);
  const { groups: instrumentGroups, reload: reloadInstruments } = useInstrumentGroups();
  const { groups: vocalGroups, reload: reloadVocals } = useVocalGroups();
  const [technicalCategories, setTechnicalCategories] = useState<{ id: string, name: string }[]>([]);
  const [isLoadingTech, setIsLoadingTech] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    churchName: "",
  });

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const load = async () => {
    try {
      const { users, viewerRole } = await listUsersAdmin();
      setUsers(users);
      setViewerRole(viewerRole);
    } catch (e: any) {
      toast.error("Erro ao carregar usuários: " + (e?.message || ""));
    }
  };

  const ROLE_LABELS: Record<string, string> = {
    admin: "Administrador",
    lider_nacional: "Líder Nacional",
    lider_estadual: "Líder Estadual",
    lider_local: "Líder Local",
    user: "Usuário",
  };

  const getPrimaryRole = (roles: string[]): "user" | "admin" | "lider_nacional" | "lider_estadual" | "lider_local" => {
    if (roles.includes("admin")) return "admin";
    if (roles.includes("lider_nacional")) return "lider_nacional";
    if (roles.includes("lider_estadual")) return "lider_estadual";
    if (roles.includes("lider_local")) return "lider_local";
    return "user";
  };

  const exportCsv = () => {
    const headers = ["Nome", "Email", "Igreja", "Função", "Cadastro", "Último acesso"];
    const rows = users.map((u) => [
      u.full_name || "",
      u.email || "",
      u.church_name || "",
      ROLE_LABELS[getPrimaryRole(u.roles)],
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
      password: "",
      fullName: user.full_name || "",
      churchName: user.church_name || "",
    });
    setSelectedRoles((user.roles ?? []).filter((r: string) =>
      ["admin", "lider_nacional", "lider_estadual", "lider_local"].includes(r)
    ));
    setInstruments(user.instruments ?? []);
    setVocalTypes(user.vocal_types ?? []);
    setTechnicalRoles(user.technical_roles ?? []);
    setEditingId(user.id);
    
    // Load technical categories if editing
    setIsLoadingTech(true);
    const { data, error } = await supabase.from("technical_categories").select("id, name").order("sort_order");
    setIsLoadingTech(false);
    if (data) setTechnicalCategories(data as any);
    
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

  const impersonate = async (userId: string, name: string) => {
    if (!confirm(`Conectar como "${name}"? Sua sessão atual de admin será encerrada.`)) return;
    try {
      const { actionLink } = await impersonateUserAdmin({ data: { userId } });
      window.location.href = actionLink;
    } catch (error: any) {
      toast.error(error.message || "Erro ao acessar perfil");
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.churchName.trim()) {
      toast.error("Selecione a igreja do usuário.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingId) {
        await updateUserAdmin({
          data: {
            userId: editingId,
            fullName: formData.fullName,
            churchName: formData.churchName,
            roles: selectedRoles as any,
            instruments,
            vocalTypes,
            technicalRoles,
          },
        });
        toast.success("Usuário atualizado com sucesso!");
      } else {
        await createUserAdmin({
          data: {
            email: formData.email,
            password: formData.password,
            fullName: formData.fullName,
            churchName: formData.churchName,
            roles: selectedRoles as any,
            instruments,
            vocalTypes,
            technicalRoles,
          },
        });
        toast.success("Usuário criado com sucesso!");
      }

      setIsDialogOpen(false);
      setFormData({ email: "", password: "", fullName: "", churchName: "" });
      setSelectedRoles([]);
      setInstruments([]);
      setVocalTypes([]);
      setTechnicalRoles([]);
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
          <p className="mt-2 text-sm text-muted-foreground">
            Total: {users.length}
            {viewerRole === "lider_estadual" && " · usuários da sua estadual"}
            {viewerRole === "lider_local" && " · usuários da sua igreja"}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={exportCsv} disabled={!users.length}>
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
          {isAdmin && (
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              if (open) { 
                reloadInstruments(); 
                reloadVocals(); 
                setIsLoadingTech(true);
                import("@/integrations/supabase/client").then(({ supabase }) => {
                  supabase.from("technical_categories").select("id, name").order("sort_order").then(({ data, error }) => {
                    setIsLoadingTech(false);
                    if (error) {
                      console.error("Error loading technical categories:", error);
                      toast.error("Erro ao carregar funções técnicas");
                    }
                    if (data) setTechnicalCategories(data as any);
                  });
                }).catch(err => {
                  console.error("Failed to load supabase client", err);
                  setIsLoadingTech(false);
                });
              }
              setIsDialogOpen(open);
              if (!open) {
                setEditingId(null);
                setFormData({ email: "", password: "", fullName: "", churchName: "" });
                setSelectedRoles([]);
                setInstruments([]);
                setVocalTypes([]);
                setTechnicalRoles([]);
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
                <Label htmlFor="churchName">Igreja *</Label>
                <ChurchSelect
                  id="churchName"
                  value={formData.churchName}
                  onChange={(name) => setFormData({ ...formData, churchName: name })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Funções</Label>
                <p className="text-xs text-muted-foreground">Marque uma ou mais funções. Sem marcações = usuário comum.</p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {[
                    { v: "admin", l: "Administrador" },
                    { v: "lider_nacional", l: "Líder Nacional" },
                    { v: "lider_estadual", l: "Líder Estadual" },
                    { v: "lider_local", l: "Líder Local" },
                  ].map((r) => (
                    <label key={r.v} className="flex items-center gap-2 rounded-lg border border-border p-2 cursor-pointer hover:bg-accent">
                      <Checkbox
                        checked={selectedRoles.includes(r.v)}
                        onCheckedChange={() => toggleRole(r.v)}
                      />
                      <span className="text-sm">{r.l}</span>
                    </label>
                  ))}
                </div>
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
              <div className="space-y-2">
                <Label>Equipe Técnica</Label>
                <MusicianMultiSelect
                  groups={[{ label: "Funções Técnicas", options: technicalCategories.map(c => ({ label: c.name, value: c.name })) }]}
                  value={technicalRoles}
                  onChange={setTechnicalRoles}
                  placeholder={isLoadingTech ? "Carregando funções..." : "Escolher funções técnicas…"}
                  emptyText={isLoadingTech ? "Carregando..." : "Nenhuma função técnica cadastrada."}
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
          )}
        </div>
      </header>

      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        {users.map((u) => {
          const targetIsAdmin = u.roles.includes("admin");
          const userRoles: string[] = (u.roles ?? []).filter((r: string) =>
            ["admin", "lider_nacional", "lider_estadual", "lider_local"].includes(r)
          );
          return (
            <div key={u.id} className="flex items-center gap-3 p-4">
              <div className="grid size-10 place-items-center rounded-full bg-gold-soft text-gold text-sm font-semibold">{(u.full_name?.[0] || "?").toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{u.full_name || "—"}</p>
                {u.email && <p className="text-xs text-muted-foreground truncate">{u.email}</p>}
                <p className="text-xs text-muted-foreground">desde {new Date(u.created_at).toLocaleDateString("pt-BR")}</p>
              </div>
              <div className="flex flex-wrap gap-1 justify-end max-w-[220px]">
                {userRoles.map((r) => (
                  <span key={r} className="text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-gold-soft text-gold whitespace-nowrap">{ROLE_LABELS[r]}</span>
                ))}
              </div>
              {isAdmin && (
                <>
                  <button onClick={() => impersonate(u.id, u.full_name || u.email || "usuário")} className="p-2 text-muted-foreground hover:text-gold transition-colors" title="Conectar como este usuário">
                    <LogIn className="h-4 w-4" />
                  </button>
                  <button onClick={() => toggleAdmin(u.id, targetIsAdmin)} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[10px] uppercase tracking-widest hover:bg-accent" title={targetIsAdmin ? "Remover Admin" : "Tornar Admin"}>
                    {targetIsAdmin ? <ShieldOff className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                  </button>
                  <button onClick={() => handleEditUser(u)} className="p-2 text-muted-foreground hover:text-gold transition-colors" title="Editar Usuário">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => deleteUser(u.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors" title="Excluir Usuário">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
