import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, MessageSquare, Clock, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { AnalysisSessionListItem } from '@/api/analysisSessions';

interface ChatHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: AnalysisSessionListItem[];
  currentSessionId: string | null;
  onSwitchSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

export function ChatHistorySheet({
  open,
  onOpenChange,
  sessions,
  currentSessionId,
  onSwitchSession,
  onDeleteSession,
}: ChatHistorySheetProps) {
  // Group sessions by date
  const groupedSessions = sessions.reduce((groups, session) => {
    const date = new Date(session.updated_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let groupLabel: string;
    if (date.toDateString() === today.toDateString()) {
      groupLabel = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      groupLabel = 'Yesterday';
    } else {
      groupLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    
    if (!groups[groupLabel]) {
      groups[groupLabel] = [];
    }
    groups[groupLabel].push(session);
    return groups;
  }, {} as Record<string, AnalysisSessionListItem[]>);

  const archivedSessions = sessions.filter(s => s.id !== currentSessionId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px] p-0">
        <SheetHeader className="px-6 py-4 border-b bg-gradient-to-r from-muted/50 to-muted/30">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Chat History
            <Badge variant="secondary" className="ml-2">
              {archivedSessions.length} {archivedSessions.length === 1 ? 'chat' : 'chats'}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="p-4 space-y-6">
            {sessions.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">No chat history yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Your conversations will appear here
                </p>
              </div>
            ) : (
              Object.entries(groupedSessions).map(([dateLabel, dateSessions]) => (
                <div key={dateLabel}>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    {dateLabel}
                  </h3>
                  <div className="space-y-2">
                    {dateSessions.map((session) => {
                      const isActive = session.id === currentSessionId;
                      
                      return (
                        <div
                          key={session.id}
                          className={`
                            group relative p-4 rounded-xl border transition-all duration-200 cursor-pointer
                            ${isActive 
                              ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/20' 
                              : 'bg-card/50 border-border/50 hover:bg-muted/50 hover:border-border hover:shadow-sm'
                            }
                          `}
                          onClick={() => !isActive && onSwitchSession(session.id)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {isActive && (
                                  <Badge variant="default" className="text-[10px] h-5 gap-1">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Active
                                  </Badge>
                                )}
                                {session.analysis_mode && (
                                  <Badge variant="secondary" className="text-[10px] h-5 capitalize">
                                    {session.analysis_mode.replace('_', ' ')}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm font-medium line-clamp-2">
                                {session.title || 'Untitled conversation'}
                              </p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDistanceToNow(new Date(session.updated_at), { addSuffix: true })}
                                </span>
                                <span>{session.transcript_ids.length} transcripts</span>
                              </div>
                            </div>
                            
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteSession(session.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
