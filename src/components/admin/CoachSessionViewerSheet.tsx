import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, User, Bot, Calendar, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import type { AdminCoachSession } from '@/api/adminSalesCoachSessions';
import { cn } from '@/lib/utils';

interface CoachSessionViewerSheetProps {
  session: AdminCoachSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CoachSessionViewerSheet({ 
  session, 
  open, 
  onOpenChange 
}: CoachSessionViewerSheetProps) {
  if (!session) return null;

  const copyConversation = () => {
    const text = session.messages
      .map(m => `${m.role === 'user' ? 'User' : 'AI Coach'}: ${m.content}`)
      .join('\n\n');
    navigator.clipboard.writeText(text);
    toast.success('Conversation copied to clipboard');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1 min-w-0">
              <SheetTitle className="text-lg truncate">
                {session.title || 'Untitled Conversation'}
              </SheetTitle>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  {session.user_name}
                </span>
                {session.account_name && (
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    {session.account_name}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(new Date(session.updated_at), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={session.is_active ? 'default' : 'secondary'}>
                {session.is_active ? 'Active' : 'Archived'}
              </Badge>
              <Button variant="outline" size="sm" onClick={copyConversation}>
                <Copy className="h-4 w-4 mr-1.5" />
                Copy
              </Button>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 p-6">
          <div className="space-y-4">
            {session.messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex gap-3",
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3",
                    message.role === 'user'
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {message.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            {session.messages.length} messages in this conversation
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
