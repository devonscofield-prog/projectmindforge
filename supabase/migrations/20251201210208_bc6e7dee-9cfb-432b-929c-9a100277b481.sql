-- Create products reference table
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Seed with the 9 products
INSERT INTO public.products (name, slug, display_order) VALUES
  ('Enterprise IT', 'enterprise_it', 1),
  ('Enterprise End User', 'enterprise_end_user', 2),
  ('Desktop Applications', 'desktop_applications', 3),
  ('AI Bundle', 'ai_bundle', 4),
  ('StormAI Phishing', 'stormai_phishing', 5),
  ('Security Awareness', 'security_awareness', 6),
  ('Compliance', 'compliance', 7),
  ('Business Skills', 'business_skills', 8),
  ('PM All Access', 'pm_all_access', 9)
ON CONFLICT (slug) DO NOTHING;

-- Create call_products table for per-call product offerings
CREATE TABLE IF NOT EXISTS public.call_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.call_transcripts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  promotion_notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(call_id, product_id)
);

-- Add active_revenue column to prospects
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS active_revenue numeric DEFAULT 0;

-- Enable RLS on products table
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Products are readable by all authenticated users (reference data)
CREATE POLICY "Authenticated users can view products"
ON public.products
FOR SELECT
TO authenticated
USING (true);

-- Enable RLS on call_products table
ALTER TABLE public.call_products ENABLE ROW LEVEL SECURITY;

-- Reps can insert their own call products
CREATE POLICY "Reps can insert own call products"
ON public.call_products
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.call_transcripts
    WHERE id = call_products.call_id
    AND rep_id = auth.uid()
  )
);

-- Reps can view own call products
CREATE POLICY "Reps can view own call products"
ON public.call_products
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.call_transcripts
    WHERE id = call_products.call_id
    AND rep_id = auth.uid()
  )
);

-- Managers can view team call products
CREATE POLICY "Managers can view team call products"
ON public.call_products
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::user_role) AND
  EXISTS (
    SELECT 1 FROM public.call_transcripts ct
    WHERE ct.id = call_products.call_id
    AND is_manager_of_user(auth.uid(), ct.rep_id)
  )
);

-- Admins can manage all call products
CREATE POLICY "Admins can manage all call products"
ON public.call_products
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));