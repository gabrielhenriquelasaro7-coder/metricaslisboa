import { Skeleton } from '@/components/ui/skeleton';

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 bg-muted/40" />
          <Skeleton className="h-4 w-32 bg-muted/30" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32 bg-muted/40" />
          <Skeleton className="h-10 w-10 bg-muted/40" />
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="premium-card p-3 sm:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-16 bg-muted/30" />
              <Skeleton className="h-9 w-9 rounded-xl bg-muted/20" />
            </div>
            <Skeleton className="h-6 w-24 bg-muted/40" />
            <Skeleton className="h-10 w-full rounded bg-muted/20" />
          </div>
        ))}
      </div>

      {/* Results Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="w-1 h-6 rounded-full bg-emerald-500/30" />
          <Skeleton className="h-5 w-24 bg-muted/40" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="premium-card p-3 sm:p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-16 bg-muted/30" />
                <Skeleton className="h-9 w-9 rounded-xl bg-muted/20" />
              </div>
              <Skeleton className="h-6 w-24 bg-muted/40" />
              <Skeleton className="h-10 w-full rounded bg-muted/20" />
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="premium-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32 bg-muted/40" />
          <Skeleton className="h-8 w-24 bg-muted/30" />
        </div>
        <Skeleton className="h-64 w-full rounded-lg bg-muted/20" />
      </div>
    </div>
  );
}

// Skeleton for individual metric cards (inline loading)
export function MetricCardSkeleton() {
  return (
    <div className="premium-card p-3 sm:p-4 space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-16 bg-muted/30" />
        <Skeleton className="h-9 w-9 rounded-xl bg-muted/20" />
      </div>
      <Skeleton className="h-6 w-24 bg-muted/40" />
      <Skeleton className="h-10 w-full rounded bg-muted/20" />
    </div>
  );
}