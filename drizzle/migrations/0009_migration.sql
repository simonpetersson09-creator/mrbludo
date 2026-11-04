CREATE TABLE public.push_tokens (
  token text PRIMARY KEY,
  user_id uuid NOT NULL,
  platform text NOT NULL DEFAULT 'ios',
  environment text NOT NULL DEFAULT 'production',
  locale text NOT NULL DEFAULT 'sv',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_tokens_user_idx ON public.push_tokens (user_id);
GRANT ALL ON public.push_tokens TO service_role;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.push_sent (
  key text PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_sent_created_idx ON public.push_sent (created_at);
GRANT ALL ON public.push_sent TO service_role;
ALTER TABLE public.push_sent ENABLE ROW LEVEL SECURITY;