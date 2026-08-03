ALTER TABLE public.parties
  ADD COLUMN IF NOT EXISTS spin jsonb,
  ADD COLUMN IF NOT EXISTS verdicts jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS host_seen_at timestamp with time zone NOT NULL DEFAULT now();

ALTER TABLE public.party_messages
  ADD COLUMN IF NOT EXISTS reply_to uuid REFERENCES public.party_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reactions jsonb NOT NULL DEFAULT '{}'::jsonb;

DROP POLICY IF EXISTS messages_update_members ON public.party_messages;
CREATE POLICY messages_update_members
  ON public.party_messages
  FOR UPDATE
  TO authenticated
  USING (public.is_party_member(party_id, auth.uid()))
  WITH CHECK (public.is_party_member(party_id, auth.uid()));