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
  Target,
  Layers,
  FileText,
  Calendar,
  RefreshCw,
  Download,
  Pause,
  Play,
  Settings,
  Users,
  Image,
  Type,
  Pencil
} from 'lucide-react';
import { useOptimizationHistory, OptimizationRecord } from '@/hooks/useOptimizationHistory';
import { useMetaAdsData } from '@/hooks/useMetaAdsData';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Traduções de status
const STATUS_TRANSLATIONS: Record<string, string> = {
  'ACTIVE': 'Ativo',
  'PAUSED': 'Pausado',
  'DELETED': 'Deletado',
  'ARCHIVED': 'Arquivado',
  'PENDING': 'Pendente',
  'IN_PROCESS': 'Em Processamento',
  'WITH_ISSUES': 'Com Problemas',
};

// Traduções de objetivos de campanha
const OBJECTIVE_TRANSLATIONS: Record<string, string> = {
  'OUTCOME_LEADS': 'Geração de Leads',
  'OUTCOME_SALES': 'Vendas',
  'OUTCOME_ENGAGEMENT': 'Engajamento',
  'OUTCOME_AWARENESS': 'Reconhecimento de Marca',
  'OUTCOME_TRAFFIC': 'Tráfego',
  'OUTCOME_APP_PROMOTION': 'Promoção de App',
  'LINK_CLICKS': 'Cliques no Link',
  'POST_ENGAGEMENT': 'Engajamento com Publicação',
  'VIDEO_VIEWS': 'Visualizações de Vídeo',
  'REACH': 'Alcance',
  'CONVERSIONS': 'Conversões',
  'MESSAGES': 'Mensagens',
  'LEAD_GENERATION': 'Geração de Leads',
  'BRAND_AWARENESS': 'Reconhecimento de Marca',
  'STORE_VISITS': 'Visitas à Loja',
  'CATALOG_SALES': 'Vendas do Catálogo',
};

const FIELD_LABELS: Record<string, string> = {
  status: 'Status',
  objective: 'Objetivo da Campanha',
  targeting: 'Público-Alvo',
  creative_image_url: 'Imagem do Criativo',
  creative_video_url: 'Vídeo do Criativo',
  headline: 'Título do Anúncio',
  primary_text: 'Texto Principal',
  cta: 'Botão de Ação',
  daily_budget: 'Orçamento Diário',
  lifetime_budget: 'Orçamento Total',
};

const CHANGE_TYPE_CONFIG: Record<string, { label: string; color: string; icon: typeof Settings; description: string }> = {
  status_change: { 
    label: 'Mudança de Status', 
    color: 'bg-blue-500', 
    icon: Settings,
    description: 'O status foi alterado'
  },
  creative_change: { 
    label: 'Alteração de Criativo', 
    color: 'bg-pink-500', 
    icon: Image,
    description: 'O criativo foi modificado'
  },
  targeting_change: { 
    label: 'Alteração de Público', 
    color: 'bg-cyan-500', 
    icon: Users,
    description: 'A segmentação de público foi alterada'
  },
  objective_change: { 
    label: 'Mudança de Objetivo', 
    color: 'bg-indigo-500', 
    icon: Target,
    description: 'O objetivo da campanha foi alterado'
  },
  paused: { 
    label: 'Pausado', 
    color: 'bg-orange-500', 
    icon: Pause,
    description: 'Foi pausado'
  },
  activated: { 
    label: 'Ativado', 
    color: 'bg-emerald-500', 
    icon: Play,
    description: 'Foi ativado'
  },
};

const ENTITY_TYPE_CONFIG: Record<string, { label: string; labelSingular: string; icon: typeof Target; color: string }> = {
  campaign: { label: 'Campanhas', labelSingular: 'Campanha', icon: Target, color: 'text-blue-500 bg-blue-500/10' },
  ad_set: { label: 'Conjuntos', labelSingular: 'Conjunto de Anúncios', icon: Layers, color: 'text-purple-500 bg-purple-500/10' },
  ad: { label: 'Anúncios', labelSingular: 'Anúncio', icon: FileText, color: 'text-amber-500 bg-amber-500/10' },
};

// Função para traduzir valores
function translateValue(value: string | null, field: string): string {
  if (value === null || value === '-') return 'Não definido';
  
  // Traduz status
  if (field === 'status') {
    return STATUS_TRANSLATIONS[value] || value;
  }
  
  // Traduz objetivos
  if (field === 'objective') {
    return OBJECTIVE_TRANSLATIONS[value] || value;
  }
  
  // Traduz targeting (formato resumido: idade:18-65|genero:1,2|local:SP|publicos:3)
  if (field === 'targeting') {
    if (!value) return 'Não definido';
    
    const parts = value.split('|');
    const translated: string[] = [];
    
    const genderMap: Record<string, string> = { '1': 'Homens', '2': 'Mulheres' };
    const platformMap: Record<string, string> = { 
      'facebook': 'Facebook', 
      'instagram': 'Instagram', 
      'audience_network': 'Audience Network',
      'messenger': 'Messenger'
    };
    
    for (const part of parts) {
      const [key, val] = part.split(':');
      if (!key || !val) continue;
      
      switch (key) {
        case 'idade':
          translated.push(`📅 Idade: ${val} anos`);
          break;
        case 'genero':
          const genders = val.split(',').map(g => genderMap[g] || g).join(' e ');
          translated.push(`👥 Gênero: ${genders}`);
          break;
        case 'local':
          translated.push(`📍 Local: ${val}`);
          break;
        case 'publicos':
          translated.push(`🎯 ${val} público(s) personalizado(s)`);
          break;
        case 'excluidos':
          translated.push(`🚫 ${val} público(s) excluído(s)`);
          break;
        case 'interesses':
          translated.push(`💡 ${val} interesse(s)`);
          break;
        case 'plataformas':
          const platforms = val.split(',').map(p => platformMap[p] || p).join(', ');
          translated.push(`📱 Plataformas: ${platforms}`);
          break;
      }
    }
    
    return translated.length > 0 ? translated.join(' | ') : 'Segmentação personalizada';
  }
  
  return value;
}

// Função para gerar descrição legível da mudança
function getChangeDescription(record: OptimizationRecord): string {
  const entityLabel = ENTITY_TYPE_CONFIG[record.entity_type]?.labelSingular || record.entity_type;
  const fieldLabel = FIELD_LABELS[record.field_changed] || record.field_changed;
  
  const oldValue = translateValue(record.old_value, record.field_changed);
  const newValue = translateValue(record.new_value, record.field_changed);
  
  // Mudança de status
  if (record.field_changed === 'status') {
    if (record.new_value === 'PAUSED') {
      return `${entityLabel} foi pausada`;
    }
    if (record.new_value === 'ACTIVE') {
      return `${entityLabel} foi ativada`;
    }
    return `Status alterado de "${oldValue}" para "${newValue}"`;
  }
  
  // Mudança de objetivo
  if (record.field_changed === 'objective') {
    return `Objetivo alterado para "${newValue}"`;
  }
  
  // Mudança de targeting
  if (record.field_changed === 'targeting') {
    return `Público-alvo foi modificado: ${newValue}`;
  }
  
  // Mudança de criativo
  if (record.field_changed === 'headline') {
    return `Título alterado para "${newValue}"`;
  }
  if (record.field_changed === 'primary_text') {
    return `Texto principal foi modificado`;
  }
  if (record.field_changed === 'creative_image_url') {
    return `Imagem do criativo foi substituída`;
  }
  if (record.field_changed === 'creative_video_url') {
    return `Vídeo do criativo foi substituído`;
  }
  
  // Fallback genérico
  return `${fieldLabel}: "${oldValue}" → "${newValue}"`;
}

// Função para obter o ícone da mudança
function getChangeIcon(record: OptimizationRecord) {
  if (record.field_changed === 'status') {
    if (record.new_value === 'PAUSED') return <Pause className="w-4 h-4" />;
    if (record.new_value === 'ACTIVE') return <Play className="w-4 h-4" />;
  }
  if (record.field_changed === 'targeting') return <Users className="w-4 h-4" />;
  if (record.field_changed === 'objective') return <Target className="w-4 h-4" />;
  if (record.field_changed === 'headline' || record.field_changed === 'primary_text') return <Type className="w-4 h-4" />;
  if (record.field_changed.includes('creative') || record.field_changed.includes('image') || record.field_changed.includes('video')) {
    return <Image className="w-4 h-4" />;
  }
  return <Pencil className="w-4 h-4" />;
}

// Função para obter cor do badge baseado na mudança
function getChangeBadgeStyle(record: OptimizationRecord): { color: string; label: string } {
  if (record.field_changed === 'status') {
    if (record.new_value === 'PAUSED') {
      return { color: 'bg-orange-500', label: 'Pausado' };
    }
    if (record.new_value === 'ACTIVE') {
      return { color: 'bg-emerald-500', label: 'Ativado' };
    }
  }
  
  const config = CHANGE_TYPE_CONFIG[record.change_type];
  if (config) {
    return { color: config.color, label: config.label };
  }
  
  // Fallback baseado no campo
  if (record.field_changed === 'targeting') {
    return { color: 'bg-cyan-500', label: 'Público Alterado' };
  }
  if (record.field_changed === 'objective') {
    return { color: 'bg-indigo-500', label: 'Objetivo Alterado' };
  }
  if (record.field_changed.includes('creative') || record.field_changed === 'headline' || record.field_changed === 'primary_text') {
    return { color: 'bg-pink-500', label: 'Criativo Alterado' };
  }
  
  return { color: 'bg-gray-500', label: 'Modificado' };
}

export default function OptimizationHistory() {
  const navigate = useNavigate();
  const { selectedProject, projectsLoading, loading: dataLoading } = useMetaAdsData();
  const { history, loading, refetch } = useOptimizationHistory(selectedProject?.id || null);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [changeTypeFilter, setChangeTypeFilter] = useState<string>('all');

  // Show loading skeleton while loading
  if (projectsLoading || dataLoading) {
    return (
      <DashboardLayout>
        <div className="p-8 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <Skeleton className="h-10 w-80 mb-2" />
              <Skeleton className="h-5 w-96" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-28" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-12 w-full" />
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Redirect only after loading is complete and no project
  if (!selectedProject) {
    navigate('/projects');
    return null;
  }

  const filteredHistory = useMemo(() => {
    return history.filter(record => {
      const matchesSearch = search === '' || 
        record.entity_name.toLowerCase().includes(search.toLowerCase()) ||
        getChangeDescription(record).toLowerCase().includes(search.toLowerCase());
      
      const matchesEntity = entityFilter === 'all' || record.entity_type === entityFilter;
      const matchesChangeType = changeTypeFilter === 'all' || record.change_type === changeTypeFilter;
      
      return matchesSearch && matchesEntity && matchesChangeType;
    });
  }, [history, search, entityFilter, changeTypeFilter]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, OptimizationRecord[]> = {};
    
    filteredHistory.forEach(record => {
      const date = new Date(record.detected_at).toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(record);
    });
    
    return groups;
  }, [filteredHistory]);

  const stats = useMemo(() => {
    const campaigns = history.filter(h => h.entity_type === 'campaign').length;
    const adSets = history.filter(h => h.entity_type === 'ad_set').length;
    const ads = history.filter(h => h.entity_type === 'ad').length;
    
    // Contagem por tipo de mudança
    const paused = history.filter(h => h.new_value === 'PAUSED').length;
    const activated = history.filter(h => h.new_value === 'ACTIVE').length;
    const creativeChanges = history.filter(h => 
      h.field_changed.includes('creative') || 
      h.field_changed === 'headline' || 
      h.field_changed === 'primary_text'
    ).length;
    const targetingChanges = history.filter(h => h.field_changed === 'targeting').length;
    
    return { campaigns, adSets, ads, total: history.length, paused, activated, creativeChanges, targetingChanges };
  }, [history]);

  const exportToCSV = useCallback(() => {
    if (filteredHistory.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    const headers = [
      'Data',
      'Hora',
      'Tipo',
      'Nome',
      'O que mudou',
      'Descrição da Mudança'
    ];

    const rows = filteredHistory.map(record => [
      new Date(record.detected_at).toLocaleDateString('pt-BR'),
      new Date(record.detected_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      ENTITY_TYPE_CONFIG[record.entity_type]?.labelSingular || record.entity_type,
      record.entity_name,
      FIELD_LABELS[record.field_changed] || record.field_changed,
      getChangeDescription(record)
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
              Acompanhe todas as mudanças realizadas nas suas campanhas, conjuntos e anúncios
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
              Exportar
            </Button>
          </div>
        </div>

        {/* Stats - Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="glass-card p-4 v4-accent">
            <p className="text-3xl font-bold text-foreground">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total de Mudanças</p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-2">
              <Pause className="w-5 h-5 text-orange-500" />
              <p className="text-2xl font-bold text-orange-500">{stats.paused}</p>
            </div>
            <p className="text-sm text-muted-foreground">Pausados</p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-2">
              <Play className="w-5 h-5 text-emerald-500" />
              <p className="text-2xl font-bold text-emerald-500">{stats.activated}</p>
            </div>
            <p className="text-sm text-muted-foreground">Ativados</p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-2">
              <Image className="w-5 h-5 text-pink-500" />
              <p className="text-2xl font-bold text-pink-500">{stats.creativeChanges}</p>
            </div>
            <p className="text-sm text-muted-foreground">Criativos</p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-500" />
              <p className="text-2xl font-bold text-cyan-500">{stats.targetingChanges}</p>
            </div>
            <p className="text-sm text-muted-foreground">Público</p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-500" />
              <p className="text-2xl font-bold text-blue-500">{stats.campaigns}</p>
            </div>
            <p className="text-sm text-muted-foreground">Campanhas</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={changeTypeFilter} onValueChange={setChangeTypeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Tipo de mudança" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">Todas as mudanças</SelectItem>
              {availableChangeTypes.map(type => (
                <SelectItem key={type} value={type}>
                  {CHANGE_TYPE_CONFIG[type]?.label || type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs value={entityFilter} onValueChange={setEntityFilter} className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-4">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="campaign" className="flex items-center gap-1">
              <Target className="w-3 h-3" />
              <span className="hidden sm:inline">Campanhas</span>
            </TabsTrigger>
            <TabsTrigger value="ad_set" className="flex items-center gap-1">
              <Layers className="w-3 h-3" />
              <span className="hidden sm:inline">Conjuntos</span>
            </TabsTrigger>
            <TabsTrigger value="ad" className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              <span className="hidden sm:inline">Anúncios</span>
            </TabsTrigger>
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
                  O histórico será preenchido conforme as sincronizações ocorrem.
                  <br />
                  Mudanças em status, público-alvo, objetivo e criativos serão registradas automaticamente.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(groupedByDate).map(([date, records]) => (
                  <div key={date}>
                    <div className="flex items-center gap-3 mb-4 sticky top-0 bg-background/95 backdrop-blur py-2 z-10">
                      <Calendar className="w-5 h-5 text-primary" />
                      <span className="text-lg font-semibold capitalize">{date}</span>
                      <Badge variant="secondary">{records.length} {records.length === 1 ? 'mudança' : 'mudanças'}</Badge>
                    </div>
                    
                    <div className="grid gap-3">
                      {records.map(record => {
                        const entityConfig = ENTITY_TYPE_CONFIG[record.entity_type];
                        const EntityIcon = entityConfig?.icon || Target;
                        const badgeStyle = getChangeBadgeStyle(record);
                        const description = getChangeDescription(record);
                        const ChangeIcon = getChangeIcon(record);
                        
                        return (
                          <div 
                            key={record.id}
                            className="glass-card p-5 hover:bg-muted/30 transition-all duration-200 border-l-4"
                            style={{ borderLeftColor: badgeStyle.color.replace('bg-', 'var(--') }}
                          >
                            <div className="flex flex-col gap-3">
                              {/* Header: Entity + Badge */}
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                                    entityConfig?.color
                                  )}>
                                    <EntityIcon className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                                      {entityConfig?.labelSingular}
                                    </p>
                                    <p className="font-semibold" title={record.entity_name}>
                                      {record.entity_name}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge 
                                    className={cn("text-xs text-white flex items-center gap-1", badgeStyle.color)}
                                  >
                                    {ChangeIcon}
                                    {badgeStyle.label}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(record.detected_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              </div>
                              
                              {/* Description */}
                              <div className="pl-13">
                                <p className="text-sm text-foreground">
                                  {description}
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
