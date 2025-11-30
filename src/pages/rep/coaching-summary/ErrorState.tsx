import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3 } from 'lucide-react';
import { getDashboardUrl } from '@/lib/routes';

interface ErrorStateProps {
  error: Error | null;
  comparisonError: Error | null;
  isOwnSummary: boolean;
}

export function ErrorState({ error, comparisonError, isOwnSummary }: ErrorStateProps) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium">Unable to Generate Analysis</h3>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto">
          {error instanceof Error 
            ? error.message 
            : comparisonError instanceof Error 
              ? comparisonError.message 
              : 'Failed to generate coaching trends'}
        </p>
        {isOwnSummary && (
          <Button asChild className="mt-4">
            <Link to={getDashboardUrl('rep')}>Submit a Call</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
