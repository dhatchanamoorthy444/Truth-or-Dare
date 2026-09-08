-- ============ authoritative multiplayer game state ============

ALTER TABLE public.parties
  ADD COLUMN IF NOT EXISTS turn_order uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS turn_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS turn_seq bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS turn_started_at timestamptz;

ALTER TABLE public.party_members
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS voice_on boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mic_muted boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS party_members_unique_player
  ON public.party_members (party_id, user_id);
CREATE INDEX IF NOT EXISTS party_members_party_idx ON public.party_members (party_id);
CREATE INDEX IF NOT EXISTS party_messages_party_idx ON public.party_messages (party_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS parties_code_unique ON public.parties (upper(code));

-- ---------- write protection on member progression ----------
CREATE OR REPLACE FUNCTION public.guard_member_progression()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('app.game', true), '') <> 'on' THEN
    NEW.score        := OLD.score;
    NEW.truths       := OLD.truths;
    NEW.dares        := OLD.dares;
    NEW.votes        := OLD.votes;
    NEW.skips_left   := OLD.skips_left;
    NEW.mission      := OLD.mission;
    NEW.mission_done := OLD.mission_done;
    NEW.user_id      := OLD.user_id;
    NEW.party_id     := OLD.party_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_member_progression ON public.party_members;
CREATE TRIGGER guard_member_progression BEFORE UPDATE ON public.party_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_member_progression();

-- ---------- room row: only the host may write directly ----------
DROP POLICY IF EXISTS parties_update_members ON public.parties;
CREATE POLICY parties_update_host ON public.parties FOR UPDATE TO authenticated
  USING (host_id = auth.uid()) WITH CHECK (host_id = auth.uid());

-- ---------- helpers ----------
CREATE OR REPLACE FUNCTION public.active_player_ids(_party uuid)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(user_id ORDER BY joined_at), '{}')
  FROM public.party_members
  WHERE party_id = _party AND spectator = false
    AND last_seen_at > now() - interval '60 seconds'
$$;

CREATE OR REPLACE FUNCTION public.all_player_ids(_party uuid)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(user_id ORDER BY joined_at), '{}')
  FROM public.party_members
  WHERE party_id = _party AND spectator = false
$$;

-- Deterministic rotation: keep the stored order, drop leavers, append joiners,
-- then hand the turn to the next still-active player after the last one.
CREATE OR REPLACE FUNCTION public.rotate_turn(_party uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _p public.parties;
  _active uuid[];
  _order uuid[] := '{}';
  _id uuid;
  _n int;
  _start int;
  _i int;
  _pick uuid;
BEGIN
  SELECT * INTO _p FROM public.parties WHERE id = _party;
  _active := public.active_player_ids(_party);
  IF coalesce(array_length(_active, 1), 0) = 0 THEN
    _active := public.all_player_ids(_party);
  END IF;
  IF coalesce(array_length(_active, 1), 0) = 0 THEN RETURN NULL; END IF;

  FOREACH _id IN ARRAY coalesce(_p.turn_order, '{}') LOOP
    IF _id = ANY (_active) AND NOT (_id = ANY (_order)) THEN _order := _order || _id; END IF;
  END LOOP;
  FOREACH _id IN ARRAY _active LOOP
    IF NOT (_id = ANY (_order)) THEN _order := _order || _id; END IF;
  END LOOP;

  _n := array_length(_order, 1);
  _start := coalesce(array_position(_order, _p.victim_id), 0);
  _i := (_start % _n) + 1;
  _pick := _order[_i];

  UPDATE public.parties SET turn_order = _order, turn_index = _i - 1 WHERE id = _party;
  RETURN _pick;
END;
$$;

-- ---------- heartbeat / presence ----------
CREATE OR REPLACE FUNCTION public.heartbeat(_party uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN RETURN; END IF;
  PERFORM set_config('app.game', 'on', true);
  UPDATE public.party_members SET last_seen_at = now()
   WHERE party_id = _party AND user_id = _me;
  UPDATE public.parties SET host_seen_at = now()
   WHERE id = _party AND host_id = _me;
  PERFORM set_config('app.game', '', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_voice_state(_party uuid, _voice boolean, _muted boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  UPDATE public.party_members SET voice_on = _voice, mic_muted = _muted
   WHERE party_id = _party AND user_id = auth.uid();
END;
$$;

-- ---------- start match ----------
CREATE OR REPLACE FUNCTION public.start_match(_party uuid, _missions text[] DEFAULT '{}')
RETURNS public.parties LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _p public.parties;
  _players uuid[];
  _skips int;
  _m record;
  _i int := 1;
BEGIN
  SELECT * INTO _p FROM public.parties WHERE id = _party FOR UPDATE;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'Room not found.'; END IF;
  IF NOT public.is_party_host(_party, auth.uid()) THEN
    RAISE EXCEPTION 'Only the host can start the game.';
  END IF;
  IF _p.status <> 'lobby' AND _p.status <> 'results' THEN
    RETURN _p; -- already started: idempotent
  END IF;

  _players := public.all_player_ids(_party);
  IF coalesce(array_length(_players, 1), 0) < 2 THEN
    RAISE EXCEPTION 'You need at least 2 players to start.';
  END IF;

  _skips := coalesce((_p.settings->>'skips')::int, 1);
  PERFORM set_config('app.game', 'on', true);
  FOR _m IN SELECT * FROM public.party_members WHERE party_id = _party ORDER BY joined_at LOOP
    UPDATE public.party_members
       SET score = 0, truths = 0, dares = 0, votes = 0,
           skips_left = greatest(_skips, -1),
           mission = coalesce(_missions[((_i - 1) % greatest(coalesce(array_length(_missions,1),1),1)) + 1], NULL),
           mission_done = false
     WHERE id = _m.id;
    _i := _i + 1;
  END LOOP;

  UPDATE public.parties
     SET status = 'intro', phase = 'countdown', round = 1,
         turn_order = _players, turn_index = 0, turn_seq = turn_seq + 1,
         victim_id = NULL, current_turn = NULL, current_challenge = NULL,
         mystery = NULL, recap = NULL, spin = NULL, verdicts = '{}'::jsonb,
         transfer_used = false, turn_ends_at = NULL, turn_started_at = NULL,
         used_ids = '{}', red_score = 0, blue_score = 0, updated_at = now()
   WHERE id = _party
  RETURNING * INTO _p;

  DELETE FROM public.party_imposters WHERE party_id = _party;
  PERFORM set_config('app.game', '', true);
  RETURN _p;
END;
$$;

-- ---------- begin round (host, idempotent per round) ----------
CREATE OR REPLACE FUNCTION public.begin_round(_party uuid, _imposter uuid DEFAULT NULL)
RETURNS public.parties LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _p public.parties;
  _wheel text;
  _chooser text;
  _victim uuid;
BEGIN
  SELECT * INTO _p FROM public.parties WHERE id = _party FOR UPDATE;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'Room not found.'; END IF;
  IF NOT public.is_party_host(_party, auth.uid()) THEN RETURN _p; END IF;
  IF _p.status <> 'intro' THEN RETURN _p; END IF;

  _wheel := coalesce(_p.settings->>'wheelMode', 'mixed');
  IF _wheel = 'mixed' THEN
    _wheel := (ARRAY['random','imposter','host'])[1 + floor(random() * 3)::int];
  END IF;
  _chooser := CASE
    WHEN _wheel = 'imposter' AND (_imposter IS NULL OR coalesce((_p.settings->>'imposter')::boolean, true) = false)
      THEN 'random' ELSE _wheel END;

  IF coalesce((_p.settings->>'imposter')::boolean, true) AND _imposter IS NOT NULL
     AND public.is_party_member(_party, _imposter) THEN
    INSERT INTO public.party_imposters (party_id, imposter_id, round)
    VALUES (_party, _imposter, _p.round)
    ON CONFLICT (party_id) DO UPDATE
      SET imposter_id = EXCLUDED.imposter_id, round = EXCLUDED.round, updated_at = now();
  ELSE
    DELETE FROM public.party_imposters WHERE party_id = _party;
  END IF;

  IF _chooser = 'random' THEN
    _victim := public.rotate_turn(_party);
    UPDATE public.parties
       SET status = 'playing', phase = 'challenge', victim_id = _victim, current_turn = _victim,
           transfer_used = false, mystery = NULL, current_challenge = NULL, recap = NULL,
           spin = NULL, verdicts = '{}'::jsonb, turn_seq = turn_seq + 1,
           turn_started_at = now(), turn_ends_at = NULL, updated_at = now()
     WHERE id = _party RETURNING * INTO _p;
  ELSE
    UPDATE public.parties
       SET status = 'playing', phase = CASE WHEN _chooser = 'host' THEN 'victim' ELSE 'imposter' END,
           victim_id = NULL, current_turn = NULL, transfer_used = false, mystery = NULL,
           current_challenge = NULL, recap = NULL, spin = NULL, verdicts = '{}'::jsonb,
           turn_seq = turn_seq + 1, turn_started_at = now(), turn_ends_at = NULL, updated_at = now()
     WHERE id = _party RETURNING * INTO _p;
  END IF;
  RETURN _p;
END;
$$;

-- ---------- shared roulette spin ----------
CREATE OR REPLACE FUNCTION public.set_spin(_party uuid, _index integer, _ids uuid[])
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.parties;
BEGIN
  SELECT * INTO _p FROM public.parties WHERE id = _party FOR UPDATE;
  IF _p.id IS NULL THEN RETURN false; END IF;
  IF _p.phase NOT IN ('imposter','victim') THEN RETURN false; END IF;
  IF _p.spin IS NOT NULL THEN RETURN false; END IF;
  IF NOT (public.is_party_host(_party, auth.uid()) OR public.am_i_imposter(_party)) THEN RETURN false; END IF;
  UPDATE public.parties
     SET spin = jsonb_build_object('index', _index, 'at', (extract(epoch from now()) * 1000)::bigint,
                                   'by', auth.uid()::text, 'ids', to_jsonb(_ids)),
         updated_at = now()
   WHERE id = _party;
  RETURN true;
END;
$$;

-- ---------- lock in the player on the spot ----------
CREATE OR REPLACE FUNCTION public.set_victim(_party uuid, _user uuid)
RETURNS public.parties LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.parties;
BEGIN
  SELECT * INTO _p FROM public.parties WHERE id = _party FOR UPDATE;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'Room not found.'; END IF;
  IF _p.phase NOT IN ('imposter','victim') THEN RETURN _p; END IF;
  IF NOT (public.is_party_host(_party, auth.uid()) OR public.am_i_imposter(_party)) THEN RETURN _p; END IF;
  IF NOT public.is_party_member(_party, _user) THEN RETURN _p; END IF;

  UPDATE public.parties
     SET phase = 'challenge', victim_id = _user, current_turn = _user,
         transfer_used = false, verdicts = '{}'::jsonb, spin = NULL,
         turn_order = CASE WHEN _user = ANY(coalesce(turn_order,'{}')) THEN turn_order
                           ELSE coalesce(turn_order,'{}') || _user END,
         turn_seq = turn_seq + 1, turn_started_at = now(), updated_at = now()
   WHERE id = _party RETURNING * INTO _p;
  RETURN _p;
END;
$$;

-- ---------- draw a truth / dare (only the active player, only once) ----------
CREATE OR REPLACE FUNCTION public.select_challenge(
  _party uuid, _turn_seq bigint, _challenge jsonb, _mystery jsonb, _used text[], _seconds integer)
RETURNS public.parties LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.parties;
BEGIN
  SELECT * INTO _p FROM public.parties WHERE id = _party FOR UPDATE;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'Room not found.'; END IF;
  IF _p.current_turn IS DISTINCT FROM auth.uid() THEN RETURN _p; END IF;
  IF _p.turn_seq <> _turn_seq THEN RETURN _p; END IF;
  IF _p.current_challenge IS NOT NULL THEN RETURN _p; END IF;

  UPDATE public.parties
     SET current_challenge = _challenge,
         mystery = _mystery,
         used_ids = (SELECT array_agg(x) FROM (
            SELECT unnest(coalesce(used_ids,'{}') || coalesce(_used,'{}')) AS x
            OFFSET greatest(0, array_length(coalesce(used_ids,'{}') || coalesce(_used,'{}'), 1) - 400)
         ) t),
         turn_started_at = now(),
         turn_ends_at = CASE WHEN coalesce(_seconds,0) > 0
                             THEN now() + make_interval(secs => _seconds) ELSE NULL END,
         updated_at = now()
   WHERE id = _party RETURNING * INTO _p;
  RETURN _p;
END;
$$;

-- ---------- transfer ----------
CREATE OR REPLACE FUNCTION public.transfer_challenge(_party uuid, _turn_seq bigint, _to uuid, _seconds integer)
RETURNS public.parties LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.parties;
BEGIN
  SELECT * INTO _p FROM public.parties WHERE id = _party FOR UPDATE;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'Room not found.'; END IF;
  IF _p.current_turn IS DISTINCT FROM auth.uid() THEN RETURN _p; END IF;
  IF _p.turn_seq <> _turn_seq OR _p.transfer_used THEN RETURN _p; END IF;
  IF NOT public.is_party_member(_party, _to) THEN RETURN _p; END IF;

  UPDATE public.parties
     SET victim_id = _to, current_turn = _to, transfer_used = true,
         turn_seq = turn_seq + 1, turn_started_at = now(),
         turn_ends_at = CASE WHEN coalesce(_seconds,0) > 0
                             THEN now() + make_interval(secs => _seconds) ELSE NULL END,
         updated_at = now()
   WHERE id = _party RETURNING * INTO _p;
  RETURN _p;
END;
$$;

-- ---------- crowd votes + secret missions ----------
CREATE OR REPLACE FUNCTION public.vote_funny(_party uuid, _target uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_party_member(_party, auth.uid()) THEN RETURN false; END IF;
  IF _target = auth.uid() THEN RETURN false; END IF;
  PERFORM set_config('app.game', 'on', true);
  UPDATE public.party_members SET votes = votes + 1
   WHERE party_id = _party AND user_id = _target;
  PERFORM set_config('app.game', '', true);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_mission(_party uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _m public.party_members;
BEGIN
  SELECT * INTO _m FROM public.party_members
   WHERE party_id = _party AND user_id = auth.uid() FOR UPDATE;
  IF _m.id IS NULL OR _m.mission IS NULL OR _m.mission_done THEN RETURN false; END IF;
  PERFORM set_config('app.game', 'on', true);
  UPDATE public.party_members SET mission_done = true, score = score + 30 WHERE id = _m.id;
  PERFORM set_config('app.game', '', true);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.cast_verdict(_party uuid, _pass boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.parties;
BEGIN
  SELECT * INTO _p FROM public.parties WHERE id = _party FOR UPDATE;
  IF auth.uid() IS NULL OR NOT public.is_party_member(_party, auth.uid()) THEN RETURN false; END IF;
  IF _p.current_turn = auth.uid() THEN RETURN false; END IF;
  IF _p.verdicts ? auth.uid()::text THEN RETURN false; END IF;
  UPDATE public.parties
     SET verdicts = coalesce(verdicts,'{}'::jsonb) || jsonb_build_object(auth.uid()::text, _pass)
   WHERE id = _party;
  RETURN true;
END;
$$;

-- ---------- finish a turn (single source of truth for scoring) ----------
CREATE OR REPLACE FUNCTION public.resolve_turn(
  _party uuid, _turn_seq bigint, _completed boolean, _recap jsonb DEFAULT '{}'::jsonb)
RETURNS public.parties LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _p public.parties;
  _m public.party_members;
  _ch jsonb;
  _base int;
  _points int := 0;
  _team_patch text;
BEGIN
  SELECT * INTO _p FROM public.parties WHERE id = _party FOR UPDATE;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'Room not found.'; END IF;
  IF _p.turn_seq <> _turn_seq OR _p.phase <> 'challenge' THEN RETURN _p; END IF; -- already resolved
  IF NOT (_p.current_turn = auth.uid() OR public.is_party_host(_party, auth.uid())) THEN
    RAISE EXCEPTION 'Only the active player or the host can end this turn.';
  END IF;

  _ch := _p.current_challenge;
  IF _ch IS NULL THEN RETURN _p; END IF;

  SELECT * INTO _m FROM public.party_members
   WHERE party_id = _party AND user_id = _p.current_turn FOR UPDATE;

  PERFORM set_config('app.game', 'on', true);

  IF NOT _completed THEN
    IF coalesce((_p.settings->>'skips')::int, 1) <> -1 AND _m.id IS NOT NULL THEN
      IF _m.skips_left <= 0 AND _p.current_turn = auth.uid() THEN
        PERFORM set_config('app.game', '', true);
        RAISE EXCEPTION 'No skip cards left — you have to face it!';
      END IF;
      UPDATE public.party_members SET skips_left = greatest(0, skips_left - 1) WHERE id = _m.id;
    END IF;
  ELSE
    _base := CASE WHEN _ch->>'type' = 'dare' THEN 25 ELSE 15 END;
    IF coalesce(_p.mystery->>'id', '') = 'golden-reward' THEN _base := _base * 3; END IF;
    _points := _base + coalesce((_ch->>'bonus')::int, 0);
    IF _m.id IS NOT NULL THEN
      UPDATE public.party_members
         SET score = score + _points,
             truths = truths + CASE WHEN _ch->>'type' = 'truth' THEN 1 ELSE 0 END,
             dares  = dares  + CASE WHEN _ch->>'type' = 'dare'  THEN 1 ELSE 0 END
       WHERE id = _m.id;
    END IF;
  END IF;

  PERFORM set_config('app.game', '', true);

  UPDATE public.parties
     SET phase = 'recap',
         recap = coalesce(_recap,'{}'::jsonb) || jsonb_build_object(
                   'completed', _completed, 'points', _points, 'type', _ch->>'type'),
         current_challenge = NULL, turn_ends_at = NULL, turn_seq = turn_seq + 1,
         red_score  = red_score  + CASE WHEN _p.team_mode AND _completed AND _m.team = 'red'  THEN 1 ELSE 0 END,
         blue_score = blue_score + CASE WHEN _p.team_mode AND _completed AND _m.team = 'blue' THEN 1 ELSE 0 END,
         updated_at = now()
   WHERE id = _party RETURNING * INTO _p;
  RETURN _p;
END;
$$;

-- ---------- timer expiry: any client may nudge, it only fires once ----------
CREATE OR REPLACE FUNCTION public.expire_turn(_party uuid, _turn_seq bigint)
RETURNS public.parties LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.parties;
BEGIN
  SELECT * INTO _p FROM public.parties WHERE id = _party FOR UPDATE;
  IF _p.id IS NULL OR NOT public.is_party_member(_party, auth.uid()) THEN RETURN _p; END IF;
  IF _p.turn_seq <> _turn_seq OR _p.phase <> 'challenge' THEN RETURN _p; END IF;
  IF _p.turn_ends_at IS NULL OR _p.turn_ends_at > now() THEN RETURN _p; END IF;

  UPDATE public.parties
     SET phase = 'recap',
         recap = jsonb_build_object('completed', false, 'points', 0, 'expired', true,
                                    'type', coalesce(_p.current_challenge->>'type','truth')),
         current_challenge = NULL, turn_ends_at = NULL, turn_seq = turn_seq + 1, updated_at = now()
   WHERE id = _party RETURNING * INTO _p;
  RETURN _p;
END;
$$;

-- ---------- next round / end match ----------
CREATE OR REPLACE FUNCTION public.next_round(_party uuid)
RETURNS public.parties LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _p public.parties;
  _players int;
BEGIN
  SELECT * INTO _p FROM public.parties WHERE id = _party FOR UPDATE;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'Room not found.'; END IF;
  IF NOT public.is_party_host(_party, auth.uid()) THEN RETURN _p; END IF;
  IF _p.phase <> 'recap' THEN RETURN _p; END IF;

  SELECT coalesce(array_length(public.all_player_ids(_party), 1), 0) INTO _players;

  IF _players < 2 OR _p.round >= _players * 3 THEN
    UPDATE public.parties
       SET status = 'results', phase = 'idle', current_challenge = NULL,
           current_turn = NULL, turn_ends_at = NULL, turn_seq = turn_seq + 1, updated_at = now()
     WHERE id = _party RETURNING * INTO _p;
  ELSE
    UPDATE public.parties
       SET status = 'intro', phase = 'countdown', round = round + 1, recap = NULL,
           mystery = NULL, current_turn = NULL, spin = NULL, verdicts = '{}'::jsonb,
           transfer_used = false, turn_seq = turn_seq + 1, turn_ends_at = NULL, updated_at = now()
     WHERE id = _party RETURNING * INTO _p;
  END IF;
  RETURN _p;
END;
$$;

CREATE OR REPLACE FUNCTION public.end_match(_party uuid)
RETURNS public.parties LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.parties;
BEGIN
  IF NOT public.is_party_host(_party, auth.uid()) THEN
    SELECT * INTO _p FROM public.parties WHERE id = _party; RETURN _p;
  END IF;
  UPDATE public.parties
     SET status = 'results', phase = 'idle', current_challenge = NULL, current_turn = NULL,
         turn_ends_at = NULL, turn_seq = turn_seq + 1, updated_at = now()
   WHERE id = _party RETURNING * INTO _p;
  RETURN _p;
END;
$$;

-- ---------- privileges: signed-in players only ----------
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'heartbeat(uuid)','set_voice_state(uuid,boolean,boolean)','start_match(uuid,text[])',
    'begin_round(uuid,uuid)','set_spin(uuid,integer,uuid[])','set_victim(uuid,uuid)',
    'select_challenge(uuid,bigint,jsonb,jsonb,text[],integer)','transfer_challenge(uuid,bigint,uuid,integer)',
    'vote_funny(uuid,uuid)','complete_mission(uuid)','cast_verdict(uuid,boolean)',
    'resolve_turn(uuid,bigint,boolean,jsonb)','expire_turn(uuid,bigint)','next_round(uuid)','end_match(uuid)',
    'rotate_turn(uuid)','active_player_ids(uuid)','all_player_ids(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.rotate_turn(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_member_progression() FROM PUBLIC, anon, authenticated;