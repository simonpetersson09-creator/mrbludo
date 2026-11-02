alter table public.profiles add column if not exists avatar_image text;
alter table public.profiles add constraint profiles_avatar_image_size check (avatar_image is null or char_length(avatar_image) <= 120000);
comment on column public.profiles.avatar_image is 'Profile picture as a small JPEG data URL, shown to other players. NULL = use the emoji avatar.';