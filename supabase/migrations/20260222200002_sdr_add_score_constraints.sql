-- Add CHECK constraints on sdr_call_grades score fields and overall_grade.

-- Score fields must be between 0 and 10
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'sdr_call_grades_opener_score_range'
  ) THEN
    ALTER TABLE public.sdr_call_grades
      ADD CONSTRAINT sdr_call_grades_opener_score_range
      CHECK (opener_score >= 0 AND opener_score <= 10);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'sdr_call_grades_engagement_score_range'
  ) THEN
    ALTER TABLE public.sdr_call_grades
      ADD CONSTRAINT sdr_call_grades_engagement_score_range
      CHECK (engagement_score >= 0 AND engagement_score <= 10);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'sdr_call_grades_objection_handling_score_range'
  ) THEN
    ALTER TABLE public.sdr_call_grades
      ADD CONSTRAINT sdr_call_grades_objection_handling_score_range
      CHECK (objection_handling_score >= 0 AND objection_handling_score <= 10);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'sdr_call_grades_appointment_setting_score_range'
  ) THEN
    ALTER TABLE public.sdr_call_grades
      ADD CONSTRAINT sdr_call_grades_appointment_setting_score_range
      CHECK (appointment_setting_score >= 0 AND appointment_setting_score <= 10);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'sdr_call_grades_professionalism_score_range'
  ) THEN
    ALTER TABLE public.sdr_call_grades
      ADD CONSTRAINT sdr_call_grades_professionalism_score_range
      CHECK (professionalism_score >= 0 AND professionalism_score <= 10);
  END IF;
END $$;

-- overall_grade must be one of the allowed letter grades
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'sdr_call_grades_overall_grade_enum'
  ) THEN
    ALTER TABLE public.sdr_call_grades
      ADD CONSTRAINT sdr_call_grades_overall_grade_enum
      CHECK (overall_grade IN ('A+', 'A', 'B', 'C', 'D', 'F'));
  END IF;
END $$;
