CREATE OR REPLACE FUNCTION public.add_player_stats(_uid uuid, _played int, _wins int, _captures int, _pieces_home int, _forfeits int)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.player_stats AS s (user_id, played, wins, captures, pieces_home, forfeits, updated_at)
  SELECT _uid, _played, _wins, _captures, _pieces_home, _forfeits, now()
  WHERE EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid)
  ON CONFLICT (user_id) DO UPDATE SET
    played = s.played + EXCLUDED.played, wins = s.wins + EXCLUDED.wins,
    captures = s.captures + EXCLUDED.captures, pieces_home = s.pieces_home + EXCLUDED.pieces_home,
    forfeits = s.forfeits + EXCLUDED.forfeits, updated_at = now();
$$;
REVOKE ALL ON FUNCTION public.add_player_stats(uuid,int,int,int,int,int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_player_stats(uuid,int,int,int,int,int) TO service_role;

CREATE TABLE public.quick_search_locks (
  user_id uuid PRIMARY KEY,
  locked_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.quick_search_locks TO service_role;
ALTER TABLE public.quick_search_locks ENABLE ROW LEVEL SECURITY;