import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarCheck, Clock, RefreshCw, User, Users, AlertCircle, MessageSquare, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { generateAgreedNextSteps, isAgreedNextSteps, type AgreedNextSteps } from '@/api/agreedNextSteps';
import { formatDistanceToNow } from 'date-fns';

interface AgreedNextStepsCardProps {
  prospectId: string;
  aiExtractedInfo: Record<string, unknown> | null;
  onRefresh?: () => void;
}

function getOwnerIcon(owner?: string) {
  switch (owner) {
    case 'rep': return <User className="h-4 w-4" />;
    case 'prospect': return <Users className="h-4 w-4" />;
    case 'both': return <Users className="h-4 w-4" />;
    default: return null;
  }
}

function getOwnerLabel(owner?: string) {
  switch (owner) {
    case 'rep': return 'You need to follow up';
    case 'prospect': return 'Waiting on prospect';
    case 'both': return 'Both parties to act';
    default: return '';
  }
}

function getTypeBadge(type: string) {
  switch (type) {
    case 'scheduled_meeting':
      return <Badge className="bg-green-500 text-white">Meeting Scheduled</Badge>;
    case 'pending_action':
      return <Badge className="bg-blue-500 text-white">Pending Action</Badge>;
    case 'awaiting_response':
      return <Badge className="bg-yellow-500 text-black">Awaiting Response</Badge>;
    case 'none':
      return <Badge variant="secondary">No Next Steps</Badge>;
    default:
      return null;
  }
}

function getConfidenceBadge(confidence: string) {
  switch (confidence) {
    case 'high':
      return <Badge variant="outline" className="text-green-600 border-green-300 text-xs">High confidence</Badge>;
    case 'medium':
      return <Badge variant="outline" className="text-yellow-600 border-yellow-300 text-xs">Medium confidence</Badge>;
    case 'low':
      return <Badge variant="outline" className="text-muted-foreground text-xs">Low confidence</Badge>;
    default:
      return null;
  }
}

export function AgreedNextStepsCard({ prospectId, aiExtractedInfo, onRefresh }: AgreedNextStepsCardProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const nextSteps = aiExtractedInfo?.agreed_next_steps;
  const hasData = nextSteps && isAgreedNextSteps(nextSteps);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await generateAgreedNextSteps(prospectId);
      toast.success('Next steps extracted from transcripts');
      onRefresh?.();
    } catch (error) {
      console.error('Failed to generate next steps:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to extract next steps');
    } finally {
      setIsGenerating(false);
    }
  };

  // No data state
  if (!hasData) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck className="h-5 w-5 text-primary" />
            Agreed Next Steps
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-muted-foreground text-sm mb-4">
              Extract mutually agreed next steps from your call transcripts.
            </p>
            <Button onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing calls...
                </>
              ) : (
                <>
                  <CalendarCheck className="h-4 w-4 mr-2" />
                  Extract Next Steps
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const data = nextSteps as AgreedNextSteps;
  const lastUpdated = data.extracted_at
    ? formatDistanceToNow(new Date(data.extracted_at), { addSuffix: true })
    : 'Unknown';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck className="h-5 w-5 text-primary" />
            Agreed Next Steps
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{lastUpdated}</span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleGenerate}
              disabled={isGenerating}
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Type Badge */}
        <div className="flex items-center gap-2">
          {getTypeBadge(data.type)}
          {getConfidenceBadge(data.confidence)}
        </div>

        {/* Scheduled Meeting Display */}
        {data.type === 'scheduled_meeting' && (
          <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-3">
              <CalendarCheck className="h-6 w-6 text-green-600" />
              <div>
                <div className="font-semibold text-lg">
                  {data.meeting_date}
                  {data.meeting_time && <span className="ml-2 text-muted-foreground">at {data.meeting_time}</span>}
                </div>
                {data.meeting_agenda && (
                  <p className="text-sm text-muted-foreground">{data.meeting_agenda}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Pending Action / Awaiting Response Display */}
        {(data.type === 'pending_action' || data.type === 'awaiting_response') && data.summary && (
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              {data.type === 'pending_action' ? (
                <Clock className="h-5 w-5 text-blue-500 mt-0.5" />
              ) : (
                <MessageSquare className="h-5 w-5 text-yellow-600 mt-0.5" />
              )}
              <p className="text-sm">{data.summary}</p>
            </div>
          </div>
        )}

        {/* No Next Steps */}
        {data.type === 'none' && (
          <div className="bg-yellow-50 dark:bg-yellow-950/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">No clear next steps agreed</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {data.summary || 'Consider scheduling a follow-up to establish next steps.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Owner indicator */}
        {data.who_owns_next_action && data.type !== 'none' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {getOwnerIcon(data.who_owns_next_action)}
            <span>{getOwnerLabel(data.who_owns_next_action)}</span>
          </div>
        )}

        {/* Evidence quote */}
        {data.evidence_quote && (
          <div className="border-l-2 border-primary/30 pl-3">
            <p className="text-xs text-muted-foreground italic">"{data.evidence_quote}"</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
