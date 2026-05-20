import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Music, Sparkles, Zap, Heart } from "lucide-react";
import { useAppSettings } from "@/hooks/use-app-settings";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { app_name } = useAppSettings();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="font-serif text-2xl text-gold">{app_name}</span>
          </Link>
          <nav className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Entrar</Link>
            <Link to="/signup" className="rounded-full bg-gold px-5 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground hover:opacity-90 transition-opacity">
              Começar
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 pt-40 pb-24">
        <div className="absolute inset-x-0 top-0 -z-10 h-[600px] bg-[radial-gradient(ellipse_at_top,_color-mix(in_oklab,var(--gold)_18%,transparent),transparent_70%)]" />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-gold">
            <Sparkles className="h-3 w-3" /> Renascer Praise Collection
          </p>
          <h1 className="font-serif text-6xl leading-[1.05] text-foreground md:text-8xl">
            Suas cifras,<br />
            <span className="italic text-gold">com unção.</span>
          </h1>
          <p className="mx-auto mt-8 max-w-xl text-lg text-muted-foreground">
            Plataforma profissional de cifras para o ministério. Acordes destacados, transposição instantânea,
            modo apresentação e repertórios — tudo otimizado para o palco.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to="/signup" className="rounded-full bg-gold px-8 py-3 text-xs font-semibold uppercase tracking-widest text-primary-foreground hover:opacity-90 transition-opacity">
              Criar conta grátis
            </Link>
            <Link to="/login" className="rounded-full border border-border px-8 py-3 text-xs font-semibold uppercase tracking-widest text-foreground hover:bg-card transition-colors">
              Entrar
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-24 grid gap-6 md:grid-cols-3"
        >
          {[
            { icon: Music, title: "Acordes destacados", desc: "Cores distintas tornam a leitura no palco quase instantânea." },
            { icon: Zap, title: "Transposição em 1 clique", desc: "Mude o tom da música sem perder o alinhamento da letra." },
            { icon: Heart, title: "Repertórios e favoritos", desc: "Monte seu setlist e abra em modo apresentação fullscreen." },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 + i * 0.1 }}
              className="rounded-2xl border border-border bg-card p-6"
            >
              <f.icon className="h-6 w-6 text-gold" />
              <h3 className="mt-4 font-serif text-xl">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </main>

      <footer className="border-t border-border/50 px-6 py-8 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
        © {new Date().getFullYear()} {app_name} — Core Code Web
      </footer>
    </div>
  );
}
