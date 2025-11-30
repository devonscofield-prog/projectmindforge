import { supabase } from '@/integrations/supabase/client';
import { 
  DIRECT_ANALYSIS_MAX, 
  SAMPLING_MAX 
} from './constants';
import type { 
  AnalysisTier, 
  CallAnalysis, 
  ChunkSummary, 
  CoachingTrendAnalysis,
  FormattedCall,
  RepContributionData 
} from './types';

/**
 * Determines the analysis tier based on call count
 */
export function determineAnalysisTier(callCount: number): AnalysisTier {
  if (callCount <= DIRECT_ANALYSIS_MAX) return 'direct';
  if (callCount <= SAMPLING_MAX) return 'sampled';
  return 'hierarchical';
}

/**
 * Performs stratified sampling across the date range.
 * Groups calls by week and samples proportionally to maintain temporal distribution.
 */
export function stratifiedSample<T extends { date: string }>(
  calls: T[],
  targetSize: number = DIRECT_ANALYSIS_MAX
): { sampled: T[]; originalCount: number } {
  if (calls.length <= targetSize) {
    return { sampled: calls, originalCount: calls.length };
  }

  // Group calls by week
  const weekGroups = new Map<string, T[]>();
  calls.forEach(call => {
    const date = new Date(call.date);
    const weekStart = new Date(date);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    if (!weekGroups.has(weekKey)) {
      weekGroups.set(weekKey, []);
    }
    weekGroups.get(weekKey)!.push(call);
  });

  // Calculate proportional sample size per week
  const totalCalls = calls.length;
  const sampled: T[] = [];
  
  // Sort weeks chronologically
  const sortedWeeks = Array.from(weekGroups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  
  for (const [, weekCalls] of sortedWeeks) {
    const proportion = weekCalls.length / totalCalls;
    let sampleSize = Math.round(proportion * targetSize);
    
    // Ensure at least 1 call per week if week has calls
    sampleSize = Math.max(1, Math.min(sampleSize, weekCalls.length));
    
    // Sort by date and take evenly distributed samples
    const sorted = weekCalls.sort((a, b) => a.date.localeCompare(b.date));
    if (sampleSize >= sorted.length) {
      sampled.push(...sorted);
    } else {
      const step = sorted.length / sampleSize;
      for (let i = 0; i < sampleSize; i++) {
        sampled.push(sorted[Math.floor(i * step)]);
      }
    }
  }

  // If we're still over target, trim from the middle (preserve recent and oldest)
  if (sampled.length > targetSize) {
    const sorted = sampled.sort((a, b) => a.date.localeCompare(b.date));
    const keepStart = Math.floor(targetSize * 0.3);
    const keepEnd = Math.floor(targetSize * 0.4);
    const result = [
      ...sorted.slice(0, keepStart),
      ...sorted.slice(sorted.length - keepEnd)
    ];
    // Fill remaining from middle, evenly spaced
    const middle = sorted.slice(keepStart, sorted.length - keepEnd);
    const remaining = targetSize - result.length;
    const middleStep = middle.length / remaining;
    for (let i = 0; i < remaining && i * middleStep < middle.length; i++) {
      result.splice(keepStart + i, 0, middle[Math.floor(i * middleStep)]);
    }
    return { sampled: result.slice(0, targetSize), originalCount: calls.length };
  }

  return { sampled, originalCount: calls.length };
}

/**
 * Splits calls into weekly chunks for hierarchical analysis
 */
export function splitIntoWeeklyChunks<T extends { date: string }>(
  calls: T[],
  minChunkSize: number = 5,
  maxChunkSize: number = 25
): T[][] {
  // Group by week
  const weekGroups = new Map<string, T[]>();
  calls.forEach(call => {
    const date = new Date(call.date);
    const weekStart = new Date(date);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    if (!weekGroups.has(weekKey)) {
      weekGroups.set(weekKey, []);
    }
    weekGroups.get(weekKey)!.push(call);
  });

  // Sort weeks and create chunks
  const sortedWeeks = Array.from(weekGroups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, calls]) => calls);

  // Merge small weeks together, split large weeks
  const chunks: T[][] = [];
  let currentChunk: T[] = [];

  for (const weekCalls of sortedWeeks) {
    if (weekCalls.length > maxChunkSize) {
      // Flush current chunk if non-empty
      if (currentChunk.length >= minChunkSize) {
        chunks.push(currentChunk);
        currentChunk = [];
      } else if (currentChunk.length > 0) {
        // Add to beginning of large week
        weekCalls.unshift(...currentChunk);
        currentChunk = [];
      }
      
      // Split large week into multiple chunks
      for (let i = 0; i < weekCalls.length; i += maxChunkSize) {
        const slice = weekCalls.slice(i, i + maxChunkSize);
        if (slice.length >= minChunkSize) {
          chunks.push(slice);
        } else {
          currentChunk = slice;
        }
      }
    } else if (currentChunk.length + weekCalls.length <= maxChunkSize) {
      currentChunk.push(...weekCalls);
    } else {
      if (currentChunk.length >= minChunkSize) {
        chunks.push(currentChunk);
      }
      currentChunk = weekCalls;
    }
  }

  // Handle remaining chunk
  if (currentChunk.length > 0) {
    if (currentChunk.length >= minChunkSize || chunks.length === 0) {
      chunks.push(currentChunk);
    } else {
      // Merge with last chunk
      chunks[chunks.length - 1].push(...currentChunk);
    }
  }

  return chunks;
}

/**
 * Performs hierarchical analysis by analyzing chunks and then synthesizing
 */
export async function analyzeHierarchically(
  formattedCalls: FormattedCall[],
  dateRange: { from: string; to: string }
): Promise<{ analysis: CoachingTrendAnalysis; chunksAnalyzed: number; callsPerChunk: number[] }> {
  const chunks = splitIntoWeeklyChunks(formattedCalls);
  console.log(`[analyzeHierarchically] Split ${formattedCalls.length} calls into ${chunks.length} chunks`);

  // Analyze each chunk
  const chunkSummaries: ChunkSummary[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkDates = chunk.map(c => c.date).sort();
    
    console.log(`[analyzeHierarchically] Analyzing chunk ${i + 1}/${chunks.length} with ${chunk.length} calls`);
    
    const response = await supabase.functions.invoke('generate-coaching-chunk-summary', {
      body: {
        calls: chunk,
        chunkIndex: i,
        dateRange: {
          from: chunkDates[0],
          to: chunkDates[chunkDates.length - 1]
        }
      }
    });

    if (response.error) {
      console.error(`[analyzeHierarchically] Chunk ${i} error:`, response.error);
      throw new Error(`Failed to analyze chunk ${i + 1}: ${response.error.message}`);
    }

    chunkSummaries.push(response.data as ChunkSummary);
  }

  console.log(`[analyzeHierarchically] All ${chunks.length} chunks analyzed, synthesizing...`);

  // Send chunk summaries to main function for synthesis
  const response = await supabase.functions.invoke('generate-coaching-trends', {
    body: {
      hierarchicalMode: true,
      chunkSummaries,
      dateRange,
      totalCalls: formattedCalls.length
    }
  });

  if (response.error) {
    throw new Error(`Failed to synthesize hierarchical analysis: ${response.error.message}`);
  }

  return {
    analysis: response.data as CoachingTrendAnalysis,
    chunksAnalyzed: chunks.length,
    callsPerChunk: chunks.map(c => c.length)
  };
}

/**
 * Helper to invoke the coaching trends edge function
 */
export async function invokeCoachingTrendsFunction(
  calls: FormattedCall[],
  dateRange: { from: string; to: string }
): Promise<CoachingTrendAnalysis> {
  try {
    const response = await supabase.functions.invoke('generate-coaching-trends', {
      body: { calls, dateRange }
    });

    if (response.error) {
      const errorMessage = response.error.message?.toLowerCase() || '';
      const errorContext = (response.error as unknown as { context?: { body?: string } }).context?.body?.toLowerCase() || '';
      
      if (errorMessage.includes('429') || errorMessage.includes('rate') || errorContext.includes('rate limit')) {
        throw new Error('AI service is temporarily busy. Please wait a moment and try again.');
      }
      if (errorMessage.includes('402') || errorMessage.includes('quota') || errorContext.includes('quota')) {
        throw new Error('AI usage quota exceeded. Please contact support or try again later.');
      }
      if (errorMessage.includes('503') || errorMessage.includes('unavailable')) {
        throw new Error('AI service is temporarily unavailable. Please try again in a few minutes.');
      }
      
      throw new Error(`AI trend analysis failed: ${response.error.message}`);
    }

    if (!response.data || response.data.error) {
      throw new Error(response.data?.error || 'Unknown error from AI');
    }

    return response.data as CoachingTrendAnalysis;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    if (errorMessage.includes('temporarily') || errorMessage.includes('quota') || errorMessage.includes('unavailable')) {
      throw err;
    }
    throw new Error(`AI trend analysis failed: ${errorMessage}`);
  }
}

/**
 * Calculate per-rep contribution metrics from analyses
 */
export function calculateRepContributions(
  analyses: CallAnalysis[],
  repProfiles: { id: string; name: string; team_id: string | null }[],
  teamMap: Map<string, string>,
  totalCalls: number
): RepContributionData[] {
  // Group analyses by rep
  const repAnalyses = new Map<string, CallAnalysis[]>();
  analyses.forEach(a => {
    const existing = repAnalyses.get(a.rep_id) || [];
    existing.push(a);
    repAnalyses.set(a.rep_id, existing);
  });

  // Calculate metrics for each rep
  const contributions: RepContributionData[] = [];
  
  repProfiles.forEach(rep => {
    const repCalls = repAnalyses.get(rep.id) || [];
    if (repCalls.length === 0) return; // Skip reps with no calls

    // Calculate average heat score
    const heatScores = repCalls
      .map(a => a.coach_output?.heat_signature?.score)
      .filter((s): s is number => s !== null && s !== undefined);
    const avgHeat = heatScores.length > 0 
      ? heatScores.reduce((sum, s) => sum + s, 0) / heatScores.length 
      : null;

    // Calculate framework scores
    const bantScores: number[] = [];
    const gapScores: number[] = [];
    const listenScores: number[] = [];

    repCalls.forEach(a => {
      const fs = a.coach_output?.framework_scores;
      if (fs?.bant?.score !== undefined) bantScores.push(fs.bant.score);
      if (fs?.gap_selling?.score !== undefined) gapScores.push(fs.gap_selling.score);
      if (fs?.active_listening?.score !== undefined) listenScores.push(fs.active_listening.score);
    });

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null;

    contributions.push({
      repId: rep.id,
      repName: rep.name,
      teamName: rep.team_id ? teamMap.get(rep.team_id) : undefined,
      callCount: repCalls.length,
      percentageOfTotal: (repCalls.length / totalCalls) * 100,
      averageHeatScore: avgHeat,
      frameworkScores: {
        bant: avg(bantScores),
        gapSelling: avg(gapScores),
        activeListening: avg(listenScores),
      },
    });
  });

  // Sort by call count descending
  return contributions.sort((a, b) => b.callCount - a.callCount);
}
