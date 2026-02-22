-- Extend category CHECK constraint to allow both AI and task categories, plus NULL
-- Replaces the existing constraint from migration 20260205214003

ALTER TABLE public.account_follow_ups
  DROP CONSTRAINT IF EXISTS account_follow_ups_category_check;

ALTER TABLE public.account_follow_ups
  ADD CONSTRAINT account_follow_ups_category_check
  CHECK (category IS NULL OR category = ANY (ARRAY[
    'discovery', 'stakeholder', 'objection', 'proposal',
    'relationship', 'competitive',
    'phone_call', 'drip_email', 'text_message', 'follow_up_email'
  ]));
