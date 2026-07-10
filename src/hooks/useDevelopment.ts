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
  // Report fields — null for manual entries
  grade: string | null;
  subject: string | null;
  sub_area: string | null;
  teacher_comment: string | null;
  report_year: number | null;
  report_term: string | null;
  source: "manual" | "report";
  improvement_tips: string[] | null;
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

function gradeToScore(grade: string | null): ScoreValue {
  if (!grade) return "yellow";
  const g = grade.trim().toUpperCase();
  if (g === "A" || g === "EXCELLENT") return "green";
  if (g === "B" || g === "HIGH") return "green";
  if (g === "C" || g === "SATISFACTORY") return "yellow";
  return "red"; // D, E, LIMITED, VERY LOW
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

  const importReport = useCallback(async (
    childId: string,
    subjects: Array<{
      name: string;
      overall_grade?: string | null;
      teacher_comment?: string | null;
      sub_areas: Array<{
        name: string;
        grade: string;
        effort?: string | null;
        improvement_tips: string[];
      }>;
    }>,
    reportTerm: string | null,
    reportYear: number | null
  ) => {
    if (!user) return;

    if (reportTerm && reportYear) {
      await supabase
        .from("development_scores")
        .delete()
        .eq("user_id", user.id)
        .eq("child_id", childId)
        .eq("source", "report")
        .eq("report_term", reportTerm)
        .eq("report_year", reportYear);
    }

    const rows: any[] = [];
    for (const subject of subjects) {
      for (const sa of subject.sub_areas) {
        rows.push({
          user_id: user.id,
          child_id: childId,
          area: sa.name,
          category: "academic",
          score: gradeToScore(sa.grade),
          grade: sa.grade,
          subject: subject.name,
          sub_area: sa.name,
          teacher_comment: subject.teacher_comment || null,
          report_term: reportTerm,
          report_year: reportYear,
          source: "report",
          improvement_tips: sa.improvement_tips?.length ? sa.improvement_tips : null,
          notes: null,
          term: reportTerm,
        });
      }
    }

    if (rows.length === 0) return;
    const { data, error } = await supabase.from("development_scores").insert(rows).select("*");
    if (error) { toast.error("Failed to save report"); console.error(error); return; }
    setScores((prev) => [
      ...(data as DevelopmentScore[]),
      ...prev.filter((s) => !(s.source === "report" && s.report_term === reportTerm && s.report_year === reportYear && s.child_id === childId)),
    ]);
    toast.success("Report imported successfully");
  }, [user]);

  return { scores, meetings, loading, upsertScore, removeScore, upsertMeeting, removeMeeting, refetch: fetchAll, importReport };
}