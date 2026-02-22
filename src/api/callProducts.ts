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

export async function updateCallProduct(
  productId: string,
  updates: {
    unit_price?: number;
    quantity?: number;
    promotion_notes?: string;
  }
): Promise<CallProduct> {
  const { data, error } = await supabase
    .from('call_products')
    .update(updates)
    .eq('id', productId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCallProduct(productId: string): Promise<void> {
  const { error } = await supabase
    .from('call_products')
    .delete()
    .eq('id', productId);

  if (error) throw error;
}

export interface ProspectProductSummary {
  product_id: string;
  product_name: string;
  product_slug: string;
  total_revenue: number;
  call_count: number;
  total_quantity: number;
  avg_unit_price: number;
  most_recent_call_date: string;
  calls: {
    call_id: string;
    call_date: string;
    unit_price: number;
    quantity: number;
    promotion_notes: string | null;
  }[];
}

export async function getProspectProductsSummary(
  prospectId: string
): Promise<ProspectProductSummary[]> {
  // First, get all call products for this prospect with call info
  const { data: callProducts, error } = await supabase
    .from('call_products')
    .select(`
      id,
      product_id,
      unit_price,
      quantity,
      promotion_notes,
      products:product_id (
        id,
        name,
        slug
      ),
      call_transcripts!inner (
        id,
        call_date,
        prospect_id
      )
    `)
    .eq('call_transcripts.prospect_id', prospectId)
    .order('call_transcripts(call_date)', { ascending: false });

  if (error) throw error;
  if (!callProducts || callProducts.length === 0) return [];

  // Group by product
  const productMap = new Map<string, ProspectProductSummary>();

  type CallProductRow = NonNullable<typeof callProducts>[number] & {
    products: { id: string; name: string; slug: string } | null;
    call_transcripts: { id: string; call_date: string; prospect_id: string } | null;
  };
  (callProducts as CallProductRow[]).forEach((cp) => {
    const productId = cp.product_id;
    const productName = cp.products?.name || 'Unknown Product';
    const productSlug = cp.products?.slug || '';
    const callDate = cp.call_transcripts?.call_date || '';
    const callId = cp.call_transcripts?.id || '';

    if (!productMap.has(productId)) {
      productMap.set(productId, {
        product_id: productId,
        product_name: productName,
        product_slug: productSlug,
        total_revenue: 0,
        call_count: 0,
        total_quantity: 0,
        avg_unit_price: 0,
        most_recent_call_date: callDate,
        calls: [],
      });
    }

    const summary = productMap.get(productId)!;
    summary.total_revenue += cp.unit_price * cp.quantity;
    summary.total_quantity += cp.quantity;
    summary.call_count += 1;
    summary.calls.push({
      call_id: callId,
      call_date: callDate,
      unit_price: cp.unit_price,
      quantity: cp.quantity,
      promotion_notes: cp.promotion_notes,
    });

    // Update most recent call date
    if (callDate > summary.most_recent_call_date) {
      summary.most_recent_call_date = callDate;
    }
  });

  // Calculate averages and return as array
  const summaries = Array.from(productMap.values()).map(summary => {
    summary.avg_unit_price = summary.total_revenue / summary.total_quantity;
    return summary;
  });

  // Sort by total revenue descending
  summaries.sort((a, b) => b.total_revenue - a.total_revenue);

  return summaries;
}
