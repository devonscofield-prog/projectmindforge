import { cn } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";
import { Card, CardContent, CardHeader } from "./card";
import { Badge } from "./badge";

/**
 * Skeleton for stat cards (e.g., dashboard KPIs)
 */
function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-3 w-20 mt-2" />
      </CardContent>
    </Card>
  );
}

/**
 * Grid of stat card skeletons
 */
function StatCardGridSkeleton({ 
  count = 4, 
  columns = "md:grid-cols-4" 
}: { 
  count?: number; 
  columns?: string;
}) {
  return (
    <div className={cn("grid gap-4 grid-cols-2", columns)}>
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for table rows
 */
function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 py-4 border-b border-border">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-5",
            i === 0 ? "w-32" : i === columns - 1 ? "w-8" : "w-20"
          )}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton for table with multiple rows
 */
function TableSkeleton({ 
  rows = 5, 
  columns = 5,
  showHeader = true,
}: { 
  rows?: number; 
  columns?: number;
  showHeader?: boolean;
}) {
  return (
    <div className="space-y-2">
      {showHeader && (
        <div className="flex items-center gap-4 py-3 border-b-2 border-border">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn(
                "h-4",
                i === 0 ? "w-28" : i === columns - 1 ? "w-8" : "w-16"
              )}
            />
          ))}
        </div>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} columns={columns} />
      ))}
    </div>
  );
}

/**
 * Skeleton for list items (cards)
 */
function ListItemSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-start gap-4">
        <Skeleton className="h-10 w-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-2 mt-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-8 w-8 rounded" />
      </div>
    </Card>
  );
}

/**
 * Skeleton for list of items
 */
function ListSkeleton({ 
  count = 5,
  className,
}: { 
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <ListItemSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for chart/graph areas
 */
function ChartSkeleton({ 
  height = "h-64",
  className,
}: { 
  height?: string;
  className?: string;
}) {
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className={cn("w-full rounded-lg", height)} />
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton for page header with title and description
 */
function PageHeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
    </div>
  );
}

/**
 * Skeleton for form fields
 */
function FormFieldSkeleton({ label = true }: { label?: boolean }) {
  return (
    <div className="space-y-2">
      {label && <Skeleton className="h-4 w-20" />}
      <Skeleton className="h-10 w-full rounded-md" />
    </div>
  );
}

/**
 * Skeleton for a card with content
 */
function ContentCardSkeleton({ 
  lines = 3,
  className,
}: { 
  lines?: number;
  className?: string;
}) {
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-60" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton 
            key={i} 
            className={cn("h-4", i === lines - 1 ? "w-3/4" : "w-full")} 
          />
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * Full page loading skeleton
 */
function PageSkeleton({ 
  showStats = true,
  showChart = true,
  showList = true,
}: { 
  showStats?: boolean;
  showChart?: boolean;
  showList?: boolean;
}) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading page content">
      <PageHeaderSkeleton />
      {showStats && <StatCardGridSkeleton count={4} />}
      {showChart && <ChartSkeleton />}
      {showList && (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <ListSkeleton count={5} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Skeleton for breadcrumb navigation
 */
function BreadcrumbSkeleton() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/50">
      <Skeleton className="h-4 w-4 rounded" />
      <Skeleton className="h-4 w-24 hidden sm:block" />
      <Skeleton className="h-3 w-3" />
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

/**
 * Dashboard page skeleton with stats and content
 */
function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse-subtle">
      <BreadcrumbSkeleton />
      <PageHeaderSkeleton />
      <StatCardGridSkeleton count={4} />
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartSkeleton height="h-72" />
        <ContentCardSkeleton lines={5} />
      </div>
    </div>
  );
}

/**
 * List page skeleton (accounts, users, etc.)
 */
function ListPageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse-subtle">
      <BreadcrumbSkeleton />
      <PageHeaderSkeleton />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-24" />
          </div>
        </CardHeader>
        <CardContent>
          <TableSkeleton rows={8} columns={6} />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Detail page skeleton (account detail, call detail, etc.)
 */
function DetailPageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse-subtle">
      <BreadcrumbSkeleton />
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <StatCardGridSkeleton count={4} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <ContentCardSkeleton lines={4} />
          <ContentCardSkeleton lines={6} />
        </div>
        <div className="space-y-6">
          <ContentCardSkeleton lines={5} />
          <ContentCardSkeleton lines={3} />
        </div>
      </div>
    </div>
  );
}

/**
 * Form page skeleton
 */
function FormPageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse-subtle">
      <BreadcrumbSkeleton />
      <PageHeaderSkeleton />
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormFieldSkeleton />
            <FormFieldSkeleton />
          </div>
          <FormFieldSkeleton />
          <Skeleton className="h-32 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Mobile call card skeleton
 */
function MobileCallCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-24" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-12" />
            </div>
          </div>
          <Skeleton className="h-5 w-5 shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Mobile call card list skeleton
 */
function MobileCallListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <MobileCallCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Stakeholder card skeleton
 */
function StakeholderCardSkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 p-2 rounded-lg border">
        <Skeleton className="h-8 w-8 rounded-full shrink-0" />
        <div className="flex-1 min-w-0 space-y-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-4 w-4" />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <div className="space-y-3">
          <div>
            <Skeleton className="h-3 w-24 mb-1" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-2 w-20 rounded-full" />
              <Skeleton className="h-4 w-10" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-32" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Stakeholder list skeleton
 */
function StakeholderListSkeleton({ 
  count = 4, 
  compact = false 
}: { 
  count?: number; 
  compact?: boolean;
}) {
  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      {Array.from({ length: count }).map((_, i) => (
        <StakeholderCardSkeleton key={i} compact={compact} />
      ))}
    </div>
  );
}

/**
 * Follow-up item skeleton
 */
function FollowUpItemSkeleton() {
  return (
    <div className="border rounded-lg p-4 bg-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>
    </div>
  );
}

/**
 * Follow-up list skeleton
 */
function FollowUpListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <FollowUpItemSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * KPI card skeleton with progress bar
 */
function KPICardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2 mb-3">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-4 w-12" />
        </div>
        <Skeleton className="h-3 w-full rounded-full" />
        <div className="flex items-center justify-between mt-3">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * KPI card grid skeleton
 */
function KPICardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <KPICardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Mobile prospect card skeleton
 */
function MobileProspectCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <Skeleton className="h-4 w-28" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
          <Skeleton className="h-5 w-5 shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Mobile prospect list skeleton
 */
function MobileProspectListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <MobileProspectCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Coaching insight card skeleton
 */
function CoachingInsightSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Coaching insight list skeleton
 */
function CoachingInsightListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <CoachingInsightSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Activity log item skeleton
 */
function ActivityItemSkeleton() {
  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0">
      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
      <div className="flex-1 space-y-1">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

/**
 * Activity log skeleton
 */
function ActivityLogSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <ActivityItemSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Transcript row skeleton for analysis page
 */
function TranscriptRowSkeleton() {
  return (
    <div className="flex items-center gap-4 py-3 border-b">
      <Skeleton className="h-4 w-4 rounded" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-4 w-20" />
    </div>
  );
}

/**
 * Transcript table skeleton
 */
function TranscriptTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-4 py-3 border-b-2">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-4 w-16" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <TranscriptRowSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Chat message skeleton
 */
function ChatMessageSkeleton({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
      <div className={cn("space-y-2 max-w-[80%]", isUser && "items-end")}>
        <Skeleton className={cn("h-4 w-48", isUser && "ml-auto")} />
        <Skeleton className={cn("h-4 w-64", isUser && "ml-auto")} />
        <Skeleton className={cn("h-4 w-32", isUser && "ml-auto")} />
      </div>
    </div>
  );
}

/**
 * Chat panel skeleton
 */
function ChatPanelSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-4 p-4">
        <ChatMessageSkeleton />
        <ChatMessageSkeleton isUser />
        <ChatMessageSkeleton />
      </div>
      <div className="p-4 border-t">
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    </div>
  );
}

/**
 * Filter bar skeleton
 */
function FilterBarSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <Skeleton className="h-10 flex-1 rounded-md" />
          <Skeleton className="h-10 w-[150px] rounded-md" />
          <Skeleton className="h-10 w-[150px] rounded-md" />
          <Skeleton className="h-10 w-[150px] rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Call analysis page skeleton
 */
function CallAnalysisPageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse-subtle">
      <BreadcrumbSkeleton />
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>
      <StatCardGridSkeleton count={5} columns="md:grid-cols-5" />
      <div className="grid gap-6 lg:grid-cols-2">
        <ContentCardSkeleton lines={6} />
        <ContentCardSkeleton lines={5} />
      </div>
      <ContentCardSkeleton lines={8} />
    </div>
  );
}

/**
 * Coaching summary page skeleton
 */
function CoachingSummaryPageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse-subtle">
      <BreadcrumbSkeleton />
      <PageHeaderSkeleton />
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-40" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28 rounded-md" />
              <Skeleton className="h-9 w-28 rounded-md" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <ContentCardSkeleton lines={4} />
          <div className="grid gap-4 md:grid-cols-2">
            <ChartSkeleton height="h-48" />
            <ChartSkeleton height="h-48" />
          </div>
          <CoachingInsightListSkeleton count={4} />
        </CardContent>
      </Card>
    </div>
  );
}

export {
  StatCardSkeleton,
  StatCardGridSkeleton,
  TableRowSkeleton,
  TableSkeleton,
  ListItemSkeleton,
  ListSkeleton,
  ChartSkeleton,
  PageHeaderSkeleton,
  FormFieldSkeleton,
  ContentCardSkeleton,
  PageSkeleton,
  BreadcrumbSkeleton,
  DashboardSkeleton,
  ListPageSkeleton,
  DetailPageSkeleton,
  FormPageSkeleton,
  // Mobile & Component-specific skeletons
  MobileCallCardSkeleton,
  MobileCallListSkeleton,
  StakeholderCardSkeleton,
  StakeholderListSkeleton,
  FollowUpItemSkeleton,
  FollowUpListSkeleton,
  KPICardSkeleton,
  KPICardGridSkeleton,
  MobileProspectCardSkeleton,
  MobileProspectListSkeleton,
  CoachingInsightSkeleton,
  CoachingInsightListSkeleton,
  ActivityItemSkeleton,
  ActivityLogSkeleton,
  TranscriptRowSkeleton,
  TranscriptTableSkeleton,
  ChatMessageSkeleton,
  ChatPanelSkeleton,
  FilterBarSkeleton,
  // Page-specific skeletons
  CallAnalysisPageSkeleton,
  CoachingSummaryPageSkeleton,
};
