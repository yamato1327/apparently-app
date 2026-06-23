import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type ScoreValue = "red" | "yellow" | "green";
export type MeetingPhase = "pre" | "meeting" | "post";
export type Owner = "Teacher" | "Parent" | "Child" | "All";

export interface DevelopmentScore {
  id: string;
  child_id: string;
  area: string;
  category: string;
  score: ScoreValue;
  notes: string | null;
  term: string | null;
}

export interface MeetingRecord {
  id: string;
  child_id: string;
  meeting_date: string;
  title: string;
  overall_notes: string | null;
  improvement_area_1: string | null;
  improvement_area_2: string | null;
  improvement_area_3: string | null;
  file_url: string | null;
  file_name: string | null;
  ai_extracted: boolean;
  phase: MeetingPhase;
  event_id: string | null;
  pre_parent_notes: string | null;
  pre_child_notes: string | null;
  post_focus_1: string | null;
  post_focus_2: string | null;
  post_focus_3: string | null;
  post_owner_1: string | null;
  post_owner_2: string | null;
  post_owner_3: string | null;
}

export function useDevelopment() {
  const { user } = useAuth();
  const [scores, setScores] = useState<DevelopmentScore[]>([]);
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) { setScores([]); setMeetings([]); setLoading(false); return; }
    setLoading(true);
    const [s, m] = await Promise.all([
      supabase.from("development_scores").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("meeting_records").select("*").eq("user_id", user.id).order("meeting_date", { ascending: false }),
    ]);
    if (s.error) console.error(s.error); else setScores((s.data || []) as DevelopmentScore[]);
    if (m.error) console.error(m.error); else setMeetings((m.data || []) as MeetingRecord[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const upsertScore = useCallback(async (input: Partial<DevelopmentScore> & { child_id: string; area: string }) => {
    if (!user) return;
    const payload: any = { ...input, user_id: user.id };
    const { data, error } = input.id
      ? await supabase.from("development_scores").update(payload).eq("id", input.id).select("*").single()
      : await supabase.from("development_scores").insert(payload).select("*").single();
    if (error) { toast.error("Failed to save score"); return; }
    setScores((prev) => {
      const others = prev.filter((p) => p.id !== data.id);
      return [data as DevelopmentScore, ...others];
    });
  }, [user]);

  const removeScore = useCallback(async (id: string) => {
    const { error } = await supabase.from("development_scores").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    setScores((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const upsertMeeting = useCallback(async (input: Partial<MeetingRecord> & { child_id: string }) => {
    if (!user) return null;
    const payload: any = { ...input, user_id: user.id };
    const { data, error } = input.id
      ? await supabase.from("meeting_records").update(payload).eq("id", input.id).select("*").single()
      : await supabase.from("meeting_records").insert(payload).select("*").single();
    if (error) { toast.error("Failed to save meeting"); return null; }
    setMeetings((prev) => {
      const others = prev.filter((p) => p.id !== data.id);
      return [data as MeetingRecord, ...others];
    });
    return data as MeetingRecord;
  }, [user]);

  const removeMeeting = useCallback(async (id: string) => {
    const { error } = await supabase.from("meeting_records").delete().eq("id", id);
    if (error) { toast.error("Failed to delete meeting"); return; }
    setMeetings((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return { scores, meetings, loading, upsertScore, removeScore, upsertMeeting, removeMeeting, refetch: fetchAll };
}