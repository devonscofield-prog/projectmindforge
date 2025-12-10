import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getCallWithAnalysis, getAnalysisForCall, retryCallAnalysis, deleteFailedTranscript, updateCallTranscript, updateAnalysisUserCounts, type UpdateCallTranscriptParams } from '@/api/aiCallAnalysis';
import { 
  getCallProducts, 
  updateCallProduct, 
  deleteCallProduct, 
  insertCallProducts,
  updateProspectActiveRevenue 
} from '@/api/callProducts';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { createLogger } from '@/lib/logger';
import { getCallHistoryUrl } from '@/lib/routes';
import type { UserRole } from '@/types/database';

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
      // Defensive validation with specific error messages
      if (!callId) {
        log.error('Call detail query failed: Missing call ID', { userId, role });
        throw new Error('Call ID is required');
      }
      if (!userId) {
        log.error('Call detail query failed: Missing user ID', { callId, role });
        throw new Error('User ID is required');
      }
      if (!role) {
        log.error('Call detail query failed: Missing role', { callId, userId });
        throw new Error('User role is required');
      }

      const result = await getCallWithAnalysis(callId);
      
      if (!result) {
        log.warn('Call not found', { callId, userId, role });
        throw new Error('Call not found');
      }

      // Role-based access check with logging
      if (role === 'rep' && result.transcript.rep_id !== userId) {
        log.warn('Unauthorized call access attempt', { 
          callId, 
          userId, 
          role,
          callOwnerId: result.transcript.rep_id 
        });
        throw new Error('Not authorized to view this call');
      }

      return result;
    },
    enabled: !!callId && !!userId && !!role,
    staleTime: 30 * 1000, // 30 seconds - relatively fresh for call details
    retry: (failureCount, error) => {
      // Don't retry authorization or not-found errors
      const message = error instanceof Error ? error.message : '';
      if (message === 'Not authorized to view this call') return false;
      if (message === 'Call not found') return false;
      if (message === 'Call ID is required') return false;
      if (message === 'User ID is required') return false;
      if (message === 'User role is required') return false;
      return failureCount < 1;
    },
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

/**
 * Hook to retry analysis for a failed call
 */
export function useRetryAnalysis(callId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const result = await retryCallAnalysis(callId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to retry analysis');
      }
      return result;
    },
    onSuccess: async () => {
      // Invalidate call queries to trigger refetch
      await queryClient.invalidateQueries({ queryKey: callDetailKeys.call(callId) });
      await queryClient.invalidateQueries({ queryKey: callDetailKeys.analysis(callId) });

      toast({
        title: 'Analysis restarted',
        description: 'Your call is being re-analyzed. This usually takes 30-60 seconds.',
      });
    },
    onError: (error) => {
      log.error('Error retrying analysis', { callId, error });
      const isRateLimited = error.message?.toLowerCase().includes('rate limit');
      toast({
        title: isRateLimited ? 'Rate Limited' : 'Retry Failed',
        description: isRateLimited 
          ? 'Too many requests. Please wait a moment before trying again.'
          : error.message || 'Failed to retry analysis.',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to delete a failed transcript
 */
export function useDeleteFailedCall(callId: string, role: UserRole | null) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const result = await deleteFailedTranscript(callId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete transcript');
      }
      return result;
    },
    onSuccess: async () => {
      // Invalidate call history queries
      await queryClient.invalidateQueries({ queryKey: ['call-transcripts'] });

      toast({
        title: 'Call deleted',
        description: 'The failed call has been deleted. You can now resubmit.',
      });

      // Navigate back to call history
      navigate(getCallHistoryUrl(role));
    },
    onError: (error) => {
      log.error('Error deleting failed call', { callId, error });
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete the call.',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to update call transcript details
 */
export function useUpdateCallTranscript(callId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (updates: UpdateCallTranscriptParams) => {
      const result = await updateCallTranscript(callId, updates);
      if (!result.success) {
        throw new Error(result.error || 'Failed to update call');
      }
      return result;
    },
    onSuccess: async () => {
      // Invalidate call queries to refetch updated data
      await queryClient.invalidateQueries({ queryKey: callDetailKeys.call(callId) });
      await queryClient.invalidateQueries({ queryKey: ['call-transcripts'] });

      toast({
        title: 'Call updated',
        description: 'Call details have been updated successfully.',
      });
    },
    onError: (error) => {
      log.error('Error updating call', { callId, error });
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update call details.',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to update analysis user counts
 */
export function useUpdateAnalysisUserCounts(callId: string, analysisId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ itUsers, endUsers }: { itUsers: number | null; endUsers: number | null }) => {
      if (!analysisId) {
        throw new Error('No analysis to update');
      }
      const result = await updateAnalysisUserCounts(analysisId, { it_users: itUsers, end_users: endUsers });
      if (!result.success) {
        throw new Error(result.error || 'Failed to update user counts');
      }
      return result;
    },
    onSuccess: async () => {
      // Invalidate and refetch call queries to show updated data immediately
      await queryClient.invalidateQueries({ queryKey: callDetailKeys.call(callId), refetchType: 'active' });
      await queryClient.refetchQueries({ queryKey: callDetailKeys.call(callId) });

      toast({
        title: 'User counts updated',
        description: 'The user counts have been corrected successfully.',
      });
    },
    onError: (error) => {
      log.error('Error updating user counts', { callId, analysisId, error });
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update user counts.',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to reanalyze a call using the 7-agent pipeline
 * Clears existing analysis and triggers fresh analysis
 */
export function useReanalyzeCall(callId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('reanalyze-call', {
        body: { call_id: callId },
      });

      if (error) {
        throw new Error(error.message || 'Failed to start reanalysis');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: async () => {
      // Invalidate queries to trigger refetch and show processing state
      await queryClient.invalidateQueries({ queryKey: callDetailKeys.call(callId) });
      await queryClient.invalidateQueries({ queryKey: callDetailKeys.analysis(callId) });

      toast({
        title: 'Reanalysis started',
        description: 'Your call is being re-analyzed. This usually takes 30-60 seconds.',
      });
    },
    onError: (error) => {
      log.error('Error starting reanalysis', { callId, error });
      const message = error instanceof Error ? error.message : 'Failed to start reanalysis';
      const isRateLimited = message.toLowerCase().includes('rate limit');
      const isInProgress = message.toLowerCase().includes('already in progress');

      toast({
        title: isRateLimited ? 'Rate Limited' : isInProgress ? 'Already Processing' : 'Reanalysis Failed',
        description: isRateLimited 
          ? 'Too many requests. Please wait a moment before trying again.'
          : isInProgress
            ? 'This call is already being analyzed.'
            : message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook for admins to delete any call transcript
 */
export function useAdminDeleteCall() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (callId: string) => {
      const { adminDeleteCall } = await import('@/api/aiCallAnalysis');
      const result = await adminDeleteCall(callId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete call');
      }
      return result;
    },
    onSuccess: () => {
      // Invalidate all call history queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['admin-call-history'] });
      queryClient.invalidateQueries({ queryKey: ['call-history'] });
      queryClient.invalidateQueries({ queryKey: callDetailKeys.all });
      
      toast({
        title: 'Call Deleted',
        description: 'The call and all related data have been permanently deleted.',
      });
    },
    onError: (error: Error) => {
      log.error('Admin delete call failed', { error: error.message });
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete the call. Please try again.',
        variant: 'destructive',
      });
    },
  });
}
