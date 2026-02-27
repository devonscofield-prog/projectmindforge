

# Salesforce Opportunity CSV Enrichment Tool

## Overview
Admin uploads a standard Salesforce Opportunities CSV. The app matches each opportunity to existing prospects/accounts by Account Name, then enriches each row with the full intelligence package from the platform and exports the enriched CSV.

## Matching Strategy
- Parse CSV and extract `Account Name` column (standard SF export field)
- Match against `prospects.account_name` (case-insensitive) and also `call_transcripts.account_name` for unlinked calls
- For each matched prospect, pull all related data across tables

## Data to Append Per Opportunity Row

| Column Group | Source | Fields Added |
|---|---|---|
| Heat Score | `prospects` | Account Heat Score, Temperature, Trend |
| AI Insights | `prospects.ai_extracted_info` | Deal Blockers, Buying Signals, Stall Signals, Relationship Trajectory, Next Best Action, Pain Points, Competitors Mentioned |
| Call Activity | `call_transcripts` | Total Calls, Last Call Date, Call Types |
| Latest Analysis | `ai_call_analysis` (latest by call) | Call Summary, MEDDPICC Score, Coach Grade, Effectiveness Score, Deal Heat |
| Stakeholders | `stakeholders` | Names, Titles, Influence Levels, Champion Scores |
| Follow-Ups | `account_follow_ups` | Pending Follow-Up Count, Next Due Date, Titles |
| Competitor Intel | `ai_call_analysis.prospect_intel` | Competitors mentioned across calls |

## Implementation

### 1. New Edge Function: `enrich-opportunities-csv`
- Receives parsed CSV rows (account names) from client
- Uses service-role client to query across all reps' data (admin-level access)
- For each account name:
  - Find matching prospect(s) via case-insensitive `account_name` match
  - Query `call_transcripts` + `ai_call_analysis` for latest call data
  - Query `stakeholders` for contact info
  - Query `account_follow_ups` for pending tasks
- Returns enriched data array back to client
- Client merges original CSV columns with enrichment columns and triggers download

### 2. New Admin Page: `/admin/opportunity-enrichment`
- File upload zone (reuse existing drop zone pattern from `UploadDocumentDialog`)
- CSV parsing on client side (simple split-based parser, no new dependency needed)
- Preview table showing parsed rows + match status
- "Enrich & Download" button
- Progress indicator during processing
- Downloads enriched CSV with original columns preserved + new columns appended

### 3. New Files
- `supabase/functions/enrich-opportunities-csv/index.ts` — Edge function
- `src/pages/admin/AdminOpportunityEnrichment.tsx` — Page component
- `src/components/admin/OpportunityEnrichment.tsx` — Main enrichment UI component
- `src/api/opportunityEnrichment.ts` — API layer
- `src/lib/csvParser.ts` — Simple CSV parse/generate utility

### 4. Route & Navigation
- Add route `/admin/opportunity-enrichment` in `App.tsx` with admin protection
- Add nav item in `AppLayout.tsx` under Reporting section
- Add to `MobileHeader.tsx` route labels
- Add breadcrumb config

### 5. Processing Flow
```text
Upload CSV → Parse on client → Extract account names
    → Send to edge function (batch)
    → Edge function queries DB for each account
    → Returns enrichment data
    → Client merges original + enrichment columns
    → Download enriched CSV
```

### 6. No Database Changes Required
All data already exists in current tables. The edge function reads existing data with service-role access.

