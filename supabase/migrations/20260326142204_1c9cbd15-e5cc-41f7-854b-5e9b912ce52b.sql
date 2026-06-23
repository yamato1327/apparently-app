
-- Development areas scoring (pre-meeting prep)
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
  ON public.development_scores FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own development scores"
  ON public.development_scores FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own development scores"
  ON public.development_scores FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own development scores"
  ON public.development_scores FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Meeting records (parent-teacher meetings)
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meeting records"
  ON public.meeting_records FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meeting records"
  ON public.meeting_records FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meeting records"
  ON public.meeting_records FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own meeting records"
  ON public.meeting_records FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Storage bucket for meeting documents
INSERT INTO storage.buckets (id, name, public) VALUES ('meeting-docs', 'meeting-docs', false);

CREATE POLICY "Users can upload meeting docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'meeting-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own meeting docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'meeting-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own meeting docs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'meeting-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
