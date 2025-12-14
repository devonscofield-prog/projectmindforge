import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function ManagerDashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6" aria-busy="true" aria-label="Loading dashboard">
      {/* Page Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-80" />
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>

      {/* Summary Cards - 2 column grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Total Reps Card */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-9 w-12" />
            <Skeleton className="h-3 w-32 mt-2" />
          </CardContent>
        </Card>

        {/* Calls (30d) Card */}
        <Card className="border-l-4 border-l-muted-foreground">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-3 w-28 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Team Table Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-10 w-[180px]" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {/* Table Header */}
            <div className="flex items-center gap-4 px-4 py-3 bg-muted/50 border-b">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20 ml-auto" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
            </div>

            {/* Table Rows - 5 skeleton rows */}
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`flex items-center gap-4 px-4 py-4 border-b last:border-b-0 ${
                  i % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                }`}
              >
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-8 w-8 rounded-full ml-auto" />
                <div className="flex flex-col items-center gap-1">
                  <Skeleton className="h-5 w-10 rounded-full" />
                  <Skeleton className="h-3 w-12" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-8 w-24 rounded-md" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
