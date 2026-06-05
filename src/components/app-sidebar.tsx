import { Link, useRouterState } from "@tanstack/react-router";
import { Library, Heart, ListMusic, Clock, LayoutDashboard, Music2, Users, Album, Settings, LogOut, LifeBuoy, UserCircle, Guitar } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useAppSettings } from "@/hooks/use-app-settings";

const userLinks = [
  { to: "/app/albums", label: "Álbuns", icon: Library },
  { to: "/app/songs", label: "Cifras", icon: Music2 },
  { to: "/app/favorites", label: "Favoritos", icon: Heart },
  { to: "/app/setlists", label: "Repertórios", icon: ListMusic },
  { to: "/app/history", label: "Recentes", icon: Clock },
  { to: "/app/profile", label: "Meu Perfil", icon: UserCircle },
  { to: "/app/support", label: "Suporte", icon: LifeBuoy },
];

const adminLinks = [
  { to: "/app/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/admin/albums", label: "Álbuns", icon: Album },
  { to: "/app/admin/songs", label: "Cifras", icon: Music2 },
  { to: "/app/admin/users", label: "Usuários", icon: Users },
  { to: "/app/admin/instruments", label: "Instrumentos", icon: Guitar },
  { to: "/app/admin/support", label: "Suporte", icon: LifeBuoy },
  { to: "/app/admin/settings", label: "Personalização", icon: Settings },
];

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, isAdmin, signOut } = useAuth();
  const { app_name, logo_url } = useAppSettings();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border/50 bg-sidebar/80 backdrop-blur-xl">
      <div className="px-7 pt-8 pb-10">
        {logo_url ? (
          <img src={logo_url} alt={app_name} className="h-10 object-contain" />
        ) : (
          <>
            <h1 className="font-serif text-3xl text-gold leading-none">{app_name}</h1>
            <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70">Renascer Collection</p>
          </>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-4 space-y-7">
        <Section label="Biblioteca">
          {userLinks.map((l) => (
            <NavLink key={l.to} to={l.to} icon={l.icon} active={pathname === l.to || pathname.startsWith(l.to + "/")} onClick={onNavigate}>
              {l.label}
            </NavLink>
          ))}
        </Section>

        {isAdmin && (
          <Section label="Administração">
            {adminLinks.map((l) => (
              <NavLink key={l.to} to={l.to} icon={l.icon}
                active={l.to === "/app/admin" ? pathname === "/app/admin" : pathname.startsWith(l.to)}
                onClick={onNavigate}>
                {l.label}
              </NavLink>
            ))}
          </Section>
        )}
      </nav>

      <div className="border-t border-border/50 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="grid size-9 place-items-center rounded-full border border-gold/30 bg-gold-soft text-[11px] font-semibold text-gold">
            {(user?.email?.[0] || "?").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{user?.email}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70">{isAdmin ? "Admin" : "Membro"}</p>
          </div>
        </div>
        <button onClick={() => signOut()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
          <LogOut className="h-3.5 w-3.5" /> Sair
        </button>
      </div>
    </aside>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-3 mb-3 text-[10px] uppercase tracking-[0.2em] font-semibold text-muted-foreground/50">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavLink({ to, icon: Icon, active, children, onClick }: { to: string; icon: any; active: boolean; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        active ? "bg-gold-soft text-gold font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </Link>
  );
}
