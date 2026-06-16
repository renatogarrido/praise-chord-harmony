import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/admin")({ component: AdminLayout });

function AdminLayout() {
  const { isAdmin, canViewUsers, canManageSchedule, loading } = useAuth();
  const nav = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  
  // Dashboard access for admins and leaders (who can manage schedule/view users)
  const isLeader = canViewUsers || canManageSchedule;
  const isKnowledge = pathname.startsWith("/app/admin/knowledge");
  const canAccessRoute = isAdmin || isKnowledge || (isLeader && pathname === "/app/admin") || (canViewUsers && pathname === "/app/admin/users");
  
  useEffect(() => { 
    if (!loading && !canAccessRoute) nav({ to: "/app/albums" }); 
  }, [loading, canAccessRoute, nav]);

  if (loading) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div>;
  if (!canAccessRoute) return null;
  return <Outlet />;
}
