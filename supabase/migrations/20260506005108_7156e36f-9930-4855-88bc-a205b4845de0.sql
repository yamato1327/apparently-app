
-- Add UPDATE policies for meeting-docs and reading-photos storage buckets
CREATE POLICY "Users can update own meeting docs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'meeting-docs' AND (storage.foldername(name))[1] = (auth.uid())::text)
WITH CHECK (bucket_id = 'meeting-docs' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "Users can update own reading photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'reading-photos' AND (storage.foldername(name))[1] = (auth.uid())::text)
WITH CHECK (bucket_id = 'reading-photos' AND (storage.foldername(name))[1] = (auth.uid())::text);

-- Fix search_path on functions that are missing it
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;

-- Revoke public/anon EXECUTE on SECURITY DEFINER functions that should not be publicly callable
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, public;
