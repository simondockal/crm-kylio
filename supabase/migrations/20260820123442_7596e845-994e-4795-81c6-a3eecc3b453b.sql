-- 1. Attribution on deals
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS caller_id uuid,
  ADD COLUMN IF NOT EXISTS caller_name text NOT NULL DEFAULT '';

-- 2. Lead lists (per-caller segmentation)
CREATE TABLE IF NOT EXISTS public.lead_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Nový list',
  position double precision NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_lists TO authenticated;
GRANT ALL ON public.lead_lists TO service_role;
ALTER TABLE public.lead_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners and admins can view lists" ON public.lead_lists
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners and admins can insert lists" ON public.lead_lists
  FOR INSERT TO authenticated
  WITH CHECK (private.is_team_member(auth.uid()) AND (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin')));
CREATE POLICY "Owners and admins can update lists" ON public.lead_lists
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners and admins can delete lists" ON public.lead_lists
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'));

-- 3. Leads: list assignment + re-engagement fields
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS list_id uuid REFERENCES public.lead_lists(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS reengage_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS previous_user_id uuid;

-- 4. Lead origin history
CREATE TABLE IF NOT EXISTS public.lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  actor_id uuid,
  actor_name text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'note',
  detail text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.lead_events TO authenticated;
GRANT ALL ON public.lead_events TO service_role;
ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can view lead events" ON public.lead_events
  FOR SELECT TO authenticated
  USING (private.is_team_member(auth.uid()));
CREATE POLICY "Team can insert own lead events" ON public.lead_events
  FOR INSERT TO authenticated
  WITH CHECK (private.is_team_member(auth.uid()) AND auth.uid() = actor_id);

-- 5. Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_by uuid,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'rebook',
  title text NOT NULL DEFAULT '',
  detail text NOT NULL DEFAULT '',
  due_at timestamp with time zone NOT NULL DEFAULT now(),
  cadence_days integer NOT NULL DEFAULT 1,
  done boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Assignee and admins can view tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Team can insert tasks" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (private.is_team_member(auth.uid()));
CREATE POLICY "Assignee and admins can update tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Assignee and admins can delete tasks" ON public.tasks
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS tasks_set_updated_at ON public.tasks;
CREATE TRIGGER tasks_set_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Reject + round-robin handover
CREATE OR REPLACE FUNCTION public.reject_lead(_lead_id uuid)
RETURNS public.leads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l public.leads;
  next_owner uuid;
  actor uuid := auth.uid();
  actor_name text;
BEGIN
  IF actor IS NULL OR NOT private.is_team_member(actor) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  SELECT * INTO l FROM public.leads WHERE id = _lead_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found'; END IF;
  IF l.user_id <> actor AND NOT private.has_role(actor, 'admin') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT ur.user_id INTO next_owner
  FROM public.user_roles ur
  WHERE ur.role = 'cold_caller'
    AND ur.user_id <> l.user_id
  ORDER BY (
    SELECT count(*) FROM public.leads x
    WHERE x.user_id = ur.user_id AND x.reengage_at IS NOT NULL
  ) ASC, ur.created_at ASC
  LIMIT 1;

  UPDATE public.leads
  SET status = 'odmitnul',
      previous_user_id = l.user_id,
      user_id = COALESCE(next_owner, l.user_id),
      list_id = CASE WHEN next_owner IS NULL THEN list_id ELSE NULL END,
      rejected_at = now(),
      reengage_at = now() + interval '3 days'
  WHERE id = _lead_id
  RETURNING * INTO l;

  SELECT COALESCE(full_name, email, '') INTO actor_name FROM public.profiles WHERE id = actor;

  INSERT INTO public.lead_events (lead_id, actor_id, actor_name, type, detail)
  VALUES (_lead_id, actor, COALESCE(actor_name, ''), 'rejected',
    CASE WHEN next_owner IS NULL
      THEN 'Odmítnuto — cooldown 3 dny, zůstává u stávajícího volajícího'
      ELSE 'Odmítnuto — předáno dalšímu volajícímu, cooldown 3 dny' END);

  RETURN l;
END;
$$;
REVOKE ALL ON FUNCTION public.reject_lead(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_lead(uuid) TO authenticated;

-- 7. No-show -> rebook task for the original caller
CREATE OR REPLACE FUNCTION public.create_rebook_task(_deal_id uuid)
RETURNS public.tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.deals;
  t public.tasks;
  assignee uuid;
  due timestamp with time zone;
  actor uuid := auth.uid();
BEGIN
  IF actor IS NULL OR NOT private.is_team_member(actor) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  SELECT * INTO d FROM public.deals WHERE id = _deal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;

  assignee := COALESCE(d.caller_id, d.user_id);

  SELECT * INTO t FROM public.tasks
  WHERE deal_id = _deal_id AND kind = 'rebook' AND done = false
  LIMIT 1;
  IF FOUND THEN RETURN t; END IF;

  due := date_trunc('day', now()) + interval '1 day' + interval '9 hours';
  WHILE extract(isodow from due) > 5 LOOP
    due := due + interval '1 day';
  END LOOP;

  INSERT INTO public.tasks (user_id, created_by, lead_id, deal_id, kind, title, detail, due_at, cadence_days)
  VALUES (assignee, actor, d.lead_id, _deal_id, 'rebook', 'Přebukovat schůzku',
    COALESCE(NULLIF(d.company_name, ''), 'Deal') || ' se nedostavil na schůzku.', due, 1)
  RETURNING * INTO t;

  INSERT INTO public.lead_events (lead_id, deal_id, actor_id, actor_name, type, detail)
  VALUES (d.lead_id, _deal_id, actor,
    COALESCE((SELECT COALESCE(full_name, email, '') FROM public.profiles WHERE id = actor), ''),
    'no_show', 'Nedostavil se — vytvořen úkol Přebukovat schůzku');

  RETURN t;
END;
$$;
REVOKE ALL ON FUNCTION public.create_rebook_task(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_rebook_task(uuid) TO authenticated;