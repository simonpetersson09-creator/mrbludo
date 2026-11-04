-- Separate cleanup rules for private matches and quick play.
-- Private: waiting lobbies close after 6 h; a running private match may rest up to 14 days.
-- Quick play: running matches close after 24 h without activity, or 10 min with every human gone.
CREATE OR REPLACE FUNCTION public.cleanup_stale_matches() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w int; q int; g int; p int;
BEGIN
  -- Never-started lobbies (both kinds): the code stops working after 6 hours.
  UPDATE public.matches SET status = 'abandoned', updated_at = now() WHERE status = 'waiting' AND created_at < now() - interval '6 hours';
  GET DIAGNOSTICS w = ROW_COUNT;
  -- Quick play, running: no activity for 24 hours.
  UPDATE public.matches SET status = 'abandoned', updated_at = now() WHERE status = 'playing' AND NOT is_private AND updated_at < now() - interval '24 hours';
  GET DIAGNOSTICS q = ROW_COUNT;
  -- Quick play, running: every human seat gone for 10 minutes.
  UPDATE public.matches m SET status = 'abandoned', updated_at = now() WHERE m.status = 'playing' AND NOT m.is_private AND m.updated_at < now() - interval '10 minutes'
    AND NOT EXISTS (SELECT 1 FROM public.match_players s WHERE s.match_id = m.id AND s.left_at IS NULL AND s.last_seen > now() - interval '10 minutes');
  GET DIAGNOSTICS g = ROW_COUNT;
  -- Private, running: pausable and resumable for up to 14 days without activity.
  UPDATE public.matches SET status = 'abandoned', updated_at = now() WHERE status = 'playing' AND is_private AND updated_at < now() - interval '14 days';
  GET DIAGNOSTICS p = ROW_COUNT;
  DELETE FROM public.quick_search_locks WHERE locked_at < now() - interval '1 minute';
  UPDATE public.match_invites SET status = 'expired' WHERE status = 'pending' AND created_at < now() - interval '6 hours';
  RETURN jsonb_build_object('waiting', w, 'quick_stale', q, 'quick_empty', g, 'private_stale', p);
END $$;
REVOKE ALL ON FUNCTION public.cleanup_stale_matches() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_matches() TO service_role;