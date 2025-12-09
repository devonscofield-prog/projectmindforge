-- Add Account Heat Score columns to prospects table
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS account_heat_score integer;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS account_heat_analysis jsonb;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS account_heat_updated_at timestamptz;

-- Add index for sorting by account heat score
CREATE INDEX IF NOT EXISTS idx_prospects_account_heat_score ON public.prospects(account_heat_score DESC NULLS LAST);

-- Add comment for documentation
COMMENT ON COLUMN public.prospects.account_heat_score IS 'Aggregate account health score (0-100) calculated from all available data';
COMMENT ON COLUMN public.prospects.account_heat_analysis IS 'JSONB containing detailed factor breakdown, signals, and recommendations';
COMMENT ON COLUMN public.prospects.account_heat_updated_at IS 'Timestamp of last account heat calculation';