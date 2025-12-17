import { supabase } from '@/integrations/supabase/client';

export interface ObjectionHandler {
  id: string;
  callId: string;
  callDate: string;
  accountName: string | null;
  repName: string;
  repId: string;
  objection: string;
  repResponse: string;
  category: string;
  handlingRating: string;
  coachingTip?: string;
}

export interface PitchTrack {
  id: string;
  callId: string;
  callDate: string;
  accountName: string | null;
  repName: string;
  repId: string;
  painIdentified: string;
  featurePitched: string;
  painSeverity: string;
  painType: string;
  isRelevant: boolean;
  reasoning: string;
}

export interface TalkTrack {
  id: string;
  callId: string;
  callDate: string;
  accountName: string | null;
  repName: string;
  repId: string;
  pain: string;
  suggestedTalkTrack: string;
  severity: string;
}

interface AnalysisRow {
  id: string;
  call_id: string;
  rep_id: string;
  analysis_strategy: unknown;
  call_transcripts: {
    call_date: string;
    account_name: string | null;
  } | null;
  profiles: {
    name: string;
  } | null;
}

/**
 * Fetches successful objection handlers from AI analysis data
 * Filters by handling_rating of 'Effective' or 'Highly Effective'
 */
export async function fetchSuccessfulObjectionHandlers(
  category?: string,
  repId?: string
): Promise<ObjectionHandler[]> {
  const { data, error } = await supabase
    .from('ai_call_analysis')
    .select(`
      id,
      call_id,
      rep_id,
      analysis_strategy,
      call_transcripts!ai_call_analysis_call_id_fkey (
        call_date,
        account_name
      ),
      profiles!ai_call_analysis_rep_id_fkey (
        name
      )
    `)
    .not('analysis_strategy', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('Error fetching objection handlers:', error);
    throw error;
  }

  const handlers: ObjectionHandler[] = [];

  for (const row of (data || []) as AnalysisRow[]) {
    const strategy = row.analysis_strategy as Record<string, unknown> | null;
    if (!strategy) continue;

    const objectionHandling = strategy.objection_handling as Record<string, unknown> | null;
    if (!objectionHandling) continue;

    const objections = objectionHandling.objections_detected as Array<{
      objection?: string;
      rep_response?: string;
      category?: string;
      handling_rating?: string;
      coaching_tip?: string;
    }> | null;

    if (!Array.isArray(objections)) continue;

    for (const obj of objections) {
      // Only include successful handlers
      if (!obj.handling_rating || !['Effective', 'Highly Effective'].includes(obj.handling_rating)) {
        continue;
      }

      // Apply category filter
      if (category && obj.category !== category) continue;

      // Apply rep filter
      if (repId && row.rep_id !== repId) continue;

      handlers.push({
        id: `${row.id}-${handlers.length}`,
        callId: row.call_id,
        callDate: row.call_transcripts?.call_date || '',
        accountName: row.call_transcripts?.account_name || null,
        repName: row.profiles?.name || 'Unknown',
        repId: row.rep_id,
        objection: obj.objection || '',
        repResponse: obj.rep_response || '',
        category: obj.category || 'Unknown',
        handlingRating: obj.handling_rating,
        coachingTip: obj.coaching_tip,
      });
    }
  }

  return handlers;
}

/**
 * Fetches successful pitch tracks from AI analysis data
 * Filters by is_relevant = true
 */
export async function fetchSuccessfulPitches(
  severity?: string,
  repId?: string
): Promise<PitchTrack[]> {
  const { data, error } = await supabase
    .from('ai_call_analysis')
    .select(`
      id,
      call_id,
      rep_id,
      analysis_strategy,
      call_transcripts!ai_call_analysis_call_id_fkey (
        call_date,
        account_name
      ),
      profiles!ai_call_analysis_rep_id_fkey (
        name
      )
    `)
    .not('analysis_strategy', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('Error fetching pitch tracks:', error);
    throw error;
  }

  const pitches: PitchTrack[] = [];

  for (const row of (data || []) as AnalysisRow[]) {
    const strategy = row.analysis_strategy as Record<string, unknown> | null;
    if (!strategy) continue;

    const threading = strategy.strategic_threading as Record<string, unknown> | null;
    if (!threading) continue;

    const relevanceMap = threading.relevance_map as Array<{
      pain_identified?: string;
      feature_pitched?: string;
      pain_severity?: string;
      pain_type?: string;
      is_relevant?: boolean;
      reasoning?: string;
    }> | null;

    if (!Array.isArray(relevanceMap)) continue;

    for (const pitch of relevanceMap) {
      // Only include relevant pitches
      if (!pitch.is_relevant) continue;

      // Apply severity filter
      if (severity && pitch.pain_severity !== severity) continue;

      // Apply rep filter
      if (repId && row.rep_id !== repId) continue;

      pitches.push({
        id: `${row.id}-${pitches.length}`,
        callId: row.call_id,
        callDate: row.call_transcripts?.call_date || '',
        accountName: row.call_transcripts?.account_name || null,
        repName: row.profiles?.name || 'Unknown',
        repId: row.rep_id,
        painIdentified: pitch.pain_identified || '',
        featurePitched: pitch.feature_pitched || '',
        painSeverity: pitch.pain_severity || 'Unknown',
        painType: pitch.pain_type || 'Unknown',
        isRelevant: pitch.is_relevant,
        reasoning: pitch.reasoning || '',
      });
    }
  }

  return pitches;
}

/**
 * Fetches suggested talk tracks from missed opportunities
 */
export async function fetchSuggestedTalkTracks(
  severity?: string,
  repId?: string
): Promise<TalkTrack[]> {
  const { data, error } = await supabase
    .from('ai_call_analysis')
    .select(`
      id,
      call_id,
      rep_id,
      analysis_strategy,
      call_transcripts!ai_call_analysis_call_id_fkey (
        call_date,
        account_name
      ),
      profiles!ai_call_analysis_rep_id_fkey (
        name
      )
    `)
    .not('analysis_strategy', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('Error fetching talk tracks:', error);
    throw error;
  }

  const talkTracks: TalkTrack[] = [];

  for (const row of (data || []) as AnalysisRow[]) {
    const strategy = row.analysis_strategy as Record<string, unknown> | null;
    if (!strategy) continue;

    const threading = strategy.strategic_threading as Record<string, unknown> | null;
    if (!threading) continue;

    const missedOpps = threading.missed_opportunities as Array<{
      pain?: string;
      severity?: string;
      talk_track?: string;
    }> | null;

    if (!Array.isArray(missedOpps)) continue;

    for (const opp of missedOpps) {
      if (!opp.talk_track) continue;

      // Apply severity filter
      if (severity && opp.severity !== severity) continue;

      // Apply rep filter
      if (repId && row.rep_id !== repId) continue;

      talkTracks.push({
        id: `${row.id}-${talkTracks.length}`,
        callId: row.call_id,
        callDate: row.call_transcripts?.call_date || '',
        accountName: row.call_transcripts?.account_name || null,
        repName: row.profiles?.name || 'Unknown',
        repId: row.rep_id,
        pain: opp.pain || '',
        suggestedTalkTrack: opp.talk_track,
        severity: opp.severity || 'Unknown',
      });
    }
  }

  return talkTracks;
}

/**
 * Get unique categories from objection handlers
 */
export function getObjectionCategories(): string[] {
  return ['Timing', 'Price', 'Competitor', 'Authority', 'Feature', 'Need', 'Status Quo', 'Risk'];
}

/**
 * Get severity levels
 */
export function getSeverityLevels(): string[] {
  return ['High', 'Medium', 'Low'];
}

export interface ExportedPain {
  pain: string;
  severity: string;
  type: string;
  source: 'Pitch Library' | 'Missed Opportunity';
  accountName: string | null;
  repName: string;
}

/**
 * Combines pains from pitches and talk tracks into a deduplicated list
 */
export function collectAllPains(
  pitches: PitchTrack[],
  talkTracks: TalkTrack[]
): ExportedPain[] {
  const painMap = new Map<string, ExportedPain>();

  // Add pains from successful pitches
  for (const pitch of pitches) {
    const key = pitch.painIdentified.toLowerCase().trim();
    if (!painMap.has(key)) {
      painMap.set(key, {
        pain: pitch.painIdentified,
        severity: pitch.painSeverity,
        type: pitch.painType,
        source: 'Pitch Library',
        accountName: pitch.accountName,
        repName: pitch.repName,
      });
    }
  }

  // Add pains from missed opportunities (talk tracks)
  for (const track of talkTracks) {
    const key = track.pain.toLowerCase().trim();
    if (!painMap.has(key)) {
      painMap.set(key, {
        pain: track.pain,
        severity: track.severity,
        type: 'Missed',
        source: 'Missed Opportunity',
        accountName: track.accountName,
        repName: track.repName,
      });
    }
  }

  return Array.from(painMap.values());
}

/**
 * Exports pains to CSV format
 */
export function exportPainsToCSV(pains: ExportedPain[]): string {
  const headers = ['Pain', 'Severity', 'Type', 'Source', 'Account', 'Rep'];
  const rows = pains.map(p => [
    `"${p.pain.replace(/"/g, '""')}"`,
    p.severity,
    p.type,
    p.source,
    p.accountName ? `"${p.accountName.replace(/"/g, '""')}"` : '',
    p.repName,
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Returns unique pain strings as a plain text list
 */
export function getPainsAsList(pains: ExportedPain[]): string {
  return pains.map(p => `• ${p.pain}`).join('\n');
}

/**
 * Downloads content as a file
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
