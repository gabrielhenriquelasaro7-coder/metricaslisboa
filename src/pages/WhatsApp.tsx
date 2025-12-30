import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  MessageSquare, 
  Loader2, 
  Save, 
  Send, 
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Eye,
  Edit3,
  RotateCcw
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WhatsAppSubscription {
  id: string;
  user_id: string;
  project_id: string;
  phone_number: string;
  weekly_report_enabled: boolean;
  report_day_of_week: number;
  report_time: string;
  report_period: string;
  message_template?: string | null;
  include_spend?: boolean | null;
  include_leads?: boolean | null;
  include_cpl?: boolean | null;
  include_impressions?: boolean | null;
  include_clicks?: boolean | null;
  include_ctr?: boolean | null;
  include_roas?: boolean | null;
  include_reach?: boolean | null;
  include_cpm?: boolean | null;
  include_cpc?: boolean | null;
  include_conversions?: boolean | null;
  include_conversion_value?: boolean | null;
  include_frequency?: boolean | null;
  last_report_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

interface WhatsAppMessageLog {
  id: string;
  subscription_id: string;
  message_type: string;
  content: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
];

const TIME_OPTIONS = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
];

const PERIOD_OPTIONS = [
  { value: 'last_7_days', label: 'Últimos 7 dias' },
  { value: 'last_14_days', label: 'Últimos 14 dias' },
  { value: 'last_30_days', label: 'Últimos 30 dias' },
  { value: 'this_week', label: 'Esta semana' },
  { value: 'last_week', label: 'Semana passada' },
  { value: 'this_month', label: 'Este mês' },
  { value: 'last_month', label: 'Mês passado' },
];

const DEFAULT_MESSAGE_TEMPLATE = `📊 *Relatório de Tráfego - {projeto}*
📅 Período: {periodo}

━━━━━━━━━━━━━━━━━━━━━

{investimento}
{alcance}
{impressoes}
{frequencia}
{cliques}
{ctr}
{cpm}
{cpc}
{conversoes}
{valor_conversao}
{cpl}
{roas}

━━━━━━━━━━━━━━━━━━━━━

_Relatório gerado automaticamente_`;

// All available metrics with their config
const METRICS_CONFIG = [
  { id: 'spend', key: 'investimento', label: '💰 Investimento', emoji: '💰', preview: 'R$ 5.234,50' },
  { id: 'reach', key: 'alcance', label: '👁️ Alcance', emoji: '👁️', preview: '32.5K' },
  { id: 'impressions', key: 'impressoes', label: '📺 Impressões', emoji: '📺', preview: '45.2K' },
  { id: 'frequency', key: 'frequencia', label: '🔄 Frequência', emoji: '🔄', preview: '1.39' },
  { id: 'clicks', key: 'cliques', label: '👆 Cliques', emoji: '👆', preview: '1.823' },
  { id: 'ctr', key: 'ctr', label: '📈 CTR', emoji: '📈', preview: '3.98%' },
  { id: 'cpm', key: 'cpm', label: '💵 CPM', emoji: '💵', preview: 'R$ 115,78' },
  { id: 'cpc', key: 'cpc', label: '💳 CPC', emoji: '💳', preview: 'R$ 2,87' },
  { id: 'conversions', key: 'conversoes', label: '🎯 Conversões', emoji: '🎯', preview: '127' },
  { id: 'conversion_value', key: 'valor_conversao', label: '💎 Valor Conversão', emoji: '💎', preview: 'R$ 23.545,00' },
  { id: 'leads', key: 'cpl', label: '📊 CPL / CPA', emoji: '📊', preview: 'R$ 41,22' },
  { id: 'roas', key: 'roas', label: '🚀 ROAS', emoji: '🚀', preview: '4.5x' },
];

function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  
  if (digits.length <= 2) {
    return `(${digits}`;
  }
  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

function generatePreview(
  template: string,
  projectName: string,
  period: string,
  enabledMetrics: Record<string, boolean>
): string {
  const periodLabel = PERIOD_OPTIONS.find(p => p.value === period)?.label || 'Últimos 7 dias';
  
  let result = template
    .replace('{periodo}', periodLabel)
    .replace('{projeto}', projectName);
  
  // Replace each metric variable
  METRICS_CONFIG.forEach(metric => {
    const isEnabled = enabledMetrics[metric.id] ?? true;
    const varName = `{${metric.key}}`;
    
    if (isEnabled) {
      result = result.replace(varName, `${metric.emoji} ${metric.label.replace(/^[^\s]+ /, '')}: ${metric.preview}`);
    } else {
      // Remove the line with this variable
      result = result.replace(new RegExp(`.*\\{${metric.key}\\}.*\\n?`, 'g'), '');
    }
  });
  
  // Clean up multiple empty lines
  result = result.replace(/\n{3,}/g, '\n\n');
  
  return result;
}

export default function WhatsApp() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { projects } = useProjects();
  
  const selectedProjectId = localStorage.getItem('selectedProjectId');
  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0];

  // Subscription state
  const [subscription, setSubscription] = useState<WhatsAppSubscription | null>(null);
  const [messageLogs, setMessageLogs] = useState<WhatsAppMessageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  // Form state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [weeklyReportEnabled, setWeeklyReportEnabled] = useState(true);
  const [reportDayOfWeek, setReportDayOfWeek] = useState(1);
  const [reportTime, setReportTime] = useState('08:00');
  const [reportPeriod, setReportPeriod] = useState('last_7_days');
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_MESSAGE_TEMPLATE);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Metrics selection - all metrics
  const [metricsEnabled, setMetricsEnabled] = useState<Record<string, boolean>>({
    spend: true,
    reach: true,
    impressions: true,
    frequency: true,
    clicks: true,
    ctr: true,
    cpm: true,
    cpc: true,
    conversions: true,
    conversion_value: true,
    leads: true,
    roas: true,
  });

  const toggleMetric = (id: string) => {
    setMetricsEnabled(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Fetch subscription for current project
  const fetchSubscription = useCallback(async () => {
    if (!user || !selectedProject) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('whatsapp_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('project_id', selectedProject.id)
        .maybeSingle();

      if (error) throw error;
      setSubscription(data);
    } catch (error) {
      console.error('Error fetching WhatsApp subscription:', error);
    } finally {
      setLoading(false);
    }
  }, [user, selectedProject]);

  // Fetch message logs
  const fetchMessageLogs = useCallback(async () => {
    if (!subscription) return;

    try {
      const { data, error } = await supabase
        .from('whatsapp_messages_log')
        .select('*')
        .eq('subscription_id', subscription.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setMessageLogs(data || []);
    } catch (error) {
      console.error('Error fetching message logs:', error);
    }
  }, [subscription]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  useEffect(() => {
    if (subscription) {
      fetchMessageLogs();
    }
  }, [subscription, fetchMessageLogs]);

  // Initialize form from subscription
  useEffect(() => {
    if (subscription) {
      setPhoneNumber(formatPhoneNumber(subscription.phone_number));
      setWeeklyReportEnabled(subscription.weekly_report_enabled);
      setReportDayOfWeek(subscription.report_day_of_week);
      setReportTime(subscription.report_time?.slice(0, 5) || '08:00');
      setReportPeriod(subscription.report_period || 'last_7_days');
      setMessageTemplate(subscription.message_template || DEFAULT_MESSAGE_TEMPLATE);
      setMetricsEnabled({
        spend: subscription.include_spend ?? true,
        reach: subscription.include_reach ?? true,
        impressions: subscription.include_impressions ?? true,
        frequency: subscription.include_frequency ?? true,
        clicks: subscription.include_clicks ?? true,
        ctr: subscription.include_ctr ?? true,
        cpm: subscription.include_cpm ?? true,
        cpc: subscription.include_cpc ?? true,
        conversions: subscription.include_conversions ?? true,
        conversion_value: subscription.include_conversion_value ?? true,
        leads: subscription.include_leads ?? true,
        roas: subscription.include_roas ?? true,
      });
    }
  }, [subscription]);

  // Track changes
  useEffect(() => {
    if (!subscription) {
      setHasChanges(phoneNumber.length > 0);
      return;
    }

    const phoneChanged = phoneNumber.replace(/\D/g, '') !== subscription.phone_number.replace(/\D/g, '');
    const enabledChanged = weeklyReportEnabled !== subscription.weekly_report_enabled;
    const dayChanged = reportDayOfWeek !== subscription.report_day_of_week;
    const timeChanged = reportTime !== subscription.report_time?.slice(0, 5);
    const periodChanged = reportPeriod !== (subscription.report_period || 'last_7_days');
    const templateChanged = messageTemplate !== (subscription.message_template || DEFAULT_MESSAGE_TEMPLATE);
    
    const metricsChanged = 
      metricsEnabled.spend !== (subscription.include_spend ?? true) ||
      metricsEnabled.reach !== (subscription.include_reach ?? true) ||
      metricsEnabled.impressions !== (subscription.include_impressions ?? true) ||
      metricsEnabled.frequency !== (subscription.include_frequency ?? true) ||
      metricsEnabled.clicks !== (subscription.include_clicks ?? true) ||
      metricsEnabled.ctr !== (subscription.include_ctr ?? true) ||
      metricsEnabled.cpm !== (subscription.include_cpm ?? true) ||
      metricsEnabled.cpc !== (subscription.include_cpc ?? true) ||
      metricsEnabled.conversions !== (subscription.include_conversions ?? true) ||
      metricsEnabled.conversion_value !== (subscription.include_conversion_value ?? true) ||
      metricsEnabled.leads !== (subscription.include_leads ?? true) ||
      metricsEnabled.roas !== (subscription.include_roas ?? true);

    setHasChanges(phoneChanged || enabledChanged || dayChanged || timeChanged || periodChanged || templateChanged || metricsChanged);
  }, [subscription, phoneNumber, weeklyReportEnabled, reportDayOfWeek, reportTime, reportPeriod, messageTemplate, metricsEnabled]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  const handleSave = async () => {
    if (!user || !selectedProject) return;

    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      toast.error('Número de telefone inválido');
      return;
    }

    setSaving(true);
    try {
      const updateData = {
        phone_number: cleanPhone,
        weekly_report_enabled: weeklyReportEnabled,
        report_day_of_week: reportDayOfWeek,
        report_time: reportTime,
        report_period: reportPeriod,
        message_template: messageTemplate,
        include_spend: metricsEnabled.spend,
        include_reach: metricsEnabled.reach,
        include_impressions: metricsEnabled.impressions,
        include_frequency: metricsEnabled.frequency,
        include_clicks: metricsEnabled.clicks,
        include_ctr: metricsEnabled.ctr,
        include_cpm: metricsEnabled.cpm,
        include_cpc: metricsEnabled.cpc,
        include_conversions: metricsEnabled.conversions,
        include_conversion_value: metricsEnabled.conversion_value,
        include_leads: metricsEnabled.leads,
        include_cpl: metricsEnabled.leads, // Keep backward compat
        include_roas: metricsEnabled.roas,
      };

      if (subscription) {
        const { error } = await supabase
          .from('whatsapp_subscriptions')
          .update(updateData)
          .eq('id', subscription.id);

        if (error) throw error;
        toast.success('Configurações salvas!');
      } else {
        const { data: newSub, error } = await supabase
          .from('whatsapp_subscriptions')
          .insert({
            user_id: user.id,
            project_id: selectedProject.id,
            ...updateData,
          })
          .select()
          .single();

        if (error) throw error;
        setSubscription(newSub);
        toast.success('Configurações salvas!');
      }

      await fetchSubscription();
    } catch (error: any) {
      console.error('Error saving subscription:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!subscription) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('whatsapp_subscriptions')
        .delete()
        .eq('id', subscription.id);

      if (error) throw error;
      
      setSubscription(null);
      setMessageLogs([]);
      setPhoneNumber('');
      setWeeklyReportEnabled(true);
      setReportDayOfWeek(1);
      setReportTime('08:00');
      setReportPeriod('last_7_days');
      setMessageTemplate(DEFAULT_MESSAGE_TEMPLATE);
      setMetricsEnabled({
        spend: true,
        reach: true,
        impressions: true,
        frequency: true,
        clicks: true,
        ctr: true,
        cpm: true,
        cpc: true,
        conversions: true,
        conversion_value: true,
        leads: true,
        roas: true,
      });
      toast.success('Configurações removidas');
    } catch (error) {
      console.error('Error deleting subscription:', error);
      toast.error('Erro ao remover configurações');
    } finally {
      setSaving(false);
    }
  };

  const sendTestReport = async () => {
    if (!subscription) {
      toast.error('Configure e salve seu número primeiro');
      return;
    }

    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-weekly-report', {
        body: { subscriptionId: subscription.id },
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Relatório de teste enviado!');
        await fetchMessageLogs();
      } else {
        toast.error('Erro ao enviar relatório de teste');
      }
    } catch (error: any) {
      console.error('Error sending test report:', error);
      toast.error(error.message || 'Erro ao enviar relatório de teste');
    } finally {
      setSendingTest(false);
    }
  };

  const resetTemplate = () => {
    setMessageTemplate(DEFAULT_MESSAGE_TEMPLATE);
    toast.success('Template restaurado para o padrão');
  };

  const getStatusBadge = (status: string) => {
    if (status === 'sent') {
      return (
        <Badge variant="outline" className="bg-metric-positive/10 text-metric-positive border-metric-positive/20">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Enviado
        </Badge>
      );
    }
    if (status === 'failed') {
      return (
        <Badge variant="outline" className="bg-metric-negative/10 text-metric-negative border-metric-negative/20">
          <XCircle className="w-3 h-3 mr-1" />
          Falhou
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-muted text-muted-foreground">
        <Clock className="w-3 h-3 mr-1" />
        {status}
      </Badge>
    );
  };

  const previewMessage = generatePreview(
    messageTemplate,
    selectedProject?.name || 'Projeto',
    reportPeriod,
    metricsEnabled
  );

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!selectedProject) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8 flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-muted-foreground">Selecione um projeto primeiro</p>
          <Button onClick={() => navigate('/projects')}>
            Ir para Projetos
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">WhatsApp</h1>
            <p className="text-muted-foreground">
              Configurar relatório para <span className="font-medium text-foreground">{selectedProject.name}</span>
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column - Configuration */}
          <div className="space-y-6">
            {/* Basic Settings Card */}
            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Configurações</CardTitle>
                <CardDescription>
                  Configure quando e como receber o relatório
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Phone Number */}
                <div className="space-y-2">
                  <Label htmlFor="phone">Número do WhatsApp</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                  />
                  <p className="text-xs text-muted-foreground">
                    Digite seu número com DDD
                  </p>
                </div>

                {/* Enable/Disable */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
                  <div className="space-y-0.5">
                    <Label htmlFor="weekly-report">Relatório ativado</Label>
                    <p className="text-sm text-muted-foreground">
                      Envio automático
                    </p>
                  </div>
                  <Switch
                    id="weekly-report"
                    checked={weeklyReportEnabled}
                    onCheckedChange={setWeeklyReportEnabled}
                  />
                </div>

                {/* Period Selector */}
                <div className="space-y-2">
                  <Label>Período do relatório</Label>
                  <Select value={reportPeriod} onValueChange={setReportPeriod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERIOD_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Schedule */}
                {weeklyReportEnabled && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Dia da semana</Label>
                      <Select
                        value={reportDayOfWeek.toString()}
                        onValueChange={(v) => setReportDayOfWeek(parseInt(v))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS_OF_WEEK.map(day => (
                            <SelectItem key={day.value} value={day.value.toString()}>
                              {day.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Horário</Label>
                      <Select
                        value={reportTime}
                        onValueChange={setReportTime}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.map(time => (
                            <SelectItem key={time} value={time}>
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Metrics Selection Card */}
            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Métricas do Relatório</CardTitle>
                <CardDescription>
                  Escolha quais métricas incluir no relatório
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {METRICS_CONFIG.map(metric => (
                    <div
                      key={metric.id}
                      className="flex items-center space-x-2 p-2.5 rounded-lg bg-muted/30 border border-border/50 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleMetric(metric.id)}
                    >
                      <Checkbox
                        id={metric.id}
                        checked={metricsEnabled[metric.id] ?? true}
                        onCheckedChange={() => toggleMetric(metric.id)}
                      />
                      <Label htmlFor={metric.id} className="cursor-pointer text-xs sm:text-sm truncate">
                        {metric.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleSave}
                disabled={saving || !hasChanges || phoneNumber.replace(/\D/g, '').length < 10}
                className="flex-1 sm:flex-none"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Salvar
              </Button>

              <Button
                variant="outline"
                onClick={sendTestReport}
                disabled={sendingTest || !subscription}
                className="flex-1 sm:flex-none"
              >
                {sendingTest ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Enviar Teste
              </Button>

              {subscription && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover configuração?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Isso irá desativar o envio de relatórios para seu WhatsApp neste projeto.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Remover
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          {/* Right Column - Message Preview & Template */}
          <div className="space-y-6">
            {/* Message Preview Card */}
            <Card className="glass-card border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Preview da Mensagem
                    </CardTitle>
                    <CardDescription>
                      Como sua mensagem será exibida
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-[#0b141a] rounded-lg p-4 font-mono text-sm text-[#e9edef] whitespace-pre-wrap border border-[#2a3942] max-h-[400px] overflow-y-auto">
                  {previewMessage}
                </div>
              </CardContent>
            </Card>

            {/* Message Template Editor */}
            <Card className="glass-card border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Edit3 className="w-4 h-4" />
                      Editar Template
                    </CardTitle>
                    <CardDescription>
                      Personalize o texto da mensagem
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={resetTemplate}>
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Restaurar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  rows={12}
                  className="font-mono text-sm bg-muted/30"
                />
                <div className="text-xs text-muted-foreground space-y-2">
                  <p className="font-medium">Variáveis disponíveis:</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div><code className="bg-muted px-1 rounded">{'{projeto}'}</code> Nome do projeto</div>
                    <div><code className="bg-muted px-1 rounded">{'{periodo}'}</code> Período selecionado</div>
                    <div><code className="bg-muted px-1 rounded">{'{investimento}'}</code> Investimento</div>
                    <div><code className="bg-muted px-1 rounded">{'{alcance}'}</code> Alcance</div>
                    <div><code className="bg-muted px-1 rounded">{'{impressoes}'}</code> Impressões</div>
                    <div><code className="bg-muted px-1 rounded">{'{frequencia}'}</code> Frequência</div>
                    <div><code className="bg-muted px-1 rounded">{'{cliques}'}</code> Cliques</div>
                    <div><code className="bg-muted px-1 rounded">{'{ctr}'}</code> CTR</div>
                    <div><code className="bg-muted px-1 rounded">{'{cpm}'}</code> CPM</div>
                    <div><code className="bg-muted px-1 rounded">{'{cpc}'}</code> CPC</div>
                    <div><code className="bg-muted px-1 rounded">{'{conversoes}'}</code> Conversões</div>
                    <div><code className="bg-muted px-1 rounded">{'{valor_conversao}'}</code> Valor</div>
                    <div><code className="bg-muted px-1 rounded">{'{cpl}'}</code> CPL / CPA</div>
                    <div><code className="bg-muted px-1 rounded">{'{roas}'}</code> ROAS</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Message History */}
            {subscription && messageLogs.length > 0 && (
              <Card className="glass-card border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Histórico
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {messageLogs.map(log => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
                      >
                        <div className="space-y-0.5">
                          <span className="text-sm font-medium">
                            {log.message_type === 'weekly_report' ? 'Relatório' : 'Teste'}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        {getStatusBadge(log.status)}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
