DROP POLICY "parties_update_host" ON public.parties;
CREATE POLICY "parties_update_members" ON public.parties FOR UPDATE TO authenticated
  USING (host_id = auth.uid() OR public.is_party_member(id, auth.uid()))
  WITH CHECK (host_id = auth.uid() OR public.is_party_member(id, auth.uid()));