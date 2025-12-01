-- Add RLS policies for updating and deleting call products

-- Reps can update products on their own calls
CREATE POLICY "Reps can update own call products"
ON call_products
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM call_transcripts
    WHERE call_transcripts.id = call_products.call_id
      AND call_transcripts.rep_id = auth.uid()
  )
);

-- Reps can delete products from their own calls
CREATE POLICY "Reps can delete own call products"
ON call_products
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM call_transcripts
    WHERE call_transcripts.id = call_products.call_id
      AND call_transcripts.rep_id = auth.uid()
  )
);