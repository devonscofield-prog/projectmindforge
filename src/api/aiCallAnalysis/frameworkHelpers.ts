/**
 * Helper functions for backward compatibility with BANT → MEDDPICC migration
 */

import { FrameworkTrend, CoachingTrendAnalysis } from './types';

// Default FrameworkTrend for when data is missing
export const defaultFrameworkTrend: FrameworkTrend = {
  trend: 'stable',
  startingAvg: 0,
  endingAvg: 0,
  keyInsight: 'No data available',
  evidence: [],
  recommendation: 'Submit more calls to generate insights',
};

/**
 * Get the primary qualification framework trend (MEDDPICC or legacy BANT)
 */
export function getPrimaryFrameworkTrend(trendAnalysis: CoachingTrendAnalysis['trendAnalysis']): FrameworkTrend {
  return trendAnalysis.meddpicc ?? trendAnalysis.bant ?? defaultFrameworkTrend;
}

/**
 * Get the label for the primary qualification framework
 */
export function getPrimaryFrameworkLabel(trendAnalysis: CoachingTrendAnalysis['trendAnalysis']): string {
  return trendAnalysis.meddpicc ? 'MEDDPICC' : 'BANT';
}

/**
 * Safely access BANT data with fallback to default
 */
export function getBantTrend(trendAnalysis: CoachingTrendAnalysis['trendAnalysis']): FrameworkTrend {
  return trendAnalysis.bant ?? defaultFrameworkTrend;
}

/**
 * Check if analysis uses MEDDPICC (new) or BANT (legacy)
 */
export function usesMeddpicc(trendAnalysis: CoachingTrendAnalysis['trendAnalysis']): boolean {
  return !!trendAnalysis.meddpicc;
}
