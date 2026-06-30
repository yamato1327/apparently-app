import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { DraftEvent } from "@/lib/normalizeDraft";

export interface GmailDraftEvent extends DraftEvent {
  sourceEmailSubject?: string;
  sourceMessageId?: string;
}

export const useGmailScan = () => {
  const { user } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [drafts, setDrafts] = useState<GmailDraftEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const scan = async () => {
    setScanning(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("scan-gmail", {
        body: { userId: user?.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDrafts(data?.events ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  return { scan, scanning, drafts, setDrafts, error };
};
