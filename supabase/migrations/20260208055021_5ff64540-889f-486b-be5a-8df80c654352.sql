ALTER TABLE public.daily_report_configs
ADD COLUMN report_sections jsonb DEFAULT '{
  "summary_stats": true,
  "wow_trends": true,
  "top_calls": true,
  "bottom_calls": true,
  "top_performers": true,
  "needs_attention": true,
  "rep_breakdown": true,
  "pipeline": true
}'::jsonb;