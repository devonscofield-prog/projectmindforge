import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Lightbulb,
  RefreshCw,
  Database,
  Zap,
  Clock,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  CheckCheck,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { markRecommendationImplemented } from '@/api/implementedRecommendations';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';

interface Recommendation {
  title: string;
  priority: 'high' | 'medium' | 'low';
  category: 'database' | 'edge_function' | 'caching' | 'error_handling' | 'scaling';
  impact: string;
  effort: string;
  description: string;
  action: string;
  affectedOperations: string[];
}

interface AnalysisResult {
  recommendations: Recommendation[];
  summary: string;
  healthScore: number;
}

const priorityColors = {
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  low: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
} as const;

const categoryIcons = {
  database: Database,
  edge_function: Zap,
  caching: Clock,
  error_handling: AlertTriangle,
  scaling: TrendingUp,
} as const;

const categoryLabels = {
  database: 'Database',
  edge_function: 'Edge Function',
  caching: 'Caching',
  error_handling: 'Error Handling',
  scaling: 'Scaling',
} as const;

function getHealthColor(score: number): string {
  if (score >= 80) return 'text-emerald-500';
  if (score >= 60) return 'text-yellow-500';
  if (score >= 40) return 'text-orange-500';
  return 'text-destructive';
}

function getHealthLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Needs Attention';
}

const logger = createLogger('PerformanceRecommendations');

async function fetchRecommendations(): Promise<AnalysisResult> {
  const { data, error } = await supabase.functions.invoke('analyze-performance');

  if (error) {
    logger.error('Error fetching recommendations', { error });
    throw error;
  }

  return data as AnalysisResult;
}

export function PerformanceRecommendations() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const {
    data: analysis,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['performance-recommendations'],
    queryFn: fetchRecommendations,
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    retry: 1,
  });

  const implementMutation = useMutation({
    mutationFn: (rec: Recommendation) =>
      markRecommendationImplemented({
        title: rec.title,
        category: rec.category,
        priority: rec.priority,
        action: rec.action,
        affectedOperations: rec.affectedOperations || [],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['implemented-recommendations'] });
      toast.success('Recommendation marked as implemented. Baseline metrics captured.');
    },
    onError: () => {
      toast.error('Failed to mark recommendation as implemented');
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast.success('Recommendations updated');
    } catch (e) {
      toast.error('Failed to refresh recommendations');
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              <CardTitle className="text-base">AI Recommendations</CardTitle>
            </div>
          </div>
          <CardDescription>Analyzing performance patterns...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              <CardTitle className="text-base">AI Recommendations</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
            <p>Unable to generate recommendations.</p>
            <p className="text-sm">Please try again later.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const recommendations = analysis?.recommendations || [];
  const healthScore = analysis?.healthScore || 0;
  const summary = analysis?.summary || 'No summary available';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-base">AI Recommendations</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <CardDescription>
          Automated optimization suggestions based on your performance data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Health Score */}
        <div className="p-4 rounded-lg bg-muted/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">System Health Score</span>
            <span className={`text-2xl font-bold ${getHealthColor(healthScore)}`}>
              {healthScore}/100
            </span>
          </div>
          <Progress value={healthScore} className="h-2 mb-2" />
          <div className="flex items-center justify-between text-sm">
            <span className={getHealthColor(healthScore)}>{getHealthLabel(healthScore)}</span>
            <span className="text-muted-foreground">{summary}</span>
          </div>
        </div>

        {/* Recommendations */}
        {recommendations.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-500" />
            <p className="font-medium">No issues detected!</p>
            <p className="text-sm">Your system is performing well.</p>
          </div>
        ) : (
          <Accordion type="single" collapsible className="space-y-2">
            {recommendations.map((rec, index) => {
              const CategoryIcon = categoryIcons[rec.category] || Lightbulb;

              return (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="border rounded-lg px-4"
                >
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-3 text-left">
                      <CategoryIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{rec.title}</span>
                          <Badge
                            variant="outline"
                            className={priorityColors[rec.priority]}
                          >
                            {rec.priority}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span>{categoryLabels[rec.category]}</span>
                          <span>•</span>
                          <span>Impact: {rec.impact}</span>
                          <span>•</span>
                          <span>Effort: {rec.effort}</span>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="space-y-4 pt-2">
                      <div>
                        <h4 className="text-sm font-medium mb-1">Issue</h4>
                        <p className="text-sm text-muted-foreground">{rec.description}</p>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium mb-1 flex items-center gap-1">
                          <ArrowRight className="h-3 w-3" />
                          Recommended Action
                        </h4>
                        <p className="text-sm text-muted-foreground">{rec.action}</p>
                      </div>

                      {rec.affectedOperations && rec.affectedOperations.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Affected Operations</h4>
                          <div className="flex flex-wrap gap-1">
                            {rec.affectedOperations.map((op, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {op}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => implementMutation.mutate(rec)}
                          disabled={implementMutation.isPending}
                        >
                          <CheckCheck className="h-4 w-4" />
                          Mark as Implemented
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2">
                          This will capture current metrics as baseline for comparison
                        </p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Recommendations are generated by AI based on your last 24 hours of performance data.
        </p>
      </CardContent>
    </Card>
  );
}
