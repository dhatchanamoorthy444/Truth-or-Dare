-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  avatar text NOT NULL DEFAULT '🦊',
  player_code text NOT NULL UNIQUE,
  country text NOT NULL DEFAULT '🌍',
  level int NOT NULL DEFAULT 1,
  xp int NOT NULL DEFAULT 0,
  coins int NOT NULL DEFAULT 250,
  rank_points int NOT NULL DEFAULT 0,
  wins int NOT NULL DEFAULT 0,
  losses int NOT NULL DEFAULT 0,
  title text NOT NULL DEFAULT 'Rookie',
  frame text NOT NULL DEFAULT 'none',
  name_color text NOT NULL DEFAULT 'default',
  badges text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ============ PARTIES ============
CREATE TABLE public.parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT 'Party',
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'friends',
  theme text NOT NULL DEFAULT 'fantasy',
  visibility text NOT NULL DEFAULT 'public',
  status text NOT NULL DEFAULT 'lobby',
  max_players int NOT NULL DEFAULT 20,
  round int NOT NULL DEFAULT 0,
  team_mode boolean NOT NULL DEFAULT false,
  red_score int NOT NULL DEFAULT 0,
  blue_score int NOT NULL DEFAULT 0,
  current_turn uuid,
  current_challenge jsonb,
  turn_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parties TO authenticated;
GRANT ALL ON public.parties TO service_role;
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;

-- ============ MEMBERS ============
CREATE TABLE public.party_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team text NOT NULL DEFAULT 'none',
  ready boolean NOT NULL DEFAULT false,
  spectator boolean NOT NULL DEFAULT false,
  score int NOT NULL DEFAULT 0,
  truths int NOT NULL DEFAULT 0,
  dares int NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (party_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.party_members TO authenticated;
GRANT ALL ON public.party_members TO service_role;
ALTER TABLE public.party_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.party_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (party_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.party_bans TO authenticated;
GRANT ALL ON public.party_bans TO service_role;
ALTER TABLE public.party_bans ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.party_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  kind text NOT NULL DEFAULT 'chat',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.party_messages TO authenticated;
GRANT ALL ON public.party_messages TO service_role;
ALTER TABLE public.party_messages ENABLE ROW LEVEL SECURITY;

-- ============ HELPERS ============
CREATE OR REPLACE FUNCTION public.is_party_host(_party uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.parties p WHERE p.id = _party AND p.host_id = _user)
$$;

CREATE OR REPLACE FUNCTION public.is_party_member(_party uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.party_members m WHERE m.party_id = _party AND m.user_id = _user)
$$;

-- ============ POLICIES ============
CREATE POLICY "parties_read" ON public.parties FOR SELECT TO authenticated USING (true);
CREATE POLICY "parties_insert_host" ON public.parties FOR INSERT TO authenticated WITH CHECK (host_id = auth.uid());
CREATE POLICY "parties_update_host" ON public.parties FOR UPDATE TO authenticated USING (host_id = auth.uid()) WITH CHECK (host_id = auth.uid());
CREATE POLICY "parties_delete_host" ON public.parties FOR DELETE TO authenticated USING (host_id = auth.uid());

CREATE POLICY "bans_read" ON public.party_bans FOR SELECT TO authenticated USING (true);
CREATE POLICY "bans_write_host" ON public.party_bans FOR INSERT TO authenticated WITH CHECK (public.is_party_host(party_id, auth.uid()));
CREATE POLICY "bans_delete_host" ON public.party_bans FOR DELETE TO authenticated USING (public.is_party_host(party_id, auth.uid()));

CREATE POLICY "members_read" ON public.party_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "members_join" ON public.party_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.party_bans b WHERE b.party_id = party_members.party_id AND b.user_id = auth.uid())
  );
CREATE POLICY "members_update_self_or_host" ON public.party_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_party_host(party_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_party_host(party_id, auth.uid()));
CREATE POLICY "members_delete_self_or_host" ON public.party_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_party_host(party_id, auth.uid()));

CREATE POLICY "messages_read_members" ON public.party_messages FOR SELECT TO authenticated
  USING (public.is_party_member(party_id, auth.uid()));
CREATE POLICY "messages_insert_members" ON public.party_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_party_member(party_id, auth.uid()) AND length(body) BETWEEN 1 AND 300);

-- ============ REALTIME ============
ALTER TABLE public.parties REPLICA IDENTITY FULL;
ALTER TABLE public.party_members REPLICA IDENTITY FULL;
ALTER TABLE public.party_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.parties;
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_messages;

CREATE INDEX idx_members_party ON public.party_members(party_id);
CREATE INDEX idx_messages_party ON public.party_messages(party_id, created_at DESC);
CREATE INDEX idx_parties_public ON public.parties(visibility, status, created_at DESC);