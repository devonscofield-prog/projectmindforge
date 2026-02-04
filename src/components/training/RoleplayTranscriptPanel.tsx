import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  ChevronUp, 
  ChevronDown,
  Bot,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TranscriptEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface RoleplayTranscriptPanelProps {
  transcript: TranscriptEntry[];
  currentTranscript: string;
  isExpanded?: boolean;
}

export function RoleplayTranscriptPanel({
  transcript,
  currentTranscript,
  isExpanded: defaultExpanded = false,
}: RoleplayTranscriptPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  const messageCount = transcript.length + (currentTranscript ? 1 : 0);

  return (
    <Card className={cn(
      "transition-all duration-300 overflow-hidden",
      isExpanded ? "max-h-[400px]" : "max-h-14"
    )}>
      <CardHeader 
        className="py-3 px-4 cursor-pointer hover:bg-secondary/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Live Transcript</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {messageCount} message{messageCount !== 1 ? 's' : ''}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="px-4 pb-4 pt-0 max-h-[320px] overflow-y-auto">
          <div className="space-y-3">
            {transcript.length === 0 && !currentTranscript && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Conversation will appear here...
              </p>
            )}
            
            {transcript.map((entry, idx) => (
              <div 
                key={idx}
                className={cn(
                  "flex gap-2",
                  entry.role === 'user' ? 'flex-row-reverse' : ''
                )}
              >
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                  entry.role === 'user' ? 'bg-primary' : 'bg-secondary'
                )}>
                  {entry.role === 'user' ? (
                    <User className="h-3 w-3 text-primary-foreground" />
                  ) : (
                    <Bot className="h-3 w-3" />
                  )}
                </div>
                <div className={cn(
                  "rounded-lg px-3 py-2 max-w-[85%] text-sm",
                  entry.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-secondary'
                )}>
                  {entry.content}
                </div>
              </div>
            ))}
            
            {/* Current typing indicator for assistant */}
            {currentTranscript && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <Bot className="h-3 w-3" />
                </div>
                <div className="rounded-lg px-3 py-2 max-w-[85%] text-sm bg-secondary">
                  {currentTranscript}
                  <span className="inline-block w-1 h-4 ml-0.5 bg-foreground animate-pulse" />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
