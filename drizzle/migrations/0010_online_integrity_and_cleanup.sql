-- B6: match write and stat increments in one transaction.
CREATE OR REPLACE FUNCTION public.commit_match(_id uuid, _version int, _state jsonb, _finished boolean, _verified boolean, _deltas jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text; d jsonb; n int;
BEGIN
  UPDATE public.matches SET state = _state, version = _version + 1, updated_at = now(), turn_started_at = now(),
    status = CASE WHEN _finished THEN 'finished' ELSE status END,
    finished_at = CASE WHEN _finished THEN now() ELSE finished_at END,
    verified = CASE WHEN _finished THEN _verified ELSE verified END
  WHERE id = _id AND version = _version AND status = 'playing';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RETURN false; END IF;
  FOR k, d IN SELECT * FROM jsonb_each(coalesce(_deltas, '{}'::jsonb)) LOOP
    PERFORM public.add_player_stats(k::uuid, coalesce((d->>'played')::int,0), coalesce((d->>'wins')::int,0),
      coalesce((d->>'captures')::int,0), coalesce((d->>'pieces_home')::int,0), coalesce((d->>'forfeits')::int,0));
  END LOOP;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.commit_match(uuid,int,jsonb,boolean,boolean,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_match(uuid,int,jsonb,boolean,boolean,jsonb) TO service_role;

-- B7: start only with exactly the seats that exist at the moment of start.
CREATE OR REPLACE FUNCTION public.start_match(_id uuid, _version int, _state jsonb, _user_ids uuid[])
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record; cur uuid[];
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = _id FOR UPDATE;
  IF m IS NULL OR m.status <> 'waiting' OR m.version <> _version THEN RETURN 'stale'; END IF;
  SELECT coalesce(array_agg(user_id ORDER BY user_id), '{}') INTO cur FROM public.match_players WHERE match_id = _id;
  IF cur <> (SELECT coalesce(array_agg(u ORDER BY u), '{}') FROM unnest(_user_ids) u) THEN RETURN 'changed'; END IF;
  UPDATE public.matches SET status = 'playing', state = _state, version = _version + 1, turn_started_at = now(), updated_at = now() WHERE id = _id;
  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION public.start_match(uuid,int,jsonb,uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_match(uuid,int,jsonb,uuid[]) TO service_role;

-- Seats may only be added or removed while the match is waiting (serialised with start_match).
CREATE OR REPLACE FUNCTION public.guard_match_seats() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE st text;
BEGIN
  SELECT status INTO st FROM public.matches WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.match_id ELSE NEW.match_id END FOR SHARE;
  IF TG_OP = 'INSERT' AND st IS DISTINCT FROM 'waiting' THEN RAISE EXCEPTION 'match_not_waiting'; END IF;
  IF TG_OP = 'DELETE' AND st = 'playing' THEN RAISE EXCEPTION 'match_playing'; END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS guard_match_seats ON public.match_players;
CREATE TRIGGER guard_match_seats BEFORE INSERT OR DELETE ON public.match_players FOR EACH ROW EXECUTE FUNCTION public.guard_match_seats();

-- A1: close dead matches.
CREATE OR REPLACE FUNCTION public.cleanup_stale_matches() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w int; p int; g int;
BEGIN
  UPDATE public.matches SET status = 'abandoned', updated_at = now() WHERE status = 'waiting' AND created_at < now() - interval '6 hours';
  GET DIAGNOSTICS w = ROW_COUNT;
  UPDATE public.matches SET status = 'abandoned', updated_at = now() WHERE status = 'playing' AND updated_at < now() - interval '24 hours';
  GET DIAGNOSTICS p = ROW_COUNT;
  -- Everyone gone: no human seat seen for 10 minutes.
  UPDATE public.matches m SET status = 'abandoned', updated_at = now() WHERE m.status = 'playing' AND m.updated_at < now() - interval '10 minutes'
    AND NOT EXISTS (SELECT 1 FROM public.match_players s WHERE s.match_id = m.id AND s.left_at IS NULL AND s.last_seen > now() - interval '10 minutes');
  GET DIAGNOSTICS g = ROW_COUNT;
  DELETE FROM public.quick_search_locks WHERE locked_at < now() - interval '1 minute';
  UPDATE public.match_invites SET status = 'expired' WHERE status = 'pending' AND created_at < now() - interval '6 hours';
  RETURN jsonb_build_object('waiting', w, 'stale', p, 'empty', g);
END $$;
REVOKE ALL ON FUNCTION public.cleanup_stale_matches() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_matches() TO service_role;

-- A4: remove a player's id and name from every saved match.
CREATE OR REPLACE FUNCTION public.scrub_player(_uid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; anon uuid;
BEGIN
  FOR r IN SELECT DISTINCT match_id FROM public.match_players WHERE user_id = _uid
           UNION SELECT id FROM public.matches WHERE host_id = _uid OR state->'players' @> jsonb_build_array(jsonb_build_object('id', _uid::text)) LOOP
    anon := gen_random_uuid();
    UPDATE public.matches SET
      host_id = CASE WHEN host_id = _uid THEN anon ELSE host_id END,
      state = CASE WHEN state ? 'players' THEN jsonb_set(state, '{players}', (
        SELECT coalesce(jsonb_agg(CASE WHEN p->>'id' = _uid::text THEN p || jsonb_build_object('id', anon::text, 'name', '—') ELSE p END ORDER BY i), '[]'::jsonb)
        FROM jsonb_array_elements(state->'players') WITH ORDINALITY AS t(p, i))) ELSE state END
    WHERE id = r.match_id;
    UPDATE public.match_players SET user_id = anon, display_name = '—', avatar = '🎲', left_at = coalesce(left_at, now())
    WHERE match_id = r.match_id AND user_id = _uid;
  END LOOP;
  UPDATE public.app_events SET detail = detail - 'winner' WHERE detail->>'winner' = _uid::text;
END $$;
REVOKE ALL ON FUNCTION public.scrub_player(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scrub_player(uuid) TO service_role;