ALTER TABLE account_follow_ups DROP CONSTRAINT account_follow_ups_category_check;
ALTER TABLE account_follow_ups ADD CONSTRAINT account_follow_ups_category_check 
  CHECK (category = ANY (ARRAY[
    'discovery', 'stakeholder', 'objection', 'proposal', 
    'relationship', 'competitive',
    'phone_call', 'drip_email', 'text_message', 'follow_up_email'
  ]));