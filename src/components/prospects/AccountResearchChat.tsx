import { useState, useRef, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RateLimitCountdown } from '@/components/ui/rate-limit-countdown';
import { Search, Loader2, Copy, Check, ChevronDown, Plus, X, Building2, Save } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { streamAccountResearch, type AccountResearchRequest } from '@/api/accountResearch';
import { useRateLimitCountdown } from '@/hooks/useRateLimitCountdown';
import { industryOptions } from '@/components/prospects/detail/constants';
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
  onSaveResearch?: (research: string) => Promise<boolean>;
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
  const [researchResult, setResearchResult] = useState('');
  const [copied, setCopied] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const researchResultRef = useRef('');
  
  // Rate limiting
  const { secondsRemaining, isRateLimited, startCountdown } = useRateLimitCountdown(60);

  // Initialize form from prospect data when opening
  useEffect(() => {
    if (open) {
      setCompanyName(prospect?.account_name || prospect?.prospect_name || '');
      setWebsite((prospect as any)?.website || ''); // Use dedicated website field
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

      // Reset results
      setResearchResult('');
      setShowForm(true);
    }
  }, [open, prospect, stakeholders]);

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
    setResearchResult('');
    researchResultRef.current = '';
    setShowForm(false);
    setSaved(false);

    const request: AccountResearchRequest = {
      companyName: companyName.trim(),
      website: website.trim() || undefined,
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

    await streamAccountResearch({
      request,
      onDelta: (text) => {
        researchResultRef.current += text;
        setResearchResult(prev => prev + text);
        // Auto-scroll to bottom
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      },
      onDone: async () => {
        setIsResearching(false);
        
        // Auto-save if callback exists and we have results
        if (onSaveResearch && researchResultRef.current && prospect) {
          try {
            const success = await onSaveResearch(researchResultRef.current);
            if (success) {
              setSaved(true);
              toast.success('Research complete and saved');
            } else {
              toast.success('Research complete');
              toast.warning('Auto-save failed - click Save to retry');
            }
          } catch (err) {
            toast.success('Research complete');
            toast.warning('Auto-save failed - click Save to retry');
          }
        } else {
          toast.success('Research complete');
        }
      },
      onError: (error) => {
        setIsResearching(false);
        researchResultRef.current = '';
        if (error.message.includes('Rate limit') || error.message.includes('429')) {
          startCountdown(60);
          toast.error('Rate limited. Please wait before trying again.');
        } else {
          toast.error(error.message);
        }
        setShowForm(true);
      },
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(researchResult);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleNewResearch = () => {
    setResearchResult('');
    researchResultRef.current = '';
    setShowForm(true);
    setSaved(false);
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
    } catch (err) {
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
          <div ref={scrollContainerRef} className="py-4 space-y-6">
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
                      Add Person
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
            ) : (
              /* Research Results */
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {researchResult ? (
                  <ReactMarkdown>{researchResult}</ReactMarkdown>
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                )}
                {isResearching && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Researching...
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="border-t px-6 py-4 flex gap-2">
          {showForm ? (
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
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleNewResearch}
                disabled={isResearching}
              >
                New Research
              </Button>
              <Button
                variant="outline"
                onClick={handleCopy}
                disabled={!researchResult || isResearching}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
              {onSaveResearch && prospect && (
                <Button
                  onClick={handleSaveToAccount}
                  disabled={!researchResult || isResearching || isSaving || saved}
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
