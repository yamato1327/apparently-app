CREATE POLICY "Users can update own event attachments"
ON public.event_attachments
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);