REVOKE EXECUTE ON FUNCTION public.is_party_host(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_party_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_party_host(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_party_member(uuid, uuid) TO authenticated, service_role;