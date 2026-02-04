-- Create storage bucket for product knowledge documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-documents', 'product-documents', false);

-- RLS: Admins can manage files in product-documents bucket
CREATE POLICY "Admins can upload product documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-documents' AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can view product documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'product-documents' AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete product documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'product-documents' AND has_role(auth.uid(), 'admin'::user_role));

-- Add source_type column to distinguish scraped vs uploaded content
ALTER TABLE public.product_knowledge 
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'scraped' CHECK (source_type IN ('scraped', 'uploaded'));

-- Add file_path column to store the storage path for uploaded files
ALTER TABLE public.product_knowledge 
ADD COLUMN IF NOT EXISTS file_path TEXT;

-- Add original_filename column
ALTER TABLE public.product_knowledge 
ADD COLUMN IF NOT EXISTS original_filename TEXT;