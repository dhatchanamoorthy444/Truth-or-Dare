-- 1) Secret imposter moved out of the shared parties row
CREATE TABLE IF NOT EXISTS public.party_imposters (
  party_id uuid PRIMARY KEY REFERENCES public.parties(id) ON DELETE CASCADE,
  imposter_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  round integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.party_imposters TO authenticated;
GRANT ALL ON public.party_imposters TO service_role;

ALTER TABLE public.party_imposters ENABLE ROW LEVEL SECURITY;

CREATE POLICY imposters_read_self ON public.party_imposters
  FOR SELECT TO authenticated
  USING (imposter_id = auth.uid());

ALTER TABLE public.parties DROP COLUMN IF EXISTS imposter_id;

CREATE OR REPLACE FUNCTION public.set_imposter(_party uuid, _user uuid, _round integer DEFAULT 0)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_party_host(_party, auth.uid()) THEN
    RETURN false;
  END IF;
  IF _user IS NOT NULL AND NOT public.is_party_member(_party, _user) THEN
    RETURN false;
  END IF;
  INSERT INTO public.party_imposters (party_id, imposter_id, round)
  VALUES (_party, _user, coalesce(_round, 0))
  ON CONFLICT (party_id) DO UPDATE
    SET imposter_id = EXCLUDED.imposter_id, round = EXCLUDED.round, updated_at = now();
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.am_i_imposter(_party uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.party_imposters i
    WHERE i.party_id = _party AND i.imposter_id = auth.uid() AND auth.uid() IS NOT NULL
  )
$$;

REVOKE ALL ON FUNCTION public.set_imposter(uuid, uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.am_i_imposter(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_imposter(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.am_i_imposter(uuid) TO authenticated;

-- 2) Chat messages: owner-only edits, controlled reactions/pinning
DROP POLICY IF EXISTS messages_update_members ON public.party_messages;

CREATE POLICY messages_update_own ON public.party_messages
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND is_party_member(party_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() AND is_party_member(party_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.react_to_message(_message uuid, _emoji text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _me uuid := auth.uid();
  _m public.party_messages;
  _list jsonb;
  _next jsonb;
BEGIN
  IF _me IS NULL OR _emoji IS NULL OR length(_emoji) > 8 THEN RETURN false; END IF;
  SELECT * INTO _m FROM public.party_messages WHERE id = _message;
  IF _m.id IS NULL OR NOT public.is_party_member(_m.party_id, _me) THEN RETURN false; END IF;

  _next := coalesce(_m.reactions, '{}'::jsonb);
  _list := coalesce(_next -> _emoji, '[]'::jsonb);

  IF _list @> to_jsonb(_me::text) THEN
    _list := coalesce((SELECT jsonb_agg(v) FROM jsonb_array_elements(_list) v WHERE v <> to_jsonb(_me::text)), '[]'::jsonb);
  ELSE
    _list := _list || to_jsonb(_me::text);
  END IF;

  IF jsonb_array_length(_list) = 0 THEN
    _next := _next - _emoji;
  ELSE
    _next := jsonb_set(_next, ARRAY[_emoji], _list, true);
  END IF;

  UPDATE public.party_messages SET reactions = _next WHERE id = _message;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.pin_message(_party uuid, _message uuid, _pinned boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_party_host(_party, auth.uid()) THEN RETURN false; END IF;
  IF _pinned THEN
    UPDATE public.party_messages SET pinned = false WHERE party_id = _party AND pinned = true;
  END IF;
  UPDATE public.party_messages SET pinned = _pinned WHERE id = _message AND party_id = _party;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.react_to_message(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pin_message(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.react_to_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pin_message(uuid, uuid, boolean) TO authenticated;

-- 3) Profiles: block self-service progression edits
CREATE OR REPLACE FUNCTION public.guard_profile_progression()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(current_setting('app.progression', true), '') <> 'on' THEN
    NEW.coins       := OLD.coins;
    NEW.xp          := OLD.xp;
    NEW.level       := OLD.level;
    NEW.rank_points := OLD.rank_points;
    NEW.wins        := OLD.wins;
    NEW.losses      := OLD.losses;
    NEW.title       := OLD.title;
    NEW.badges      := OLD.badges;
    NEW.frame       := OLD.frame;
    NEW.name_color  := OLD.name_color;
    NEW.player_code := OLD.player_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_progression ON public.profiles;
CREATE TRIGGER guard_profile_progression
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_progression();