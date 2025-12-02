import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { expect } from '@playwright/test';
import type { Database } from '@/integrations/supabase/types';

// Check if service role key is available
export function isServiceRoleAvailable(): boolean {
  return !!(process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Initialize Supabase admin client for tests
// Returns null if service role key is not available (graceful degradation)
export function createSupabaseAdmin(): SupabaseClient<Database> | null {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn(
      '⚠️  SUPABASE_SERVICE_ROLE_KEY not available - database-level tests will be skipped'
    );
    return null;
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Database helpers for E2E tests
 */
export class DatabaseHelpers {
  constructor(private supabase: SupabaseClient<Database> | null) {}

  // Check if database operations are available
  isAvailable(): boolean {
    return this.supabase !== null;
  }

  // Throw helpful error if operations are attempted without service key
  private ensureAvailable(): SupabaseClient<Database> {
    if (!this.supabase) {
      throw new Error('Database operations require SUPABASE_SERVICE_ROLE_KEY');
    }
    return this.supabase;
  }

  // ============= User & Profile Helpers =============

  async getUserByEmail(email: string) {
    const supabase = this.ensureAvailable();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async getUserRole(userId: string) {
    const supabase = this.ensureAvailable();
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data?.role;
  }

  // ============= Prospect Helpers =============

  async getProspectByName(repId: string, prospectName: string) {
    const supabase = this.ensureAvailable();
    const { data, error } = await supabase
      .from('prospects')
      .select('*')
      .eq('rep_id', repId)
      .eq('prospect_name', prospectName)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async getProspectById(prospectId: string) {
    const supabase = this.ensureAvailable();
    const { data, error } = await supabase
      .from('prospects')
      .select('*')
      .eq('id', prospectId)
      .is('deleted_at', null)
      .single();

    if (error) throw error;
    return data;
  }

  async countProspects(repId: string) {
    const supabase = this.ensureAvailable();
    const { count, error } = await supabase
      .from('prospects')
      .select('*', { count: 'exact', head: true })
      .eq('rep_id', repId)
      .is('deleted_at', null);

    if (error) throw error;
    return count || 0;
  }

  // ============= Call Transcript Helpers =============

  async getCallTranscriptById(callId: string) {
    const supabase = this.ensureAvailable();
    const { data, error } = await supabase
      .from('call_transcripts')
      .select('*')
      .eq('id', callId)
      .is('deleted_at', null)
      .single();

    if (error) throw error;
    return data;
  }

  async getCallTranscriptsByProspect(prospectId: string) {
    const supabase = this.ensureAvailable();
    const { data, error } = await supabase
      .from('call_transcripts')
      .select('*')
      .eq('prospect_id', prospectId)
      .is('deleted_at', null)
      .order('call_date', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async countCallTranscripts(repId: string) {
    const supabase = this.ensureAvailable();
    const { count, error } = await supabase
      .from('call_transcripts')
      .select('*', { count: 'exact', head: true })
      .eq('rep_id', repId)
      .is('deleted_at', null);

    if (error) throw error;
    return count || 0;
  }

  // ============= AI Analysis Helpers =============

  async getCallAnalysis(callId: string) {
    const supabase = this.ensureAvailable();
    const { data, error } = await supabase
      .from('ai_call_analysis')
      .select('*')
      .eq('call_id', callId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async waitForAnalysisComplete(callId: string, timeoutMs = 30000) {
    const supabase = this.ensureAvailable();
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const { data, error } = await supabase
        .from('call_transcripts')
        .select('analysis_status')
        .eq('id', callId)
        .single();

      if (error) throw error;

      if (data.analysis_status === 'completed') {
        return true;
      } else if (data.analysis_status === 'error') {
        throw new Error('Call analysis failed');
      }

      // Wait 1 second before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error(`Analysis timeout after ${timeoutMs}ms`);
  }

  // ============= Follow-Up Helpers =============

  async getFollowUps(prospectId: string) {
    const supabase = this.ensureAvailable();
    const { data, error } = await supabase
      .from('account_follow_ups')
      .select('*')
      .eq('prospect_id', prospectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async countPendingFollowUps(repId: string) {
    const supabase = this.ensureAvailable();
    const { count, error } = await supabase
      .from('account_follow_ups')
      .select('*', { count: 'exact', head: true })
      .eq('rep_id', repId)
      .eq('status', 'pending');

    if (error) throw error;
    return count || 0;
  }

  // ============= Stakeholder Helpers =============

  async getStakeholders(prospectId: string) {
    const supabase = this.ensureAvailable();
    const { data, error } = await supabase
      .from('stakeholders')
      .select('*')
      .eq('prospect_id', prospectId)
      .is('deleted_at', null);

    if (error) throw error;
    return data || [];
  }

  // ============= Activity Helpers =============

  async getActivities(prospectId: string) {
    const supabase = this.ensureAvailable();
    const { data, error } = await supabase
      .from('prospect_activities')
      .select('*')
      .eq('prospect_id', prospectId)
      .order('activity_date', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // ============= Coaching Session Helpers =============

  async getCoachingSessionById(sessionId: string) {
    const supabase = this.ensureAvailable();
    const { data, error } = await supabase
      .from('coaching_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async getCoachingSessionsForRep(repId: string) {
    const supabase = this.ensureAvailable();
    const { data, error } = await supabase
      .from('coaching_sessions')
      .select('*')
      .eq('rep_id', repId)
      .order('session_date', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async countCoachingSessions(managerId: string) {
    const supabase = this.ensureAvailable();
    const { count, error } = await supabase
      .from('coaching_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('manager_id', managerId);

    if (error) throw error;
    return count || 0;
  }

  // ============= Cleanup Helpers =============

  async cleanupTestProspects(repId: string, namePattern: string) {
    const supabase = this.ensureAvailable();
    const { data: prospects, error: fetchError } = await supabase
      .from('prospects')
      .select('id')
      .eq('rep_id', repId)
      .like('prospect_name', `%${namePattern}%`);

    if (fetchError) throw fetchError;

    if (prospects && prospects.length > 0) {
      const prospectIds = prospects.map(p => p.id);
      
      // Soft delete prospects
      const { error: deleteError } = await supabase
        .from('prospects')
        .update({ deleted_at: new Date().toISOString(), deleted_by: repId })
        .in('id', prospectIds);

      if (deleteError) throw deleteError;
    }

    return prospects?.length || 0;
  }

  async cleanupTestCalls(repId: string, accountNamePattern: string) {
    const supabase = this.ensureAvailable();
    const { data: calls, error: fetchError } = await supabase
      .from('call_transcripts')
      .select('id')
      .eq('rep_id', repId)
      .like('account_name', `%${accountNamePattern}%`);

    if (fetchError) throw fetchError;

    if (calls && calls.length > 0) {
      const callIds = calls.map(c => c.id);
      
      // Soft delete calls
      const { error: deleteError } = await supabase
        .from('call_transcripts')
        .update({ deleted_at: new Date().toISOString(), deleted_by: repId })
        .in('id', callIds);

      if (deleteError) throw deleteError;
    }

    return calls?.length || 0;
  }

  async cleanupTestData(repId: string, testIdentifier: string) {
    await this.cleanupTestProspects(repId, testIdentifier);
    await this.cleanupTestCalls(repId, testIdentifier);
  }
}

/**
 * Database assertion helpers
 */
export class DatabaseAssertions {
  constructor(private db: DatabaseHelpers) {}

  async expectProspectExists(repId: string, prospectName: string) {
    const prospect = await this.db.getProspectByName(repId, prospectName);
    expect(prospect).toBeTruthy();
    expect(prospect?.prospect_name).toBe(prospectName);
    return prospect;
  }

  async expectProspectNotExists(repId: string, prospectName: string) {
    const prospect = await this.db.getProspectByName(repId, prospectName);
    expect(prospect).toBeNull();
  }

  async expectCallTranscriptExists(callId: string) {
    const call = await this.db.getCallTranscriptById(callId);
    expect(call).toBeTruthy();
    expect(call.id).toBe(callId);
    return call;
  }

  async expectAnalysisCompleted(callId: string) {
    const analysis = await this.db.getCallAnalysis(callId);
    expect(analysis).toBeTruthy();
    expect(analysis?.call_summary).toBeTruthy();
    return analysis;
  }

  async expectFollowUpsGenerated(prospectId: string, minCount = 1) {
    const followUps = await this.db.getFollowUps(prospectId);
    expect(followUps.length).toBeGreaterThanOrEqual(minCount);
    return followUps;
  }

  async expectStakeholderExists(prospectId: string, stakeholderName: string) {
    const stakeholders = await this.db.getStakeholders(prospectId);
    const stakeholder = stakeholders.find(s => s.name === stakeholderName);
    expect(stakeholder).toBeTruthy();
    return stakeholder;
  }

  async expectActivityExists(
    prospectId: string,
    activityType: string,
    description?: string
  ) {
    const activities = await this.db.getActivities(prospectId);
    const activity = description
      ? activities.find(a => a.activity_type === activityType && a.description === description)
      : activities.find(a => a.activity_type === activityType);
    
    expect(activity).toBeTruthy();
    return activity;
  }

  async expectUserHasRole(userId: string, expectedRole: string) {
    const role = await this.db.getUserRole(userId);
    expect(role).toBe(expectedRole);
  }
}
