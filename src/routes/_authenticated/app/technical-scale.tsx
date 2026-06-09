import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Settings, Users, Calendar, Music2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/app/technical-scale")({
  component: TechnicalScalePage,
});

function TechnicalScalePage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="font-serif text-4xl text-gold mb-2">Escala Técnica</h1>
            <p className="text-muted-foreground">Gerenciamento da equipe de som, iluminação e telão.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-gold/10 p-3 rounded-xl border border-gold/20">
              <Settings className="w-6 h-6 text-gold" />
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-10">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Técnicos de Som</CardTitle>
              <Users className="w-4 h-4 text-gold" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground mt-1">Escalados para esta semana</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Iluminação</CardTitle>
              <Calendar className="w-4 h-4 text-gold" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground mt-1">Próximo evento: Domingo</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Telão</CardTitle>
              <Music2 className="w-4 h-4 text-gold" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground mt-1">Status: Operacional</p>
            </CardContent>
          </Card>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-md p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="bg-gold/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 border border-gold/10">
              <Settings className="w-8 h-8 text-gold/40" />
            </div>
            <h2 className="text-xl font-medium mb-3">Módulo em Desenvolvimento</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-8">
              Estamos preparando uma interface completa para você gerenciar a escala técnica da sua igreja com a mesma facilidade da escala musical.
            </p>
            <div className="h-1 w-24 bg-gold/20 mx-auto rounded-full" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
