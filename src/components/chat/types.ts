import type { ReactNode } from 'react';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  title: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuickAction {
  id: string;
  icon: ReactNode;
  label: string;
  prompt: string;
}

export interface StreamCallbacks {
  onDelta: (delta: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

/**
 * ChatAdapter captures everything that varies between chat implementations.
 * Each consumer (SalesAssistantChat, SalesCoachChat) provides its own adapter.
 */
export interface ChatAdapter {
  // --- API calls ---
  /** Stream the AI response for the given messages. */
  sendMessage: (messages: ChatMessage[], callbacks: StreamCallbacks) => Promise<void>;
  /** Save messages to the current session (create or update). */
  saveSession: (messages: ChatMessage[], sessionId?: string) => Promise<boolean>;
  /** Load the active session. Returns null if none. */
  loadActiveSession: () => Promise<ChatSession | null>;
  /** Load all sessions for the history view. */
  loadAllSessions: () => Promise<ChatSession[]>;
  /** Archive the current session and start fresh. */
  archiveSession: () => Promise<boolean>;
  /** Switch to a different session by ID. */
  switchSession: (sessionId: string) => Promise<boolean>;
  /** Delete a session by ID. */
  deleteSession: (sessionId: string) => Promise<boolean>;

  // --- Configuration ---
  /** Title shown in the header bar */
  headerTitle: string;
  /** Subtitle shown below the header title */
  headerSubtitle: string;
  /** Placeholder text for the input textarea */
  placeholder: string;

  // --- Empty state ---
  /** Custom empty-state content rendered when there are no messages. */
  emptyState: (handlers: EmptyStateHandlers) => ReactNode;

  // --- Optional features ---
  /** Extra header content (e.g. session count badge in SalesCoachChat) */
  headerExtra?: ReactNode;
  /** Custom header dropdown items (replaces default New Chat / History / Delete) */
  headerMenuItems?: (handlers: HeaderMenuHandlers) => ReactNode;
  /** Called when a user message is sent (e.g. for tracking recent questions) */
  onMessageSent?: (content: string) => void;
  /** Extra error handling beyond the default (e.g. network-specific toast) */
  onStreamError?: (error: string, handleNewChat: () => void) => void;
  /** Whether the clear/delete current chat option is available */
  clearCurrentChat?: (handlers: { handleClearHistory: () => Promise<void> }) => ReactNode;
  /** Custom sheet width class (defaults to "sm:max-w-lg") */
  sheetMaxWidth?: string;
  /** Custom message rendering (e.g. SalesCoachChat has custom ReactMarkdown components) */
  renderAssistantMessage?: (content: string) => ReactNode;
  /** Custom user message rendering */
  renderUserMessage?: (content: string) => ReactNode;
  /** Custom trigger button */
  triggerButton?: ReactNode;
  /** Whether to show "last updated" timestamp below input (default: true for assistant, false for coach) */
  showLastUpdated?: boolean;
  /** Custom container for the full portal render (SalesCoachChat wraps everything in a portal) */
  portalMode?: 'floating-button' | 'full-portal';
  /** Custom assistant avatar styling */
  assistantAvatarClass?: string;
  /** Custom user avatar styling */
  userAvatarClass?: string;
  /** Custom message bubble styling for assistant */
  assistantBubbleClass?: string;
  /** Custom message bubble styling for user */
  userBubbleClass?: string;
  /** Custom typing indicator bubble styling */
  typingBubbleClass?: string;
  /** Additional content to show between messages list and input (e.g. conversation timestamp pill) */
  messagesHeader?: (lastUpdated: string | null) => ReactNode;
  /** Additional input area footer (e.g. "Press Enter to send" hint) */
  inputFooter?: ReactNode;
  /** Custom rate-limit countdown seconds (default 60) */
  rateLimitSeconds?: number;
  /** Custom loading history state UI */
  loadingHistoryState?: ReactNode;
  /** Custom history sheet content (rendered inside a Sheet managed by ChatBase — return SheetContent, not a full Sheet) */
  renderHistorySheet?: (props: HistorySheetProps) => ReactNode;
}

export interface EmptyStateHandlers {
  setInput: (value: string) => void;
  focusInput: () => void;
  isLoading: boolean;
  isRateLimited: boolean;
}

export interface HeaderMenuHandlers {
  handleNewChat: () => void;
  handleDeleteSession: (sessionId: string) => Promise<void>;
  setShowHistorySheet: (show: boolean) => void;
  currentSessionId: string | null;
  archivedSessions: ChatSession[];
  messages: ChatMessage[];
}

export interface HistorySheetProps {
  allSessions: ChatSession[];
  currentSessionId: string | null;
  handleSwitchSession: (sessionId: string) => Promise<void>;
  handleDeleteSession: (sessionId: string) => Promise<void>;
  setShowHistorySheet: (show: boolean) => void;
}
