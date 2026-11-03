ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS variant text NOT NULL DEFAULT 'classic';
ALTER TABLE public.matches ADD CONSTRAINT matches_variant_check CHECK (variant IN ('classic', 'fia'));