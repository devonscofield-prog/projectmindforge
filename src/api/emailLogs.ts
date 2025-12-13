import { supabase } from '@/integrations/supabase/client';

export type EmailDirection = 'incoming' | 'outgoing';

export interface EmailLog {
  id: string;
  prospect_id: string;
  rep_id: string;
  direction: EmailDirection;
  subject: string | null;
  body: string;
  email_date: string;
  contact_name: string | null;
  contact_email: string | null;
  notes: string | null;
  stakeholder_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailLogStakeholder {
  id: string;
  email_log_id: string;
  stakeholder_id: string;
  created_at: string;
}

export interface CreateEmailLogParams {
  prospectId: string;
  repId: string;
  direction: EmailDirection;
  subject?: string;
  body: string;
  emailDate: string;
  contactName?: string;
  contactEmail?: string;
  notes?: string;
  stakeholderId?: string;
  stakeholderIds?: string[]; // Multiple stakeholders
}

export interface UpdateEmailLogParams {
  direction?: EmailDirection;
  subject?: string | null;
  body?: string;
  emailDate?: string;
  contactName?: string | null;
  contactEmail?: string | null;
  notes?: string | null;
  stakeholderId?: string | null;
  stakeholderIds?: string[];
}

export async function createEmailLog(params: CreateEmailLogParams): Promise<EmailLog> {
  const { data, error } = await supabase
    .from('email_logs')
    .insert({
      prospect_id: params.prospectId,
      rep_id: params.repId,
      direction: params.direction,
      subject: params.subject || null,
      body: params.body,
      email_date: params.emailDate,
      contact_name: params.contactName || null,
      contact_email: params.contactEmail || null,
      notes: params.notes || null,
      stakeholder_id: params.stakeholderId || null,
    })
    .select()
    .single();

  if (error) throw error;
  
  const emailLog = data as EmailLog;
  
  // Insert stakeholder associations if provided
  const stakeholderIds = params.stakeholderIds || (params.stakeholderId ? [params.stakeholderId] : []);
  if (stakeholderIds.length > 0) {
    const { error: stakeholderError } = await supabase
      .from('email_log_stakeholders')
      .insert(
        stakeholderIds.map(stakeholderId => ({
          email_log_id: emailLog.id,
          stakeholder_id: stakeholderId,
        }))
      );
    
    if (stakeholderError) {
      console.error('Failed to insert email log stakeholders:', stakeholderError);
    }
  }
  
  return emailLog;
}

export async function listEmailLogsForProspect(prospectId: string): Promise<EmailLog[]> {
  const { data, error } = await supabase
    .from('email_logs')
    .select('*')
    .eq('prospect_id', prospectId)
    .order('email_date', { ascending: false });

  if (error) throw error;
  return (data || []) as EmailLog[];
}

export async function getEmailLogStakeholders(emailLogId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('email_log_stakeholders')
    .select('stakeholder_id')
    .eq('email_log_id', emailLogId);
  
  if (error) throw error;
  return (data || []).map(row => row.stakeholder_id);
}

/**
 * Batch fetch stakeholder links for multiple email logs
 * Returns a map of email_log_id -> stakeholder_ids[]
 */
export async function getEmailLogStakeholdersBatch(emailLogIds: string[]): Promise<Map<string, string[]>> {
  if (emailLogIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('email_log_stakeholders')
    .select('email_log_id, stakeholder_id')
    .in('email_log_id', emailLogIds);
  
  if (error) throw error;

  const result = new Map<string, string[]>();
  
  // Initialize all email log IDs with empty arrays
  emailLogIds.forEach(id => result.set(id, []));
  
  // Populate with actual stakeholder links
  (data || []).forEach(row => {
    const existing = result.get(row.email_log_id) || [];
    existing.push(row.stakeholder_id);
    result.set(row.email_log_id, existing);
  });

  return result;
}

interface EmailLogUpdateData {
  direction?: EmailDirection;
  subject?: string | null;
  body?: string;
  email_date?: string;
  contact_name?: string | null;
  contact_email?: string | null;
  notes?: string | null;
  stakeholder_id?: string | null;
}

export async function updateEmailLog(id: string, updates: UpdateEmailLogParams): Promise<EmailLog> {
  const updateData: EmailLogUpdateData = {};
  
  if (updates.direction !== undefined) updateData.direction = updates.direction;
  if (updates.subject !== undefined) updateData.subject = updates.subject;
  if (updates.body !== undefined) updateData.body = updates.body;
  if (updates.emailDate !== undefined) updateData.email_date = updates.emailDate;
  if (updates.contactName !== undefined) updateData.contact_name = updates.contactName;
  if (updates.contactEmail !== undefined) updateData.contact_email = updates.contactEmail;
  if (updates.notes !== undefined) updateData.notes = updates.notes;
  if (updates.stakeholderId !== undefined) updateData.stakeholder_id = updates.stakeholderId;

  const { data, error } = await supabase
    .from('email_logs')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  
  // Update stakeholder associations if provided
  if (updates.stakeholderIds !== undefined) {
    // Delete existing associations
    await supabase
      .from('email_log_stakeholders')
      .delete()
      .eq('email_log_id', id);
    
    // Insert new associations
    if (updates.stakeholderIds.length > 0) {
      await supabase
        .from('email_log_stakeholders')
        .insert(
          updates.stakeholderIds.map(stakeholderId => ({
            email_log_id: id,
            stakeholder_id: stakeholderId,
          }))
        );
    }
  }
  
  return data as EmailLog;
}

export async function deleteEmailLog(id: string): Promise<void> {
  const { error } = await supabase
    .from('email_logs')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
