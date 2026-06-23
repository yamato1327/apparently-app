
CREATE TABLE public.children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own children" ON public.children FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own children" ON public.children FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own children" ON public.children FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own children" ON public.children FOR DELETE USING (auth.uid() = user_id);

-- Add onboarding_completed flag to profiles
ALTER TABLE public.profiles ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;
