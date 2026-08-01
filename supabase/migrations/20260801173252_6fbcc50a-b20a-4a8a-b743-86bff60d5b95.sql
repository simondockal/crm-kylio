GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.leads TO authenticated;
GRANT ALL ON TABLE public.leads TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.deals TO authenticated;
GRANT ALL ON TABLE public.deals TO service_role;