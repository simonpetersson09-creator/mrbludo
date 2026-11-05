create or replace function public.unique_default_name() returns text
language plpgsql security definer set search_path to 'public' as $$
declare n text; i int := 0;
begin
  loop
    n := 'Spelare ' || (1000 + floor(random() * 9000))::int;
    i := i + 1;
    exit when i > 20 or not exists (select 1 from public.profiles where display_name = n);
  end loop;
  return n;
end $$;
revoke all on function public.unique_default_name() from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.profiles (id, display_name, avatar)
  values (new.id,
    left(coalesce(nullif(new.raw_user_meta_data->>'display_name',''), nullif(new.raw_user_meta_data->>'full_name',''), nullif(split_part(coalesce(new.email,''),'@',1),''), public.unique_default_name()), 20),
    '🎲');
  insert into public.player_stats (user_id) values (new.id);
  return new;
end $$;

do $$
declare r record; n text;
begin
  for r in select id from public.profiles where display_name = 'Spelare' loop
    n := public.unique_default_name();
    update public.profiles set display_name = n where id = r.id;
    update public.match_players set display_name = n where user_id = r.id and display_name = 'Spelare';
  end loop;
end $$;