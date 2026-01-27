

# Plan: Fix prospects.heat_score Constraint Mismatch

## Problem

The `prospects.heat_score` column has an outdated CHECK constraint that limits values to 1-10:
```sql
CHECK ((heat_score >= 1) AND (heat_score <= 10))
```

The Deal Heat scoring system now uses a **0-100 scale**, causing constraint violations when the analysis pipeline tries to update prospect records with new heat scores.

## Solution

Create a database migration to update the constraint from 1-10 to 0-100.

## Migration SQL

```sql
-- Drop the old 1-10 constraint
ALTER TABLE public.prospects 
DROP CONSTRAINT IF EXISTS prospects_heat_score_check;

-- Add new 0-100 constraint
ALTER TABLE public.prospects 
ADD CONSTRAINT prospects_heat_score_check 
CHECK ((heat_score >= 0) AND (heat_score <= 100));
```

## Files to Create

| File | Action | Description |
|------|--------|-------------|
| New migration | Create | Update heat_score constraint from 1-10 to 0-100 |

## Expected Result

After this migration:
- Deal Heat calculations (0-100 scale) will successfully update `prospects.heat_score`
- The analysis pipeline will no longer fail on prospect updates
- Existing heat scores (if any are still in 1-10 range) will remain valid since 1-10 is within 0-100

## Risk Assessment

**Low risk** - The new constraint (0-100) is a superset of the old constraint (1-10), so:
- All existing valid data remains valid
- No data migration needed
- Only enables new valid values

