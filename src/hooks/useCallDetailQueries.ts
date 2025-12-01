import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCallWithAnalysis, getAnalysisForCall } from '@/api/aiCallAnalysis';
import { 
  getCallProducts, 
  updateCallProduct, 
  deleteCallProduct, 
  insertCallProducts,
  updateProspectActiveRevenue 
} from '@/api/callProducts';
import { useToast } from '@/hooks/use-toast';
import { createLogger } from '@/lib/logger';

const log = createLogger('useCallDetailQueries');

// Query keys
export const callDetailKeys = {
  all: ['call-detail'] as const,
  call: (id: string) => [...callDetailKeys.all, 'call', id] as const,
  analysis: (id: string) => [...callDetailKeys.all, 'analysis', id] as const,
  products: (id: string) => [...callDetailKeys.all, 'products', id] as const,
};

/**
 * Hook to fetch call with analysis
 */
export function useCallWithAnalysis(callId: string | undefined, userId: string | undefined, role: string | undefined) {
  return useQuery({
    queryKey: callDetailKeys.call(callId || ''),
    queryFn: async () => {
      if (!callId) throw new Error('Call ID is required');
      const result = await getCallWithAnalysis(callId);
      
      if (!result) {
        throw new Error('Call not found');
      }

      // Role-based access check
      if (role === 'rep' && result.transcript.rep_id !== userId) {
        throw new Error('Not authorized to view this call');
      }

      return result;
    },
    enabled: !!callId && !!userId && !!role,
    staleTime: 30 * 1000, // 30 seconds - relatively fresh for call details
    retry: 1,
  });
}

/**
 * Hook to poll for analysis completion
 * Only polls when analysis status is pending or processing
 */
export function useAnalysisPolling(callId: string | undefined, shouldPoll: boolean) {
  return useQuery({
    queryKey: callDetailKeys.analysis(callId || ''),
    queryFn: async () => {
      if (!callId) return null;
      return await getAnalysisForCall(callId);
    },
    enabled: !!callId && shouldPoll,
    refetchInterval: shouldPoll ? 2000 : false, // Poll every 2 seconds when enabled
    staleTime: 0, // Always fresh when polling
  });
}

/**
 * Hook to fetch call products
 */
export function useCallProducts(callId: string | undefined) {
  return useQuery({
    queryKey: callDetailKeys.products(callId || ''),
    queryFn: async () => {
      if (!callId) return [];
      const data = await getCallProducts(callId);
      // getCallProducts returns data with joined products relation
      return data as Array<{
        id: string;
        call_id: string;
        product_id: string;
        unit_price: number;
        quantity: number;
        promotion_notes: string | null;
        created_at: string | null;
        products?: {
          id: string;
          name: string;
          slug: string;
        };
      }>;
    },
    enabled: !!callId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to update a call product
 */
export function useUpdateCallProduct(prospectId: string | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      productId, 
      updates 
    }: { 
      productId: string; 
      updates: { unit_price: number; quantity: number; promotion_notes: string } 
    }) => {
      await updateCallProduct(productId, updates);
    },
    onSuccess: async (_, variables) => {
      // Extract callId from the current query data
      const allKeys = queryClient.getQueryCache().getAll();
      const callProductKey = allKeys.find(q => 
        q.queryKey[0] === 'call-detail' && 
        q.queryKey[1] === 'products'
      )?.queryKey;
      
      if (callProductKey) {
        await queryClient.invalidateQueries({ queryKey: callProductKey });
      }

      // Update prospect active revenue if linked
      if (prospectId) {
        await updateProspectActiveRevenue(prospectId);
      }

      toast({
        title: 'Product updated',
        description: 'Product information has been updated successfully.',
      });
    },
    onError: (error) => {
      log.error('Error updating product', { error });
      toast({
        title: 'Error',
        description: 'Failed to update product information.',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to delete a call product
 */
export function useDeleteCallProduct(prospectId: string | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (productId: string) => {
      await deleteCallProduct(productId);
    },
    onSuccess: async () => {
      // Invalidate all call products queries
      await queryClient.invalidateQueries({ queryKey: ['call-detail', 'products'] });

      // Update prospect active revenue if linked
      if (prospectId) {
        await updateProspectActiveRevenue(prospectId);
      }

      toast({
        title: 'Product removed',
        description: 'Product has been removed from this call.',
      });
    },
    onError: (error) => {
      log.error('Error deleting product', { error });
      toast({
        title: 'Error',
        description: 'Failed to remove product.',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to add a product to a call
 */
export function useAddCallProduct(callId: string, prospectId: string | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      productId,
      unitPrice,
      quantity,
      promotionNotes,
    }: {
      productId: string;
      unitPrice: number;
      quantity: number;
      promotionNotes: string;
    }) => {
      await insertCallProducts(callId, [{
        productId,
        unitPrice,
        quantity,
        promotionNotes: promotionNotes || undefined,
      }]);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: callDetailKeys.products(callId) });

      // Update prospect active revenue if linked
      if (prospectId) {
        await updateProspectActiveRevenue(prospectId);
      }

      toast({
        title: 'Product added',
        description: 'Product has been added to this call.',
      });
    },
    onError: (error) => {
      log.error('Error adding product', { error });
      toast({
        title: 'Error',
        description: 'Failed to add product.',
        variant: 'destructive',
      });
    },
  });
}
