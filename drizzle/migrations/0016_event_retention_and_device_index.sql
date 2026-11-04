CREATE OR REPLACE FUNCTION public.cleanup_stale_matches() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w int; q int; g int; p int; e int;
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
  -- Log retention: diagnostics 30 days (Yatzy's rule), all other admin events 90 days.
  DELETE FROM public.app_events WHERE created_at < now() - interval '30 days'
    AND kind IN ('error', 'ad', 'server_timing', 'admin_pin_fail');
  DELETE FROM public.app_events WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS e = ROW_COUNT;
  RETURN jsonb_build_object('waiting', w, 'quick_stale', q, 'quick_empty', g, 'private_stale', p, 'old_events', e);
END $$;
REVOKE ALL ON FUNCTION public.cleanup_stale_matches() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_matches() TO service_role;
CREATE INDEX IF NOT EXISTS app_events_created_at_idx ON public.app_events (created_at);
CREATE INDEX IF NOT EXISTS app_events_device_created_idx ON public.app_events (device_id, created_at DESC);