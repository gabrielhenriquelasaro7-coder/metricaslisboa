import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, MousePointerClick, Target, ShoppingCart, MessageCircle, Users, TrendingDown, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FunnelChartProps {
  impressions: number;
  reach?: number;
  clicks: number;
  conversions: number;
  conversionValue?: number;
  messages?: number;
  spend?: number;
  currency?: string;
  className?: string;
  businessModel?: string | null;
}

interface FunnelStep {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

export function FunnelChart({
  impressions,
  reach,
  clicks,
  conversions,
  conversionValue = 0,
  messages = 0,
  spend = 0,
  currency = 'BRL',
  className,
  businessModel
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

  const formatCurrencyCompact = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const steps: FunnelStep[] = useMemo(() => {
    const baseSteps: FunnelStep[] = [];
    
    // Impressões (maior)
    baseSteps.push({
      label: 'Impressões',
      value: impressions,
      icon: <Eye className="w-4 h-4" />,
      color: 'from-warning via-warning to-warning/90',
      bgColor: 'bg-warning',
    });

    // Alcance (se disponível)
    if (reach && reach > 0) {
      baseSteps.push({
        label: 'Alcance',
        value: reach,
        icon: <Users className="w-4 h-4" />,
        color: 'from-warning via-warning to-warning/90',
        bgColor: 'bg-warning',
      });
    }

    // Cliques
    baseSteps.push({
      label: 'Cliques',
      value: clicks,
      icon: <MousePointerClick className="w-4 h-4" />,
      color: 'from-warning via-warning to-warning/90',
      bgColor: 'bg-warning',
    });

    // Mensagens (se disponível para inside_sales)
    if (messages && messages > 0 && businessModel === 'inside_sales') {
      baseSteps.push({
        label: 'Mensagens',
        value: messages,
        icon: <MessageCircle className="w-4 h-4" />,
        color: 'from-warning via-warning to-warning/90',
        bgColor: 'bg-warning',
      });
    }

    // Conversões/Resultados
    baseSteps.push({
      label: businessModel === 'ecommerce' ? 'Compras' : 'Conversões',
      value: conversions,
      icon: businessModel === 'ecommerce' ? <ShoppingCart className="w-4 h-4" /> : <Target className="w-4 h-4" />,
      color: 'from-warning via-warning to-warning/90',
      bgColor: 'bg-warning',
    });

    return baseSteps;
  }, [impressions, reach, clicks, conversions, messages, businessModel]);

  // Calcular a largura de cada step baseado no valor
  const maxValue = Math.max(...steps.map(s => s.value));

  return (
    <Card className={cn("glass-card overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-warning/20 to-warning/10 flex items-center justify-center">
            <TrendingDown className="w-4 h-4 text-warning" />
          </div>
          Funil Geral
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        {/* Header das colunas */}
        <div className="flex items-center mb-4 text-xs text-muted-foreground font-medium">
          <div className="flex-1" />
          <div className="w-20 text-center">Taxa</div>
          <div className="w-24 text-right">Custo/Ação</div>
        </div>

        <div className="space-y-2">
          {steps.map((step, index) => {
            // Calcula a largura baseada no valor proporcional
            const widthPercent = maxValue > 0 ? Math.max((step.value / maxValue) * 100, 25) : 25;
            
            // Taxa de conversão do step anterior para este
            const conversionRate = index > 0 && steps[index - 1].value > 0 
              ? ((step.value / steps[index - 1].value) * 100)
              : 100;

            // Custo por ação (spend / valor do step)
            const costPerAction = step.value > 0 ? spend / step.value : 0;

            return (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08, duration: 0.4 }}
                className="flex items-center gap-3"
              >
                {/* Barra do funil */}
                <div className="flex-1 flex items-center justify-center">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${widthPercent}%` }}
                    transition={{ delay: index * 0.08 + 0.15, duration: 0.5, ease: "easeOut" }}
                    className={cn(
                      "relative h-12 rounded-md bg-gradient-to-r shadow-lg",
                      step.color,
                      "flex items-center justify-between px-3",
                      "border border-white/20"
                    )}
                    style={{
                      minWidth: '160px',
                      boxShadow: '0 4px 16px -4px hsl(var(--warning) / 0.4)'
                    }}
                  >
                    {/* Ícone e Label */}
                    <div className="flex items-center gap-2 text-warning-foreground">
                      {step.icon}
                      <span className="text-xs font-medium truncate">{step.label}</span>
                    </div>
                    
                    {/* Valor */}
                    <div className="text-right">
                      <span className="text-base font-bold text-warning-foreground">
                        {formatNumber(step.value)}
                      </span>
                    </div>

                    {/* Efeito de brilho */}
                    <div className="absolute inset-0 rounded-md bg-gradient-to-t from-transparent via-white/5 to-white/15 pointer-events-none" />
                  </motion.div>
                </div>

                {/* Taxa de conversão */}
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.08 + 0.3, duration: 0.3 }}
                  className="w-20 text-center"
                >
                  <span className={cn(
                    "text-sm font-semibold",
                    index === 0 ? "text-muted-foreground" : conversionRate >= 50 ? "text-success" : conversionRate >= 20 ? "text-warning" : "text-destructive"
                  )}>
                    {index === 0 ? '-' : `${conversionRate.toFixed(0)}%`}
                  </span>
                </motion.div>

                {/* Custo por ação */}
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.08 + 0.35, duration: 0.3 }}
                  className="w-24 text-right"
                >
                  <span className="text-sm font-semibold text-foreground">
                    {formatCurrencyCompact(costPerAction)}
                  </span>
                </motion.div>
              </motion.div>
            );
          })}
        </div>

        {/* Resumo final */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: steps.length * 0.08 + 0.4, duration: 0.4 }}
          className="mt-6 pt-4 border-t border-border/50 space-y-3"
        >
          {/* Investimento */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Investimento Total</span>
            </div>
            <span className="text-lg font-bold text-primary">
              {formatCurrency(spend)}
            </span>
          </div>

          {/* Valor de conversão */}
          {conversionValue > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Valor em Conversões</span>
              </div>
              <span className="text-lg font-bold text-success">
                {formatCurrency(conversionValue)}
              </span>
            </div>
          )}

          {/* Taxa geral */}
          <div className="flex items-center justify-between text-sm pt-2 border-t border-border/30">
            <span className="text-muted-foreground">Taxa de Conversão Geral</span>
            <span className="font-semibold text-foreground">
              {impressions > 0 ? ((conversions / impressions) * 100).toFixed(3) : '0.000'}%
            </span>
          </div>
        </motion.div>
      </CardContent>
    </Card>
  );
}
