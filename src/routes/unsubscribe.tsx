import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: (s: Record<string, unknown>) => ({ token: (s.token as string) ?? "" }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const { token } = useSearch({ from: "/unsubscribe" });
  const [state, setState] = useState<"loading" | "ready" | "already" | "invalid" | "success" | "error">("loading");

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.valid) setState("ready");
        else if (d?.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      })
      .catch(() => setState("error"));
  }, [token]);

  const confirm = async () => {
    setState("loading");
    try {
      const r = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const d = await r.json();
      if (d?.success) setState("success");
      else if (d?.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } catch { setState("error"); }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="max-w-md w-full text-center rounded-2xl border border-border bg-card p-8">
        <p className="text-[10px] uppercase tracking-[0.25em] text-gold mb-3">Cifras Praise</p>
        <h1 className="font-serif text-3xl mb-4">Cancelar inscrição</h1>
        {state === "loading" && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {state === "ready" && (
          <>
            <p className="text-sm text-muted-foreground mb-6">Confirme que você deseja não receber mais e-mails.</p>
            <button onClick={confirm} className="rounded-full bg-gold px-6 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground">Confirmar cancelamento</button>
          </>
        )}
        {state === "success" && <p className="text-sm">Pronto! Você não receberá mais e-mails.</p>}
        {state === "already" && <p className="text-sm">Este e-mail já está descadastrado.</p>}
        {state === "invalid" && <p className="text-sm text-destructive">Link inválido ou expirado.</p>}
        {state === "error" && <p className="text-sm text-destructive">Erro ao processar. Tente novamente.</p>}
      </div>
    </div>
  );
}
