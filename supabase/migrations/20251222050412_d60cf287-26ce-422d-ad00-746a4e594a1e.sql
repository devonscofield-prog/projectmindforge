
-- Soft-delete the original 4 personas by marking them inactive (they have session references)
UPDATE public.roleplay_personas
SET is_active = false
WHERE name NOT IN (
  'Richard Morrison',
  'Victoria Chen',
  'Jonathan Park',
  'Angela Washington',
  'Kevin O Brien',
  'Tyler Nguyen',
  'Samantha Rodriguez',
  'Dr. Michelle Foster'
);
