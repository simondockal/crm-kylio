CREATE TABLE public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  company_name text NOT NULL DEFAULT '',
  website_url text NOT NULL DEFAULT '',
  contact_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  cold_note text NOT NULL DEFAULT '',
  stage text NOT NULL DEFAULT 'nova_schuzka',
  position double precision NOT NULL DEFAULT 0,
  followup_at timestamptz,
  followup_note text NOT NULL DEFAULT '',
  followup_done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deals_stage_check CHECK (stage IN ('nova_schuzka','uvodni_probehla','v_jednani','nedostavil_se','vyhrano','prohrano'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deals TO authenticated;
GRANT ALL ON public.deals TO service_role;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own deals" ON public.deals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own deals" ON public.deals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own deals" ON public.deals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own deals" ON public.deals FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER deals_set_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX deals_user_stage_idx ON public.deals (user_id, stage, position);

CREATE TABLE public.deal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  author text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_notes TO authenticated;
GRANT ALL ON public.deal_notes TO service_role;
ALTER TABLE public.deal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own deal notes" ON public.deal_notes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own deal notes" ON public.deal_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own deal notes" ON public.deal_notes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own deal notes" ON public.deal_notes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER deal_notes_set_updated_at BEFORE UPDATE ON public.deal_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX deal_notes_deal_idx ON public.deal_notes (deal_id, created_at);
