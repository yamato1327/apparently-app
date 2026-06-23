-- Recreate development_scores
CREATE TABLE public.development_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  area TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'academic',
  score TEXT NOT NULL DEFAULT 'green' CHECK (score IN ('red', 'yellow', 'green')),
  notes TEXT,
  term TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.development_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own development scores"
  ON public.development_scores FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own development scores"
  ON public.development_scores FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own development scores"
  ON public.development_scores FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own development scores"
  ON public.development_scores FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_development_scores_updated_at
  BEFORE UPDATE ON public.development_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Recreate meeting_records (with all phase fields)
CREATE TABLE public.meeting_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL DEFAULT 'Parent-Teacher Meeting',
  overall_notes TEXT,
  improvement_area_1 TEXT,
  improvement_area_2 TEXT,
  improvement_area_3 TEXT,
  file_url TEXT,
  file_name TEXT,
  ai_extracted BOOLEAN NOT NULL DEFAULT false,
  phase TEXT NOT NULL DEFAULT 'pre' CHECK (phase IN ('pre', 'meeting', 'post')),
  event_id UUID,
  pre_parent_notes TEXT,
  pre_child_notes TEXT,
  post_focus_1 TEXT,
  post_focus_2 TEXT,
  post_focus_3 TEXT,
  post_owner_1 TEXT,
  post_owner_2 TEXT,
  post_owner_3 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meeting records"
  ON public.meeting_records FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meeting records"
  ON public.meeting_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meeting records"
  ON public.meeting_records FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own meeting records"
  ON public.meeting_records FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_meeting_records_updated_at
  BEFORE UPDATE ON public.meeting_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();