import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Project, BusinessModel } from '@/hooks/useProjects';
import { ProjectHealth, HealthStatus } from '@/hooks/useProjectHealth';
import { supabase } from '@/integrations/supabase/client';
import { 
  MoreHorizontal, 
  TrendingUp, 
  TrendingDown,
  Minus,
  Users, 
  Store,
  Clock,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Archive,
  ArchiveRestore,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  Shield,
  DollarSign,
  Target,
  User,
  Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import { ptBR, enUS, es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

const businessModelConfig: Record<BusinessModel, { icon: typeof TrendingUp; labelKey: string; color: string }> = {
  inside_sales: { icon: Users, labelKey: 'Inside Sales', color: 'text-chart-1' },
  ecommerce: { icon: TrendingUp, labelKey: 'E-commerce', color: 'text-chart-3' },
  infoproduto: { icon: TrendingUp, labelKey: 'Infoproduto', color: 'text-chart-2' },
  pdv: { icon: Store, labelKey: 'PDV', color: 'text-chart-4' },
  custom: { icon: Target, labelKey: 'Custom', color: 'text-primary' },
};

const healthConfig: Record<HealthStatus, { icon: typeof ShieldCheck; label: string; color: string; bgColor: string; borderColor: string }> = {
  safe: { 
    icon: ShieldCheck, 
    label: 'Safe', 
    color: 'text-metric-positive',
    bgColor: 'bg-metric-positive/10',
    borderColor: 'border-l-metric-positive'
  },
  care: { 
    icon: Shield, 
    label: 'Care', 
    color: 'text-metric-warning',
    bgColor: 'bg-metric-warning/10',
    borderColor: 'border-l-metric-warning'
  },
  danger: { 
    icon: ShieldAlert, 
    label: 'Danger', 
    color: 'text-metric-negative',
    bgColor: 'bg-metric-negative/10',
    borderColor: 'border-l-metric-negative'
  },
};

interface EnhancedProjectCardProps {
  project: Project;
  health?: ProjectHealth;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
  onArchive: (project: Project) => void;
  onUnarchive: (project: Project) => void;
}

export default function EnhancedProjectCard({ 
  project, 
  health,
  onEdit, 
  onDelete, 
  onArchive, 
  onUnarchive 
}: EnhancedProjectCardProps) {
  const { t, i18n } = useTranslation();
  const [investidorNames, setInvestidorNames] = useState<string[]>([]);
  const [squadName, setSquadName] = useState<string | null>(null);
  
  const getDateLocale = () => {
    switch (i18n.language) {
      case 'en-US': return enUS;
      case 'es': return es;
      default: return ptBR;
    }
  };
  // Fetch investidor and squad names
  useEffect(() => {
    const fetchProjectDetails = async () => {
      // Fetch investidores from project_investidores table
      const { data: investidoresData } = await supabase
        .from('project_investidores')
        .select('investidor_id')
        .eq('project_id', project.id);
      
      if (investidoresData && investidoresData.length > 0) {
        const investidorIds = investidoresData.map(i => i.investidor_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('full_name')
          .in('user_id', investidorIds);
        
        if (profilesData) {
          const names = profilesData
            .map(p => p.full_name)
            .filter((name): name is string => !!name);
          setInvestidorNames(names);
        }
      } else if (project.investidor_id) {
        // Fallback to legacy investidor_id field
        const { data: investidorData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', project.investidor_id)
          .maybeSingle();
        
        if (investidorData?.full_name) {
          setInvestidorNames([investidorData.full_name]);
        }
      }

      // Fetch squad name
      if (project.squad_id) {
        const { data: squadData } = await supabase
          .from('squads')
          .select('name')
          .eq('id', project.squad_id)
          .maybeSingle();
        
        if (squadData?.name) {
          setSquadName(squadData.name);
        }
      }
    };

    fetchProjectDetails();
  }, [project.id, project.investidor_id, project.squad_id]);

  const config = businessModelConfig[project.business_model];
  const Icon = config.icon;
  const healthStatus = health?.status || 'care';
  const healthCfg = healthConfig[healthStatus];
  const HealthIcon = healthCfg.icon;
  
  const syncStatus = project.webhook_status === 'success' ? 'synced' : project.webhook_status === 'error' ? 'error' : 'pending';
  
  const isEcommerce = project.business_model === 'ecommerce';
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: project.currency || 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const chartData = health?.trend.map((value, index) => ({ value, index })) || [];
  
  const TrendIcon = health?.trendDirection === 'up' 
    ? TrendingUp 
    : health?.trendDirection === 'down' 
      ? TrendingDown 
      : Minus;

  return (
    <Link to={`/project/${project.id}`} className="block">
      <div className={cn(
        'glass-card-hover p-5 group border-l-4 transition-all duration-300',
        healthCfg.borderColor,
        project.archived && 'opacity-60'
      )}>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {project.avatar_url ? (
              <img 
                src={project.avatar_url} 
                alt={project.name} 
                className="w-11 h-11 rounded-xl object-cover border border-border"
              />
            ) : (
              <div className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center',
                healthCfg.bgColor
              )}>
                <Icon className={cn('w-5 h-5', healthCfg.color)} />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base group-hover:text-primary transition-colors line-clamp-1">
                  {project.name}
                </h3>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge 
                  variant="outline" 
                  className={cn('text-xs py-0 px-1.5', healthCfg.color, healthCfg.bgColor)}
                >
                  <HealthIcon className="w-3 h-3 mr-1" />
                  {healthCfg.label}
                </Badge>
                <span className="text-xs text-muted-foreground">{config.labelKey}</span>
              </div>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.preventDefault(); onEdit(project); }}>
                {t('common.edit')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {project.archived ? (
                <DropdownMenuItem onClick={(e) => { e.preventDefault(); onUnarchive(project); }}>
                  <ArchiveRestore className="w-4 h-4 mr-2" />
                  {t('projects.restore')}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={(e) => { e.preventDefault(); onArchive(project); }}>
                  <Archive className="w-4 h-4 mr-2" />
                  {t('projects.archive')}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem 
                onClick={(e) => { e.preventDefault(); onDelete(project); }}
                className="text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('common.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Metrics Row */}
        {health && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center p-2 bg-secondary/30 rounded-lg">
              <p className="text-lg font-bold">{formatCurrency(health.spend)}</p>
              <p className="text-xs text-muted-foreground">{t('projects.spent30d')}</p>
            </div>
            <div className="text-center p-2 bg-secondary/30 rounded-lg">
              <p className="text-lg font-bold">{health.conversions}</p>
              <p className="text-xs text-muted-foreground">{isEcommerce ? t('dashboard.purchases') : t('dashboard.leads')}</p>
            </div>
            <div className={cn('text-center p-2 rounded-lg', healthCfg.bgColor)}>
              <p className={cn('text-lg font-bold', healthCfg.color)}>
                {isEcommerce ? `${health.roas.toFixed(2)}x` : formatCurrency(health.cpl)}
              </p>
              <p className="text-xs text-muted-foreground">{isEcommerce ? 'ROAS' : 'CPL'}</p>
            </div>
          </div>
        )}

        {/* Sparkline Trend */}
        {chartData.length > 1 && (
          <div className="h-12 mb-3 -mx-1 opacity-70">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`trend-${project.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={
                      healthStatus === 'safe' ? 'hsl(142, 76%, 36%)' 
                      : healthStatus === 'care' ? 'hsl(45, 93%, 47%)' 
                      : 'hsl(0, 84%, 60%)'
                    } stopOpacity={0.4} />
                    <stop offset="95%" stopColor={
                      healthStatus === 'safe' ? 'hsl(142, 76%, 36%)' 
                      : healthStatus === 'care' ? 'hsl(45, 93%, 47%)' 
                      : 'hsl(0, 84%, 60%)'
                    } stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={
                    healthStatus === 'safe' ? 'hsl(142, 76%, 36%)' 
                    : healthStatus === 'care' ? 'hsl(45, 93%, 47%)' 
                    : 'hsl(0, 84%, 60%)'
                  }
                  strokeWidth={1.5}
                  fill={`url(#trend-${project.id})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Investidor & Squad Info - Always show */}
        <div className="flex flex-col gap-1.5 mb-3 pt-2 border-t border-border/50 text-xs">
        <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('common.investor')}</span>
            <span className={cn(
              investidorNames.length > 0 ? 'text-foreground' : 'text-muted-foreground/70'
            )}>
              {investidorNames.length > 0 
                ? investidorNames.map(name => name.split(' ').slice(0, 2).join(' ')).join(', ')
                : t('common.noInvestor')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('common.squad')}</span>
            <span className={cn(
              squadName ? 'text-foreground' : 'text-muted-foreground/70'
            )}>
              {squadName || t('common.noSquad')}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {project.last_sync_at 
                ? formatDistanceToNow(new Date(project.last_sync_at), { addSuffix: true, locale: getDateLocale() })
                : t('common.neverSynced')
              }
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {health && (
              <div className={cn('flex items-center gap-1', 
                health.trendDirection === 'up' ? 'text-metric-positive' : 
                health.trendDirection === 'down' ? 'text-metric-negative' : 'text-muted-foreground'
              )}>
                <TrendIcon className="w-3.5 h-3.5" />
                <span className="text-xs">7d</span>
              </div>
            )}
            {syncStatus === 'synced' && <CheckCircle className="w-3.5 h-3.5 text-metric-positive" />}
            {syncStatus === 'error' && <AlertCircle className="w-3.5 h-3.5 text-metric-negative" />}
            {syncStatus === 'pending' && <RefreshCw className="w-3.5 h-3.5 text-metric-warning animate-spin" />}
          </div>
        </div>
      </div>
    </Link>
  );
}
