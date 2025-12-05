import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { createLogger } from '@/lib/logger';

const log = createLogger('RepDashboard');
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createCallTranscriptAndAnalyze } from '@/api/aiCallAnalysis';
import type { ProductEntry } from '@/api/aiCallAnalysis';
import { updateProspect } from '@/api/prospects';
import { CallType, callTypeOptions } from '@/constants/callTypes';
import { format } from 'date-fns';
import { Send, Loader2, FileText, Pencil, BarChart3 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AccountCombobox } from '@/components/forms/AccountCombobox';
import { StakeholderCombobox } from '@/components/forms/StakeholderCombobox';
import { ProductSelector } from '@/components/forms/ProductSelector';
import { PendingFollowUpsWidget } from '@/components/dashboard/PendingFollowUpsWidget';
import { QueryErrorBoundary } from '@/components/ui/query-error-boundary';
import { withPageErrorBoundary } from '@/components/ui/page-error-boundary';

function RepDashboard() {
  const {
    user,
    profile
  } = useAuth();
  const {
    toast
  } = useToast();
  const navigate = useNavigate();

  // Form state
  const [transcript, setTranscript] = useState('');
  const [stakeholderName, setStakeholderName] = useState('');
  const [selectedStakeholderId, setSelectedStakeholderId] = useState<string | null>(null);
  const [accountName, setAccountName] = useState('');
  const [selectedProspectId, setSelectedProspectId] = useState<string | null>(null);
  const [salesforceAccountLink, setSalesforceAccountLink] = useState('');
  const [existingAccountHasSalesforceLink, setExistingAccountHasSalesforceLink] = useState(false);
  const [isEditingSalesforceLink, setIsEditingSalesforceLink] = useState(false);
  const [callDate, setCallDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [callType, setCallType] = useState<CallType>('first_demo');
  const [callTypeOther, setCallTypeOther] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<ProductEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleAccountChange = (name: string, prospectId: string | null, salesforceLink?: string | null) => {
    setAccountName(name);
    setSelectedProspectId(prospectId);
    // Auto-populate salesforce link if existing account has one
    if (prospectId && salesforceLink) {
      setSalesforceAccountLink(salesforceLink);
      setExistingAccountHasSalesforceLink(true);
      setIsEditingSalesforceLink(false);
    } else {
      setSalesforceAccountLink('');
      setExistingAccountHasSalesforceLink(false);
      setIsEditingSalesforceLink(false);
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
    if (!user?.id) return undefined;

    // Validation
    const trimmedStakeholderName = stakeholderName.trim();
    if (!trimmedStakeholderName) {
      toast({
        title: 'Error',
        description: 'Stakeholder name is required',
        variant: 'destructive'
      });
      return;
    }
    if (trimmedStakeholderName.length < 2) {
      toast({
        title: 'Error',
        description: 'Stakeholder name must be at least 2 characters',
        variant: 'destructive'
      });
      return;
    }
    const trimmedAccountName = accountName.trim();
    if (!trimmedAccountName) {
      toast({
        title: 'Error',
        description: 'Account name is required',
        variant: 'destructive'
      });
      return;
    }
    if (trimmedAccountName.length < 2) {
      toast({
        title: 'Error',
        description: 'Account name must be at least 2 characters',
        variant: 'destructive'
      });
      return;
    }
    // Salesforce link is only required for new accounts or existing accounts without a link
    const salesforceLinkRequired = !selectedProspectId || !existingAccountHasSalesforceLink;
    if (salesforceLinkRequired && !salesforceAccountLink.trim()) {
      toast({
        title: 'Error',
        description: 'Salesforce Account Link is required for new accounts',
        variant: 'destructive'
      });
      return;
    }
    if (!transcript.trim()) {
      toast({
        title: 'Error',
        description: 'Transcript is required',
        variant: 'destructive'
      });
      return;
    }
    if (callType === 'other' && !callTypeOther.trim()) {
      toast({
        title: 'Error',
        description: 'Please specify the call type',
        variant: 'destructive'
      });
      return;
    }
    setIsSubmitting(true);
    try {
      // If user edited the Salesforce link for an existing account, update the prospect
      if (selectedProspectId && isEditingSalesforceLink && salesforceAccountLink.trim()) {
        await updateProspect(selectedProspectId, {
          salesforce_link: salesforceAccountLink.trim()
        });
      }
      const result = await createCallTranscriptAndAnalyze({
        repId: user.id,
        callDate,
        callType,
        callTypeOther: callType === 'other' ? callTypeOther : undefined,
        stakeholderName: stakeholderName.trim(),
        accountName: accountName.trim(),
        salesforceAccountLink: salesforceAccountLink.trim() || undefined,
        rawText: transcript,
        prospectId: selectedProspectId || undefined,
        stakeholderId: selectedStakeholderId || undefined,
        products: selectedProducts.length > 0 ? selectedProducts.map(p => ({
          productId: p.productId,
          unitPrice: p.unitPrice,
          quantity: p.quantity,
          promotionNotes: p.promotionNotes,
        })) : undefined,
      });

      // Check for rate limit error in analyze response
      if (result.analyzeResponse?.isRateLimited) {
        toast({
          title: 'Too many requests',
          description: 'Your call was saved but analysis is queued. Please wait a moment before submitting another.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Call submitted for analysis',
          description: 'Redirecting to your call details...'
        });
      }

      // Navigate to the call detail page
      navigate(`/calls/${result.transcript.id}`);
    } catch (error) {
      log.error('Error submitting call', { error });
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to submit call for analysis',
        variant: 'destructive'
      });
      setIsSubmitting(false);
    }
  };
  // Show loading skeleton while profile loads
  if (!profile) {
    return (
      <AppLayout>
        <div className="space-y-6 md:space-y-8">
          <div className="text-center space-y-2">
            <Skeleton className="h-8 w-64 mx-auto" />
            <Skeleton className="h-5 w-96 mx-auto" />
            <Skeleton className="h-9 w-48 mx-auto mt-2" />
          </div>
          <div className="grid gap-6 lg:gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Skeleton className="h-[600px] w-full rounded-lg" />
            </div>
            <Skeleton className="h-[400px] w-full rounded-lg" />
          </div>
        </div>
      </AppLayout>
    );
  }

  return <AppLayout>
      <div className="space-y-6 md:space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold">
            Welcome back, {profile.name?.split(' ')[0] || 'Rep'}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Submit your call transcripts for AI-powered coaching and insights
          </p>
          <Button variant="outline" size="sm" asChild className="mt-2">
            <Link to="/rep/coaching-summary">
              <BarChart3 className="h-4 w-4 mr-2" />
              View Coaching Summary
            </Link>
          </Button>
        </div>

        <div className="grid gap-6 lg:gap-8 lg:grid-cols-3">
          {/* Submit Call Card - Takes up 2 columns */}
          <div className="lg:col-span-2">
            <Card className="border-2">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl md:text-2xl">Analyze a Call</CardTitle>
                <CardDescription className="text-sm md:text-base">
                  Paste your call transcript to get AI coaching, MEDDPICC scoring, and a recap email draft.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
                  {/* Account and Primary Stakeholder Row */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="accountName">Account Name *</Label>
                      <AccountCombobox repId={user?.id || ''} value={accountName} selectedProspectId={selectedProspectId} onChange={handleAccountChange} placeholder="Select or type account..." disabled={!user?.id} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stakeholderName">Stakeholder *</Label>
                      <StakeholderCombobox prospectId={selectedProspectId} value={stakeholderName} selectedStakeholderId={selectedStakeholderId} onChange={handleStakeholderChange} placeholder="Who was on the call?" disabled={!user?.id} />
                    </div>
                  </div>

                  {/* Salesforce Link Row */}
                  <div className="space-y-2">
                    <Label htmlFor="salesforceAccountLink">
                      Salesforce Account Link {(!selectedProspectId || !existingAccountHasSalesforceLink) && '*'}
                    </Label>
                    <div className="flex gap-2">
                      <Input id="salesforceAccountLink" type="url" placeholder="https://..." value={salesforceAccountLink} onChange={e => setSalesforceAccountLink(e.target.value)} disabled={existingAccountHasSalesforceLink && !isEditingSalesforceLink} className="flex-1" />
                      {existingAccountHasSalesforceLink && !isEditingSalesforceLink && <Button type="button" variant="outline" size="icon" onClick={() => setIsEditingSalesforceLink(true)} title="Edit Salesforce link">
                          <Pencil className="h-4 w-4" />
                        </Button>}
                    </div>
                    {existingAccountHasSalesforceLink && <p className="text-xs text-muted-foreground">
                        {isEditingSalesforceLink ? 'Editing account link' : 'Using existing account link'}
                      </p>}
                  </div>

                  {/* Date and Call Type Row */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="callDate">Call Date *</Label>
                      <Input 
                        id="callDate" 
                        type="date" 
                        value={callDate} 
                        onChange={e => setCallDate(e.target.value)} 
                        max={format(new Date(), 'yyyy-MM-dd')}
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="callType">Call Type *</Label>
                      <Select value={callType} onValueChange={v => setCallType(v as CallType)}>
                        <SelectTrigger id="callType">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {callTypeOptions.map(option => <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Other Call Type Input (conditional) */}
                  {callType === 'other' && <div className="space-y-2">
                      <Label htmlFor="callTypeOther">Specify Call Type *</Label>
                      <Input id="callTypeOther" placeholder="e.g., Technical Review" value={callTypeOther} onChange={e => setCallTypeOther(e.target.value)} required />
                    </div>}

                  {/* Transcript */}
                  <div className="space-y-2">
                    <Label htmlFor="transcript">Call Transcript *</Label>
                    <Textarea 
                      id="transcript" 
                      placeholder="Paste the full call transcript here. Include the entire conversation—speaker labels are helpful but not required. The more detail you include, the better the analysis." 
                      value={transcript} 
                      onChange={e => setTranscript(e.target.value)} 
                      className="min-h-[200px] md:min-h-[250px] font-mono text-sm" 
                      required 
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Include the full conversation for best analysis results.</span>
                      <span className={transcript.length < 500 ? 'text-amber-500' : 'text-muted-foreground'}>
                        {transcript.length.toLocaleString()} characters
                        {transcript.length < 500 && transcript.length > 0 && ' (short)'}
                      </span>
                    </div>
                  </div>

                  {/* Product Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="products">Products Discussed (Optional)</Label>
                    <p className="text-xs text-muted-foreground -mt-1">
                      Track products and pricing discussed on this call to calculate active revenue.
                    </p>
                    <ProductSelector
                      value={selectedProducts}
                      onChange={setSelectedProducts}
                    />
                  </div>

                    {/* Submit Button */}
                    <Button type="submit" disabled={isSubmitting || !transcript.trim() || stakeholderName.trim().length < 2 || accountName.trim().length < 2 || (!selectedProspectId || !existingAccountHasSalesforceLink) && !salesforceAccountLink.trim()} className="w-full h-12 text-lg" size="lg">
                    {isSubmitting ? <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Analyzing Call...
                      </> : <>
                        <Send className="mr-2 h-5 w-5" />
                        Analyze Call
                      </>}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Follow-ups Widget - Takes up 1 column */}
          <div>
            <QueryErrorBoundary>
              {user?.id && <PendingFollowUpsWidget repId={user.id} />}
            </QueryErrorBoundary>
          </div>
        </div>
      </div>
    </AppLayout>;
}

export default withPageErrorBoundary(RepDashboard, 'Dashboard');