DROP POLICY IF EXISTS "Team members can view leads" ON public.leads;
DROP POLICY IF EXISTS "Team members can update leads" ON public.leads;
DROP POLICY IF EXISTS "Team members can insert leads" ON public.leads;

CREATE POLICY "Owners and admins can view leads"
ON public.leads FOR SELECT TO authenticated
USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners and admins can update leads"
ON public.leads FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (
  private.is_team_member(auth.uid())
  AND (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Owners and admins can insert leads"
ON public.leads FOR INSERT TO authenticated
WITH CHECK (
  private.is_team_member(auth.uid())
  AND (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role))
);