import { Skeleton } from '@/components/ui/skeleton';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  title?: string;
}

export function TableSkeleton({ rows = 5, columns = 6, title }: TableSkeletonProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          {title && <Skeleton className="h-4 w-56" />}
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28" />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {/* Table Header */}
        <div className="p-4 border-b border-border/50">
          <div className="flex gap-4">
            {[...Array(columns)].map((_, i) => (
              <Skeleton key={i} className="h-4 flex-1" />
            ))}
          </div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-border/30">
          {[...Array(rows)].map((_, i) => (
            <div key={i} className="p-4">
              <div className="flex gap-4 items-center">
                {[...Array(columns)].map((_, j) => (
                  <Skeleton 
                    key={j} 
                    className={`h-5 flex-1 ${j === 0 ? 'max-w-[200px]' : ''}`} 
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}