-- 1. Ban-aware membership check
CREATE OR REPLACE FUNCTION public.is_party_member(_party uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.party_members m WHERE m.party_id = _party AND m.user_id = _user)
     AND NOT EXISTS (SELECT 1 FROM public.party_bans b WHERE b.party_id = _party AND b.user_id = _user)
$$;

-- Also exclude banned users from shared-party profile visibility
CREATE OR REPLACE FUNCTION public.shares_party(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.party_members m1
    JOIN public.party_members m2 ON m1.party_id = m2.party_id
    WHERE m1.user_id = _a AND m2.user_id = _b
      AND NOT EXISTS (SELECT 1 FROM public.party_bans b WHERE b.party_id = m1.party_id AND b.user_id = _a)
      AND NOT EXISTS (SELECT 1 FROM public.party_bans b WHERE b.party_id = m2.party_id AND b.user_id = _b)
  )
$$;

-- 2. Atomically remove membership when a ban is inserted
CREATE OR REPLACE FUNCTION public.enforce_ban_removes_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.party_members m
   WHERE m.party_id = NEW.party_id AND m.user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ban_removes_member ON public.party_bans;
CREATE TRIGGER trg_ban_removes_member
AFTER INSERT ON public.party_bans
FOR EACH ROW EXECUTE FUNCTION public.enforce_ban_removes_member();

-- 3. Revoke execute from unauthenticated callers on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.is_party_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_party_host(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.shares_party(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_use_party_topic(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.claim_host(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.join_party(text, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.guard_party_host_change() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.enforce_ban_removes_member() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.is_party_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_party_host(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_party(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_use_party_topic(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_host(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_party(text, boolean) TO authenticated;