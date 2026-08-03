-- helper: do two users share a party?
CREATE OR REPLACE FUNCTION public.shares_party(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.party_members m1
    JOIN public.party_members m2 ON m1.party_id = m2.party_id
    WHERE m1.user_id = _a AND m2.user_id = _b
  )
$$;

REVOKE ALL ON FUNCTION public.shares_party(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shares_party(uuid, uuid) TO authenticated;

-- ---------- parties ----------
DROP POLICY IF EXISTS parties_read ON public.parties;
CREATE POLICY parties_read ON public.parties
FOR SELECT TO authenticated
USING (
  visibility = 'public'
  OR host_id = auth.uid()
  OR public.is_party_member(id, auth.uid())
);

-- ---------- party_members ----------
DROP POLICY IF EXISTS members_read ON public.party_members;
CREATE POLICY members_read ON public.party_members
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_party_member(party_id, auth.uid())
  OR public.is_party_host(party_id, auth.uid())
);

-- ---------- party_bans ----------
DROP POLICY IF EXISTS bans_read ON public.party_bans;
CREATE POLICY bans_read ON public.party_bans
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_party_host(party_id, auth.uid())
);

-- ---------- profiles ----------
DROP POLICY IF EXISTS profiles_read ON public.profiles;
CREATE POLICY profiles_read ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.shares_party(id, auth.uid())
);

-- ---------- secure join-by-code ----------
CREATE OR REPLACE FUNCTION public.join_party(_code text, _spectator boolean DEFAULT false)
RETURNS public.parties
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _party public.parties;
  _count int;
  _red int;
  _team text := 'none';
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to join a party.';
  END IF;

  SELECT * INTO _party FROM public.parties WHERE code = upper(btrim(_code));
  IF _party.id IS NULL THEN
    RAISE EXCEPTION 'No party found with that code.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.party_bans b WHERE b.party_id = _party.id AND b.user_id = _me) THEN
    RAISE EXCEPTION 'You have been banned from this party.';
  END IF;

  SELECT count(*) INTO _count FROM public.party_members m WHERE m.party_id = _party.id;

  IF NOT _spectator
     AND _count >= _party.max_players
     AND NOT EXISTS (SELECT 1 FROM public.party_members m WHERE m.party_id = _party.id AND m.user_id = _me)
  THEN
    RAISE EXCEPTION 'That party is full — join as a spectator instead.';
  END IF;

  IF _party.team_mode THEN
    SELECT count(*) INTO _red FROM public.party_members m WHERE m.party_id = _party.id AND m.team = 'red';
    _team := CASE WHEN _red * 2 <= _count THEN 'red' ELSE 'blue' END;
  END IF;

  INSERT INTO public.party_members (party_id, user_id, spectator, team)
  VALUES (_party.id, _me, _spectator, _team)
  ON CONFLICT (party_id, user_id) DO UPDATE SET spectator = EXCLUDED.spectator;

  RETURN _party;
END;
$$;

REVOKE ALL ON FUNCTION public.join_party(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_party(text, boolean) TO authenticated;