import { 
  Users, 
  Target, 
  Handshake, 
  CheckCircle2,
  ArrowDown,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FunnelStage {
  id: string;
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

interface InsideSalesFunnelProps {
  leads?: number;
  mql?: number;
  sql?: number;
  sales?: number;
  revenue?: number;
}

export function InsideSalesFunnel({
  leads = 0,
  mql = 0,
  sql = 0,
  sales = 0,
  revenue = 0,
}: InsideSalesFunnelProps) {
  const stages: FunnelStage[] = [
    { id: 'leads', label: 'Leads', value: leads, icon: Users, color: 'text-blue-500', bgColor: 'bg-blue-500' },
    { id: 'mql', label: 'MQL', value: mql, icon: Target, color: 'text-cyan-500', bgColor: 'bg-cyan-500' },
    { id: 'sql', label: 'SQL', value: sql, icon: Handshake, color: 'text-purple-500', bgColor: 'bg-purple-500' },
    { id: 'sales', label: 'Vendas', value: sales, icon: CheckCircle2, color: 'text-metric-positive', bgColor: 'bg-metric-positive' },
  ];

  const maxValue = Math.max(...stages.map(s => s.value), 1);

  const getConversionRate = (current: number, previous: number): string => {
    if (previous === 0) return '0';
    return ((current / previous) * 100).toFixed(1);
  };

  const conversions = [
    { from: 'Lead', to: 'MQL', rate: getConversionRate(mql, leads) },
    { from: 'MQL', to: 'SQL', rate: getConversionRate(sql, mql) },
    { from: 'SQL', to: 'Venda', rate: getConversionRate(sales, sql) },
  ];

  const overallConversion = getConversionRate(sales, leads);

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
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">
              R$ {(revenue / 1000).toFixed(revenue >= 1000 ? 0 : 1)}k
            </p>
            <p className="text-xs text-muted-foreground">Receita</p>
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
        <div className="grid grid-cols-3 gap-2 pt-4 border-t">
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

        {/* Overall Conversion */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Conversão Geral</p>
                <p className="text-xs text-muted-foreground">Lead → Venda</p>
              </div>
            </div>
            <span className="text-3xl font-bold text-primary">
              {overallConversion}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
