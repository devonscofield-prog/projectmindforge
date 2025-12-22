-- Add grading_criteria column to roleplay_personas for persona-specific grading rules
ALTER TABLE public.roleplay_personas 
ADD COLUMN IF NOT EXISTS grading_criteria jsonb DEFAULT '{}'::jsonb;

-- Add feedback_visibility column to roleplay_grades to track restricted feedback
ALTER TABLE public.roleplay_grades 
ADD COLUMN IF NOT EXISTS feedback_visibility text DEFAULT 'full';

-- Update Alex with his specific grading criteria
UPDATE public.roleplay_personas 
SET grading_criteria = '{
  "role_description": "You are a senior coach specializing in Investigative Empathy. You are grading a call against Alex, the Stoic IT Director.",
  "scoring_categories": [
    {
      "name": "Patience & Silence",
      "weight": 30,
      "description": "Did the rep allow for silence after Alex short answers? If the rep spoke again within 2 seconds of a short answer, deduct points.",
      "key": "patience_silence"
    },
    {
      "name": "Question Quality",
      "weight": 40,
      "description": "Count the number of How and What questions vs Yes/No questions. Effective discovery with Alex requires open-ended curiosity.",
      "key": "question_quality"
    },
    {
      "name": "The Azure Pivot",
      "weight": 30,
      "description": "Did the rep successfully uncover the Azure Migration pain point? If they finished the call without Alex admitting the teams skill gap, they failed the primary objective.",
      "key": "azure_pivot"
    }
  ],
  "negative_triggers": [
    {
      "trigger": "Rep starts pitching StormWind platform before Alex mentions a specific technology gap",
      "max_grade": "C",
      "explanation": "Premature pitching before uncovering the core pain point"
    }
  ],
  "hide_feedback_below_grade": "C"
}'::jsonb
WHERE name = 'Alex';