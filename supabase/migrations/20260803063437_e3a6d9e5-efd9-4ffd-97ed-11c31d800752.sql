DROP POLICY IF EXISTS parties_read ON public.parties;

CREATE POLICY parties_read ON public.parties
FOR SELECT
TO authenticated
USING (
  host_id = auth.uid()
  OR public.is_party_member(id, auth.uid())
  OR (visibility = 'public' AND status = 'lobby')
);