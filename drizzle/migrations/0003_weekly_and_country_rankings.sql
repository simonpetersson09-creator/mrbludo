-- Yatzy-style "most active this week" and "top countries" lists. Only finished, verified online matches count.
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
  GROUP BY mp.user_id, p.display_name, p.avatar, p.country
  ORDER BY games DESC, max(m.finished_at) ASC
  LIMIT least(greatest(coalesce(_limit, 10), 1), 50);
$$;

CREATE OR REPLACE FUNCTION public.get_top_countries(_limit integer DEFAULT 10)
RETURNS TABLE(country text, games integer, players integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.country, count(*)::int AS games, count(DISTINCT mp.user_id)::int AS players
  FROM public.match_players mp
  JOIN public.matches m ON m.id = mp.match_id
  JOIN public.profiles p ON p.id = mp.user_id
  WHERE m.status = 'finished' AND m.verified
    AND m.finished_at >= date_trunc('year', now())
  GROUP BY p.country
  ORDER BY games DESC, players DESC, p.country
  LIMIT least(greatest(coalesce(_limit, 10), 1), 50);
$$;

REVOKE ALL ON FUNCTION public.get_weekly_most_active(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_top_countries(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_weekly_most_active(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_top_countries(integer) TO authenticated, service_role;