ALTER TABLE public.parties
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS imposter_id uuid,
  ADD COLUMN IF NOT EXISTS victim_id uuid,
  ADD COLUMN IF NOT EXISTS transfer_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mystery jsonb,
  ADD COLUMN IF NOT EXISTS used_ids text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS recap jsonb,
  ADD COLUMN IF NOT EXISTS preset text NOT NULL DEFAULT 'casual';

ALTER TABLE public.party_members
  ADD COLUMN IF NOT EXISTS skips_left integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mission text,
  ADD COLUMN IF NOT EXISTS mission_done boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS votes integer NOT NULL DEFAULT 0;