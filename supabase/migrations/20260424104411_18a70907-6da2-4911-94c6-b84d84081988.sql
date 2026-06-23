CREATE TABLE public.reading_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  photo_path TEXT NOT NULL,
  title TEXT,
  question_1 TEXT,
  question_2 TEXT,
  question_3 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reading_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reading books"
  ON public.reading_books FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reading books"
  ON public.reading_books FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reading books"
  ON public.reading_books FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reading books"
  ON public.reading_books FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_reading_books_updated_at
  BEFORE UPDATE ON public.reading_books
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('reading-photos', 'reading-photos', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload reading photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'reading-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own reading photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'reading-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own reading photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'reading-photos' AND (storage.foldername(name))[1] = auth.uid()::text);