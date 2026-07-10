-- Add report-specific fields to development_scores
-- These are null for manual entries (source = 'manual') and populated for AI-extracted report entries (source = 'report').

ALTER TABLE public.development_scores
  ADD COLUMN IF NOT EXISTS grade TEXT,
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS sub_area TEXT,
  ADD COLUMN IF NOT EXISTS teacher_comment TEXT,
  ADD COLUMN IF NOT EXISTS report_year INT,
  ADD COLUMN IF NOT EXISTS report_term TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS improvement_tips TEXT[];

-- source must be 'manual' or 'report'
ALTER TABLE public.development_scores
  ADD CONSTRAINT development_scores_source_check
  CHECK (source IN ('manual', 'report'));
