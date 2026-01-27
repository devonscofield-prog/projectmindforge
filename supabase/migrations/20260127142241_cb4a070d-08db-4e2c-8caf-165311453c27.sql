-- Add technical_environment column to roleplay_personas for persona-specific technical context
ALTER TABLE public.roleplay_personas 
ADD COLUMN technical_environment jsonb DEFAULT NULL;

COMMENT ON COLUMN public.roleplay_personas.technical_environment IS 
'Optional technical context: { stack: [], integration_questions: [], concerns: [] }';