

# Add Contract Contact Matching to Opportunity Enrichment

## Problem
Currently the enrichment only matches by Account Name against `prospects.account_name` / `prospects.prospect_name`. The user wants to also match by "Contract Contact" column from the Excel against stakeholder names in the `stakeholders` table.

## Changes

### 1. New DB function: `fuzzy_match_stakeholders`
Create a new RPC that fuzzy-matches contact names against `stakeholders.name`, returning the linked `prospect_id` and similarity score. This gives a second path to find the right prospect when account name matching fails or is weak.

### 2. Update frontend: detect "Contract Contact" column
- Add `CONTRACT_CONTACT_VARIANTS` list (e.g., "Contract Contact", "Contact Name", "Primary Contact", "contract_contact")
- Detect this column during parsing (similar to account name detection)
- Send both `accountNames` and `contactNames` arrays (with a mapping of which contact belongs to which row) to the edge function

### 3. Update edge function to accept contact names
- Accept new `contactNames` parameter (array of objects: `{ accountName, contactName }`)
- For each row:
  1. First try `fuzzy_match_prospects` by account name (existing)
  2. If no match or low confidence, try `fuzzy_match_stakeholders` by contact name
  3. If stakeholder matches, use its `prospect_id` to pull the same enrichment data
  4. Pick whichever match has highest combined confidence
- Add `SW_Contact_Match` and `SW_Matched_Contact` columns to output

### 4. Update match stats display
- Include "Fuzzy Match" in the matched count (currently only counts exact "Matched")
- Show contact-based matches in the preview table

## Technical Details

**New migration SQL** — `fuzzy_match_stakeholders` function:
```sql
CREATE OR REPLACE FUNCTION public.fuzzy_match_stakeholders(
  p_contact_names text[],
  p_threshold float DEFAULT 0.3
)
RETURNS TABLE(
  input_name text,
  stakeholder_id uuid,
  stakeholder_name text,
  prospect_id uuid,
  rep_id uuid,
  job_title text,
  similarity_score float
)
-- Matches against stakeholders.name using pg_trgm similarity
-- Returns top 3 per input, ordered by similarity
```

**Edge function flow** — for each opportunity row:
1. Look up account name match from `fuzzy_match_prospects` results
2. If contact name provided, also call `fuzzy_match_stakeholders`
3. If stakeholder match found and its `prospect_id` yields a better or supplementary match, use it
4. Merge: account-level enrichment + `SW_Matched_Contact` / `SW_Contact_Title` columns

**Frontend changes** — `OpportunityEnrichment.tsx`:
- Detect contact column, pass `contactNames` alongside `accountNames` to edge function
- Display `SW_Matched_Contact` in preview

