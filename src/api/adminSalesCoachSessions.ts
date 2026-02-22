import { supabase } from "@/integrations/supabase/client";
import type { CoachMessage } from "./salesCoachSessions";

export interface AdminCoachSession {
  id: string;
  user_id: string;
  prospect_id: string;
  messages: CoachMessage[];
  title: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user_name: string;
  user_email: string;
  prospect_name: string | null;
  account_name: string | null;
}

export interface CoachSessionStats {
  totalSessions: number;
  activeSessions: number;
  totalMessages: number;
  uniqueUsers: number;
  avgMessagesPerSession: number;
}

export async function fetchAdminCoachSessions(options?: {
  userId?: string;
  searchQuery?: string;
  limit?: number;
  offset?: number;
}): Promise<{ sessions: AdminCoachSession[]; total: number }> {
  const { userId, searchQuery, limit = 50, offset = 0 } = options || {};

  let query = supabase
    .from('sales_coach_sessions')
    .select(`
      *,
      profiles!sales_coach_sessions_user_id_fkey(name, email),
      prospects!sales_coach_sessions_prospect_id_fkey(prospect_name, account_name)
    `, { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching admin coach sessions:', error);
    return { sessions: [], total: 0 };
  }

  type SessionRow = NonNullable<typeof data>[number] & {
    profiles: { name: string | null; email: string | null } | null;
    prospects: { prospect_name: string | null; account_name: string | null } | null;
  };
  const sessions: AdminCoachSession[] = ((data || []) as SessionRow[]).map((session) => {
    const messages = (session.messages as unknown as CoachMessage[]) || [];
    
    // Apply search filter on messages if provided
    if (searchQuery) {
      const hasMatch = messages.some(m => 
        m.content.toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (!hasMatch && !session.title?.toLowerCase().includes(searchQuery.toLowerCase())) {
        return null;
      }
    }

    return {
      id: session.id,
      user_id: session.user_id,
      prospect_id: session.prospect_id,
      messages,
      title: session.title ?? null,
      is_active: session.is_active ?? false,
      created_at: session.created_at,
      updated_at: session.updated_at,
      user_name: session.profiles?.name || 'Unknown User',
      user_email: session.profiles?.email || '',
      prospect_name: session.prospects?.prospect_name || null,
      account_name: session.prospects?.account_name || null,
    };
  }).filter(Boolean) as AdminCoachSession[];

  return { sessions, total: count || 0 };
}

export async function fetchCoachSessionStats(): Promise<CoachSessionStats> {
  const { data, error } = await supabase
    .from('sales_coach_sessions')
    .select('id, user_id, is_active, messages');

  if (error) {
    console.error('Error fetching coach session stats:', error);
    return {
      totalSessions: 0,
      activeSessions: 0,
      totalMessages: 0,
      uniqueUsers: 0,
      avgMessagesPerSession: 0,
    };
  }

  const sessions = data || [];
  const uniqueUsers = new Set(sessions.map(s => s.user_id)).size;
  const totalMessages = sessions.reduce((acc, s) => {
    const msgs = (s.messages as unknown as CoachMessage[]) || [];
    return acc + msgs.length;
  }, 0);
  const activeSessions = sessions.filter(s => s.is_active).length;

  return {
    totalSessions: sessions.length,
    activeSessions,
    totalMessages,
    uniqueUsers,
    avgMessagesPerSession: sessions.length > 0 
      ? Math.round(totalMessages / sessions.length * 10) / 10 
      : 0,
  };
}

export async function fetchUsersWithCoachSessions(): Promise<Array<{ id: string; name: string; email: string }>> {
  const { data, error } = await supabase
    .from('sales_coach_sessions')
    .select('user_id, profiles!sales_coach_sessions_user_id_fkey(id, name, email)')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching users with sessions:', error);
    return [];
  }

  const userMap = new Map<string, { id: string; name: string; email: string }>();
  type UserSessionRow = NonNullable<typeof data>[number] & {
    profiles: { id: string; name: string | null; email: string | null } | null;
  };
  ((data || []) as UserSessionRow[]).forEach((session) => {
    if (session.profiles && !userMap.has(session.user_id)) {
      userMap.set(session.user_id, {
        id: session.profiles.id,
        name: session.profiles.name || 'Unknown',
        email: session.profiles.email || '',
      });
    }
  });

  return Array.from(userMap.values());
}
