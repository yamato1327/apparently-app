-- Create private storage bucket for event attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-attachments', 'event-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Table to track attachments per event
CREATE TABLE IF NOT EXISTS public.event_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL,
  user_id UUID NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_attachments_event ON public.event_attachments(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attachments_user ON public.event_attachments(user_id);

ALTER TABLE public.event_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own event attachments"
  ON public.event_attachments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own event attachments"
  ON public.event_attachments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own event attachments"
  ON public.event_attachments FOR DELETE
  USING (auth.uid() = user_id);

-- Storage policies: users can only access files under their own user_id folder
CREATE POLICY "Users can view own event attachment files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'event-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can upload own event attachment files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'event-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own event attachment files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'event-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );