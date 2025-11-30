import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";
import { Card, CardContent, CardHeader } from "./card";

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
};
