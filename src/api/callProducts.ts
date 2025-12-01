import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type CallProduct = Tables<'call_products'>;
export type CallProductInsert = TablesInsert<'call_products'>;

interface ProductEntry {
  productId: string;
  unitPrice: number;
  quantity: number;
  promotionNotes?: string;
}

export async function insertCallProducts(
  callId: string,
  products: ProductEntry[]
): Promise<CallProduct[]> {
  if (products.length === 0) return [];

  const inserts: CallProductInsert[] = products.map(p => ({
    call_id: callId,
    product_id: p.productId,
    unit_price: p.unitPrice,
    quantity: p.quantity,
    promotion_notes: p.promotionNotes || null,
  }));

  const { data, error } = await supabase
    .from('call_products')
    .insert(inserts)
    .select();

  if (error) throw error;
  return data;
}

export async function getCallProducts(callId: string): Promise<CallProduct[]> {
  const { data, error } = await supabase
    .from('call_products')
    .select(`
      *,
      products:product_id (
        id,
        name,
        slug
      )
    `)
    .eq('call_id', callId);

  if (error) throw error;
  return data || [];
}

export async function calculateActiveRevenueForProspect(
  prospectId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('call_products')
    .select('unit_price, quantity, call_transcripts!inner(prospect_id)')
    .eq('call_transcripts.prospect_id', prospectId);

  if (error) throw error;
  
  if (!data || data.length === 0) return 0;

  return data.reduce((sum, item) => {
    return sum + (item.unit_price * item.quantity);
  }, 0);
}

export async function updateProspectActiveRevenue(
  prospectId: string
): Promise<void> {
  const activeRevenue = await calculateActiveRevenueForProspect(prospectId);

  const { error } = await supabase
    .from('prospects')
    .update({ active_revenue: activeRevenue })
    .eq('id', prospectId);

  if (error) throw error;
}
