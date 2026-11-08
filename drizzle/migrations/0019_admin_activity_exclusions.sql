CREATE TABLE public.admin_activity_exclusions (
  user_id uuid PRIMARY KEY,
  device_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_activity_exclusions TO service_role;
ALTER TABLE public.admin_activity_exclusions ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.admin_activity_exclusions IS 'Server-managed test identities/devices omitted from admin activity analytics, never from diagnostics or player results.';