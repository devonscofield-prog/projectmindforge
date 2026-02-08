ALTER TABLE daily_report_configs
ALTER COLUMN report_sections SET DEFAULT '{
  "summary_stats": true,
  "wow_trends": true,
  "best_deal": true,
  "label_breakdown": true,
  "close_month_breakdown": true,
  "pipeline_integrity": true,
  "rep_breakdown": true
}'::jsonb;