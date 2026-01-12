import { 
  Users, 
  Target, 
  Handshake, 
  CheckCircle2,
  ArrowDown,
  TrendingUp,
  DollarSign,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FunnelCard, getIconComponent, getColorClasses } from './FunnelCardsConfig';

interface FunnelStage {
  id: string;
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

interface Stage {
  id: string;
  name: string;
  color: string;
  sort: number;
  type: number;
  leads_count: number;
}

interface InsideSalesFunnelProps {
  leads?: number;
  mql?: number;
  sql?: number;
  sales?: number;
  revenue?: number;
  hasCRMData?: boolean;
  funnelConfig?: FunnelCard[];
  crmStages?: Stage[];
  totalDeals?: number; // Total real de deals do CRM
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function InsideSalesFunnel({
  leads = 0,
  mql = 0,
  sql = 0,
  sales = 0,
  revenue = 0,
  hasCRMData = false,
  funnelConfig,
  crmStages = [],
  totalDeals,
  onRefresh,
  isRefreshing = false,
}: InsideSalesFunnelProps) {
  
  // Build stages from config or use defaults
  const buildStagesFromConfig = (): FunnelStage[] => {
    if (!funnelConfig || funnelConfig.length === 0) {
      // Default stages
      const defaultStages: FunnelStage[] = [
        { id: 'leads', label: 'Leads', value: leads, icon: Users, color: 'text-blue-500', bgColor: 'bg-blue-500' },
      ];
      
      if (hasCRMData) {
        defaultStages.push(
          { id: 'mql', label: 'MQL', value: mql, icon: Target, color: 'text-cyan-500', bgColor: 'bg-cyan-500' },
          { id: 'sql', label: 'SQL', value: sql, icon: Handshake, color: 'text-purple-500', bgColor: 'bg-purple-500' },
          { id: 'sales', label: 'Vendas', value: sales, icon: CheckCircle2, color: 'text-metric-positive', bgColor: 'bg-metric-positive' },
        );
      }
      
      return defaultStages;
    }

    // Build from custom config
    return funnelConfig
      .filter(card => card.enabled)
      .map(card => {
        let value = 0;
        
        if (card.id === 'leads') {
          // Leads Recebidos = total de deals no CRM (não apenas os "não classificados")
          value = totalDeals ?? leads ?? crmStages.reduce((sum, s) => sum + (s.leads_count || 0), 0);
        } else if (card.id === 'sales') {
          // Vendas = deals ganhos
          value = sales || crmStages.filter(s => s.type === 1).reduce((sum, s) => sum + (s.leads_count || 0), 0);
        } else {
          // Sum leads from associated CRM stages
          value = crmStages
            .filter(s => card.stage_ids.includes(s.id))
            .reduce((sum, s) => sum + (s.leads_count || 0), 0);
        }

        const colorClasses = getColorClasses(card.color);
        
        return {
          id: card.id,
          label: card.label,
          value,
          icon: getIconComponent(card.icon),
          color: colorClasses.text,
          bgColor: colorClasses.bg,
        };
      });
  };

  const stages = buildStagesFromConfig();
  const maxValue = Math.max(...stages.map(s => s.value), 1);

  const getConversionRate = (current: number, previous: number): string => {
    if (previous === 0) return '0';
    return ((current / previous) * 100).toFixed(1);
  };

  // Calculate conversions between stages
  const conversions = stages.length > 1 ? stages.slice(1).map((stage, index) => ({
    from: stages[index].label,
    to: stage.label,
    rate: getConversionRate(stage.value, stages[index].value)
  })) : [];

  const firstStage = stages[0];
  const lastStage = stages[stages.length - 1];
  const overallConversion = stages.length > 1 
    ? getConversionRate(lastStage.value, firstStage.value)
    : '0';

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Funil de Vendas
            </CardTitle>
            <CardDescription>
              Acompanhe a conversão em cada etapa
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="h-8 w-8"
              >
                <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
              </Button>
            )}
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">
                R$ {(revenue / 1000).toFixed(revenue >= 1000 ? 0 : 1)}k
              </p>
              <p className="text-xs text-muted-foreground">Receita</p>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Funnel Bars */}
        <div className="space-y-3">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            const widthPercent = Math.max((stage.value / maxValue) * 100, 20);
            const prevStage = index > 0 ? stages[index - 1] : null;

            return (
              <div key={stage.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={cn('p-1.5 rounded-lg bg-opacity-20', stage.bgColor.replace('bg-', 'bg-') + '/20')}>
                      <Icon className={cn('w-4 h-4', stage.color)} />
                    </div>
                    <span className="font-medium">{stage.label}</span>
                  </div>
                  <span className="font-bold text-lg tabular-nums">
                    {stage.value.toLocaleString('pt-BR')}
                  </span>
                </div>
                
                <div className="relative h-10 bg-muted/30 rounded-lg overflow-hidden">
                  <div 
                    className={cn(
                      'absolute inset-y-0 left-0 rounded-lg transition-all duration-700 ease-out flex items-center justify-end pr-3',
                      stage.bgColor
                    )}
                    style={{ width: `${widthPercent}%` }}
                  >
                    {widthPercent > 25 && (
                      <span className="text-sm font-semibold text-white">
                        {((stage.value / maxValue) * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Conversion arrow between stages */}
                {prevStage && (
                  <div className="flex items-center justify-center gap-2 py-1 text-xs text-muted-foreground">
                    <ArrowDown className="w-3 h-3" />
                    <span>{getConversionRate(stage.value, prevStage.value)}% conversão</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Conversion Summary */}
        {conversions.length > 0 && (
          <div className={cn(
            "grid gap-2 pt-4 border-t",
            conversions.length <= 3 ? `grid-cols-${conversions.length}` : "grid-cols-2 sm:grid-cols-3"
          )}>
            {conversions.map((conv, idx) => (
              <div key={idx} className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">
                  {conv.from} → {conv.to}
                </p>
                <p className="text-lg font-bold text-foreground">
                  {conv.rate}%
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Overall Conversion */}
        {stages.length > 1 && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Conversão Geral</p>
                  <p className="text-xs text-muted-foreground">{firstStage.label} → {lastStage.label}</p>
                </div>
              </div>
              <span className="text-3xl font-bold text-primary">
                {overallConversion}%
              </span>
            </div>
          </div>
        )}
        
        {/* Message when no CRM connected */}
        {!hasCRMData && !funnelConfig && (
          <div className="p-4 rounded-xl bg-muted/30 border border-border text-center">
            <p className="text-sm text-muted-foreground">
              Conecte seu CRM para visualizar mais etapas do funil
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
