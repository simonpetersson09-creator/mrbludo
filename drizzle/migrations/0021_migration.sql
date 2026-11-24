CREATE OR REPLACE FUNCTION public.get_top_countries(_limit integer DEFAULT 10)
 RETURNS TABLE(country text, games integer, players integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT mp.country, count(*)::int AS games, count(DISTINCT mp.user_id)::int AS players
  FROM public.match_players mp
  JOIN public.matches m ON m.id = mp.match_id
  WHERE m.status = 'finished' AND m.verified
    AND m.finished_at >= date_trunc('year', now())
    AND NOT EXISTS (SELECT 1 FROM public.admin_activity_exclusions x WHERE x.user_id = mp.user_id)
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(m.state->'players', '[]'::jsonb)) pl
                    WHERE pl->>'id' = mp.user_id::text AND coalesce((pl->>'forfeited')::boolean, false))
  GROUP BY mp.country
  ORDER BY games DESC, players DESC, mp.country
  LIMIT least(greatest(coalesce(_limit, 10), 1), 50);
$function$;

CREATE OR REPLACE FUNCTION public.get_weekly_most_active(_limit integer DEFAULT 10)
 RETURNS TABLE(user_id uuid, display_name text, avatar text, country text, games integer, games_24h integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT mp.user_id, p.display_name, p.avatar, p.country,
         count(*)::int AS games,
         count(*) FILTER (WHERE m.finished_at >= now() - interval '24 hours')::int AS games_24h
  FROM public.match_players mp
  JOIN public.matches m ON m.id = mp.match_id
  JOIN public.profiles p ON p.id = mp.user_id
  WHERE m.status = 'finished' AND m.verified
    AND m.finished_at >= greatest(date_trunc('month', now()), timestamptz '2026-11-08T13:00:01.000Z')
    AND NOT EXISTS (SELECT 1 FROM public.admin_activity_exclusions x WHERE x.user_id = mp.user_id)
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(m.state->'players', '[]'::jsonb)) pl
                    WHERE pl->>'id' = mp.user_id::text AND coalesce((pl->>'forfeited')::boolean, false))
  GROUP BY mp.user_id, p.display_name, p.avatar, p.country
  ORDER BY games DESC, max(m.finished_at) ASC
  LIMIT least(greatest(coalesce(_limit, 10), 1), 50);
$function$;

CREATE OR REPLACE FUNCTION public.get_my_ranks()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_country text;
  v_ranked integer;
  v_world bigint;
  v_country_rank bigint;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('found', false); END IF;
  SELECT p.country, GREATEST(s.played - s.forfeits, 0) INTO v_country, v_ranked
  FROM public.profiles p JOIN public.player_stats s ON s.user_id = p.id
  WHERE p.id = v_uid;
  IF v_ranked IS NULL OR v_ranked <= 0 THEN
    RETURN jsonb_build_object('found', false, 'country', v_country);
  END IF;
  SELECT r INTO v_world FROM (
    SELECT s.user_id, ROW_NUMBER() OVER (ORDER BY (s.played - s.forfeits) DESC, p.created_at ASC) r
    FROM public.player_stats s JOIN public.profiles p ON p.id = s.user_id
    WHERE s.played - s.forfeits > 0
      AND (s.user_id = v_uid OR NOT EXISTS (SELECT 1 FROM public.admin_activity_exclusions x WHERE x.user_id = s.user_id))
  ) x WHERE x.user_id = v_uid;
  IF coalesce(v_country, '') <> '' THEN
    SELECT r INTO v_country_rank FROM (
      SELECT s.user_id, ROW_NUMBER() OVER (ORDER BY (s.played - s.forfeits) DESC, p.created_at ASC) r
      FROM public.player_stats s JOIN public.profiles p ON p.id = s.user_id
      WHERE s.played - s.forfeits > 0 AND p.country = v_country
        AND (s.user_id = v_uid OR NOT EXISTS (SELECT 1 FROM public.admin_activity_exclusions x WHERE x.user_id = s.user_id))
    ) x WHERE x.user_id = v_uid;
  END IF;
  RETURN jsonb_build_object('found', true, 'country', v_country, 'world_rank', v_world, 'country_rank', v_country_rank);
END;
$function$;