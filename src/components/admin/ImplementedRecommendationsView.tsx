import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Trash2,
  BarChart3,
  Clock,
} from 'lucide-react';
import {
  getImplementedRecommendations,
  measureRecommendationImpact,
  deleteImplementedRecommendation,
  type ImplementedRecommendation,
  type BaselineMetrics,
} from '@/api/implementedRecommendations';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

const priorityColors = {
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  low: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
} as const;

function MetricComparison({
  label,
  before,
  after,
  unit,
  lowerIsBetter = true,
}: {
  label: string;
  before: number;
  after: number;
  unit: string;
  lowerIsBetter?: boolean;
}) {
  const diff = before - after;
  const percentChange = before > 0 ? (diff / before) * 100 : 0;
  const improved = lowerIsBetter ? diff > 0 : diff < 0;
  const isStable = Math.abs(percentChange) < 5;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Before</div>
          <div className="font-mono">
            {before}
            {unit}
          </div>
        </div>
        <div className="flex items-center">
          {isStable ? (
            <Minus className="h-4 w-4 text-muted-foreground" />
          ) : improved ? (
            <TrendingDown className="h-4 w-4 text-emerald-500" />
          ) : (
            <TrendingUp className="h-4 w-4 text-destructive" />
          )}
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">After</div>
          <div className={`font-mono ${improved ? 'text-emerald-500' : isStable ? '' : 'text-destructive'}`}>
            {after}
            {unit}
          </div>
        </div>
        <Badge
          variant="outline"
          className={
            isStable
              ? ''
              : improved
              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
              : 'bg-destructive/10 text-destructive border-destructive/20'
          }
        >
          {isStable ? '~0%' : `${improved ? '-' : '+'}${Math.abs(percentChange).toFixed(1)}%`}
        </Badge>
      </div>
    </div>
  );
}

function ComparisonDialog({
  recommendation,
  open,
  onOpenChange,
}: {
  recommendation: ImplementedRecommendation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!recommendation) return null;

  const baseline = recommendation.baseline_metrics as BaselineMetrics;
  const post = recommendation.post_metrics as BaselineMetrics | null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Performance Comparison
          </DialogTitle>
          <DialogDescription>{recommendation.recommendation_title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Timeline */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              <Clock className="h-4 w-4 inline mr-1" />
              Implemented: {format(new Date(recommendation.implemented_at), 'MMM d, yyyy HH:mm')}
            </div>
            {recommendation.measured_at && (
              <div>
                Measured: {format(new Date(recommendation.measured_at), 'MMM d, yyyy HH:mm')}
              </div>
            )}
          </div>

          {/* Overall Improvement */}
          {recommendation.improvement_percent !== null && (
            <div
              className={`p-4 rounded-lg text-center ${
                recommendation.improvement_percent > 0
                  ? 'bg-emerald-500/10 border border-emerald-500/20'
                  : recommendation.improvement_percent < -5
                  ? 'bg-destructive/10 border border-destructive/20'
                  : 'bg-muted'
              }`}
            >
              <div className="text-3xl font-bold">
                {recommendation.improvement_percent > 0 ? '+' : ''}
                {recommendation.improvement_percent.toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground">
                {recommendation.improvement_percent > 0
                  ? 'Overall Improvement'
                  : recommendation.improvement_percent < -5
                  ? 'Performance Regression'
                  : 'No Significant Change'}
              </div>
            </div>
          )}

          {/* Detailed Metrics */}
          {post ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Metric Breakdown</h4>
              <MetricComparison
                label="Query Time"
                before={baseline.avgQueryTime}
                after={post.avgQueryTime}
                unit="ms"
              />
              <MetricComparison
                label="Edge Function Time"
                before={baseline.avgEdgeFunctionTime}
                after={post.avgEdgeFunctionTime}
                unit="ms"
              />
              <MetricComparison
                label="Error Rate"
                before={baseline.errorRate}
                after={post.errorRate}
                unit="%"
              />
              <MetricComparison
                label="P99 Latency"
                before={baseline.p99Latency}
                after={post.p99Latency}
                unit="ms"
              />
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2" />
              <p>No post-implementation metrics yet.</p>
              <p className="text-sm">Click "Measure Impact" to capture current metrics.</p>
            </div>
          )}

          {/* Notes */}
          {recommendation.notes && (
            <div>
              <h4 className="text-sm font-medium mb-1">Notes</h4>
              <p className="text-sm text-muted-foreground">{recommendation.notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ImplementedRecommendationsView() {
  const [selectedRecommendation, setSelectedRecommendation] =
    useState<ImplementedRecommendation | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data: recommendations, isLoading } = useQuery({
    queryKey: ['implemented-recommendations'],
    queryFn: getImplementedRecommendations,
  });

  const measureMutation = useMutation({
    mutationFn: measureRecommendationImpact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['implemented-recommendations'] });
      toast.success('Impact measured successfully');
    },
    onError: () => {
      toast.error('Failed to measure impact');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteImplementedRecommendation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['implemented-recommendations'] });
      toast.success('Recommendation removed');
    },
    onError: () => {
      toast.error('Failed to delete recommendation');
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Implemented Optimizations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const implementedRecs = recommendations || [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Implemented Optimizations
          </CardTitle>
          <CardDescription>
            Track and measure the impact of your performance improvements
          </CardDescription>
        </CardHeader>
        <CardContent>
          {implementedRecs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No optimizations tracked yet.</p>
              <p className="text-sm">
                Mark recommendations as "Implemented" to track their impact.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Optimization</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Implemented</TableHead>
                    <TableHead>Impact</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {implementedRecs.map((rec) => (
                    <TableRow key={rec.id}>
                      <TableCell>
                        <button
                          className="text-left hover:underline font-medium"
                          onClick={() => {
                            setSelectedRecommendation(rec);
                            setDialogOpen(true);
                          }}
                        >
                          {rec.recommendation_title}
                        </button>
                        <div className="text-xs text-muted-foreground capitalize">
                          {rec.recommendation_category.replace('_', ' ')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={priorityColors[rec.recommendation_priority as keyof typeof priorityColors] || ''}
                        >
                          {rec.recommendation_priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(rec.implemented_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        {rec.improvement_percent !== null ? (
                          <Badge
                            variant="outline"
                            className={
                              rec.improvement_percent > 0
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                : rec.improvement_percent < -5
                                ? 'bg-destructive/10 text-destructive border-destructive/20'
                                : ''
                            }
                          >
                            {rec.improvement_percent > 0 ? '+' : ''}
                            {rec.improvement_percent.toFixed(1)}%
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not measured</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {rec.status === 'implemented' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => measureMutation.mutate(rec.id)}
                              disabled={measureMutation.isPending}
                            >
                              Measure Impact
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(rec.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ComparisonDialog
        recommendation={selectedRecommendation}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
