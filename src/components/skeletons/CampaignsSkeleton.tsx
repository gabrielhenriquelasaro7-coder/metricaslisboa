import { Skeleton } from '@/components/ui/skeleton';

export function CampaignsSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Campaign Cards */}
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="glass-card p-4">
            <div className="flex items-center gap-4">
              {/* Status indicator */}
              <Skeleton className="h-3 w-3 rounded-full" />
              
              {/* Campaign info */}
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-64" />
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>

              {/* Metrics */}
              <div className="hidden md:flex gap-8">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="text-center space-y-1">
                    <Skeleton className="h-3 w-12 mx-auto" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                ))}
              </div>

              {/* Actions */}
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}