import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- hoisted mocks ---
const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

import {
  insertCallProducts,
  getCallProducts,
  calculateActiveRevenueForProspect,
  updateCallProduct,
  deleteCallProduct,
  getProspectProductsSummary,
} from '../callProducts';

// ---------- helpers ----------
function chainable(resolveValue: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolveValue),
    then: <T>(resolve: (v: typeof resolveValue) => T): T => resolve(resolveValue),
    [Symbol.toStringTag]: 'Promise',
  };
  return builder;
}

// ---------- setup ----------
beforeEach(() => {
  vi.clearAllMocks();
});

// ---------- tests ----------
describe('callProducts', () => {
  describe('insertCallProducts', () => {
    it('returns empty array for empty products list', async () => {
      const result = await insertCallProducts('call-1', []);
      expect(result).toEqual([]);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('inserts products and returns them', async () => {
      const inserted = [
        { id: 'cp-1', call_id: 'call-1', product_id: 'prod-1', unit_price: 100, quantity: 2, promotion_notes: null },
        { id: 'cp-2', call_id: 'call-1', product_id: 'prod-2', unit_price: 50, quantity: 1, promotion_notes: 'Discount' },
      ];
      mockFrom.mockReturnValue(chainable({ data: inserted, error: null }));

      const result = await insertCallProducts('call-1', [
        { productId: 'prod-1', unitPrice: 100, quantity: 2 },
        { productId: 'prod-2', unitPrice: 50, quantity: 1, promotionNotes: 'Discount' },
      ]);

      expect(result).toHaveLength(2);
      expect(mockFrom).toHaveBeenCalledWith('call_products');
    });

    it('throws on insert error', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: new Error('Insert failed') }));

      await expect(
        insertCallProducts('call-1', [{ productId: 'p1', unitPrice: 10, quantity: 1 }])
      ).rejects.toThrow('Insert failed');
    });
  });

  describe('getCallProducts', () => {
    it('returns call products with joined product info', async () => {
      const products = [
        { id: 'cp-1', product_id: 'prod-1', products: { id: 'prod-1', name: 'Widget', slug: 'widget' } },
      ];
      mockFrom.mockReturnValue(chainable({ data: products, error: null }));

      const result = await getCallProducts('call-1');
      expect(result).toHaveLength(1);
      expect(mockFrom).toHaveBeenCalledWith('call_products');
    });

    it('returns empty array when data is null', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: null }));

      const result = await getCallProducts('call-1');
      expect(result).toEqual([]);
    });
  });

  describe('calculateActiveRevenueForProspect', () => {
    it('sums unit_price * quantity across all products', async () => {
      const data = [
        { unit_price: 100, quantity: 2, call_transcripts: { prospect_id: 'p-1' } },
        { unit_price: 50, quantity: 3, call_transcripts: { prospect_id: 'p-1' } },
      ];
      mockFrom.mockReturnValue(chainable({ data, error: null }));

      const revenue = await calculateActiveRevenueForProspect('p-1');
      // 100*2 + 50*3 = 200 + 150 = 350
      expect(revenue).toBe(350);
    });

    it('returns 0 when no data', async () => {
      mockFrom.mockReturnValue(chainable({ data: [], error: null }));

      const revenue = await calculateActiveRevenueForProspect('p-1');
      expect(revenue).toBe(0);
    });

    it('returns 0 when data is null', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: null }));

      const revenue = await calculateActiveRevenueForProspect('p-1');
      expect(revenue).toBe(0);
    });
  });

  describe('updateCallProduct', () => {
    it('updates and returns the product', async () => {
      const updated = { id: 'cp-1', unit_price: 200, quantity: 5 };
      const builder = chainable({ data: updated, error: null });
      mockFrom.mockReturnValue(builder);

      const result = await updateCallProduct('cp-1', { unit_price: 200, quantity: 5 });
      expect(result.unit_price).toBe(200);
      expect((builder.eq as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('id', 'cp-1');
    });

    it('throws on update error', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: new Error('Update failed') }));

      await expect(updateCallProduct('cp-1', { quantity: 0 })).rejects.toThrow('Update failed');
    });
  });

  describe('deleteCallProduct', () => {
    it('deletes successfully', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: null }));

      await expect(deleteCallProduct('cp-1')).resolves.toBeUndefined();
      expect(mockFrom).toHaveBeenCalledWith('call_products');
    });

    it('throws on delete error', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: new Error('Not found') }));

      await expect(deleteCallProduct('cp-1')).rejects.toThrow('Not found');
    });
  });

  describe('getProspectProductsSummary', () => {
    it('groups by product and computes summary fields', async () => {
      const rawData = [
        {
          id: 'cp-1',
          product_id: 'prod-1',
          unit_price: 100,
          quantity: 2,
          promotion_notes: null,
          products: { id: 'prod-1', name: 'Widget', slug: 'widget' },
          call_transcripts: { id: 'call-1', call_date: '2024-01-15', prospect_id: 'p-1' },
        },
        {
          id: 'cp-2',
          product_id: 'prod-1',
          unit_price: 120,
          quantity: 3,
          promotion_notes: '10% off',
          products: { id: 'prod-1', name: 'Widget', slug: 'widget' },
          call_transcripts: { id: 'call-2', call_date: '2024-02-10', prospect_id: 'p-1' },
        },
        {
          id: 'cp-3',
          product_id: 'prod-2',
          unit_price: 500,
          quantity: 1,
          promotion_notes: null,
          products: { id: 'prod-2', name: 'Gadget', slug: 'gadget' },
          call_transcripts: { id: 'call-1', call_date: '2024-01-15', prospect_id: 'p-1' },
        },
      ];
      mockFrom.mockReturnValue(chainable({ data: rawData, error: null }));

      const summaries = await getProspectProductsSummary('p-1');

      // Should be sorted by total_revenue desc
      // prod-1: 100*2 + 120*3 = 200 + 360 = 560
      // prod-2: 500*1 = 500
      expect(summaries).toHaveLength(2);
      expect(summaries[0].product_id).toBe('prod-1');
      expect(summaries[0].total_revenue).toBe(560);
      expect(summaries[0].call_count).toBe(2);
      expect(summaries[0].total_quantity).toBe(5);
      expect(summaries[0].avg_unit_price).toBe(112); // 560/5
      expect(summaries[0].most_recent_call_date).toBe('2024-02-10');
      expect(summaries[0].calls).toHaveLength(2);

      expect(summaries[1].product_id).toBe('prod-2');
      expect(summaries[1].total_revenue).toBe(500);
      expect(summaries[1].call_count).toBe(1);
    });

    it('returns empty array when no data', async () => {
      mockFrom.mockReturnValue(chainable({ data: [], error: null }));

      const result = await getProspectProductsSummary('p-1');
      expect(result).toEqual([]);
    });

    it('returns empty array when data is null', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: null }));

      const result = await getProspectProductsSummary('p-1');
      expect(result).toEqual([]);
    });

    it('handles missing product/call info gracefully', async () => {
      const rawData = [
        {
          id: 'cp-1',
          product_id: 'prod-x',
          unit_price: 10,
          quantity: 1,
          promotion_notes: null,
          products: null,
          call_transcripts: null,
        },
      ];
      mockFrom.mockReturnValue(chainable({ data: rawData, error: null }));

      const summaries = await getProspectProductsSummary('p-1');

      expect(summaries).toHaveLength(1);
      expect(summaries[0].product_name).toBe('Unknown Product');
      expect(summaries[0].product_slug).toBe('');
      expect(summaries[0].calls[0].call_date).toBe('');
      expect(summaries[0].calls[0].call_id).toBe('');
    });

    it('throws on supabase error', async () => {
      mockFrom.mockReturnValue(chainable({ data: null, error: new Error('Query failed') }));

      await expect(getProspectProductsSummary('p-1')).rejects.toThrow('Query failed');
    });
  });
});
