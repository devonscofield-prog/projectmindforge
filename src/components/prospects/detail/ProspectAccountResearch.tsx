import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { StructuredResearchDisplay } from '@/components/prospects/research';
import { isStructuredAccountResearch, type StructuredAccountResearch } from '@/types/accountResearch';
import { AnalysisMessageRenderer } from '@/components/admin/AnalysisMessageRenderer';
import type { Prospect } from '@/api/prospects';

interface ProspectAccountResearchProps {
  prospect: Prospect;
  onResearchAccount?: () => void;
}

export function ProspectAccountResearch({
  prospect,
  onResearchAccount,
}: ProspectAccountResearchProps) {
  const aiInfo = prospect.ai_extracted_info as {
    account_research?: StructuredAccountResearch | string;
    account_research_generated_at?: string;
    account_research_date?: string;
  } | null;

  const research = aiInfo?.account_research;
  const isStructured = isStructuredAccountResearch(research);
  const researchDate = aiInfo?.account_research_generated_at || aiInfo?.account_research_date
    ? new Date(aiInfo.account_research_generated_at || aiInfo.account_research_date!)
    : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Account Research
          </CardTitle>
          {researchDate && (
            <CardDescription>
              Researched {format(researchDate, 'MMM d, yyyy h:mm a')}
            </CardDescription>
          )}
        </div>
        {onResearchAccount && (
          <Button
            variant="outline"
            size="sm"
            onClick={onResearchAccount}
          >
            <Search className="h-4 w-4 mr-1" />
            {research ? 'Re-Research' : 'Research'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!research ? (
          <div className="text-center py-8">
            <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-3">
              No research available yet
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto mb-4">
              Research this account to get AI-powered insights including company overview, pain points, stakeholder insights, and conversation hooks.
            </p>
            {onResearchAccount && (
              <Button
                variant="outline"
                size="sm"
                onClick={onResearchAccount}
              >
                <Search className="h-4 w-4 mr-2" />
                Research Account
              </Button>
            )}
          </div>
        ) : isStructured ? (
          <StructuredResearchDisplay research={research as StructuredAccountResearch} />
        ) : (
          // Legacy markdown research - still render with old renderer
          <AnalysisMessageRenderer content={research as string} />
        )}
      </CardContent>
    </Card>
  );
}
