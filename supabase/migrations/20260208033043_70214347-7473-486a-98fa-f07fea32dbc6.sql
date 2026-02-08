ALTER TABLE public.sales_coach_sessions
  ADD CONSTRAINT sales_coach_sessions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id);