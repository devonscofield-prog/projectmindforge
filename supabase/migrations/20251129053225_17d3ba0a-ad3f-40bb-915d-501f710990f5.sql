-- Add industry column to prospects table
ALTER TABLE prospects ADD COLUMN industry text;

-- Create a check constraint for valid industry values
ALTER TABLE prospects ADD CONSTRAINT valid_industry CHECK (
  industry IS NULL OR industry IN (
    'education',
    'local_government', 
    'state_government',
    'federal_government',
    'healthcare',
    'msp',
    'technology',
    'finance',
    'manufacturing',
    'retail',
    'nonprofit',
    'other'
  )
);