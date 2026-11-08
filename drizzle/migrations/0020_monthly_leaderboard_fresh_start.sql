CREATE OR REPLACE FUNCTION public.get_weekly_most_active(_limit integer DEFAULT 10)
 RETURNS TABLE(user_id uuid, display_name text, avatar text, country text, games integer, games_24h integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  -- Keep historical results; only this monthly competition starts afresh.
  SELECT mp.user_id, p.display_name, p.avatar, p.country,
         count(*)::int AS games,
         count(*) FILTER (WHERE m.finished_at >= now() - interval '24 hours')::int AS games_24h
  FROM public.match_players mp
  JOIN public.matches m ON m.id = mp.match_id
  JOIN public.profiles p ON p.id = mp.user_id
  WHERE m.status = 'finished' AND m.verified
    AND m.finished_at >= greatest(date_trunc('month', now()), timestamptz '2026-11-08T13:00:01.000Z')
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(m.state->'players', '[]'::jsonb)) pl
                    WHERE pl->>'id' = mp.user_id::text AND coalesce((pl->>'forfeited')::boolean, false))
  GROUP BY mp.user_id, p.display_name, p.avatar, p.country
  ORDER BY games DESC, max(m.finished_at) ASC
  LIMIT least(greatest(coalesce(_limit, 10), 1), 50);
$function$;
REVOKE ALL ON FUNCTION public.get_weekly_most_active(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_weekly_most_active(integer) TO authenticated, service_role;