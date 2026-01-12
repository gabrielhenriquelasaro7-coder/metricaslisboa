import { 
  TrendingUp, 
  DollarSign,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Equal,
  Megaphone
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface ROASRealCardProps {
  adSpend: number;
  crmRevenue: number;
  currency?: string;
  periodLabel?: string;
}

export function ROASRealCard({
  adSpend,
  crmRevenue,
  currency = 'BRL',
  periodLabel = 'Últimos 30 dias'
}: ROASRealCardProps) {
  const roas = adSpend > 0 ? crmRevenue / adSpend : 0;
  const roi = adSpend > 0 ? ((crmRevenue - adSpend) / adSpend) * 100 : 0;
  const profit = crmRevenue - adSpend;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(value);
  };

  const roasStatus = roas >= 3 ? 'excellent' : roas >= 2 ? 'good' : roas >= 1 ? 'break-even' : 'negative';

  const statusConfig = {
    excellent: { 
      label: 'Excelente', 
      color: 'text-metric-positive', 
      bgColor: 'bg-metric-positive/10',
      borderColor: 'border-metric-positive/30'
    },
    good: { 
      label: 'Bom', 
      color: 'text-green-400', 
      bgColor: 'bg-green-400/10',
      borderColor: 'border-green-400/30'
    },
    'break-even': { 
      label: 'Equilibrado', 
      color: 'text-yellow-500', 
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/30'
    },
    negative: { 
      label: 'Negativo', 
      color: 'text-destructive', 
      bgColor: 'bg-destructive/10',
      borderColor: 'border-destructive/30'
    }
  };

  const config = statusConfig[roasStatus];

  return (
    <Card className={cn('relative overflow-hidden', config.borderColor)}>
      <div className="absolute top-0 right-0 w-32 sm:w-40 h-32 sm:h-40 bg-gradient-to-bl from-primary/5 to-transparent rounded-bl-full" />
      
      <CardHeader className="pb-2 p-3 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <CardDescription className="text-[10px] sm:text-xs mb-1">{periodLabel}</CardDescription>
            <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
              ROAS Real
              <Badge className={cn('font-medium text-[10px] sm:text-xs px-1.5 sm:px-2', config.color, config.bgColor)}>
                {config.label}
              </Badge>
            </CardTitle>
          </div>
          <div className={cn('p-2 sm:p-3 rounded-xl', config.bgColor)}>
            <TrendingUp className={cn('w-4 h-4 sm:w-6 sm:h-6', config.color)} />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 sm:space-y-6 p-3 sm:p-6 pt-0">
        {/* ROAS Principal */}
        <div className="text-center py-2 sm:py-4">
          <div className={cn('text-3xl sm:text-5xl font-bold tracking-tight', config.color)}>
            {roas.toFixed(2)}x
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Retorno sobre investimento
          </p>
        </div>

        <Separator />

        {/* Cálculo Visual */}
        <div className="space-y-2 sm:space-y-4">
          <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
                <DollarSign className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Receita CRM</p>
                <p className="text-sm sm:text-base font-semibold">{formatCurrency(crmRevenue)}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-muted flex items-center justify-center">
              <span className="text-base sm:text-lg font-bold text-muted-foreground">÷</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-destructive/10">
                <Megaphone className="w-3 h-3 sm:w-4 sm:h-4 text-destructive" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Investimento Ads</p>
                <p className="text-sm sm:text-base font-semibold">{formatCurrency(adSpend)}</p>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Métricas Adicionais */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          <div className="text-center p-2 sm:p-3 rounded-lg bg-muted/30">
            <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">ROI</p>
            <div className={cn(
              'text-base sm:text-xl font-bold flex items-center justify-center gap-0.5 sm:gap-1',
              roi >= 0 ? 'text-metric-positive' : 'text-destructive'
            )}>
              {roi >= 0 ? <ArrowUpRight className="w-3 h-3 sm:w-4 sm:h-4" /> : <ArrowDownRight className="w-3 h-3 sm:w-4 sm:h-4" />}
              {Math.abs(roi).toFixed(0)}%
            </div>
          </div>
          <div className="text-center p-2 sm:p-3 rounded-lg bg-muted/30">
            <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">Lucro</p>
            <div className={cn(
              'text-base sm:text-xl font-bold',
              profit >= 0 ? 'text-metric-positive' : 'text-destructive'
            )}>
              {profit >= 1000 ? `R$ ${(profit / 1000).toFixed(0)}k` : formatCurrency(profit)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
