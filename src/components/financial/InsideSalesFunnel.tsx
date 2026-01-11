import { 
  Users, 
  Phone, 
  Calendar, 
  FileText, 
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FunnelStage {
  id: string;
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}

interface InsideSalesFunnelProps {
  leadsReceived?: number;
  leadsContacted?: number;
  meetingsScheduled?: number;
  proposalsSent?: number;
  dealsClosed?: number;
}

export function InsideSalesFunnel({
  leadsReceived = 0,
  leadsContacted = 0,
  meetingsScheduled = 0,
  proposalsSent = 0,
  dealsClosed = 0
}: InsideSalesFunnelProps) {
  const stages: FunnelStage[] = [
    { id: 'leads', label: 'Leads Recebidos', value: leadsReceived, icon: Users, color: 'bg-blue-500' },
    { id: 'contacted', label: 'Contatados', value: leadsContacted, icon: Phone, color: 'bg-cyan-500' },
    { id: 'meetings', label: 'Reuniões', value: meetingsScheduled, icon: Calendar, color: 'bg-purple-500' },
    { id: 'proposals', label: 'Propostas', value: proposalsSent, icon: FileText, color: 'bg-orange-500' },
    { id: 'deals', label: 'Vendas', value: dealsClosed, icon: CheckCircle2, color: 'bg-metric-positive' },
  ];

  const maxValue = Math.max(...stages.map(s => s.value), 1);

  const getConversionRate = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return ((current / previous) * 100).toFixed(1);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Funil de Vendas
        </CardTitle>
        <CardDescription>
          Acompanhe a conversão em cada etapa do processo comercial
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          const widthPercent = Math.max((stage.value / maxValue) * 100, 15);
          const previousStage = index > 0 ? stages[index - 1] : null;
          const conversionRate = previousStage 
            ? getConversionRate(stage.value, previousStage.value)
            : null;

          return (
            <div key={stage.id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={cn('p-1.5 rounded-lg', stage.color.replace('bg-', 'bg-') + '/20')}>
                    <Icon className={cn('w-4 h-4', stage.color.replace('bg-', 'text-'))} />
                  </div>
                  <span className="font-medium">{stage.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  {conversionRate !== null && (
                    <span className="text-xs text-muted-foreground">
                      {conversionRate}% conversão
                    </span>
                  )}
                  <span className="font-bold text-lg tabular-nums">
                    {stage.value.toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
              
              <div className="relative h-8 bg-muted/30 rounded-lg overflow-hidden">
                <div 
                  className={cn(
                    'absolute inset-y-0 left-0 rounded-lg transition-all duration-500 ease-out flex items-center justify-end pr-3',
                    stage.color
                  )}
                  style={{ width: `${widthPercent}%` }}
                >
                  {widthPercent > 20 && (
                    <span className="text-xs font-medium text-white">
                      {stage.value > 0 ? `${((stage.value / maxValue) * 100).toFixed(0)}%` : ''}
                    </span>
                  )}
                </div>
              </div>

              {index < stages.length - 1 && (
                <div className="flex justify-center py-1">
                  <ArrowRight className="w-4 h-4 text-muted-foreground/50 rotate-90" />
                </div>
              )}
            </div>
          );
        })}

        {/* Taxa de conversão geral */}
        <div className="mt-6 p-4 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Taxa de conversão geral</p>
              <p className="text-xs text-muted-foreground">Lead → Venda</p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold text-primary">
                {getConversionRate(dealsClosed, leadsReceived)}%
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
