-- Atomic, server-only rate limiting (PIN tries, friend requests, invites).
CREATE TABLE public.rate_limit_hits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  hits integer NOT NULL DEFAULT 0
);
GRANT ALL ON public.rate_limit_hits TO service_role;
ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;

-- Counts one hit for _key and returns true while the caller is within _max hits per window.
CREATE OR REPLACE FUNCTION public.rate_hit(_key text, _max integer, _window_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  INSERT INTO public.rate_limit_hits AS r (key, window_start, hits) VALUES (_key, now(), 1)
  ON CONFLICT (key) DO UPDATE SET
    hits = CASE WHEN r.window_start < now() - make_interval(secs => _window_seconds) THEN 1 ELSE r.hits + 1 END,
    window_start = CASE WHEN r.window_start < now() - make_interval(secs => _window_seconds) THEN now() ELSE r.window_start END
  RETURNING hits INTO n;
  RETURN n <= _max;
END $$;
-- Reads the current count without adding a hit.
CREATE OR REPLACE FUNCTION public.rate_peek(_key text, _window_seconds integer)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT hits FROM public.rate_limit_hits WHERE key = _key AND window_start >= now() - make_interval(secs => _window_seconds)), 0)
$$;
REVOKE ALL ON FUNCTION public.rate_hit(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rate_peek(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_hit(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.rate_peek(text, integer) TO service_role;

-- Cleanup: "every human gone for 10 minutes" no longer depends on updated_at, which computer moves keep refreshing.
CREATE OR REPLACE FUNCTION public.cleanup_stale_matches() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w int; q int; g int; p int;
BEGIN
  UPDATE public.matches SET status = 'abandoned', updated_at = now() WHERE status = 'waiting' AND created_at < now() - interval '6 hours';
  GET DIAGNOSTICS w = ROW_COUNT;
  UPDATE public.matches SET status = 'abandoned', updated_at = now() WHERE status = 'playing' AND NOT is_private AND updated_at < now() - interval '24 hours';
  GET DIAGNOSTICS q = ROW_COUNT;
  UPDATE public.matches m SET status = 'abandoned', updated_at = now() WHERE m.status = 'playing' AND NOT m.is_private
    AND coalesce(m.turn_started_at, m.created_at) < now() - interval '10 minutes'
    AND NOT EXISTS (SELECT 1 FROM public.match_players s WHERE s.match_id = m.id AND s.left_at IS NULL AND s.last_seen > now() - interval '10 minutes');
  GET DIAGNOSTICS g = ROW_COUNT;
  UPDATE public.matches SET status = 'abandoned', updated_at = now() WHERE status = 'playing' AND is_private AND updated_at < now() - interval '14 days';
  GET DIAGNOSTICS p = ROW_COUNT;
  DELETE FROM public.quick_search_locks WHERE locked_at < now() - interval '1 minute';
  UPDATE public.match_invites SET status = 'expired' WHERE status = 'pending' AND created_at < now() - interval '6 hours';
  DELETE FROM public.rate_limit_hits WHERE window_start < now() - interval '2 days';
  RETURN jsonb_build_object('waiting', w, 'quick_stale', q, 'quick_empty', g, 'private_stale', p);
END $$;
REVOKE ALL ON FUNCTION public.cleanup_stale_matches() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_matches() TO service_role;

-- Profiles: signed-in players may read only public columns; last_seen, friend code, picture and sign-up time go through server checks.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, display_name, avatar, country) ON public.profiles TO authenticated;
