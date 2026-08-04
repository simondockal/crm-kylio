CREATE OR REPLACE FUNCTION private.is_team_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

REVOKE ALL ON FUNCTION private.is_team_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_team_member(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Authenticated can view all leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated can update all leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated can delete all leads" ON public.leads;

CREATE POLICY "Team members can view leads" ON public.leads
  FOR SELECT TO authenticated
  USING (private.is_team_member(auth.uid()));

CREATE POLICY "Team members can insert leads" ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND private.is_team_member(auth.uid()));

CREATE POLICY "Team members can update leads" ON public.leads
  FOR UPDATE TO authenticated
  USING (private.is_team_member(auth.uid()))
  WITH CHECK (private.is_team_member(auth.uid()));

CREATE POLICY "Owners and admins can delete leads" ON public.leads
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));