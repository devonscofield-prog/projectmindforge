import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link, useBlocker } from 'react-router-dom';
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
import type { ProductEntry, StakeholderEntry } from '@/api/aiCallAnalysis';
import { updateProspect } from '@/api/prospects';
import { CallType, callTypeOptions } from '@/constants/callTypes';
import { format, formatDistanceToNow } from 'date-fns';
import { Send, Loader2, FileText, Pencil, BarChart3, Users, AlertTriangle, Info, Keyboard, RotateCcw } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { AccountCombobox } from '@/components/forms/AccountCombobox';
import { MultiStakeholderSelector } from '@/components/forms/MultiStakeholderSelector';
import { ProductSelector } from '@/components/forms/ProductSelector';
import { PendingFollowUpsWidget } from '@/components/dashboard/PendingFollowUpsWidget';
import { QueryErrorBoundary } from '@/components/ui/query-error-boundary';
import { withPageErrorBoundary } from '@/components/ui/page-error-boundary';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Salesforce URL validation pattern
const SALESFORCE_URL_PATTERN = /salesforce|force\.com/i;

// Validation constants
const MIN_TRANSCRIPT_LENGTH = 500;
const MAX_ADDITIONAL_SPEAKERS = 5;
const MAX_STAKEHOLDERS = 10;
const SUBMISSION_COOLDOWN_MS = 2000;

// Draft storage key
const DRAFT_KEY = 'rep_dashboard_call_draft';

interface FormDraft {
  transcript: string;
  accountName: string;
  salesforceAccountLink: string;
  callDate: string;
  callType: CallType;
  callTypeOther: string;
  additionalSpeakersText: string;
  managerOnCall: boolean;
  additionalSpeakersEnabled: boolean;
  stakeholders: StakeholderEntry[];
  selectedProducts: ProductEntry[];
  savedAt: number;
}

function RepDashboard() {
  const {
    user,
    profile
  } = useAuth();
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  const callTypeOtherRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Form state
  const [transcript, setTranscript] = useState('');
  const [stakeholders, setStakeholders] = useState<StakeholderEntry[]>([]);
  const [accountName, setAccountName] = useState('');
  const [selectedProspectId, setSelectedProspectId] = useState<string | null>(null);
  const [salesforceAccountLink, setSalesforceAccountLink] = useState('');
  const [existingAccountHasSalesforceLink, setExistingAccountHasSalesforceLink] = useState(false);
  const [isEditingSalesforceLink, setIsEditingSalesforceLink] = useState(false);
  const [callDate, setCallDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [callType, setCallType] = useState<CallType>('first_demo');
  const [callTypeOther, setCallTypeOther] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<ProductEntry[]>([]);
  const [managerOnCall, setManagerOnCall] = useState(false);
  const [additionalSpeakersEnabled, setAdditionalSpeakersEnabled] = useState(false);
  const [additionalSpeakersText, setAdditionalSpeakersText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSubmitTime, setLastSubmitTime] = useState(0);
  
  // Draft state
  const [hasDraft, setHasDraft] = useState(false);
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  // Calculate if form has meaningful content (dirty state)
  const isDirty = useCallback(() => {
    return (
      transcript.trim().length > 0 ||
      accountName.trim().length > 0 ||
      stakeholders.length > 0 ||
      selectedProducts.length > 0
    );
  }, [transcript, accountName, stakeholders, selectedProducts]);

  // Check for existing draft on mount
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        const draft: FormDraft = JSON.parse(savedDraft);
        // Only show restore prompt if draft has meaningful content and is less than 24 hours old
        const isRecent = Date.now() - draft.savedAt < 24 * 60 * 60 * 1000;
        if (isRecent && (draft.transcript.trim().length > 0 || draft.accountName.trim().length > 0)) {
          setHasDraft(true);
          setShowDraftDialog(true);
        } else {
          localStorage.removeItem(DRAFT_KEY);
        }
      }
    } catch {
      // Invalid draft, remove it
      localStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  // Autosave draft every 30 seconds if form has content
  useEffect(() => {
    const interval = setInterval(() => {
      if (isDirty() && !isSubmitting) {
        const draft: FormDraft = {
          transcript,
          accountName,
          salesforceAccountLink,
          callDate,
          callType,
          callTypeOther,
          additionalSpeakersText,
          managerOnCall,
          additionalSpeakersEnabled,
          stakeholders,
          selectedProducts,
          savedAt: Date.now(),
        };
        try {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        } catch {
          // Storage full or unavailable
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [transcript, accountName, salesforceAccountLink, callDate, callType, callTypeOther, additionalSpeakersText, managerOnCall, additionalSpeakersEnabled, stakeholders, selectedProducts, isDirty, isSubmitting]);

  // Warn before leaving with unsaved changes (browser close/refresh)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty() && !isSubmitting) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, isSubmitting]);

  // Block in-app navigation with unsaved changes
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty() && !isSubmitting && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state === 'blocked') {
      setShowUnsavedDialog(true);
      setPendingNavigation(() => () => blocker.proceed());
    }
  }, [blocker]);

  const handleConfirmLeave = () => {
    setShowUnsavedDialog(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  };

  const handleCancelLeave = () => {
    setShowUnsavedDialog(false);
    setPendingNavigation(null);
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  };

  const restoreDraft = () => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        const draft: FormDraft = JSON.parse(savedDraft);
        setTranscript(draft.transcript || '');
        setAccountName(draft.accountName || '');
        setSalesforceAccountLink(draft.salesforceAccountLink || '');
        setCallDate(draft.callDate || format(new Date(), 'yyyy-MM-dd'));
        setCallType(draft.callType || 'first_demo');
        setCallTypeOther(draft.callTypeOther || '');
        setAdditionalSpeakersText(draft.additionalSpeakersText || '');
        setManagerOnCall(draft.managerOnCall || false);
        setAdditionalSpeakersEnabled(draft.additionalSpeakersEnabled || false);
        // Restore stakeholders and products
        setStakeholders(draft.stakeholders || []);
        setSelectedProducts(draft.selectedProducts || []);
        toast({
          title: 'Draft restored',
          description: 'Your previous work has been restored.',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Could not restore draft',
        variant: 'destructive',
      });
    }
    setShowDraftDialog(false);
    setHasDraft(false);
  };

  const discardDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setShowDraftDialog(false);
    setHasDraft(false);
  };

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Ignore
    }
  };

  // Auto-focus "Specify Call Type" input when "Other" is selected
  useEffect(() => {
    if (callType === 'other' && callTypeOtherRef.current) {
      callTypeOtherRef.current.focus();
    }
  }, [callType]);


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
    // Reset stakeholders when account changes
    setStakeholders([]);
  };

  // Normalize transcript: collapse multiple whitespace, trim
  const normalizeTranscript = (text: string): string => {
    return text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
      .replace(/[ \t]+/g, ' ') // Collapse multiple spaces/tabs to single space
      .trim();
  };

  // Parse additional speakers and validate count
  const parseAdditionalSpeakers = (text: string): { speakers: string[]; isValid: boolean } => {
    const speakers = text
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    return {
      speakers,
      isValid: speakers.length <= MAX_ADDITIONAL_SPEAKERS,
    };
  };

  // Validation helpers
  const isAccountValid = accountName.trim().length >= 2;
  const isStakeholderValid = stakeholders.length > 0;
  const normalizedTranscript = normalizeTranscript(transcript);
  const isTranscriptLengthValid = normalizedTranscript.length >= MIN_TRANSCRIPT_LENGTH;
  const isTranscriptValid = normalizedTranscript.length > 0;
  const isSalesforceRequired = !selectedProspectId || !existingAccountHasSalesforceLink;
  const isSalesforceValid = !isSalesforceRequired || salesforceAccountLink.trim().length > 0;
  const isSalesforceUrlValid = !salesforceAccountLink.trim() || SALESFORCE_URL_PATTERN.test(salesforceAccountLink);
  const isCallTypeOtherValid = callType !== 'other' || callTypeOther.trim().length > 0;
  const { speakers: additionalSpeakers, isValid: isAdditionalSpeakersValid } = parseAdditionalSpeakers(additionalSpeakersText);

  // Transcript length progress (0-100, capped at 100)
  const transcriptProgress = Math.min(100, (normalizedTranscript.length / MIN_TRANSCRIPT_LENGTH) * 100);

  // Check for products with $0 price
  const hasInvalidProducts = selectedProducts.some(p => p.unitPrice === 0);

  const canSubmit = 
    isAccountValid && 
    isStakeholderValid && 
    isTranscriptValid && 
    isTranscriptLengthValid &&
    isSalesforceValid && 
    isSalesforceUrlValid && 
    isCallTypeOtherValid && 
    isAdditionalSpeakersValid &&
    !hasInvalidProducts &&
    !isSubmitting &&
    (Date.now() - lastSubmitTime >= SUBMISSION_COOLDOWN_MS);

  // Get validation hints for incomplete fields
  const getValidationHints = () => {
    const hints: string[] = [];
    if (!isAccountValid) hints.push('Account');
    if (!isStakeholderValid) hints.push('Stakeholder');
    if (!isSalesforceValid) hints.push('Salesforce Link');
    if (!isSalesforceUrlValid) hints.push('Valid Salesforce URL');
    if (!isTranscriptValid) hints.push('Transcript');
    if (isTranscriptValid && !isTranscriptLengthValid) hints.push(`Transcript (min ${MIN_TRANSCRIPT_LENGTH} chars)`);
    if (!isCallTypeOtherValid) hints.push('Call Type');
    if (!isAdditionalSpeakersValid) hints.push(`Max ${MAX_ADDITIONAL_SPEAKERS} speakers`);
    if (hasInvalidProducts) hints.push('Products with $0 price');
    return hints;
  };

  // Get draft age for display
  const getDraftAge = (): string | null => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        const draft: FormDraft = JSON.parse(savedDraft);
        if (draft.savedAt) {
          return formatDistanceToNow(draft.savedAt, { addSuffix: true });
        }
      }
    } catch {
      // Ignore
    }
    return null;
  };

  // Clear form completely
  const clearForm = () => {
    setTranscript('');
    setAccountName('');
    setSelectedProspectId(null);
    setSalesforceAccountLink('');
    setExistingAccountHasSalesforceLink(false);
    setIsEditingSalesforceLink(false);
    setCallDate(format(new Date(), 'yyyy-MM-dd'));
    setCallType('first_demo');
    setCallTypeOther('');
    setStakeholders([]);
    setSelectedProducts([]);
    setManagerOnCall(false);
    setAdditionalSpeakersEnabled(false);
    setAdditionalSpeakersText('');
    clearDraft();
    toast({
      title: 'Form cleared',
      description: 'All fields have been reset.',
    });
  };

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Keyboard shortcut: Cmd/Ctrl + Enter to submit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canSubmit && formRef.current) {
          formRef.current.requestSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canSubmit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return undefined;

    // Submission debouncing - prevent double submits
    const now = Date.now();
    if (now - lastSubmitTime < SUBMISSION_COOLDOWN_MS) {
      return;
    }
    setLastSubmitTime(now);

    // Validation
    if (stakeholders.length === 0) {
      toast({
        title: 'Error',
        description: 'At least one stakeholder is required',
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
    // Validate Salesforce URL format
    if (salesforceAccountLink.trim() && !SALESFORCE_URL_PATTERN.test(salesforceAccountLink)) {
      toast({
        title: 'Error',
        description: 'Please enter a valid Salesforce URL (must contain "salesforce" or "force.com")',
        variant: 'destructive'
      });
      return;
    }
    // Validate transcript
    if (!normalizedTranscript) {
      toast({
        title: 'Error',
        description: 'Transcript is required',
        variant: 'destructive'
      });
      return;
    }
    if (normalizedTranscript.length < MIN_TRANSCRIPT_LENGTH) {
      toast({
        title: 'Error',
        description: `Transcript must be at least ${MIN_TRANSCRIPT_LENGTH} characters for meaningful analysis`,
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
    // Validate additional speakers count
    if (additionalSpeakersEnabled && !isAdditionalSpeakersValid) {
      toast({
        title: 'Error',
        description: `Maximum ${MAX_ADDITIONAL_SPEAKERS} additional speakers allowed`,
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
        stakeholders,
        accountName: accountName.trim(),
        salesforceAccountLink: salesforceAccountLink.trim() || undefined,
        rawText: normalizedTranscript, // Use normalized transcript
        prospectId: selectedProspectId || undefined,
        products: selectedProducts.length > 0 ? selectedProducts.map(p => ({
          productId: p.productId,
          unitPrice: p.unitPrice,
          quantity: p.quantity,
          promotionNotes: p.promotionNotes,
        })) : undefined,
        managerOnCall,
        additionalSpeakers: additionalSpeakersEnabled && additionalSpeakers.length > 0
          ? additionalSpeakers
          : undefined,
      });

      // Clear draft on successful submission
      clearDraft();

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

  const validationHints = getValidationHints();

  return (
    <AppLayout>
      {/* Draft Restore Dialog */}
      <AlertDialog open={showDraftDialog} onOpenChange={setShowDraftDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Previous Work?</AlertDialogTitle>
            <AlertDialogDescription>
              You have an unsaved call submission from a previous session. Would you like to restore it?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={discardDraft}>Discard</AlertDialogCancel>
            <AlertDialogAction onClick={restoreDraft}>Restore Draft</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved Changes Dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes that will be lost if you leave this page. Are you sure you want to leave?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelLeave}>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLeave}>Leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear Form Confirmation Dialog */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Form?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset all fields and clear your saved draft. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { clearForm(); setShowClearConfirm(false); }}>
              Clear Form
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
                  {/* Account and Primary Stakeholder Row */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="accountName">Account Name *</Label>
                      <AccountCombobox 
                        repId={user?.id || ''} 
                        value={accountName} 
                        selectedProspectId={selectedProspectId} 
                        onChange={handleAccountChange} 
                        placeholder="Select or type account..." 
                        disabled={!user?.id || isSubmitting} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Stakeholders on this call *</Label>
                      <MultiStakeholderSelector
                        prospectId={selectedProspectId}
                        stakeholders={stakeholders}
                        onChange={setStakeholders}
                        disabled={!user?.id || isSubmitting}
                      />
                    </div>
                  </div>

                  {/* Salesforce Link Row */}
                  <div className="space-y-2">
                    <Label htmlFor="salesforceAccountLink">
                      Salesforce Account Link {(!selectedProspectId || !existingAccountHasSalesforceLink) && '*'}
                    </Label>
                    <div className="flex gap-2">
                      <Input 
                        id="salesforceAccountLink" 
                        type="url" 
                        placeholder="https://..." 
                        value={salesforceAccountLink} 
                        onChange={e => setSalesforceAccountLink(e.target.value)} 
                        disabled={(existingAccountHasSalesforceLink && !isEditingSalesforceLink) || isSubmitting} 
                        maxLength={500}
                        className="flex-1" 
                      />
                      {existingAccountHasSalesforceLink && !isEditingSalesforceLink && <Button type="button" variant="outline" size="icon" onClick={() => setIsEditingSalesforceLink(true)} title="Edit Salesforce link" disabled={isSubmitting}>
                          <Pencil className="h-4 w-4" />
                        </Button>}
                    </div>
                    {existingAccountHasSalesforceLink && <p className="text-xs text-muted-foreground">
                        {isEditingSalesforceLink ? 'Editing account link' : 'Using existing account link'}
                      </p>}
                    {salesforceAccountLink.trim() && !isSalesforceUrlValid && (
                      <p className="text-xs text-destructive">
                        URL must contain "salesforce" or "force.com"
                      </p>
                    )}
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
                        disabled={isSubmitting}
                        required 
                      />
                    </div>
                      <div className="space-y-2">
                      <Label htmlFor="callType">Call Type *</Label>
                      <Select value={callType} onValueChange={v => setCallType(v as CallType)} disabled={isSubmitting}>
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

                  {/* Manager on Call Checkbox */}
                  <TooltipProvider>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="managerOnCall" 
                        checked={managerOnCall} 
                        onCheckedChange={(checked) => setManagerOnCall(checked === true)}
                        disabled={isSubmitting}
                      />
                      <Label htmlFor="managerOnCall" className="text-sm font-normal flex items-center gap-1.5 cursor-pointer">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        Manager was on this call
                      </Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">Check this if your manager joined to help close the deal. Enables coaching differentiation.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>

                  {/* Additional Speakers Checkbox + Input */}
                  <div className="space-y-2">
                    <TooltipProvider>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="additionalSpeakers" 
                          checked={additionalSpeakersEnabled} 
                          onCheckedChange={(checked) => setAdditionalSpeakersEnabled(checked === true)}
                          disabled={isSubmitting}
                        />
                        <Label htmlFor="additionalSpeakers" className="text-sm font-normal flex items-center gap-1.5 cursor-pointer">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          Additional speakers on this call
                        </Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Include names of other participants like sales engineers or technical specialists.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                    {additionalSpeakersEnabled && (
                      <div className="space-y-1">
                        <Input 
                          placeholder="Enter names separated by commas (e.g., John Smith, Sarah Jones)"
                          value={additionalSpeakersText}
                          onChange={e => setAdditionalSpeakersText(e.target.value)}
                          disabled={isSubmitting}
                          maxLength={200}
                          className="text-sm"
                          aria-describedby="speakers-hint"
                        />
                        <div className="flex justify-between">
                          <p id="speakers-hint" className="text-xs text-muted-foreground">
                            Max {MAX_ADDITIONAL_SPEAKERS} additional speakers
                          </p>
                          {additionalSpeakers.length > 0 && (
                            <p className={`text-xs ${isAdditionalSpeakersValid ? 'text-muted-foreground' : 'text-destructive'}`}>
                              {additionalSpeakers.length}/{MAX_ADDITIONAL_SPEAKERS} speakers
                            </p>
                          )}
                        </div>
                        {!isAdditionalSpeakersValid && (
                          <Alert variant="destructive" className="py-2">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              Please reduce to {MAX_ADDITIONAL_SPEAKERS} speakers or fewer.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Other Call Type Input (conditional) */}
                  {callType === 'other' && <div className="space-y-2">
                      <Label htmlFor="callTypeOther">Specify Call Type *</Label>
                      <Input 
                        ref={callTypeOtherRef}
                        id="callTypeOther" 
                        placeholder="e.g., Technical Review" 
                        value={callTypeOther} 
                        onChange={e => setCallTypeOther(e.target.value)} 
                        maxLength={50}
                        disabled={isSubmitting}
                        required 
                      />
                    </div>}

                  {/* Transcript */}
                  <div className="space-y-2">
                    <Label htmlFor="transcript">Call Transcript *</Label>
                    <Textarea 
                      id="transcript" 
                      placeholder="Paste the full call transcript here. Include the entire conversation—speaker labels are helpful but not required. The more detail you include, the better the analysis." 
                      value={transcript} 
                      onChange={e => setTranscript(e.target.value)} 
                      className="min-h-[150px] md:min-h-[250px] font-mono text-sm" 
                      maxLength={100000}
                      disabled={isSubmitting}
                      required 
                      aria-describedby="transcript-hint"
                    />
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Min {MIN_TRANSCRIPT_LENGTH} characters for meaningful analysis</span>
                        <span className={normalizedTranscript.length < MIN_TRANSCRIPT_LENGTH ? 'text-amber-500' : 'text-muted-foreground'}>
                          {normalizedTranscript.length.toLocaleString()} / {MIN_TRANSCRIPT_LENGTH.toLocaleString()} min
                        </span>
                      </div>
                      <Progress 
                        value={transcriptProgress} 
                        className="h-1.5"
                        aria-label="Transcript length progress"
                      />
                      {normalizedTranscript.length > 0 && normalizedTranscript.length < MIN_TRANSCRIPT_LENGTH && (
                        <p id="transcript-hint" className="text-xs text-amber-500">
                          Add {(MIN_TRANSCRIPT_LENGTH - normalizedTranscript.length).toLocaleString()} more characters for analysis
                        </p>
                      )}
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
                  <div className="space-y-3">
                    <Button 
                      type="submit" 
                      disabled={!canSubmit} 
                      className="w-full h-12 text-lg" 
                      size="lg"
                    >
                      {isSubmitting ? <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Analyzing Call...
                        </> : <>
                          <Send className="mr-2 h-5 w-5" />
                          Analyze Call
                        </>}
                    </Button>
                    
                    {/* Validation hints with aria-live for accessibility */}
                    <div aria-live="polite" aria-atomic="true">
                      {!canSubmit && validationHints.length > 0 && !isSubmitting && (
                        <p className="text-xs text-muted-foreground text-center">
                          Missing: {validationHints.join(', ')}
                        </p>
                      )}
                    </div>
                    
                    {/* Clear Form button and draft age */}
                    <div className="flex items-center justify-between">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowClearConfirm(true)}
                        disabled={!isDirty() && !hasDraft}
                        className="text-muted-foreground"
                      >
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                        Clear Form
                      </Button>
                      
                      {/* Draft age indicator */}
                      {isDirty() && getDraftAge() && (
                        <span className="text-xs text-muted-foreground">
                          Draft saved {getDraftAge()}
                        </span>
                      )}
                    </div>
                    
                    {/* Keyboard shortcut hint */}
                    <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                      <Keyboard className="h-3 w-3" />
                      Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">⌘</kbd>+<kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Enter</kbd> to submit
                    </p>
                  </div>
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
    </AppLayout>
  );
}

export default withPageErrorBoundary(RepDashboard, 'Dashboard');
