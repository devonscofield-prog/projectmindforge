import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Phone, Mail, Search, UserPlus, MessageSquare, FileText } from 'lucide-react';

interface ProspectQuickActionsProps {
  onLogCall?: () => void;
  onAddEmail: () => void;
  onResearchAccount?: () => void;
  onAddStakeholder: () => void;
  onOpenSalesCoach?: () => void;
  onOpenAccountResearch?: () => void;
}

export function ProspectQuickActions({
  onLogCall,
  onAddEmail,
  onResearchAccount,
  onAddStakeholder,
  onOpenSalesCoach,
  onOpenAccountResearch,
}: ProspectQuickActionsProps) {
  return (
    <Card className="sticky top-4 z-10 shadow-md">
      <CardContent className="p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {onLogCall && (
              <Button size="sm" onClick={onLogCall} className="gap-2">
                <Phone className="h-4 w-4" />
                <span className="hidden sm:inline">Log Call</span>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onAddEmail} className="gap-2">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Add Email</span>
            </Button>
            <Button variant="outline" size="sm" onClick={onAddStakeholder} className="gap-2">
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Stakeholder</span>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {onResearchAccount && (
              <Button variant="outline" size="sm" onClick={onResearchAccount} className="gap-2">
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">Research</span>
              </Button>
            )}
            {onOpenSalesCoach && (
              <Button variant="ghost" size="sm" onClick={onOpenSalesCoach} className="gap-2">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Coach</span>
              </Button>
            )}
            {onOpenAccountResearch && (
              <Button variant="ghost" size="sm" onClick={onOpenAccountResearch} className="gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">AI Notes</span>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
