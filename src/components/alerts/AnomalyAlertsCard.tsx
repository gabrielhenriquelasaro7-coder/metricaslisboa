import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { 
  AlertTriangle, 
  Bell, 
  Check, 
  Eye, 
  Loader2,
  TrendingDown,
  TrendingUp,
  PauseCircle,
  DollarSign,
  RefreshCw,
  Settings
} from 'lucide-react';
import { AnomalyAlertConfigDialog } from './AnomalyAlertConfigDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface AnomalyAlertDetails {
  old_value?: number;
  new_value?: number;
  threshold?: number;
  percentage_change?: number;
  old_status?: string;
  new_status?: string;
  budget_old?: number;
  budget_new?: number;
}

interface AnomalyAlert {
  id: string;
  project_id: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  anomaly_type: string;
  severity: string;
  details: AnomalyAlertDetails | null;
  notified: boolean;
  notified_at: string | null;
  created_at: string;
}

interface AnomalyAlertsCardProps {
  projectId: string;
}

const getAnomalyIcon = (type: string) => {
  switch (type) {
    case 'ctr_drop':
      return <TrendingDown className="w-4 h-4" />;
    case 'cpl_increase':
      return <TrendingUp className="w-4 h-4" />;
    case 'campaign_paused':
    case 'ad_set_paused':
    case 'ad_paused':
      return <PauseCircle className="w-4 h-4" />;
    case 'budget_change':
      return <DollarSign className="w-4 h-4" />;
    default:
      return <AlertTriangle className="w-4 h-4" />;
  }
};

const getAnomalyLabel = (type: string) => {
  switch (type) {
    case 'ctr_drop':
      return 'Queda de CTR';
    case 'cpl_increase':
      return 'Aumento de CPL';
    case 'campaign_paused':
      return 'Campanha Pausada';
    case 'ad_set_paused':
      return 'Conjunto Pausado';
    case 'ad_paused':
      return 'Anúncio Pausado';
    case 'budget_change':
      return 'Mudança de Orçamento';
    default:
      return type;
  }
};

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/20 text-red-500 border-red-500/30';
    case 'warning':
      return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
    case 'info':
      return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

const formatAnomalyDetails = (alert: AnomalyAlert): string => {
  const details = alert.details;
  if (!details) return '';

  switch (alert.anomaly_type) {
    case 'ctr_drop':
      return `${details.old_value?.toFixed(2)}% → ${details.new_value?.toFixed(2)}% (${details.percentage_change?.toFixed(1)}% queda)`;
    case 'cpl_increase':
      return `R$ ${details.old_value?.toFixed(2)} → R$ ${details.new_value?.toFixed(2)} (${details.percentage_change?.toFixed(1)}% aumento)`;
    case 'campaign_paused':
    case 'ad_set_paused':
    case 'ad_paused':
      return `Status: ${details.old_status} → ${details.new_status}`;
    case 'budget_change':
      return `R$ ${details.budget_old?.toFixed(2)} → R$ ${details.budget_new?.toFixed(2)}`;
    default:
      return '';
  }
};

export function AnomalyAlertsCard({ projectId }: AnomalyAlertsCardProps) {
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState<string | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('anomaly_alerts')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setAlerts((data || []).map(item => ({
        ...item,
        details: item.details as AnomalyAlertDetails | null
      })));
    } catch (error) {
      console.error('Error fetching anomaly alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchAlerts();
    }
  }, [projectId]);

  const markAsRead = async (alertId: string) => {
    try {
      setMarkingRead(alertId);
      const { error } = await supabase
        .from('anomaly_alerts')
        .update({ notified: true, notified_at: new Date().toISOString() })
        .eq('id', alertId);

      if (error) throw error;

      setAlerts(prev => 
        prev.map(a => 
          a.id === alertId 
            ? { ...a, notified: true, notified_at: new Date().toISOString() } 
            : a
        )
      );
      toast.success('Alerta marcado como lido');
    } catch (error) {
      console.error('Error marking alert as read:', error);
      toast.error('Erro ao marcar alerta');
    } finally {
      setMarkingRead(null);
    }
  };

  const markAllAsRead = async () => {
    const unreadAlerts = alerts.filter(a => !a.notified);
    if (unreadAlerts.length === 0) return;

    try {
      setMarkingRead('all');
      const { error } = await supabase
        .from('anomaly_alerts')
        .update({ notified: true, notified_at: new Date().toISOString() })
        .eq('project_id', projectId)
        .eq('notified', false);

      if (error) throw error;

      setAlerts(prev => 
        prev.map(a => ({ ...a, notified: true, notified_at: new Date().toISOString() }))
      );
      toast.success('Todos os alertas marcados como lidos');
    } catch (error) {
      console.error('Error marking all alerts as read:', error);
      toast.error('Erro ao marcar alertas');
    } finally {
      setMarkingRead(null);
    }
  };

  const unreadCount = alerts.filter(a => !a.notified).length;

  return (
    <Card className="glass-card border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Alertas de Anomalias
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount} {unreadCount === 1 ? 'novo' : 'novos'}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Anomalias detectadas nas suas campanhas
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfigDialogOpen(true)}
              title="Configurar alertas"
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchAlerts}
              disabled={loading}
              title="Atualizar"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
                disabled={markingRead === 'all'}
              >
                {markingRead === 'all' ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Marcar todos
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma anomalia detectada</p>
            <p className="text-sm">Configure os alertas para receber notificações</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`relative flex items-start gap-3 p-4 rounded-xl transition-all duration-200 hover:scale-[1.01] border ${
                  alert.notified
                    ? 'bg-muted/30 border-border/50 opacity-70'
                    : getSeverityColor(alert.severity)
                }`}
              >
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  alert.notified 
                    ? 'bg-muted text-muted-foreground' 
                    : getSeverityColor(alert.severity)
                }`}>
                  {getAnomalyIcon(alert.anomaly_type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-sm">
                      {getAnomalyLabel(alert.anomaly_type)}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {alert.entity_type === 'campaign' ? 'Campanha' : 
                       alert.entity_type === 'ad_set' ? 'Conjunto' : 'Anúncio'}
                    </Badge>
                    {alert.notified && (
                      <Badge variant="outline" className="text-xs bg-muted">
                        <Eye className="w-3 h-3 mr-1" />
                        Lido
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-foreground/80 truncate">
                    {alert.entity_name}
                  </p>
                  {formatAnomalyDetails(alert) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatAnomalyDetails(alert)}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                    <span>{format(new Date(alert.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
                  </div>
                </div>

                {!alert.notified && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-shrink-0"
                    onClick={() => markAsRead(alert.id)}
                    disabled={markingRead === alert.id}
                  >
                    {markingRead === alert.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AnomalyAlertConfigDialog
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        projectId={projectId}
      />
    </Card>
  );
}
