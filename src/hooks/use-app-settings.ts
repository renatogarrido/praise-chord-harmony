import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppSettings = {
  primary_color: string;
  logo_url: string | null;
  bg_url: string | null;
  default_theme: "dark" | "light";
  app_name: string;
};

const DEFAULTS: AppSettings = {
  primary_color: "#C5A059",
  logo_url: null,
  bg_url: null,
  default_theme: "dark",
  app_name: "Cifras Praise",
};

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  useEffect(() => {
    supabase.from("app_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) setSettings({
        primary_color: data.primary_color,
        logo_url: data.logo_url,
        bg_url: data.bg_url,
        default_theme: (data.default_theme as "dark" | "light") || "dark",
        app_name: data.app_name,
      });
    });
  }, []);
  // Apply theme class
  useEffect(() => {
    document.documentElement.classList.toggle("light", settings.default_theme === "light");
  }, [settings.default_theme]);
  return settings;
}
