import { 
  TrendingUp, 
  TrendingDown, 
  MinusCircle,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface DREItem {
  label: string;
  value: number;
  isTotal?: boolean;
  isSubtraction?: boolean;
  indent?: number;
  highlight?: boolean;
}

interface FinancialDRECardProps {
  grossRevenue?: number;
  deductions?: number;
  netRevenue?: number;
  cac?: number;
  contributionMargin?: number;
  operationalExpenses?: number;
  ebitda?: number;
  currency?: string;
}

export function FinancialDRECard({
  grossRevenue = 0,
  deductions = 0,
  netRevenue = 0,
  cac = 0,
  contributionMargin = 0,
  operationalExpenses = 0,
  ebitda = 0,
  currency = 'BRL'
}: FinancialDRECardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(value);
  };

  const items: DREItem[] = [
    { label: 'Receita Bruta', value: grossRevenue, highlight: true },
    { label: 'Deduções (impostos, devoluções)', value: deductions, isSubtraction: true, indent: 1 },
    { label: 'Receita Líquida', value: netRevenue, isTotal: true },
    { label: 'Custo de Aquisição (CAC)', value: cac, isSubtraction: true, indent: 1 },
    { label: 'Margem de Contribuição', value: contributionMargin, isTotal: true },
    { label: 'Despesas Operacionais', value: operationalExpenses, isSubtraction: true, indent: 1 },
    { label: 'EBITDA', value: ebitda, isTotal: true, highlight: true },
  ];

  const ebitdaMargin = grossRevenue > 0 ? (ebitda / grossRevenue) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Demonstração de Resultado (DRE)</CardTitle>
            <CardDescription>Visão financeira simplificada do projeto</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Margem EBITDA</p>
            <p className={cn(
              'text-2xl font-bold',
              ebitdaMargin >= 20 ? 'text-metric-positive' : 
              ebitdaMargin >= 10 ? 'text-yellow-500' : 'text-destructive'
            )}>
              {ebitdaMargin.toFixed(1)}%
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {items.map((item, index) => (
            <div key={item.label}>
              <div 
                className={cn(
                  'flex items-center justify-between py-3 px-3 rounded-lg transition-colors',
                  item.isTotal && 'bg-muted/50 font-medium',
                  item.highlight && 'bg-primary/5',
                  !item.isTotal && !item.highlight && 'hover:bg-muted/30'
                )}
              >
                <div className="flex items-center gap-2">
                  {item.indent && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                  )}
                  <span className={cn(
                    'text-sm',
                    item.isSubtraction && 'text-muted-foreground',
                    item.isTotal && 'font-semibold',
                    item.highlight && item.label === 'EBITDA' && 'text-lg font-bold'
                  )}>
                    {item.isSubtraction && '(-) '}
                    {item.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {item.label === 'EBITDA' && (
                    <>
                      {ebitda > 0 ? (
                        <TrendingUp className="w-4 h-4 text-metric-positive" />
                      ) : ebitda < 0 ? (
                        <TrendingDown className="w-4 h-4 text-destructive" />
                      ) : (
                        <MinusCircle className="w-4 h-4 text-muted-foreground" />
                      )}
                    </>
                  )}
                  <span className={cn(
                    'tabular-nums',
                    item.isSubtraction && 'text-muted-foreground',
                    item.isTotal && 'font-semibold',
                    item.highlight && item.label === 'EBITDA' && 'text-lg font-bold',
                    item.label === 'EBITDA' && (ebitda >= 0 ? 'text-metric-positive' : 'text-destructive')
                  )}>
                    {formatCurrency(item.value)}
                  </span>
                </div>
              </div>
              {item.isTotal && index < items.length - 1 && (
                <Separator className="my-2" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
