ALTER TABLE public.push_tokens ADD COLUMN IF NOT EXISTS turns boolean NOT NULL DEFAULT true;
ALTER TABLE public.push_tokens ADD COLUMN IF NOT EXISTS nudges boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.push_tokens.reminders IS 'Weekly come-and-play notification allowed on this device';
COMMENT ON COLUMN public.push_tokens.turns IS 'Your-turn notifications allowed on this device';
COMMENT ON COLUMN public.push_tokens.nudges IS 'Paused-match reminders allowed on this device';