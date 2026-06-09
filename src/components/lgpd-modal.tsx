import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function LGPDModal() {
  const { user, acceptedTerms, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          accepted_terms: true,
          terms_accepted_at: new Date().toISOString(),
        } as any)
        .eq("id", user.id);

      if (error) throw error;
      
      await refreshProfile();
      toast.success("Termos aceitos com sucesso!");
    } catch (error: any) {
      console.error("Error accepting terms:", error);
      toast.error("Erro ao aceitar termos: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!acceptedTerms}>
      <DialogContent className="sm:max-w-[500px] border-gold/20" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl text-gold">Termos de Privacidade (LGPD)</DialogTitle>
          <DialogDescription className="pt-4 text-foreground leading-relaxed">
            Para continuar utilizando o <strong>Cifras Praise</strong>, você precisa aceitar nossos termos de tratamento de dados de acordo com a Lei Geral de Proteção de Dados (LGPD) do Brasil.
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4 p-4 rounded-lg bg-accent/50 text-sm space-y-3 max-h-[300px] overflow-y-auto border border-border">
          <p>
            <strong>Quais dados coletamos?</strong><br />
            Nome completo, e-mail, foto de perfil, igreja e suas preferências musicais/técnicas dentro do sistema.
          </p>
          <p>
            <strong>Qual a finalidade?</strong><br />
            Os dados são utilizados exclusivamente para identificação no sistema, gestão de escalas, ensaios e acesso às cifras e materiais de estudo.
          </p>
          <p>
            <strong>Seus direitos:</strong><br />
            Você pode solicitar a exclusão de sua conta e dados a qualquer momento através do suporte ou de sua liderança local.
          </p>
          <p className="text-xs text-muted-foreground pt-2 italic">
            Ao clicar em "Aceitar e Continuar", você concorda com nossos <Link to="/public/terms" className="text-gold underline font-medium" target="_blank">termos de uso e política de privacidade</Link>.
          </p>
        </div>

        <DialogFooter className="mt-6">
          <Button 
            onClick={handleAccept} 
            disabled={loading}
            className="w-full bg-gold hover:bg-gold/90 text-white font-semibold uppercase tracking-widest text-xs py-6"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Aceitar e Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
