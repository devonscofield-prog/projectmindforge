import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Sparkles, 
  Search, 
  Download, 
  FileText, 
  CheckCircle2, 
  Zap,
  MoreVertical,
  Plus,
  History,
  Trash2,
  Clock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ChatHeaderProps {
  useRag: boolean;
  autoSaved: boolean;
  transcriptCount: number;
  totalTokens: number;
  hasMessages: boolean;
  lastUpdated: string | null;
  archivedSessionsCount: number;
  onExport: () => void;
  onNewChat: () => void;
  onShowHistory: () => void;
  onDeleteChat: () => void;
}

export function ChatHeader({ 
  useRag, 
  autoSaved, 
  transcriptCount, 
  totalTokens, 
  hasMessages,
  lastUpdated,
  archivedSessionsCount,
  onExport,
  onNewChat,
  onShowHistory,
  onDeleteChat,
}: ChatHeaderProps) {
  return (
    <SheetHeader className="relative px-4 py-4 border-b border-primary-foreground/10 bg-gradient-to-r from-primary via-primary/95 to-accent text-primary-foreground overflow-hidden">
      {/* Animated background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-foreground/5 via-transparent to-primary-foreground/5" />
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary-foreground/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-11 w-11 ring-2 ring-primary-foreground/20 bg-primary-foreground/15 backdrop-blur-sm">
              <AvatarFallback className="bg-transparent text-primary-foreground">
                <Sparkles className="h-5 w-5 animate-pulse" />
              </AvatarFallback>
            </Avatar>
            {/* Online indicator */}
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-success rounded-full border-2 border-primary animate-pulse" />
          </div>
          <div>
            <SheetTitle className="text-primary-foreground flex items-center gap-2">
              Transcript Analysis
              <Zap className="h-3.5 w-3.5 text-primary-foreground/80" />
            </SheetTitle>
            <p className="text-xs text-primary-foreground/70 flex items-center gap-1.5">
              <FileText className="h-3 w-3" />
              {transcriptCount} transcripts
              {useRag && (
                <Badge variant="secondary" className="text-[10px] h-5 gap-1 bg-primary-foreground/15 text-primary-foreground border-0 ml-1">
                  <Search className="h-2.5 w-2.5" />
                  RAG
                </Badge>
              )}
              {!useRag && (
                <span className="text-primary-foreground/50 ml-1">
                  ~{Math.round(totalTokens).toLocaleString()} tokens
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Last updated indicator */}
          {lastUpdated && (
            <span className="text-[10px] text-primary-foreground/50 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}
            </span>
          )}
          
          {autoSaved && (
            <Badge variant="secondary" className="text-[10px] h-6 gap-1 bg-success/20 text-primary-foreground border-0">
              <CheckCircle2 className="h-3 w-3" />
              Saved
            </Badge>
          )}
          
          {/* Session controls dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/15"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onNewChat}>
                <Plus className="h-4 w-4 mr-2" />
                New Chat
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onShowHistory}>
                <History className="h-4 w-4 mr-2" />
                Chat History
                {archivedSessionsCount > 0 && (
                  <Badge variant="secondary" className="ml-auto text-[10px] h-5">
                    {archivedSessionsCount}
                  </Badge>
                )}
              </DropdownMenuItem>
              {hasMessages && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onExport}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Chat
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={onDeleteChat}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Chat
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </SheetHeader>
  );
}
