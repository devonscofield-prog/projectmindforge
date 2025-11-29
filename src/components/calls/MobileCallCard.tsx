import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Clock, ChevronRight } from 'lucide-react';
import { CallType, callTypeLabels } from '@/constants/callTypes';

interface MobileCallCardProps {
  call: {
    id: string;
    call_date: string;
    primary_stakeholder_name?: string | null;
    account_name?: string | null;
    call_type?: string | null;
    call_type_other?: string | null;
    potential_revenue?: number | null;
    analysis_status: string;
  };
  onClick: () => void;
}

export function MobileCallCard({ call, onClick }: MobileCallCardProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="gap-1 text-xs"><CheckCircle className="h-3 w-3" /> Analyzed</Badge>;
      case 'processing':
        return <Badge variant="secondary" className="gap-1 text-xs"><Clock className="h-3 w-3" /> Processing</Badge>;
      case 'error':
        return <Badge variant="destructive" className="gap-1 text-xs"><AlertCircle className="h-3 w-3" /> Error</Badge>;
      default:
        return <Badge variant="outline" className="gap-1 text-xs"><Clock className="h-3 w-3" /> Pending</Badge>;
    }
  };

  const getCallTypeDisplay = () => {
    if (call.call_type === 'other' && call.call_type_other) {
      return call.call_type_other;
    }
    if (call.call_type) {
      return callTypeLabels[call.call_type as CallType] || call.call_type;
    }
    return '-';
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return null;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card 
      className="cursor-pointer hover:bg-muted/50 active:bg-muted/70 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium truncate">
                {call.account_name || call.primary_stakeholder_name || 'Unknown'}
              </p>
              {getStatusBadge(call.analysis_status)}
            </div>
            
            {call.account_name && call.primary_stakeholder_name && (
              <p className="text-sm text-muted-foreground truncate">
                {call.primary_stakeholder_name}
              </p>
            )}
            
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>{format(new Date(call.call_date), 'MMM d, yyyy')}</span>
              <Badge variant="outline" className="text-xs">{getCallTypeDisplay()}</Badge>
              {formatCurrency(call.potential_revenue) && (
                <span className="text-green-600">{formatCurrency(call.potential_revenue)}</span>
              )}
            </div>
          </div>
          
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}
