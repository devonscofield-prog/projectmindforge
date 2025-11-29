import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  createCallTranscriptAndAnalyze, 
  listCallTranscriptsForRep,
  CallTranscript
} from '@/api/aiCallAnalysis';
import { CallType, callTypeLabels, callTypeOptions } from '@/constants/callTypes';
import { format } from 'date-fns';
import { 
  Send, 
  History, 
  Loader2,
  CheckCircle, 
  AlertCircle, 
  Clock,
  ArrowRight,
  Mic
} from 'lucide-react';

export default function RepDashboard() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Form state
  const [transcript, setTranscript] = useState('');
  const [prospectName, setProspectName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [salesforceDemoLink, setSalesforceDemoLink] = useState('');
  const [potentialRevenue, setPotentialRevenue] = useState('');
  const [callDate, setCallDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [callType, setCallType] = useState<CallType>('first_demo');
  const [callTypeOther, setCallTypeOther] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch transcripts for history
  const { data: transcripts = [], isLoading: isLoadingTranscripts } = useQuery({
    queryKey: ['rep-transcripts', user?.id],
    queryFn: () => listCallTranscriptsForRep(user!.id),
    enabled: !!user?.id,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    // Validation
    if (!prospectName.trim()) {
      toast({ title: 'Error', description: 'Prospect Name is required', variant: 'destructive' });
      return;
    }
    if (!accountName.trim()) {
      toast({ title: 'Error', description: 'Account Name is required', variant: 'destructive' });
      return;
    }
    if (!salesforceDemoLink.trim()) {
      toast({ title: 'Error', description: 'Salesforce Demo Link is required', variant: 'destructive' });
      return;
    }
    if (!transcript.trim()) {
      toast({ title: 'Error', description: 'Transcript is required', variant: 'destructive' });
      return;
    }
    if (callType === 'other' && !callTypeOther.trim()) {
      toast({ title: 'Error', description: 'Please specify the call type', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createCallTranscriptAndAnalyze({
        repId: user.id,
        callDate,
        callType,
        callTypeOther: callType === 'other' ? callTypeOther : undefined,
        prospectName: prospectName.trim(),
        accountName: accountName.trim(),
        salesforceDemoLink: salesforceDemoLink.trim(),
        potentialRevenue: potentialRevenue ? parseFloat(potentialRevenue) : undefined,
        rawText: transcript,
      });

      toast({
        title: 'Call submitted for analysis',
        description: 'Redirecting to your call details...',
      });

      // Navigate to the call detail page
      navigate(`/calls/${result.transcript.id}`);
    } catch (error) {
      console.error('Error submitting call:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to submit call for analysis',
        variant: 'destructive',
      });
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" /> Analyzed</Badge>;
      case 'processing':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Processing</Badge>;
      case 'error':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Error</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
    }
  };

  const getCallDisplayName = (t: CallTranscript) => {
    if (t.prospect_name && t.account_name) {
      return `${t.prospect_name} - ${t.account_name}`;
    }
    if (t.account_name) {
      return t.account_name;
    }
    if (t.prospect_name) {
      return t.prospect_name;
    }
    // Fallback for older calls
    return t.notes || 'Call';
  };

  const getCallTypeDisplay = (t: CallTranscript) => {
    if (t.call_type === 'other' && t.call_type_other) {
      return t.call_type_other;
    }
    if (t.call_type) {
      return callTypeLabels[t.call_type as CallType] || t.call_type;
    }
    return null;
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">
            Welcome back, {profile?.name?.split(' ')[0] || 'Rep'}
          </h1>
          <p className="text-muted-foreground">
            Submit your call transcripts for AI-powered coaching and insights
          </p>
        </div>

        {/* Submit Call Card */}
        <Card className="border-2">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Mic className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Submit a Call for Coaching</CardTitle>
            <CardDescription className="text-base">
              Paste your call transcript below to get AI coaching, actionable insights, and a recap email draft.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Prospect and Account Row */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="prospectName">Prospect Name *</Label>
                  <Input
                    id="prospectName"
                    placeholder="e.g., John Smith"
                    value={prospectName}
                    onChange={(e) => setProspectName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountName">Account Name *</Label>
                  <Input
                    id="accountName"
                    placeholder="e.g., ACME Corporation"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Salesforce Link and Revenue Row */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="salesforceDemoLink">Salesforce Demo Link *</Label>
                  <Input
                    id="salesforceDemoLink"
                    type="url"
                    placeholder="https://..."
                    value={salesforceDemoLink}
                    onChange={(e) => setSalesforceDemoLink(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="potentialRevenue">Potential Revenue (optional)</Label>
                  <Input
                    id="potentialRevenue"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g., 50000"
                    value={potentialRevenue}
                    onChange={(e) => setPotentialRevenue(e.target.value)}
                  />
                </div>
              </div>

              {/* Date and Call Type Row */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="callDate">Call Date</Label>
                  <Input
                    id="callDate"
                    type="date"
                    value={callDate}
                    onChange={(e) => setCallDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="callType">Call Type</Label>
                  <Select value={callType} onValueChange={(v) => setCallType(v as CallType)}>
                    <SelectTrigger id="callType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {callTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Other Call Type Input (conditional) */}
              {callType === 'other' && (
                <div className="space-y-2">
                  <Label htmlFor="callTypeOther">Specify Call Type *</Label>
                  <Input
                    id="callTypeOther"
                    placeholder="e.g., Technical Review"
                    value={callTypeOther}
                    onChange={(e) => setCallTypeOther(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* Transcript */}
              <div className="space-y-2">
                <Label htmlFor="transcript">Call Transcript *</Label>
                <Textarea
                  id="transcript"
                  placeholder="Paste your full call transcript here..."
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  className="min-h-[250px] font-mono text-sm"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Include the full conversation for best analysis results.
                </p>
              </div>

              {/* Submit Button */}
              <Button 
                type="submit" 
                disabled={isSubmitting || !transcript.trim() || !prospectName.trim() || !accountName.trim() || !salesforceDemoLink.trim()} 
                className="w-full h-12 text-lg"
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Analyzing Call...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-5 w-5" />
                    Analyze Call
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Previous Calls Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Previous Calls
            </CardTitle>
            <CardDescription>
              View your past call analyses
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTranscripts ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : transcripts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No calls submitted yet. Submit your first call above!
              </p>
            ) : (
              <div className="space-y-2">
                {transcripts.slice(0, 5).map((t: CallTranscript) => (
                  <button
                    key={t.id}
                    onClick={() => navigate(`/calls/${t.id}`)}
                    className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium truncate">
                          {getCallDisplayName(t)}
                        </span>
                        {getCallTypeDisplay(t) && (
                          <Badge variant="outline" className="text-xs">
                            {getCallTypeDisplay(t)}
                          </Badge>
                        )}
                        {getStatusBadge(t.analysis_status)}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(t.call_date), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
                  </button>
                ))}
                
                {transcripts.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center pt-2">
                    Showing 5 of {transcripts.length} calls
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
