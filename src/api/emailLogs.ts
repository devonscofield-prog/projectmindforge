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
  created_at: string;
  updated_at: string;
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
}

export interface UpdateEmailLogParams {
  direction?: EmailDirection;
  subject?: string | null;
  body?: string;
  emailDate?: string;
  contactName?: string | null;
  contactEmail?: string | null;
  notes?: string | null;
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
    })
    .select()
    .single();

  if (error) throw error;
  return data as EmailLog;
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

export async function updateEmailLog(id: string, updates: UpdateEmailLogParams): Promise<EmailLog> {
  const updateData: Record<string, any> = {};
  
  if (updates.direction !== undefined) updateData.direction = updates.direction;
  if (updates.subject !== undefined) updateData.subject = updates.subject;
  if (updates.body !== undefined) updateData.body = updates.body;
  if (updates.emailDate !== undefined) updateData.email_date = updates.emailDate;
  if (updates.contactName !== undefined) updateData.contact_name = updates.contactName;
  if (updates.contactEmail !== undefined) updateData.contact_email = updates.contactEmail;
  if (updates.notes !== undefined) updateData.notes = updates.notes;

  const { data, error } = await supabase
    .from('email_logs')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as EmailLog;
}

export async function deleteEmailLog(id: string): Promise<void> {
  const { error } = await supabase
    .from('email_logs')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
