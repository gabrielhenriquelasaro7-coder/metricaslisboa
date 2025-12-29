import { cn } from '@/lib/utils';

interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div 
      className={cn(
        "rounded-2xl border-2 border-border p-5 bg-card overflow-hidden relative",
        className
      )}
    >
      {/* Shimmer overlay */}
      <div className="absolute inset-0 shimmer-effect pointer-events-none" />
      
      {/* Header with Avatar */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-muted animate-pulse" />
          <div className="flex flex-col gap-2">
            <div className="h-5 w-32 bg-muted rounded animate-pulse" />
            <div className="h-3 w-20 bg-muted/60 rounded animate-pulse" />
          </div>
        </div>
        <div className="w-8 h-8 rounded-md bg-muted/40 animate-pulse" />
      </div>
      
      {/* Health Badge */}
      <div className="h-7 w-24 bg-muted rounded-full mb-4 animate-pulse" />
      
      {/* Sync Times Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-2.5 rounded-lg bg-secondary/30">
          <div className="h-2 w-16 bg-muted/60 rounded mb-2 animate-pulse" />
          <div className="h-4 w-20 bg-muted rounded animate-pulse" />
        </div>
        <div className="p-2.5 rounded-lg bg-secondary/30">
          <div className="h-2 w-16 bg-muted/60 rounded mb-2 animate-pulse" />
          <div className="h-4 w-20 bg-muted rounded animate-pulse" />
        </div>
      </div>
      
      {/* Footer */}
      <div className="flex items-center justify-end pt-2 border-t border-border/50">
        <div className="h-3 w-24 bg-muted/40 rounded animate-pulse" />
      </div>
    </div>
  );
}

export function SkeletonMetricCard({ className }: SkeletonCardProps) {
  return (
    <div 
      className={cn(
        "metric-card overflow-hidden relative",
        className
      )}
    >
      {/* Shimmer overlay */}
      <div className="absolute inset-0 shimmer-effect pointer-events-none" />
      
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="h-4 w-20 bg-muted/60 rounded mb-3 animate-pulse" />
          <div className="h-8 w-28 bg-muted rounded animate-pulse" />
        </div>
        <div className="w-12 h-12 rounded-xl bg-primary/10 animate-pulse" />
      </div>
      
      <div className="flex items-center gap-2">
        <div className="h-4 w-16 bg-muted/40 rounded animate-pulse" />
        <div className="h-4 w-24 bg-muted/30 rounded animate-pulse" />
      </div>
    </div>
  );
}

export function SkeletonTableRow({ columns = 8 }: { columns?: number }) {
  return (
    <tr className="border-b border-border/50">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="py-4 px-3">
          <div className={cn(
            "h-4 bg-muted rounded animate-pulse",
            i === 0 ? "w-32" : "w-16"
          )} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonProfileCard({ className }: SkeletonCardProps) {
  return (
    <div 
      className={cn(
        "rounded-2xl border border-border p-6 bg-card overflow-hidden relative",
        className
      )}
    >
      {/* Shimmer overlay */}
      <div className="absolute inset-0 shimmer-effect pointer-events-none" />
      
      {/* Avatar */}
      <div className="flex justify-center mb-6">
        <div className="w-24 h-24 rounded-full bg-muted animate-pulse" />
      </div>
      
      {/* Fields */}
      <div className="space-y-4">
        <div>
          <div className="h-3 w-16 bg-muted/60 rounded mb-2 animate-pulse" />
          <div className="h-10 w-full bg-muted rounded animate-pulse" />
        </div>
        <div>
          <div className="h-3 w-12 bg-muted/60 rounded mb-2 animate-pulse" />
          <div className="h-10 w-full bg-muted/60 rounded animate-pulse" />
        </div>
        <div>
          <div className="h-3 w-14 bg-muted/60 rounded mb-2 animate-pulse" />
          <div className="h-10 w-full bg-muted rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
