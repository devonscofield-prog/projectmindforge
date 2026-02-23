import { describe, it, expect } from 'vitest';
import {
  determineAnalysisTier,
  defaultFrameworkTrend,
  getPrimaryFrameworkTrend,
  getPrimaryFrameworkLabel,
  getBantTrend,
  usesMeddpicc,
  DIRECT_ANALYSIS_MAX,
  SAMPLING_MAX,
} from '../aiCallAnalysis';
import { stratifiedSample, splitIntoWeeklyChunks, calculateRepContributions } from '../aiCallAnalysis/utils';

describe('aiCallAnalysis', () => {
  describe('determineAnalysisTier', () => {
    it('should return direct for small call counts', () => {
      expect(determineAnalysisTier(1)).toBe('direct');
      expect(determineAnalysisTier(10)).toBe('direct');
      expect(determineAnalysisTier(DIRECT_ANALYSIS_MAX)).toBe('direct');
    });

    it('should return sampled for medium call counts', () => {
      expect(determineAnalysisTier(DIRECT_ANALYSIS_MAX + 1)).toBe('sampled');
      expect(determineAnalysisTier(75)).toBe('sampled');
      expect(determineAnalysisTier(SAMPLING_MAX)).toBe('sampled');
    });

    it('should return hierarchical for large call counts', () => {
      expect(determineAnalysisTier(SAMPLING_MAX + 1)).toBe('hierarchical');
      expect(determineAnalysisTier(500)).toBe('hierarchical');
    });
  });

  describe('stratifiedSample', () => {
    it('should return all calls when under target size', () => {
      const calls = [
        { date: '2024-01-01' },
        { date: '2024-01-02' },
      ];
      const result = stratifiedSample(calls);
      expect(result.sampled.length).toBe(2);
      expect(result.originalCount).toBe(2);
    });

    it('should sample down to target size for large datasets', () => {
      // Create 100 calls across multiple weeks
      const calls = Array.from({ length: 100 }, (_, i) => ({
        date: new Date(2024, 0, 1 + i).toISOString().split('T')[0],
      }));
      const result = stratifiedSample(calls, 20);
      expect(result.sampled.length).toBeLessThanOrEqual(25); // some slack due to proportional distribution
      expect(result.originalCount).toBe(100);
    });

    it('should maintain temporal distribution across weeks', () => {
      // Create calls in two distinct weeks
      const calls = [
        ...Array.from({ length: 30 }, (_, i) => ({
          date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        })),
        ...Array.from({ length: 30 }, (_, i) => ({
          date: `2024-02-${String(i + 1).padStart(2, '0')}`,
        })),
      ];
      const result = stratifiedSample(calls, 10);
      // Should have calls from both months
      const janCalls = result.sampled.filter(c => c.date.startsWith('2024-01'));
      const febCalls = result.sampled.filter(c => c.date.startsWith('2024-02'));
      expect(janCalls.length).toBeGreaterThan(0);
      expect(febCalls.length).toBeGreaterThan(0);
    });
  });

  describe('splitIntoWeeklyChunks', () => {
    it('should group calls into weekly chunks', () => {
      const calls = [
        { date: '2024-01-01' }, // Monday week 1
        { date: '2024-01-02' }, // Tuesday week 1
        { date: '2024-01-08' }, // Monday week 2
        { date: '2024-01-09' }, // Tuesday week 2
        { date: '2024-01-15' }, // Monday week 3
        { date: '2024-01-16' }, // Tuesday week 3
        { date: '2024-01-17' }, // Wednesday week 3
        { date: '2024-01-18' }, // Thursday week 3
        { date: '2024-01-19' }, // Friday week 3
      ];
      const chunks = splitIntoWeeklyChunks(calls, 2, 10);
      expect(chunks.length).toBeGreaterThan(0);
      // All calls should be accounted for
      const totalCalls = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      expect(totalCalls).toBe(calls.length);
    });

    it('should merge small weeks together', () => {
      const calls = [
        { date: '2024-01-01' },
        { date: '2024-01-08' },
        { date: '2024-01-15' },
      ];
      // With minChunkSize=3, individual weeks with 1 call each should merge
      const chunks = splitIntoWeeklyChunks(calls, 3);
      expect(chunks.length).toBe(1);
      expect(chunks[0].length).toBe(3);
    });

    it('should split large weeks into multiple chunks', () => {
      // Create 30 calls all in the same week
      const calls = Array.from({ length: 30 }, (_, i) => ({
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
      }));
      const chunks = splitIntoWeeklyChunks(calls, 5, 10);
      // Should be split into multiple chunks of max 10
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(10 + 5); // maxChunkSize + potential merge
      });
    });
  });

  describe('frameworkHelpers', () => {
    const defaultPatience = {
      trend: 'stable' as const,
      startingAvg: 0,
      endingAvg: 0,
      avgInterruptions: 0,
      keyInsight: '',
      evidence: [],
      recommendation: '',
    };
    const defaultStrategicThreading = {
      trend: 'stable' as const,
      startingAvg: 0,
      endingAvg: 0,
      avgRelevanceRatio: 0,
      avgMissedOpportunities: 0,
      keyInsight: '',
      evidence: [],
      recommendation: '',
    };
    const defaultMonologue = {
      trend: 'stable' as const,
      totalViolations: 0,
      avgPerCall: 0,
      avgLongestTurn: 0,
      keyInsight: '',
      evidence: [],
      recommendation: '',
    };

    const meddpiccTrend = {
      trend: 'improving' as const,
      startingAvg: 50,
      endingAvg: 70,
      keyInsight: 'Getting better',
      evidence: ['Evidence 1'],
      recommendation: 'Keep going',
    };

    const bantTrend = {
      trend: 'declining' as const,
      startingAvg: 80,
      endingAvg: 60,
      keyInsight: 'Needs work',
      evidence: [],
      recommendation: 'Practice',
    };

    const baseFields = {
      patience: defaultPatience,
      strategicThreading: defaultStrategicThreading,
      monologueViolations: defaultMonologue,
    };

    describe('getPrimaryFrameworkTrend', () => {
      it('should return meddpicc when available', () => {
        const result = getPrimaryFrameworkTrend({
          ...baseFields,
          meddpicc: meddpiccTrend,
          bant: bantTrend,
          gapSelling: defaultFrameworkTrend,
          activeListening: defaultFrameworkTrend,
        });
        expect(result).toBe(meddpiccTrend);
      });

      it('should fall back to bant when meddpicc is not available', () => {
        const result = getPrimaryFrameworkTrend({
          ...baseFields,
          bant: bantTrend,
          gapSelling: defaultFrameworkTrend,
          activeListening: defaultFrameworkTrend,
          meddpicc: defaultFrameworkTrend,
        });
        expect(result).toBe(bantTrend);
      });

      it('should return default when neither is available', () => {
        const result = getPrimaryFrameworkTrend({
          ...baseFields,
          gapSelling: defaultFrameworkTrend,
          activeListening: defaultFrameworkTrend,
          meddpicc: defaultFrameworkTrend,
        });
        expect(result).toBe(defaultFrameworkTrend);
      });
    });

    describe('getPrimaryFrameworkLabel', () => {
      it('should return MEDDPICC when meddpicc is available', () => {
        const label = getPrimaryFrameworkLabel({
          ...baseFields,
          meddpicc: meddpiccTrend,
          gapSelling: defaultFrameworkTrend,
          activeListening: defaultFrameworkTrend,
        });
        expect(label).toBe('MEDDPICC');
      });

      it('should return BANT when meddpicc is not available', () => {
        const label = getPrimaryFrameworkLabel({
          ...baseFields,
          bant: bantTrend,
          gapSelling: defaultFrameworkTrend,
          activeListening: defaultFrameworkTrend,
          meddpicc: defaultFrameworkTrend,
        });
        expect(label).toBe('BANT');
      });
    });

    describe('usesMeddpicc', () => {
      it('should return true when meddpicc data exists', () => {
        expect(usesMeddpicc({
          ...baseFields,
          meddpicc: meddpiccTrend,
          gapSelling: defaultFrameworkTrend,
          activeListening: defaultFrameworkTrend,
        })).toBe(true);
      });

      it('should return false when only bant exists', () => {
        expect(usesMeddpicc({
          ...baseFields,
          bant: bantTrend,
          gapSelling: defaultFrameworkTrend,
          activeListening: defaultFrameworkTrend,
          meddpicc: defaultFrameworkTrend,
        })).toBe(false);
      });
    });

    describe('getBantTrend', () => {
      it('should return bant data when available', () => {
        expect(getBantTrend({
          ...baseFields,
          bant: bantTrend,
          gapSelling: defaultFrameworkTrend,
          activeListening: defaultFrameworkTrend,
          meddpicc: defaultFrameworkTrend,
        })).toBe(bantTrend);
      });

      it('should return default when bant is not available', () => {
        expect(getBantTrend({
          ...baseFields,
          gapSelling: defaultFrameworkTrend,
          activeListening: defaultFrameworkTrend,
          meddpicc: defaultFrameworkTrend,
        })).toBe(defaultFrameworkTrend);
      });
    });
  });

  describe('calculateRepContributions', () => {
    it('should calculate per-rep metrics from analyses', () => {
      const analyses = [
        {
          rep_id: 'rep-1',
          deal_heat_analysis: { heat_score: 80 },
          analysis_behavior: null,
          analysis_strategy: null,
          coach_output: {
            framework_scores: {
              bant: { score: 70 },
              gap_selling: { score: 60 },
              active_listening: { score: 85 },
            },
          },
        },
        {
          rep_id: 'rep-1',
          deal_heat_analysis: { heat_score: 90 },
          analysis_behavior: null,
          analysis_strategy: null,
          coach_output: {
            framework_scores: {
              bant: { score: 80 },
              gap_selling: { score: 70 },
              active_listening: { score: 95 },
            },
          },
        },
      ] as any[];

      const repProfiles = [
        { id: 'rep-1', name: 'Alice', team_id: 'team-1' },
      ];
      const teamMap = new Map([['team-1', 'Alpha']]);

      const result = calculateRepContributions(analyses, repProfiles, teamMap, 2);
      expect(result.length).toBe(1);
      expect(result[0].repId).toBe('rep-1');
      expect(result[0].repName).toBe('Alice');
      expect(result[0].teamName).toBe('Alpha');
      expect(result[0].callCount).toBe(2);
      expect(result[0].percentageOfTotal).toBe(100);
      expect(result[0].averageHeatScore).toBe(85); // (80+90)/2
      expect(result[0].frameworkScores.bant).toBe(75); // (70+80)/2
      expect(result[0].frameworkScores.gapSelling).toBe(65);
      expect(result[0].frameworkScores.activeListening).toBe(90);
    });

    it('should skip reps with no calls', () => {
      const result = calculateRepContributions(
        [],
        [{ id: 'rep-1', name: 'Alice', team_id: null }],
        new Map(),
        0
      );
      expect(result.length).toBe(0);
    });

    it('should sort by call count descending', () => {
      const analyses = [
        { rep_id: 'rep-1', deal_heat_analysis: null, analysis_behavior: null, analysis_strategy: null, coach_output: null },
        { rep_id: 'rep-2', deal_heat_analysis: null, analysis_behavior: null, analysis_strategy: null, coach_output: null },
        { rep_id: 'rep-2', deal_heat_analysis: null, analysis_behavior: null, analysis_strategy: null, coach_output: null },
      ] as any[];

      const repProfiles = [
        { id: 'rep-1', name: 'Alice', team_id: null },
        { id: 'rep-2', name: 'Bob', team_id: null },
      ];

      const result = calculateRepContributions(analyses, repProfiles, new Map(), 3);
      expect(result[0].repId).toBe('rep-2');
      expect(result[0].callCount).toBe(2);
      expect(result[1].repId).toBe('rep-1');
      expect(result[1].callCount).toBe(1);
    });

    it('should include Analysis 2.0 metrics when available', () => {
      const analyses = [
        {
          rep_id: 'rep-1',
          deal_heat_analysis: null,
          analysis_behavior: {
            metrics: {
              patience: { score: 75 },
              monologue: { violation_count: 3 },
            },
          },
          analysis_strategy: {
            strategic_threading: { score: 82 },
            meddpicc: { overall_score: 65 },
          },
          coach_output: null,
        },
      ] as any[];

      const repProfiles = [{ id: 'rep-1', name: 'Alice', team_id: null }];

      const result = calculateRepContributions(analyses, repProfiles, new Map(), 1);
      expect(result[0].analysis2_0_metrics).toBeDefined();
      expect(result[0].analysis2_0_metrics!.patienceAvg).toBe(75);
      expect(result[0].analysis2_0_metrics!.strategicThreadingAvg).toBe(82);
      expect(result[0].analysis2_0_metrics!.monologueViolationsAvg).toBe(3);
      expect(result[0].frameworkScores.meddpicc).toBe(65);
    });
  });
});
