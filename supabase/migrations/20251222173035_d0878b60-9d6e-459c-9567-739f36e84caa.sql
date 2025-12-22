-- First, set persona_id to NULL for any sessions referencing personas
UPDATE public.roleplay_sessions SET persona_id = NULL;

-- Now remove all existing roleplay personas to start fresh
DELETE FROM public.roleplay_personas;