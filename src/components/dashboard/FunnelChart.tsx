import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Eye, Users, MousePointerClick, Percent, TrendingDown, Target, Coins } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FunnelChartProps {
  impressions: number;
  reach?: number;
  clicks: number;
  conversions: number;
  spend?: number;
  ctr?: number;
  cpc?: number;
  cpl?: number;
  currency?: string;
  className?: string;
}

interface FunnelStep {
  label: string;
  value: string;
  icon: React.ReactNode;
  widthPercent: number;
}

export function FunnelChart({
  impressions,
  reach = 0,
  clicks,
  conversions,
  spend = 0,
  ctr = 0,
  cpc = 0,
  cpl = 0,
  currency = 'BRL',
  className,
}: FunnelChartProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const steps: FunnelStep[] = useMemo(() => {
    return [
      {
        label: 'Gasto',
        value: formatCurrency(spend),
        icon: <DollarSign className="w-4 h-4" />,
        widthPercent: 100,
      },
      {
        label: 'Impressões',
        value: formatNumber(impressions),
        icon: <Eye className="w-4 h-4" />,
        widthPercent: 92,
      },
      {
        label: 'Alcance',
        value: formatNumber(reach),
        icon: <Users className="w-4 h-4" />,
        widthPercent: 84,
      },
      {
        label: 'Cliques',
        value: formatNumber(clicks),
        icon: <MousePointerClick className="w-4 h-4" />,
        widthPercent: 76,
      },
      {
        label: 'CTR',
        value: `${ctr.toFixed(2)}%`,
        icon: <Percent className="w-4 h-4" />,
        widthPercent: 68,
      },
      {
        label: 'CPC',
        value: formatCurrency(cpc),
        icon: <Coins className="w-4 h-4" />,
        widthPercent: 60,
      },
      {
        label: 'CPL',
        value: formatCurrency(cpl),
        icon: <TrendingDown className="w-4 h-4" />,
        widthPercent: 52,
      },
      {
        label: 'Leads',
        value: formatNumber(conversions),
        icon: <Target className="w-4 h-4" />,
        widthPercent: 44,
      },
    ];
  }, [spend, impressions, reach, clicks, ctr, cpc, cpl, conversions, currency]);

  return (
    <Card className={cn("glass-card overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
            <TrendingDown className="w-4 h-4 text-primary" />
          </div>
          Funil Geral
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="space-y-2 flex flex-col items-center">
          {steps.map((step, index) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.06, duration: 0.4, ease: "easeOut" }}
              className="w-full flex justify-center"
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${step.widthPercent}%` }}
                transition={{ delay: index * 0.06 + 0.1, duration: 0.5, ease: "easeOut" }}
                className={cn(
                  "relative h-11 rounded-md",
                  "bg-gradient-to-r from-primary via-primary to-primary/90",
                  "flex items-center justify-between px-4",
                  "border border-white/10",
                  "shadow-[0_4px_20px_-4px_hsl(var(--primary)/0.5)]"
                )}
                style={{ minWidth: '200px' }}
              >
                {/* Ícone e Label */}
                <div className="flex items-center gap-2 text-primary-foreground">
                  {step.icon}
                  <span className="text-xs font-medium">{step.label}</span>
                </div>
                
                {/* Valor */}
                <span className="text-sm font-bold text-primary-foreground">
                  {step.value}
                </span>

                {/* Efeito de brilho */}
                <div className="absolute inset-0 rounded-md bg-gradient-to-t from-transparent via-white/5 to-white/15 pointer-events-none" />
              </motion.div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
