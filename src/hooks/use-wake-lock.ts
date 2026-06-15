import { useEffect } from "react";

/**
 * Mantém a tela ligada enquanto `active` for true.
 * Reaplica o lock ao voltar para a aba (Android libera ao perder visibilidade).
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined") return;
    const anyNav = navigator as any;
    if (!anyNav.wakeLock?.request) return;

    let sentinel: any = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const s = await anyNav.wakeLock.request("screen");
        if (cancelled) {
          s.release?.().catch(() => {});
          return;
        }
        sentinel = s;
        sentinel.addEventListener?.("release", () => {
          sentinel = null;
        });
      } catch {
        // ignorado: alguns navegadores negam fora de gesto do usuário
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && !sentinel) acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      sentinel?.release?.().catch(() => {});
      sentinel = null;
    };
  }, [active]);
}
