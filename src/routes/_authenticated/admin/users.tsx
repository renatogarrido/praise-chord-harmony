import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, ShieldOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users")({ component: AdminUsers });

function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);

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
      <header className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.25em] text-gold mb-2">Gestão</p>
        <h1 className="font-serif text-4xl">Usuários</h1>
        <p className="mt-2 text-sm text-muted-foreground">Total: {users.length}</p>
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
