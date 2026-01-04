import { Skeleton } from '@/components/ui/skeleton';

export function SettingsSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border/50 pb-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-24" />
        ))}
      </div>

      {/* Settings Content */}
      <div className="glass-card p-6 space-y-6">
        {/* Section */}
        <div className="space-y-4">
          <Skeleton className="h-5 w-32" />
          
          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Another Section */}
        <div className="pt-6 border-t border-border/50 space-y-4">
          <Skeleton className="h-5 w-40" />
          
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-muted/20">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
                <Skeleton className="h-6 w-12 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    </div>
  );
}