CREATE OR REPLACE FUNCTION public.get_weekly_most_active(_limit integer DEFAULT 10)
RETURNS TABLE(user_id uuid, display_name text, avatar text, country text, games integer, games_24h integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT mp.user_id, p.display_name, p.avatar, p.country,
         count(*)::int AS games,
         count(*) FILTER (WHERE m.finished_at >= now() - interval '24 hours')::int AS games_24h
  FROM public.match_players mp
  JOIN public.matches m ON m.id = mp.match_id
  JOIN public.profiles p ON p.id = mp.user_id
  WHERE m.status = 'finished' AND m.verified
    AND m.finished_at >= date_trunc('week', now())
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(m.state->'players', '[]'::jsonb)) pl
                    WHERE pl->>'id' = mp.user_id::text AND coalesce((pl->>'forfeited')::boolean, false))
  GROUP BY mp.user_id, p.display_name, p.avatar, p.country
  ORDER BY games DESC, max(m.finished_at) ASC
  LIMIT least(greatest(coalesce(_limit, 10), 1), 50);
$$;

-- Countries use the country each player had when the match was played, so changing country later never moves old games.
CREATE OR REPLACE FUNCTION public.get_top_countries(_limit integer DEFAULT 10)
RETURNS TABLE(country text, games integer, players integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT mp.country, count(*)::int AS games, count(DISTINCT mp.user_id)::int AS players
  FROM public.match_players mp
  JOIN public.matches m ON m.id = mp.match_id
  WHERE m.status = 'finished' AND m.verified
    AND m.finished_at >= date_trunc('year', now())
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(m.state->'players', '[]'::jsonb)) pl
                    WHERE pl->>'id' = mp.user_id::text AND coalesce((pl->>'forfeited')::boolean, false))
  GROUP BY mp.country
  ORDER BY games DESC, players DESC, mp.country
  LIMIT least(greatest(coalesce(_limit, 10), 1), 50);
$$;

-- Other players only see what lists and cards show; friend code and sign-up time stay private.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, display_name, avatar, country, last_seen, avatar_image) ON public.profiles TO authenticated;
REVOKE SELECT ON public.player_stats FROM authenticated;
GRANT SELECT (user_id, played, wins, captures, pieces_home, forfeits) ON public.player_stats TO authenticated;