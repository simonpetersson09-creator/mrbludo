DROP POLICY IF EXISTS "profiles readable by signed-in" ON public.profiles;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "stats readable" ON public.player_stats;
CREATE POLICY "own stats read" ON public.player_stats FOR SELECT TO authenticated USING (auth.uid() = user_id);