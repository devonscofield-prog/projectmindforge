-- Fix the function search path for the trigger function
CREATE OR REPLACE FUNCTION public.update_ms_graph_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;