import { useState, useMemo } from 'react';
import { Settings2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useHiddenMetrics, MetricKey, PageContext, BusinessModel, AVAILABLE_METRICS } from '@/hooks/useHiddenMetrics';
import { useUserRole } from '@/hooks/useUserRole';

interface MetricVisibilityConfigProps {
  pageContext: PageContext;
  businessModel?: BusinessModel;
}

export function MetricVisibilityConfig({ 
  pageContext, 
  businessModel 
}: MetricVisibilityConfigProps) {
  const { isGuest } = useUserRole();
  const { hiddenMetrics, toggleMetric, loading, canCustomize } = useHiddenMetrics(pageContext, businessModel);
  const [open, setOpen] = useState(false);

  // Get metrics based on business model - use AVAILABLE_METRICS for full list
  const metricsForModel = useMemo(() => {
    // Always show all available metrics so users can customize everything
    return AVAILABLE_METRICS;
  }, []);

  // Only show for guests
  if (!isGuest || !canCustomize) {
    return null;
  }

  const metricsToShow = Object.keys(metricsForModel) as MetricKey[];

  // Group metrics by category
  const groupedMetrics = useMemo(() => {
    return metricsToShow.reduce((acc, key) => {
      const metric = metricsForModel[key];
      if (!metric) return acc;
      if (!acc[metric.category]) {
        acc[metric.category] = [];
      }
      acc[metric.category].push({ key, label: metric.label, category: metric.category });
      return acc;
    }, {} as Record<string, { key: MetricKey; label: string; category: string }[]>);
  }, [metricsToShow, metricsForModel]);

  const hiddenCount = hiddenMetrics.filter(m => metricsToShow.includes(m)).length;
  const visibleCount = metricsToShow.length - hiddenCount;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 text-xs h-8"
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Personalizar Métricas</span>
          <span className="sm:hidden">Métricas</span>
          {hiddenCount > 0 && (
            <span className="ml-1 h-5 px-1.5 text-[10px] bg-secondary text-secondary-foreground rounded-md flex items-center">
              {hiddenCount} ocultas
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            Personalizar Visualização
          </DialogTitle>
          <DialogDescription>
            Escolha quais métricas você deseja ver. As métricas ocultas não aparecerão nos cards.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{visibleCount} visíveis</span>
          </div>
          <div className="flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{hiddenCount} ocultas</span>
          </div>
        </div>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-4">
            {Object.entries(groupedMetrics).map(([category, metrics]) => (
              <div key={category}>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {category}
                </h4>
                <div className="space-y-1">
                  {metrics.map(({ key, label }) => {
                    const isHidden = hiddenMetrics.includes(key);
                    return (
                      <div
                        key={key}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-lg transition-colors",
                          isHidden 
                            ? "bg-muted/30 opacity-60" 
                            : "bg-card hover:bg-muted/50"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {isHidden ? (
                            <EyeOff className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <Eye className="w-4 h-4 text-primary" />
                          )}
                          <Label 
                            htmlFor={`metric-${key}`} 
                            className={cn(
                              "text-sm cursor-pointer",
                              isHidden && "text-muted-foreground line-through"
                            )}
                          >
                            {label}
                          </Label>
                        </div>
                        <Switch
                          id={`metric-${key}`}
                          checked={!isHidden}
                          onCheckedChange={() => toggleMetric(key)}
                          disabled={loading}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
