import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, MousePointerClick, Target, ShoppingCart, MessageCircle, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FunnelChartProps {
  impressions: number;
  reach?: number;
  clicks: number;
  conversions: number;
  conversionValue?: number;
  messages?: number;
  currency?: string;
  className?: string;
  businessModel?: string | null;
}

interface FunnelStep {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  percentage?: number;
}

export function FunnelChart({
  impressions,
  reach,
  clicks,
  conversions,
  conversionValue = 0,
  messages = 0,
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
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const steps: FunnelStep[] = useMemo(() => {
    const baseSteps: FunnelStep[] = [];
    
    // Impressões (maior)
    baseSteps.push({
      label: 'Impressões',
      value: impressions,
      icon: <Eye className="w-4 h-4" />,
      color: 'from-primary/90 to-primary',
      percentage: 100,
    });

    // Alcance (se disponível)
    if (reach && reach > 0) {
      baseSteps.push({
        label: 'Alcance',
        value: reach,
        icon: <Users className="w-4 h-4" />,
        color: 'from-chart-2/90 to-chart-2',
        percentage: impressions > 0 ? (reach / impressions) * 100 : 0,
      });
    }

    // Cliques
    baseSteps.push({
      label: 'Cliques',
      value: clicks,
      icon: <MousePointerClick className="w-4 h-4" />,
      color: 'from-warning/90 to-warning',
      percentage: impressions > 0 ? (clicks / impressions) * 100 : 0,
    });

    // Mensagens (se disponível para inside_sales)
    if (messages && messages > 0 && businessModel === 'inside_sales') {
      baseSteps.push({
        label: 'Mensagens',
        value: messages,
        icon: <MessageCircle className="w-4 h-4" />,
        color: 'from-chart-5/90 to-chart-5',
        percentage: clicks > 0 ? (messages / clicks) * 100 : 0,
      });
    }

    // Conversões/Resultados
    baseSteps.push({
      label: businessModel === 'ecommerce' ? 'Compras' : 'Conversões',
      value: conversions,
      icon: businessModel === 'ecommerce' ? <ShoppingCart className="w-4 h-4" /> : <Target className="w-4 h-4" />,
      color: 'from-success/90 to-success',
      percentage: clicks > 0 ? (conversions / clicks) * 100 : 0,
    });

    return baseSteps;
  }, [impressions, reach, clicks, conversions, messages, businessModel]);

  // Calcular a largura de cada step baseado no valor
  const maxValue = Math.max(...steps.map(s => s.value));

  return (
    <Card className={cn("glass-card overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
            <Target className="w-4 h-4 text-primary" />
          </div>
          Funil de Conversão
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-3">
          {steps.map((step, index) => {
            // Calcula a largura baseada no valor proporcional
            const widthPercent = maxValue > 0 ? Math.max((step.value / maxValue) * 100, 20) : 20;
            
            // Taxa de conversão do step anterior para este
            const conversionRate = index > 0 && steps[index - 1].value > 0 
              ? ((step.value / steps[index - 1].value) * 100).toFixed(1)
              : null;

            return (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1, duration: 0.4 }}
                className="relative"
              >
                {/* Linha conectora */}
                {index > 0 && (
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 flex flex-col items-center">
                    <div className="w-px h-2 bg-border/50" />
                    {conversionRate && (
                      <span className="text-[10px] text-muted-foreground bg-card px-1.5 py-0.5 rounded-full border border-border/50 -mt-0.5">
                        {conversionRate}%
                      </span>
                    )}
                  </div>
                )}

                {/* Barra do funil */}
                <div className="flex items-center justify-center">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${widthPercent}%` }}
                    transition={{ delay: index * 0.1 + 0.2, duration: 0.5, ease: "easeOut" }}
                    className={cn(
                      "relative h-14 rounded-lg bg-gradient-to-r shadow-lg",
                      step.color,
                      "flex items-center justify-between px-4",
                      "border border-white/10"
                    )}
                    style={{
                      minWidth: '180px',
                      boxShadow: `0 4px 20px -4px hsl(var(--${step.color.includes('success') ? 'success' : step.color.includes('warning') ? 'warning' : 'primary'}) / 0.3)`
                    }}
                  >
                    {/* Ícone e Label */}
                    <div className="flex items-center gap-2 text-white/90">
                      {step.icon}
                      <span className="text-sm font-medium truncate">{step.label}</span>
                    </div>
                    
                    {/* Valor */}
                    <div className="text-right">
                      <span className="text-lg font-bold text-white">
                        {formatNumber(step.value)}
                      </span>
                    </div>

                    {/* Efeito de brilho */}
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-t from-transparent via-white/5 to-white/10 pointer-events-none" />
                  </motion.div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Resumo final */}
        {conversionValue > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: steps.length * 0.1 + 0.3, duration: 0.4 }}
            className="mt-6 pt-4 border-t border-border/50"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Valor Total em Conversões</span>
              <span className="text-xl font-bold text-success">
                {formatCurrency(conversionValue)}
              </span>
            </div>
          </motion.div>
        )}

        {/* Taxa de conversão geral */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: steps.length * 0.1 + 0.4, duration: 0.4 }}
          className={cn("mt-4 pt-4 border-t border-border/50", !conversionValue && "mt-6")}
        >
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Taxa de Conversão Geral</span>
            <span className="font-semibold text-foreground">
              {impressions > 0 ? ((conversions / impressions) * 100).toFixed(2) : '0.00'}%
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-muted-foreground">CTR (Cliques/Impressões)</span>
            <span className="font-semibold text-foreground">
              {impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00'}%
            </span>
          </div>
        </motion.div>
      </CardContent>
    </Card>
  );
}
