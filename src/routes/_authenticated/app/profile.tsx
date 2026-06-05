import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MusicianMultiSelect } from "@/components/musician-multi-select";
import { useInstrumentGroups, useVocalGroups } from "@/hooks/use-instrument-groups";

export const Route = createFileRoute("/_authenticated/app/profile")({ component: ProfilePage });

function ProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [churchName, setChurchName] = useState("");
  const [instruments, setInstruments] = useState<string[]>([]);
  const [vocalTypes, setVocalTypes] = useState<string[]>([]);
  const { groups: instrumentGroups } = useInstrumentGroups();
  const { groups: vocalGroups } = useVocalGroups();

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name,church_name,instruments,vocal_types")
        .eq("id", user.id)
        .maybeSingle();
      if (error) toast.error(error.message);
      if (data) {
        setFullName(data.full_name ?? "");
        setChurchName(data.church_name ?? "");
        setInstruments((data as any).instruments ?? []);
        setVocalTypes((data as any).vocal_types ?? []);
      }
      setLoading(false);
    })();
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim().slice(0, 255),
        church_name: churchName.trim().slice(0, 255) || null,
        instruments,
        vocal_types: vocalTypes,
      } as any)
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Perfil atualizado!");
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="px-6 md:px-12 py-8 md:py-12 max-w-2xl mx-auto">
      <header className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.25em] text-gold mb-2">Conta</p>
        <h1 className="font-serif text-4xl">Meu Perfil</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Selecione os instrumentos e tipos vocais com os quais você ministra.
        </p>
      </header>

      <form onSubmit={save} className="space-y-6 rounded-2xl border border-border bg-card p-6">
        <div className="space-y-2">
          <Label>E-mail</Label>
          <Input value={user?.email ?? ""} disabled />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fullName">Nome Completo</Label>
          <Input
            id="fullName"
            maxLength={255}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="churchName">Igreja</Label>
          <Input
            id="churchName"
            maxLength={255}
            value={churchName}
            onChange={(e) => setChurchName(e.target.value)}
            placeholder="Nome da sua igreja"
          />
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

        <div className="flex justify-end pt-2">
          <Button type="submit" className="bg-gold hover:bg-gold/90 text-white gap-2" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </form>
    </div>
  );
}
