-- Invites may be marked 'expired' (clean-up and the accept check already write it; the old check rejected it and aborted the whole clean-up run).
ALTER TABLE public.match_invites DROP CONSTRAINT IF EXISTS match_invites_status_check;
ALTER TABLE public.match_invites ADD CONSTRAINT match_invites_status_check CHECK (status IN ('pending','accepted','declined','expired'));

-- "Every human gone 10 minutes" now depends only on the players' own heartbeats and the match age:
-- computer moves refresh turn_started_at/updated_at every few seconds and must not keep a deserted match alive.
CREATE OR REPLACE FUNCTION public.cleanup_stale_matches() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w int; q int; g int; p int;
BEGIN
  UPDATE public.matches SET status = 'abandoned', updated_at = now() WHERE status = 'waiting' AND created_at < now() - interval '6 hours';
  GET DIAGNOSTICS w = ROW_COUNT;
  UPDATE public.matches SET status = 'abandoned', updated_at = now() WHERE status = 'playing' AND NOT is_private AND updated_at < now() - interval '24 hours';
  GET DIAGNOSTICS q = ROW_COUNT;
  UPDATE public.matches m SET status = 'abandoned', updated_at = now() WHERE m.status = 'playing' AND NOT m.is_private
    AND m.created_at < now() - interval '10 minutes'
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