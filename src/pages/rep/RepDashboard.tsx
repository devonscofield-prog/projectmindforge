import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createCallTranscriptAndAnalyze } from '@/api/aiCallAnalysis';
import { CallType, callTypeOptions } from '@/constants/callTypes';
import { format } from 'date-fns';
import { Send, Loader2, Mic } from 'lucide-react';
import { AccountCombobox } from '@/components/forms/AccountCombobox';
import { StakeholderCombobox } from '@/components/forms/StakeholderCombobox';
import { PendingFollowUpsWidget } from '@/components/dashboard/PendingFollowUpsWidget';

export default function RepDashboard() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Form state
  const [transcript, setTranscript] = useState('');
  const [stakeholderName, setStakeholderName] = useState('');
  const [selectedStakeholderId, setSelectedStakeholderId] = useState<string | null>(null);
  const [accountName, setAccountName] = useState('');
  const [selectedProspectId, setSelectedProspectId] = useState<string | null>(null);
  const [salesforceAccountLink, setSalesforceAccountLink] = useState('');
  const [existingAccountHasSalesforceLink, setExistingAccountHasSalesforceLink] = useState(false);
  const [potentialRevenue, setPotentialRevenue] = useState('');
  const [callDate, setCallDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [callType, setCallType] = useState<CallType>('first_demo');
  const [callTypeOther, setCallTypeOther] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAccountChange = (name: string, prospectId: string | null, salesforceLink?: string | null) => {
    setAccountName(name);
    setSelectedProspectId(prospectId);
    // Auto-populate salesforce link if existing account has one
    if (prospectId && salesforceLink) {
      setSalesforceAccountLink(salesforceLink);
      setExistingAccountHasSalesforceLink(true);
    } else {
      setSalesforceAccountLink('');
      setExistingAccountHasSalesforceLink(false);
    }
    // Reset stakeholder when account changes
    setStakeholderName('');
    setSelectedStakeholderId(null);
  };

  const handleStakeholderChange = (name: string, stakeholderId: string | null) => {
    setStakeholderName(name);
    setSelectedStakeholderId(stakeholderId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    // Validation
    if (!stakeholderName.trim()) {
      toast({ title: 'Error', description: 'Stakeholder is required', variant: 'destructive' });
      return;
    }
    if (!accountName.trim()) {
      toast({ title: 'Error', description: 'Account Name is required', variant: 'destructive' });
      return;
    }
    // Salesforce link is only required for new accounts or existing accounts without a link
    const salesforceLinkRequired = !selectedProspectId || !existingAccountHasSalesforceLink;
    if (salesforceLinkRequired && !salesforceAccountLink.trim()) {
      toast({ title: 'Error', description: 'Salesforce Account Link is required for new accounts', variant: 'destructive' });
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
        stakeholderName: stakeholderName.trim(),
        accountName: accountName.trim(),
        salesforceAccountLink: salesforceAccountLink.trim() || undefined,
        potentialRevenue: potentialRevenue ? parseFloat(potentialRevenue) : undefined,
        rawText: transcript,
        prospectId: selectedProspectId || undefined,
        stakeholderId: selectedStakeholderId || undefined,
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

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">
            Welcome back, {profile?.name?.split(' ')[0] || 'Rep'}
          </h1>
          <p className="text-muted-foreground">
            Submit your call transcripts for AI-powered coaching and insights
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Submit Call Card - Takes up 2 columns */}
          <div className="lg:col-span-2">
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
                  {/* Account and Primary Stakeholder Row */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="accountName">Account Name *</Label>
                      <AccountCombobox
                        repId={user?.id || ''}
                        value={accountName}
                        selectedProspectId={selectedProspectId}
                        onChange={handleAccountChange}
                        placeholder="Select or type account..."
                        disabled={!user?.id}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stakeholderName">Stakeholder *</Label>
                      <StakeholderCombobox
                        prospectId={selectedProspectId}
                        value={stakeholderName}
                        selectedStakeholderId={selectedStakeholderId}
                        onChange={handleStakeholderChange}
                        placeholder="Who was on the call?"
                        disabled={!user?.id}
                      />
                    </div>
                  </div>

                  {/* Salesforce Link and Revenue Row */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="salesforceAccountLink">
                        Salesforce Account Link {(!selectedProspectId || !existingAccountHasSalesforceLink) && '*'}
                      </Label>
                      <Input
                        id="salesforceAccountLink"
                        type="url"
                        placeholder="https://..."
                        value={salesforceAccountLink}
                        onChange={(e) => setSalesforceAccountLink(e.target.value)}
                        disabled={existingAccountHasSalesforceLink}
                      />
                      {existingAccountHasSalesforceLink && (
                        <p className="text-xs text-muted-foreground">Using existing account link</p>
                      )}
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
                    disabled={isSubmitting || !transcript.trim() || !stakeholderName.trim() || !accountName.trim() || ((!selectedProspectId || !existingAccountHasSalesforceLink) && !salesforceAccountLink.trim())} 
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
          </div>

          {/* Follow-ups Widget - Takes up 1 column */}
          <div>
            {user?.id && <PendingFollowUpsWidget repId={user.id} />}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
