import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  History, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Target,
  Layers,
  FileText,
  ArrowRight,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { useOptimizationHistory, OptimizationRecord } from '@/hooks/useOptimizationHistory';
import { cn } from '@/lib/utils';

interface OptimizationHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
}

const FIELD_LABELS: Record<string, string> = {
  status: 'Status',
  daily_budget: 'Orçamento Diário',
  lifetime_budget: 'Orçamento Vitalício',
  spend: 'Gasto',
  impressions: 'Impressões',
  clicks: 'Cliques',
  ctr: 'CTR',
  cpc: 'CPC',
  cpm: 'CPM',
  conversions: 'Conversões',
  cpa: 'CPA',
  roas: 'ROAS',
  reach: 'Alcance',
  frequency: 'Frequência',
  conversion_value: 'Valor de Conversão',
};

const CHANGE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  status_change: { label: 'Status', color: 'bg-blue-500' },
  budget_change: { label: 'Orçamento', color: 'bg-purple-500' },
  metric_change: { label: 'Métrica', color: 'bg-amber-500' },
  created: { label: 'Criado', color: 'bg-green-500' },
  paused: { label: 'Pausado', color: 'bg-gray-500' },
  activated: { label: 'Ativado', color: 'bg-emerald-500' },
};

const ENTITY_TYPE_LABELS: Record<string, { label: string; icon: typeof Target }> = {
  campaign: { label: 'Campanha', icon: Target },
  ad_set: { label: 'Conjunto', icon: Layers },
  ad: { label: 'Anúncio', icon: FileText },
};

export function OptimizationHistoryDialog({ 
  open, 
  onOpenChange, 
  projectId 
}: OptimizationHistoryDialogProps) {
  const { history, loading, refetch } = useOptimizationHistory(projectId);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');

  const filteredHistory = useMemo(() => {
    return history.filter(record => {
      const matchesSearch = search === '' || 
        record.entity_name.toLowerCase().includes(search.toLowerCase()) ||
        record.field_changed.toLowerCase().includes(search.toLowerCase());
      
      const matchesEntity = entityFilter === 'all' || record.entity_type === entityFilter;
      
      return matchesSearch && matchesEntity;
    });
  }, [history, search, entityFilter]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, OptimizationRecord[]> = {};
    
    filteredHistory.forEach(record => {
      const date = new Date(record.detected_at).toLocaleDateString('pt-BR');
      if (!groups[date]) groups[date] = [];
      groups[date].push(record);
    });
    
    return groups;
  }, [filteredHistory]);

  const formatValue = (value: string | null, field: string): string => {
    if (value === null) return '-';
    
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return value;
    
    if (['spend', 'daily_budget', 'lifetime_budget', 'cpc', 'cpa', 'conversion_value'].includes(field)) {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numValue);
    }
    if (['ctr', 'roas'].includes(field)) {
      return `${numValue.toFixed(2)}${field === 'ctr' ? '%' : 'x'}`;
    }
    return new Intl.NumberFormat('pt-BR').format(numValue);
  };

  const getChangeIcon = (record: OptimizationRecord) => {
    if (record.change_percentage !== null) {
      if (record.change_percentage > 0) return <TrendingUp className="w-4 h-4 text-metric-positive" />;
      if (record.change_percentage < 0) return <TrendingDown className="w-4 h-4 text-metric-negative" />;
    }
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const stats = useMemo(() => {
    const campaigns = history.filter(h => h.entity_type === 'campaign').length;
    const adSets = history.filter(h => h.entity_type === 'ad_set').length;
    const ads = history.filter(h => h.entity_type === 'ad').length;
    return { campaigns, adSets, ads, total: history.length };
  }, [history]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Histórico de Otimizações
          </DialogTitle>
          <DialogDescription>
            Todas as mudanças detectadas em campanhas, conjuntos e anúncios
          </DialogDescription>
        </DialogHeader>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 py-2">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-500">{stats.campaigns}</p>
            <p className="text-xs text-muted-foreground">Campanhas</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-purple-500">{stats.adSets}</p>
            <p className="text-xs text-muted-foreground">Conjuntos</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-amber-500">{stats.ads}</p>
            <p className="text-xs text-muted-foreground">Anúncios</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou campo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="icon" onClick={refetch} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={entityFilter} onValueChange={setEntityFilter} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="campaign">Campanhas</TabsTrigger>
            <TabsTrigger value="ad_set">Conjuntos</TabsTrigger>
            <TabsTrigger value="ad">Anúncios</TabsTrigger>
          </TabsList>

          <TabsContent value={entityFilter} className="flex-1 min-h-0 mt-4">
            <ScrollArea className="h-[400px] pr-4">
              {loading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : Object.keys(groupedByDate).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <History className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">Nenhuma mudança detectada</p>
                  <p className="text-sm">O histórico será preenchido conforme as sincronizações ocorrem</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedByDate).map(([date, records]) => (
                    <div key={date}>
                      <div className="flex items-center gap-2 mb-3 sticky top-0 bg-background py-1">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">{date}</span>
                        <Badge variant="secondary" className="text-xs">{records.length}</Badge>
                      </div>
                      
                      <div className="space-y-2">
                        {records.map(record => {
                          const EntityIcon = ENTITY_TYPE_LABELS[record.entity_type]?.icon || Target;
                          const changeType = CHANGE_TYPE_LABELS[record.change_type];
                          
                          return (
                            <div 
                              key={record.id}
                              className="bg-card border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                  <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                                    record.entity_type === 'campaign' && "bg-blue-500/10 text-blue-500",
                                    record.entity_type === 'ad_set' && "bg-purple-500/10 text-purple-500",
                                    record.entity_type === 'ad' && "bg-amber-500/10 text-amber-500",
                                  )}>
                                    <EntityIcon className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate" title={record.entity_name}>
                                      {record.entity_name}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                      <Badge 
                                        variant="secondary" 
                                        className={cn("text-xs text-white", changeType?.color || 'bg-gray-500')}
                                      >
                                        {changeType?.label || record.change_type}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">
                                        {FIELD_LABELS[record.field_changed] || record.field_changed}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2 text-sm shrink-0">
                                  <span className="text-muted-foreground">
                                    {formatValue(record.old_value, record.field_changed)}
                                  </span>
                                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                  <span className="font-medium">
                                    {formatValue(record.new_value, record.field_changed)}
                                  </span>
                                  {getChangeIcon(record)}
                                  {record.change_percentage !== null && (
                                    <span className={cn(
                                      "text-xs font-medium",
                                      record.change_percentage > 0 ? "text-metric-positive" : "text-metric-negative"
                                    )}>
                                      {record.change_percentage > 0 ? '+' : ''}{record.change_percentage.toFixed(1)}%
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground mt-2 pl-11">
                                {new Date(record.detected_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
