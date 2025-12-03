import { AlertTriangle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CriticalInfoItem {
  info: string;
  missed_opportunity?: string;
}

interface CriticalInfoPanelProps {
  items: (string | CriticalInfoItem)[];
}

export function CriticalInfoPanel({ items }: CriticalInfoPanelProps) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Critical Info Missing
          <Badge variant="destructive" className="ml-auto">
            {items.length} items
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {items.map((item, index) => {
            const isObject = typeof item === 'object' && item !== null;
            const info = isObject ? item.info : item;
            const missedOpportunity = isObject ? item.missed_opportunity : null;
            
            return (
              <li key={index} className="space-y-1">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{info}</p>
                    {missedOpportunity && (
                      <p className="text-xs text-muted-foreground mt-1 pl-0 border-l-2 border-destructive/30 ml-0 italic">
                        <span className="pl-2 block">⚠️ {missedOpportunity}</span>
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
