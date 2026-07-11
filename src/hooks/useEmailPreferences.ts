import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface EmailPreferences {
  morning_enabled: boolean;
  morning_time: string; // "HH:MM" or "HH:MM:SS"
  night_enabled: boolean;
  night_time: string;
  timezone: string;
  cc_email: string | null;
}

const DEFAULTS: EmailPreferences = {
  morning_enabled: true,
  morning_time: "06:30",
  night_enabled: true,
  night_time: "20:30",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Australia/Perth",
  cc_email: null,
};

const trimTime = (t: string) => (t?.length >= 5 ? t.slice(0, 5) : t);

export const useEmailPreferences = () => {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<EmailPreferences>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("email_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setPrefs({
          morning_enabled: data.morning_enabled,
          morning_time: trimTime(data.morning_time),
          night_enabled: data.night_enabled,
          night_time: trimTime(data.night_time),
          timezone: data.timezone || DEFAULTS.timezone,
          cc_email: (data as any).cc_email ?? null,
        });
      } else {
        // Auto-create row if missing (e.g. legacy user)
        await supabase.from("email_preferences").insert({ user_id: user.id });
      }
      setLoading(false);
    })();
  }, [user]);

  const update = useCallback(
    async (patch: Partial<EmailPreferences>) => {
      if (!user) return false;
      const next = { ...prefs, ...patch };
      setPrefs(next);
      const { error } = await supabase
        .from("email_preferences")
        .update(patch)
        .eq("user_id", user.id);
      return !error;
    },
    [user, prefs],
  );

  const sendTest = useCallback(
    async (kind: "morning" | "night") => {
      if (!user) return { ok: false, error: "Not signed in" };
      const { data, error } = await supabase.functions.invoke("send-insight-emails", {
        body: { test: true, kind, userId: user.id },
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, data };
    },
    [user],
  );

  return { prefs, loading, update, sendTest };
};
