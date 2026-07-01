import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { DraftEvent } from "@/lib/normalizeDraft";

export interface CalendarDraftEvent extends DraftEvent {
  location?: string;
  isAllDay: boolean;
  googleCalendarId: string;
  sourceCalendarTitle: string;
}

export const useGoogleCalendarSync = () => {
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [drafts, setDrafts] = useState<CalendarDraftEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const sync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("sync-google-calendar", {
        body: { userId: user?.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDrafts(data?.events ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return { sync, syncing, drafts, setDrafts, error };
};
