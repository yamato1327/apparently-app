-- 1. Role enum + table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Security definer role check (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 3. RLS: users can see their own roles; admins can see all
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- 4. Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- 5. Activity stats function (admin-only)
CREATE OR REPLACE FUNCTION public.admin_get_user_activity()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  city text,
  state text,
  onboarding_completed boolean,
  signed_up_at timestamptz,
  last_sign_in_at timestamptz,
  child_count bigint,
  event_count bigint,
  completed_event_count bigint,
  last_event_created_at timestamptz,
  is_admin boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::text,
    p.display_name,
    p.city,
    p.state,
    COALESCE(p.onboarding_completed, false) AS onboarding_completed,
    u.created_at AS signed_up_at,
    u.last_sign_in_at,
    COALESCE(c.child_count, 0) AS child_count,
    COALESCE(e.event_count, 0) AS event_count,
    COALESCE(e.completed_event_count, 0) AS completed_event_count,
    e.last_event_created_at,
    public.has_role(u.id, 'admin') AS is_admin
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  LEFT JOIN (
    SELECT user_id, COUNT(*)::bigint AS child_count
    FROM public.children GROUP BY user_id
  ) c ON c.user_id = u.id
  LEFT JOIN (
    SELECT user_id,
      COUNT(*)::bigint AS event_count,
      COUNT(*) FILTER (WHERE is_completed)::bigint AS completed_event_count,
      MAX(created_at) AS last_event_created_at
    FROM public.events GROUP BY user_id
  ) e ON e.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

-- 6. Bootstrap: promote scott to admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'srihenshaw@gmail.com'
ON CONFLICT DO NOTHING;