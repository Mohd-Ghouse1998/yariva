CREATE FUNCTION public.retain_blind_history() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
  RAISE EXCEPTION 'Blind contribution and exposure history is immutable';
END $$;
CREATE TRIGGER retain_blind_contributions BEFORE UPDATE OR DELETE ON "BlindContribution"
  FOR EACH ROW EXECUTE FUNCTION public.retain_blind_history();
CREATE TRIGGER retain_media_exposures BEFORE UPDATE OR DELETE ON "MediaExposure"
  FOR EACH ROW EXECUTE FUNCTION public.retain_blind_history();
REVOKE ALL ON FUNCTION public.retain_blind_history() FROM PUBLIC;
