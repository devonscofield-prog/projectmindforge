import { HelpCircle, MessageCircle, Copy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface FollowUpQuestion {
  question: string;
  timing_example?: string;
}

interface FollowUpQuestionsPanelProps {
  questions: (string | FollowUpQuestion)[];
}

export function FollowUpQuestionsPanel({ questions }: FollowUpQuestionsPanelProps) {
  if (!questions || questions.length === 0) {
    return null;
  }

  const handleCopyAll = async () => {
    const allQuestions = questions
      .map((item, i) => {
        const question = typeof item === 'object' && item !== null ? item.question : item;
        return `${i + 1}. ${question}`;
      })
      .join('\n');
    
    try {
      await navigator.clipboard.writeText(allQuestions);
      toast.success('Copied', { description: 'All questions copied to clipboard.' });
    } catch {
      toast.error('Error', { description: 'Failed to copy.' });
    }
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-primary">
            <HelpCircle className="h-5 w-5" />
            Follow-up Questions
            <Badge variant="secondary" className="ml-2">
              {questions.length}
            </Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={handleCopyAll}>
            <Copy className="h-4 w-4 mr-1" />
            Copy All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {questions.map((item, index) => {
            const isObject = typeof item === 'object' && item !== null;
            const question = isObject ? item.question : item;
            const timingExample = isObject ? item.timing_example : null;
            
            return (
              <li key={index} className="space-y-1">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{question}</p>
                    {timingExample && (
                      <div className="flex items-start gap-2 mt-1.5 text-xs text-muted-foreground">
                        <MessageCircle className="h-3 w-3 shrink-0 mt-0.5" />
                        <span className="italic">{timingExample}</span>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
