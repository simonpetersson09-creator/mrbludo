CREATE OR REPLACE FUNCTION public.get_my_ranks()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  ) x WHERE x.user_id = v_uid;
  IF coalesce(v_country, '') <> '' THEN
    SELECT r INTO v_country_rank FROM (
      SELECT s.user_id, ROW_NUMBER() OVER (ORDER BY (s.played - s.forfeits) DESC, p.created_at ASC) r
      FROM public.player_stats s JOIN public.profiles p ON p.id = s.user_id
      WHERE s.played - s.forfeits > 0 AND p.country = v_country
    ) x WHERE x.user_id = v_uid;
  END IF;
  RETURN jsonb_build_object('found', true, 'country', v_country, 'world_rank', v_world, 'country_rank', v_country_rank);
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_ranks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_ranks() TO authenticated;