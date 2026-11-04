ALTER TABLE public.push_tokens ADD COLUMN IF NOT EXISTS reminders boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.weekly_reminder_targets(_limit int DEFAULT 300)
RETURNS TABLE(user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT t.user_id
  FROM public.push_tokens t
  JOIN public.profiles p ON p.id = t.user_id
  WHERE t.reminders
    AND p.last_seen < now() - interval '12 hours'
    AND p.last_seen > now() - interval '30 days'
    AND extract(isodow FROM p.last_seen) = extract(isodow FROM now())
    AND extract(hour FROM p.last_seen) = extract(hour FROM now())
    AND NOT EXISTS (
      SELECT 1 FROM public.push_sent s
      WHERE s.user_id = t.user_id AND s.key LIKE 'weekly:%' AND s.created_at > now() - interval '6 days')
  LIMIT _limit
$$;
REVOKE ALL ON FUNCTION public.weekly_reminder_targets(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.weekly_reminder_targets(int) TO service_role;