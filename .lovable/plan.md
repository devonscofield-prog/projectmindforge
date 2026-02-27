

# Slim Down + Add Call Intelligence to Opportunity Enrichment

## Fields to Keep (per user request)
- `SW_Match_Status`
- `SW_Prospect_Name`
- `SW_Matched_Account`
- `SW_Matched_Contact`
- `SW_Contact_Title`
- `SW_Heat_Score`
- `SW_Assigned_Rep`

## Fields to Remove
- `SW_Confidence`, `SW_Match_Source`, `SW_Account_Status`, `SW_Industry`, `SW_Active_Revenue`, `SW_Potential_Revenue`, `SW_Last_Contact`, `SW_Latest_Call_Date`, `SW_Total_Calls`

## New Call-Level Fields to Add
From `ai_call_analysis` joined to `call_transcripts` for matched prospect IDs:

| New Column | Source | Description |
|---|---|---|
| `SW_Total_Calls` | count of `call_transcripts` | Keep this one — useful context |
| `SW_Latest_Call_Date` | `call_transcripts.call_date` | Keep — when was last interaction |
| `SW_Latest_Call_Summary` | `ai_call_analysis.call_summary` | AI summary of the most recent call |
| `SW_Deal_Temperature` | `deal_heat_analysis.temperature` | Hot / Warm / Lukewarm / Cold |
| `SW_Deal_Trend` | `deal_heat_analysis.trend` | Heating Up / Cooling Down / Stagnant |
| `SW_Win_Probability` | `deal_heat_analysis.winning_probability` | e.g. "Medium (50%)" |
| `SW_Recommended_Action` | `deal_heat_analysis.recommended_action` | Next best action from deal heat |
| `SW_Coach_Grade` | `analysis_coaching.overall_grade` | Overall coaching grade (A+, B-, etc.) |
| `SW_Key_Deal_Factors` | `deal_heat_analysis.key_factors` | Concatenated positive/negative factors |

## Implementation

### 1. Update edge function (`enrich-opportunities-csv/index.ts`)
- In step 4, change the `call_transcripts` query to also fetch `id` (call_id)
- After getting call IDs, batch-query `ai_call_analysis` for matched calls: `call_summary`, `deal_heat_analysis`, `analysis_coaching`
- For each prospect, pick the **most recent call's** analysis data
- Build the new SW_ columns from parsed JSON fields
- Remove the dropped columns from the results object

### 2. No frontend changes needed
The frontend already dynamically renders whatever `SW_*` columns the edge function returns. The new columns will appear automatically in the preview table and downloaded CSV.

