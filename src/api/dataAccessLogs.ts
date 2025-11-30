/**
 * Data Access Logging API
 * 
 * Provides functions to log and query data access for audit purposes.
 */

import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import type { Json } from '@/integrations/supabase/types';

const log = createLogger('dataAccessLogs');

export type AccessType = 'view' | 'export' | 'download' | 'share';

export interface DataAccessLog {
  id: string;
  user_id: string;
  table_name: string;
  record_id: string;
  access_type: AccessType;
  access_reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DataAccessLogWithUser extends DataAccessLog {
  user_name: string | null;
  user_email: string | null;
}

/**
 * Log a data access event using the server-side function.
 */
export async function logDataAccess(
  tableName: string,
  recordId: string,
  accessType: AccessType,
  accessReason?: string,
  metadata?: Record<string, unknown>
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('log_data_access', {
      p_table_name: tableName,
      p_record_id: recordId,
      p_access_type: accessType,
      p_access_reason: accessReason,
      p_metadata: (metadata || {}) as Json,
    });

    if (error) {
      log.error('Failed to log data access', { error, tableName, recordId });
      return null;
    }

    return data;
  } catch (err) {
    log.error('Exception logging data access', { error: err });
    return null;
  }
}

/**
 * Fetch access logs for a specific record.
 */
export async function fetchAccessLogsForRecord(
  tableName: string,
  recordId: string,
  limit = 50
): Promise<DataAccessLog[]> {
  const { data, error } = await supabase
    .from('data_access_logs')
    .select('*')
    .eq('table_name', tableName)
    .eq('record_id', recordId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    log.error('Failed to fetch access logs', { error, tableName, recordId });
    return [];
  }

  return data as DataAccessLog[];
}

/**
 * Fetch recent access logs (admin only).
 */
export async function fetchRecentAccessLogs(
  limit = 100
): Promise<DataAccessLogWithUser[]> {
  const { data, error } = await supabase
    .from('data_access_logs_with_user')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    log.error('Failed to fetch recent access logs', { error });
    return [];
  }

  return data as DataAccessLogWithUser[];
}

/**
 * Fetch access logs by table name (admin only).
 */
export async function fetchAccessLogsByTable(
  tableName: string,
  limit = 100
): Promise<DataAccessLogWithUser[]> {
  const { data, error } = await supabase
    .from('data_access_logs_with_user')
    .select('*')
    .eq('table_name', tableName)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    log.error('Failed to fetch access logs by table', { error, tableName });
    return [];
  }

  return data as DataAccessLogWithUser[];
}

/**
 * Soft delete a record using the server-side function.
 */
export async function softDeleteRecord(
  tableName: string,
  recordId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('soft_delete_record', {
      p_table_name: tableName,
      p_record_id: recordId,
    });

    if (error) {
      log.error('Failed to soft delete record', { error, tableName, recordId });
      return false;
    }

    return data === true;
  } catch (err) {
    log.error('Exception soft deleting record', { error: err });
    return false;
  }
}
