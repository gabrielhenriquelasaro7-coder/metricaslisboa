import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  RefreshCw,
  Download
} from 'lucide-react';
import { useOptimizationHistory, OptimizationRecord } from '@/hooks/useOptimizationHistory';
import { useMetaAdsData } from '@/hooks/useMetaAdsData';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const FIELD_LABELS: Record<string, string> = {
  status: 'Status',
  objective: 'Objetivo',
  targeting: 'Público/Segmentação',
  creative_image_url: 'Imagem do Criativo',
  creative_video_url: 'Vídeo do Criativo',
  headline: 'Título',
  primary_text: 'Texto Principal',
  cta: 'Botão de Ação (CTA)',
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
  creative_change: { label: 'Criativo', color: 'bg-pink-500' },
  targeting_change: { label: 'Público', color: 'bg-cyan-500' },
  objective_change: { label: 'Objetivo', color: 'bg-indigo-500' },
  created: { label: 'Criado', color: 'bg-green-500' },
  paused: { label: 'Pausado', color: 'bg-gray-500' },
  activated: { label: 'Ativado', color: 'bg-emerald-500' },
};

const ENTITY_TYPE_LABELS: Record<string, { label: string; icon: typeof Target }> = {
  campaign: { label: 'Campanha', icon: Target },
  ad_set: { label: 'Conjunto', icon: Layers },
  ad: { label: 'Anúncio', icon: FileText },
};

export default function OptimizationHistory() {
  const navigate = useNavigate();
  const { selectedProject, projectsLoading, loading: dataLoading } = useMetaAdsData();
  const { history, loading, refetch } = useOptimizationHistory(selectedProject?.id || null);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [changeTypeFilter, setChangeTypeFilter] = useState<string>('all');

  // Redirect if no project selected
  if (!selectedProject && !projectsLoading && !dataLoading) {
    navigate('/projects');
    return null;
  }

  const filteredHistory = useMemo(() => {
    return history.filter(record => {
      const matchesSearch = search === '' || 
        record.entity_name.toLowerCase().includes(search.toLowerCase()) ||
        record.field_changed.toLowerCase().includes(search.toLowerCase());
      
      const matchesEntity = entityFilter === 'all' || record.entity_type === entityFilter;
      const matchesChangeType = changeTypeFilter === 'all' || record.change_type === changeTypeFilter;
      
      return matchesSearch && matchesEntity && matchesChangeType;
    });
  }, [history, search, entityFilter, changeTypeFilter]);

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

  const exportToCSV = useCallback(() => {
    if (filteredHistory.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    const headers = [
      'Data',
      'Hora',
      'Tipo de Entidade',
      'Nome da Entidade',
      'ID da Entidade',
      'Campo Alterado',
      'Valor Anterior',
      'Novo Valor',
      'Tipo de Mudança',
      'Variação (%)'
    ];

    const rows = filteredHistory.map(record => [
      new Date(record.detected_at).toLocaleDateString('pt-BR'),
      new Date(record.detected_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      ENTITY_TYPE_LABELS[record.entity_type]?.label || record.entity_type,
      record.entity_name,
      record.entity_id,
      FIELD_LABELS[record.field_changed] || record.field_changed,
      record.old_value || '-',
      record.new_value || '-',
      CHANGE_TYPE_LABELS[record.change_type]?.label || record.change_type,
      record.change_percentage !== null ? `${record.change_percentage.toFixed(1)}%` : '-'
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `historico-otimizacoes-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast.success(`${filteredHistory.length} registros exportados`);
  }, [filteredHistory]);

  const availableChangeTypes = useMemo(() => {
    const types = new Set(history.map(h => h.change_type));
    return Array.from(types);
  }, [history]);

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2 gradient-text flex items-center gap-3">
              <History className="w-8 h-8 text-primary" />
              Histórico de Otimizações
            </h1>
            <p className="text-muted-foreground">
              Todas as mudanças detectadas em campanhas, conjuntos e anúncios
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={() => refetch()} 
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              Atualizar
            </Button>
            <Button 
              variant="outline" 
              onClick={exportToCSV}
              disabled={filteredHistory.length === 0}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card p-4 v4-accent">
            <p className="text-3xl font-bold text-foreground">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total de Mudanças</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-3xl font-bold text-blue-500">{stats.campaigns}</p>
            <p className="text-sm text-muted-foreground">Campanhas</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-3xl font-bold text-purple-500">{stats.adSets}</p>
            <p className="text-sm text-muted-foreground">Conjuntos</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-3xl font-bold text-amber-500">{stats.ads}</p>
            <p className="text-sm text-muted-foreground">Anúncios</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou campo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={changeTypeFilter} onValueChange={setChangeTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tipo de mudança" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">Todas mudanças</SelectItem>
              {availableChangeTypes.map(type => (
                <SelectItem key={type} value={type}>
                  {CHANGE_TYPE_LABELS[type]?.label || type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs value={entityFilter} onValueChange={setEntityFilter} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-4">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="campaign">Campanhas</TabsTrigger>
            <TabsTrigger value="ad_set">Conjuntos</TabsTrigger>
            <TabsTrigger value="ad">Anúncios</TabsTrigger>
          </TabsList>

          <TabsContent value={entityFilter} className="mt-6">
            {loading ? (
              <div className="space-y-4">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : Object.keys(groupedByDate).length === 0 ? (
              <div className="glass-card p-12 text-center">
                <History className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-xl font-semibold mb-2">Nenhuma mudança detectada</h3>
                <p className="text-muted-foreground">
                  O histórico será preenchido conforme as sincronizações ocorrem
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(groupedByDate).map(([date, records]) => (
                  <div key={date}>
                    <div className="flex items-center gap-3 mb-4 sticky top-0 bg-background/95 backdrop-blur py-2 z-10">
                      <Calendar className="w-5 h-5 text-primary" />
                      <span className="text-lg font-semibold">{date}</span>
                      <Badge variant="secondary">{records.length} mudanças</Badge>
                    </div>
                    
                    <div className="grid gap-3">
                      {records.map(record => {
                        const EntityIcon = ENTITY_TYPE_LABELS[record.entity_type]?.icon || Target;
                        const changeType = CHANGE_TYPE_LABELS[record.change_type];
                        
                        return (
                          <div 
                            key={record.id}
                            className="glass-card p-4 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                              {/* Entity info */}
                              <div className="flex items-start gap-3 flex-1">
                                <div className={cn(
                                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                                  record.entity_type === 'campaign' && "bg-blue-500/10 text-blue-500",
                                  record.entity_type === 'ad_set' && "bg-purple-500/10 text-purple-500",
                                  record.entity_type === 'ad' && "bg-amber-500/10 text-amber-500",
                                )}>
                                  <EntityIcon className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate" title={record.entity_name}>
                                    {record.entity_name}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <Badge 
                                      variant="secondary" 
                                      className={cn("text-xs text-white", changeType?.color || 'bg-gray-500')}
                                    >
                                      {changeType?.label || record.change_type}
                                    </Badge>
                                    <span className="text-sm text-muted-foreground">
                                      {FIELD_LABELS[record.field_changed] || record.field_changed}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Values */}
                              <div className="flex items-center gap-3 pl-13 sm:pl-0">
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                                    {formatValue(record.old_value, record.field_changed)}
                                  </span>
                                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                  <span className="font-medium bg-primary/10 text-primary px-2 py-1 rounded">
                                    {formatValue(record.new_value, record.field_changed)}
                                  </span>
                                  {getChangeIcon(record)}
                                  {record.change_percentage !== null && (
                                    <span className={cn(
                                      "text-sm font-medium",
                                      record.change_percentage > 0 ? "text-metric-positive" : "text-metric-negative"
                                    )}>
                                      {record.change_percentage > 0 ? '+' : ''}{record.change_percentage.toFixed(1)}%
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground whitespace-nowrap ml-auto">
                                  {new Date(record.detected_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
