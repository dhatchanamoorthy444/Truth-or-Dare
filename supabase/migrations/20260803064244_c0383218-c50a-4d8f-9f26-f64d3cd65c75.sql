-- 1. Block direct host_id writes unless done through the secure claim function
CREATE OR REPLACE FUNCTION public.guard_party_host_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.host_id IS DISTINCT FROM OLD.host_id THEN
    IF coalesce(current_setting('app.host_transfer', true), '') <> OLD.id::text
       AND OLD.host_id <> auth.uid() THEN
      RAISE EXCEPTION 'Only the host can transfer host control.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_party_host_change ON public.parties;
CREATE TRIGGER guard_party_host_change
BEFORE UPDATE ON public.parties
FOR EACH ROW EXECUTE FUNCTION public.guard_party_host_change();

-- 2. Secure host claim: only when the host heartbeat is stale
CREATE OR REPLACE FUNCTION public.claim_host(_party uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _p public.parties;
BEGIN
  IF _me IS NULL THEN RETURN false; END IF;
  SELECT * INTO _p FROM public.parties WHERE id = _party;
  IF _p.id IS NULL THEN RETURN false; END IF;
  IF _p.host_id = _me THEN RETURN false; END IF;
  IF NOT public.is_party_member(_party, _me) THEN RETURN false; END IF;
  IF _p.host_seen_at > now() - interval '45 seconds' THEN RETURN false; END IF;

  PERFORM set_config('app.host_transfer', _party::text, true);
  UPDATE public.parties
     SET host_id = _me, host_seen_at = now()
   WHERE id = _party AND host_id = _p.host_id;
  PERFORM set_config('app.host_transfer', '', true);
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_host(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_host(uuid) TO authenticated;

-- 3. Realtime authorization: only current, non-banned members may use party channels
CREATE OR REPLACE FUNCTION public.can_use_party_topic(_topic text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN RETURN false; END IF;
  IF _topic !~ '^(party|media):[0-9a-fA-F-]{36}$' THEN RETURN false; END IF;
  _id := split_part(_topic, ':', 2)::uuid;
  RETURN public.is_party_member(_id, _me)
     AND NOT EXISTS (SELECT 1 FROM public.party_bans b WHERE b.party_id = _id AND b.user_id = _me);
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_use_party_topic(text) TO authenticated;

DROP POLICY IF EXISTS "party members can read realtime" ON realtime.messages;
DROP POLICY IF EXISTS "party members can write realtime" ON realtime.messages;

CREATE POLICY "party members can read realtime"
ON realtime.messages FOR SELECT TO authenticated
USING (public.can_use_party_topic(realtime.topic()));

CREATE POLICY "party members can write realtime"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (public.can_use_party_topic(realtime.topic()));