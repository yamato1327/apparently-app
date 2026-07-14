-- Add progress tracking to reading_books
-- Values: 'beginning', 'middle', 'end', or a page number stored as text (e.g. '42')
ALTER TABLE public.reading_books
  ADD COLUMN IF NOT EXISTS progress TEXT;
