import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { TrendingUp, Calendar, Flame, ClipboardList, Building2 } from 'lucide-react';
import { streamAssistantResponse, type ChatMessage as ApiChatMessage } from '@/api/salesAssistant';
import {
  fetchAssistantSession,
  saveAssistantSession,
  fetchAllAssistantSessions,
  archiveAndStartNewSession,
  switchToSession,
  deleteAssistantSession,
} from '@/api/salesAssistantSessions';
import { useAuth } from '@/contexts/AuthContext';
import { ChatBase } from '@/components/chat';
import type { ChatAdapter, QuickAction, EmptyStateHandlers } from '@/components/chat';

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'pipeline',
    icon: <TrendingUp className="h-4 w-4" />,
    label: 'Pipeline Health',
    prompt: 'Give me a quick health check on my entire pipeline. What\'s working, what needs attention, and what should I prioritize this week?',
  },
  {
    id: 'tasks',
    icon: <ClipboardList className="h-4 w-4" />,
    label: 'Priority Tasks',
    prompt: 'What are the most urgent follow-ups and tasks I should focus on today across all my accounts?',
  },
  {
    id: 'hot-deals',
    icon: <Flame className="h-4 w-4" />,
    label: 'Hot Deals',
    prompt: 'Which of my deals are hottest right now? Give me a summary of my top opportunities and what I should do to close them.',
  },
  {
    id: 'weekly-plan',
    icon: <Calendar className="h-4 w-4" />,
    label: 'Weekly Plan',
    prompt: 'Help me plan my week. What calls should I prioritize, what follow-ups are due, and which accounts need attention?',
  },
];

function AssistantEmptyState({ setInput, focusInput }: EmptyStateHandlers) {
  const handleQuickAction = (action: QuickAction) => {
    setInput(action.prompt);
    focusInput();
  };

  return (
    <>
      {/* Welcome Card */}
      <div className="bg-gradient-to-br from-primary/5 via-accent/5 to-transparent rounded-xl p-4 border border-primary/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Pipeline Overview</h3>
            <p className="text-xs text-muted-foreground">I can see all your accounts</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Ask me about your pipeline health, priority tasks, hot deals, or help planning your week.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground px-1">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_ACTIONS.map((action) => (
            <Button
              key={action.id}
              variant="outline"
              className="h-auto py-3 px-3 flex flex-col items-start gap-1 text-left hover:bg-primary/5 hover:border-primary/30 transition-colors"
              onClick={() => handleQuickAction(action)}
            >
              <div className="flex items-center gap-2">
                <span className="text-primary">{action.icon}</span>
                <span className="font-medium text-sm">{action.label}</span>
              </div>
            </Button>
          ))}
        </div>
      </div>
    </>
  );
}

export function SalesAssistantChat() {
  const { user } = useAuth();

  const adapter: ChatAdapter = useMemo(() => ({
    // API calls
    sendMessage: async (messages, callbacks) => {
      await streamAssistantResponse({
        messages: messages as ApiChatMessage[],
        onDelta: callbacks.onDelta,
        onDone: callbacks.onDone,
        onError: callbacks.onError,
      });
    },
    saveSession: async (messages, sessionId) => {
      if (!user?.id) return false;
      return saveAssistantSession(user.id, messages, sessionId);
    },
    loadActiveSession: async () => {
      if (!user?.id) return null;
      const session = await fetchAssistantSession(user.id);
      if (!session) return null;
      return {
        id: session.id,
        messages: session.messages,
        title: session.title,
        is_active: session.is_active,
        created_at: session.created_at,
        updated_at: session.updated_at,
      };
    },
    loadAllSessions: async () => {
      if (!user?.id) return [];
      const sessions = await fetchAllAssistantSessions(user.id);
      return sessions.map(s => ({
        id: s.id,
        messages: s.messages,
        title: s.title,
        is_active: s.is_active,
        created_at: s.created_at,
        updated_at: s.updated_at,
      }));
    },
    archiveSession: async () => {
      if (!user?.id) return false;
      return archiveAndStartNewSession(user.id);
    },
    switchSession: async (sessionId) => {
      if (!user?.id) return false;
      return switchToSession(user.id, sessionId);
    },
    deleteSession: async (sessionId) => {
      return deleteAssistantSession(sessionId);
    },

    // Configuration
    headerTitle: 'Sales Assistant',
    headerSubtitle: 'Your AI pipeline advisor',
    placeholder: 'Ask about your pipeline...',

    // Empty state
    emptyState: (handlers) => <AssistantEmptyState {...handlers} />,

    // Use floating-button mode (default)
    portalMode: 'floating-button',
  }), [user?.id]);

  return <ChatBase adapter={adapter} />;
}
