import { useState, useEffect, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RateLimitCountdown } from '@/components/ui/rate-limit-countdown';
import { Search, Loader2, ChevronDown, Plus, X, Building2, Save, History, RefreshCw, Check } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fetchAccountResearch, type AccountResearchRequest } from '@/api/accountResearch';
import { useRateLimitCountdown } from '@/hooks/useRateLimitCountdown';
import { industryOptions } from '@/components/prospects/detail/constants';
import { ResearchLoadingSkeleton, StructuredResearchDisplay } from '@/components/prospects/research';
import { isStructuredAccountResearch, type StructuredAccountResearch } from '@/types/accountResearch';
import type { Prospect } from '@/api/prospects';
import type { Stakeholder } from '@/api/stakeholders';

const DEAL_STAGES = [
  'Prospecting',
  'Discovery',
  'Demo Scheduled',
  'Proposal',
  'Negotiation',
  'Closed Won',
  'Closed Lost',
];

interface AccountResearchChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospect?: Prospect | null;
  stakeholders?: Stakeholder[];
  onSaveResearch?: (research: StructuredAccountResearch) => Promise<boolean>;
}

interface StakeholderInput {
  name: string;
  title: string;
  role: string;
}

export function AccountResearchChat({
  open,
  onOpenChange,
  prospect,
  stakeholders = [],
  onSaveResearch,
}: AccountResearchChatProps) {
  // Form state
  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [industry, setIndustry] = useState('');
  const [stakeholderInputs, setStakeholderInputs] = useState<StakeholderInput[]>([]);
  const [productPitch, setProductPitch] = useState('');
  const [dealStage, setDealStage] = useState('');
  const [knownChallenges, setKnownChallenges] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  // UI state
  const [isResearching, setIsResearching] = useState(false);
  const [researchResult, setResearchResult] = useState<StructuredAccountResearch | null>(null);
  const [showForm, setShowForm] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [viewMode, setViewMode] = useState<'previous' | 'new' | 'result'>('previous');
  
  // Rate limiting
  const { secondsRemaining, isRateLimited, startCountdown } = useRateLimitCountdown(60);

  // Get saved research from prospect - handle both structured and legacy string formats
  const savedResearch = useMemo(() => {
    const aiInfo = prospect?.ai_extracted_info as {
      account_research?: StructuredAccountResearch | string;
      account_research_generated_at?: string;
      account_research_date?: string;
    } | null;
    
    if (aiInfo?.account_research) {
      const dateStr = aiInfo.account_research_generated_at || aiInfo.account_research_date;
      const content = aiInfo.account_research;
      
      // Check if it's structured research
      if (isStructuredAccountResearch(content)) {
        return {
          content,
          isStructured: true,
          date: dateStr ? new Date(dateStr) : null,
        };
      }
      
      // Legacy string format - return null to force new research
      return null;
    }
    return null;
  }, [prospect?.ai_extracted_info]);

  // Initialize form from prospect data when opening
  useEffect(() => {
    if (open) {
      setCompanyName(prospect?.account_name || prospect?.prospect_name || '');
      setWebsite((prospect as any)?.website || '');
      setIndustry(prospect?.industry || '');
      
      // Auto-populate stakeholders
      const initialStakeholders = stakeholders.map(s => ({
        name: s.name,
        title: s.job_title || '',
        role: s.influence_level === 'final_dm' ? 'Decision Maker' 
            : s.influence_level === 'secondary_dm' ? 'Secondary DM'
            : s.influence_level === 'heavy_influencer' ? 'Heavy Influencer'
            : 'Influencer',
      }));
      setStakeholderInputs(initialStakeholders);

      // Pre-populate known challenges from AI insights
      const aiInfo = prospect?.ai_extracted_info as { pain_points?: string[] } | null;
      if (aiInfo?.pain_points?.length) {
        setKnownChallenges(aiInfo.pain_points.join(', '));
      }

      // Reset results and determine initial view
      setResearchResult(null);
      setSaved(false);
      
      // If there's saved structured research, show it by default; otherwise show form
      if (savedResearch?.isStructured) {
        setViewMode('previous');
        setShowForm(false);
      } else {
        setViewMode('new');
        setShowForm(true);
      }
    }
  }, [open, prospect, stakeholders, savedResearch]);

  const handleAddStakeholder = () => {
    setStakeholderInputs([...stakeholderInputs, { name: '', title: '', role: '' }]);
  };

  const handleRemoveStakeholder = (index: number) => {
    setStakeholderInputs(stakeholderInputs.filter((_, i) => i !== index));
  };

  const handleStakeholderChange = (index: number, field: keyof StakeholderInput, value: string) => {
    const updated = [...stakeholderInputs];
    updated[index][field] = value;
    setStakeholderInputs(updated);
  };

  const handleStartResearch = async () => {
    if (!companyName.trim()) {
      toast.error('Company name is required');
      return;
    }

    if (isRateLimited) {
      toast.error(`Please wait ${secondsRemaining} seconds before researching again`);
      return;
    }

    setIsResearching(true);
    setResearchResult(null);
    setShowForm(false);
    setSaved(false);
    setViewMode('result');

    // Helper to ensure website has a protocol for URL validation
    const normalizeWebsite = (url: string): string | undefined => {
      const trimmed = url.trim();
      if (!trimmed) return undefined;
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
      return `https://${trimmed}`;
    };

    const request: AccountResearchRequest = {
      companyName: companyName.trim(),
      website: normalizeWebsite(website),
      industry: industry || undefined,
      stakeholders: stakeholderInputs
        .filter(s => s.name.trim())
        .map(s => ({
          name: s.name.trim(),
          title: s.title.trim() || undefined,
          role: s.role.trim() || undefined,
        })),
      productPitch: productPitch.trim() || undefined,
      dealStage: dealStage || undefined,
      knownChallenges: knownChallenges.trim() || undefined,
      additionalNotes: additionalNotes.trim() || undefined,
    };

    try {
      const research = await fetchAccountResearch(request);
      setResearchResult(research);
      setIsResearching(false);
      
      // Auto-save if callback exists
      if (onSaveResearch && prospect) {
        try {
          const success = await onSaveResearch(research);
          if (success) {
            setSaved(true);
            toast.success('Research complete and saved');
          } else {
            toast.success('Research complete');
            toast.warning('Auto-save failed - click Save to retry');
          }
        } catch {
          toast.success('Research complete');
          toast.warning('Auto-save failed - click Save to retry');
        }
      } else {
        toast.success('Research complete');
      }
    } catch (error) {
      setIsResearching(false);
      const message = error instanceof Error ? error.message : 'Research failed';
      
      if (message.includes('Rate limit') || message.includes('429')) {
        startCountdown(60);
        toast.error('Rate limited. Please wait before trying again.');
      } else {
        toast.error(message);
      }
      setShowForm(true);
    }
  };

  const handleNewResearch = () => {
    setResearchResult(null);
    setShowForm(true);
    setSaved(false);
    setViewMode('new');
  };

  const handleViewPrevious = () => {
    if (savedResearch?.isStructured) {
      setResearchResult(null);
      setShowForm(false);
      setViewMode('previous');
      setSaved(true);
    }
  };

  const handleSaveToAccount = async () => {
    if (!onSaveResearch || !researchResult) return;
    
    setIsSaving(true);
    try {
      const success = await onSaveResearch(researchResult);
      if (success) {
        setSaved(true);
        toast.success('Research saved to account');
      } else {
        toast.error('Failed to save research');
      }
    } catch {
      toast.error('Failed to save research');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col h-full p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Account Research
          </SheetTitle>
          <SheetDescription>
            AI-powered intelligence to help you close deals
          </SheetDescription>
        </SheetHeader>

        {isRateLimited && (
          <div className="px-6 py-2 border-b bg-muted/50">
            <RateLimitCountdown secondsRemaining={secondsRemaining} />
          </div>
        )}

        <ScrollArea className="flex-1 px-6">
          <div className="py-4 space-y-6">
            {showForm ? (
              <>
                {/* Company Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Company Information
                  </h3>
                  
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="companyName">Company Name *</Label>
                      <Input
                        id="companyName"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="e.g., Acme Corporation"
                      />
                    </div>

                    <div>
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="e.g., https://acme.com"
                      />
                    </div>

                    <div>
                      <Label htmlFor="industry">Industry</Label>
                      <Select value={industry} onValueChange={setIndustry}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select industry" />
                        </SelectTrigger>
                        <SelectContent>
                          {industryOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Key People */}
                <Collapsible defaultOpen={stakeholderInputs.length > 0}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full font-semibold">
                    <span>Key People ({stakeholderInputs.length})</span>
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 space-y-3">
                    {stakeholderInputs.map((stakeholder, index) => (
                      <div key={index} className="flex gap-2 items-start">
                        <div className="flex-1 grid grid-cols-3 gap-2">
                          <Input
                            value={stakeholder.name}
                            onChange={(e) => handleStakeholderChange(index, 'name', e.target.value)}
                            placeholder="Name"
                          />
                          <Input
                            value={stakeholder.title}
                            onChange={(e) => handleStakeholderChange(index, 'title', e.target.value)}
                            placeholder="Title"
                          />
                          <Input
                            value={stakeholder.role}
                            onChange={(e) => handleStakeholderChange(index, 'role', e.target.value)}
                            placeholder="Role"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveStakeholder(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddStakeholder}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Stakeholder
                    </Button>
                  </CollapsibleContent>
                </Collapsible>

                {/* Sales Context */}
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center justify-between w-full font-semibold">
                    <span>Sales Context</span>
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 space-y-3">
                    <div>
                      <Label htmlFor="productPitch">What You're Selling</Label>
                      <Input
                        id="productPitch"
                        value={productPitch}
                        onChange={(e) => setProductPitch(e.target.value)}
                        placeholder="e.g., Sales coaching AI platform"
                      />
                    </div>

                    <div>
                      <Label htmlFor="dealStage">Deal Stage</Label>
                      <Select value={dealStage} onValueChange={setDealStage}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select stage" />
                        </SelectTrigger>
                        <SelectContent>
                          {DEAL_STAGES.map(stage => (
                            <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="knownChallenges">Known Challenges</Label>
                      <Textarea
                        id="knownChallenges"
                        value={knownChallenges}
                        onChange={(e) => setKnownChallenges(e.target.value)}
                        placeholder="What challenges do you already know about?"
                        rows={2}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Additional Notes */}
                <div>
                  <Label htmlFor="additionalNotes">Additional Notes</Label>
                  <Textarea
                    id="additionalNotes"
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder="Any other context that would help the research..."
                    rows={3}
                  />
                </div>
              </>
            ) : viewMode === 'previous' && savedResearch?.isStructured ? (
              /* Previous Saved Research */
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                  <History className="h-4 w-4" />
                  <span>
                    Saved {savedResearch.date 
                      ? format(savedResearch.date, 'MMM d, yyyy \'at\' h:mm a')
                      : 'previously'}
                  </span>
                </div>
                <StructuredResearchDisplay research={savedResearch.content} />
              </div>
            ) : (
              /* New Research Results */
              <div>
                {isResearching ? (
                  <ResearchLoadingSkeleton />
                ) : researchResult ? (
                  <StructuredResearchDisplay research={researchResult} />
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="border-t px-6 py-4 flex gap-2">
          {showForm ? (
            <>
              {savedResearch?.isStructured && (
                <Button
                  variant="outline"
                  onClick={handleViewPrevious}
                >
                  <History className="h-4 w-4 mr-2" />
                  View Previous
                </Button>
              )}
              <Button
                onClick={handleStartResearch}
                disabled={isResearching || !companyName.trim() || isRateLimited}
                className="flex-1"
              >
                {isResearching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Researching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Start Research
                  </>
                )}
              </Button>
            </>
          ) : viewMode === 'previous' ? (
            <Button
              variant="outline"
              onClick={handleNewResearch}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Run New Research
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleNewResearch}
                disabled={isResearching}
              >
                New Research
              </Button>
              {onSaveResearch && prospect && researchResult && (
                <Button
                  onClick={handleSaveToAccount}
                  disabled={isResearching || isSaving || saved}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : saved ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save to Account
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
