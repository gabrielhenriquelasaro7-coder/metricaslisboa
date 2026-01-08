import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, Smartphone, Users, Calendar, Clock, Wallet, Eye, Edit3, Send, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { ManagerInstance, ReportConfig, WhatsAppGroup } from '@/hooks/useWhatsAppManager';
import { WhatsAppGroupSelector } from './WhatsAppGroupSelector';

interface Project {
  id: string;
  name: string;
  business_model: string;
}

interface ProjectReportConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  instances: ManagerInstance[];
  existingConfig?: ReportConfig;
  onSave: (config: Partial<ReportConfig> & { project_id: string }) => Promise<boolean>;
  onListGroups: (instanceId: string) => Promise<WhatsAppGroup[]>;
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

const HOUR_OPTIONS = Array.from({ length: 15 }, (_, i) => {
  const hour = i + 6; // 06:00 to 20:00
  return hour.toString().padStart(2, '0');
});

const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

const PERIOD_OPTIONS = [
  { value: 'last_7_days', label: 'Últimos 7 dias' },
  { value: 'last_14_days', label: 'Últimos 14 dias' },
  { value: 'last_30_days', label: 'Últimos 30 dias' },
  { value: 'this_week', label: 'Esta semana' },
  { value: 'last_week', label: 'Semana passada' },
  { value: 'this_month', label: 'Este mês' },
  { value: 'last_month', label: 'Mês passado' },
];

const METRICS_CONFIG = [
  { id: 'spend', label: '💰 Investimento', all: true },
  { id: 'reach', label: '👁️ Alcance', all: true },
  { id: 'impressions', label: '📺 Impressões', all: true },
  { id: 'frequency', label: '🔄 Frequência', all: true },
  { id: 'clicks', label: '👆 Cliques', all: true },
  { id: 'ctr', label: '📈 CTR', all: true },
  { id: 'cpm', label: '💵 CPM', all: true },
  { id: 'cpc', label: '💳 CPC', all: true },
  { id: 'leads', label: '🎯 Leads', models: ['inside_sales', 'custom', 'infoproduto'] },
  { id: 'cpl', label: '📊 CPL', models: ['inside_sales', 'custom', 'infoproduto'] },
  { id: 'conversions', label: '🛒 Conversões', models: ['ecommerce', 'pdv', 'custom', 'infoproduto'] },
  { id: 'conversion_value', label: '💎 Valor Conversão', models: ['ecommerce', 'pdv', 'custom', 'infoproduto'] },
  { id: 'roas', label: '🚀 ROAS', models: ['ecommerce', 'pdv', 'custom', 'infoproduto'] },
];

function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export function ProjectReportConfigDialog({
  open,
  onOpenChange,
  project,
  instances,
  existingConfig,
  onSave,
  onListGroups,
}: ProjectReportConfigDialogProps) {
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingMessage, setEditingMessage] = useState(false);
  const [testingReport, setTestingReport] = useState(false);
  const [testingBalanceAlert, setTestingBalanceAlert] = useState(false);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [realMetrics, setRealMetrics] = useState<Record<string, number | null>>({});
  const [accountBalance, setAccountBalance] = useState<number | null>(null);

  // Form state
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [targetType, setTargetType] = useState<'phone' | 'group'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [reportEnabled, setReportEnabled] = useState(true);
  const [reportDayOfWeek, setReportDayOfWeek] = useState(1);
  const [reportTime, setReportTime] = useState('08:00');
  const [reportPeriod, setReportPeriod] = useState('last_7_days');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [balanceAlertEnabled, setBalanceAlertEnabled] = useState(false);
  const [balanceAlertThreshold, setBalanceAlertThreshold] = useState(3);

  const [metricsEnabled, setMetricsEnabled] = useState<Record<string, boolean>>({
    spend: true,
    leads: true,
    cpl: true,
    impressions: true,
    clicks: true,
    ctr: true,
    roas: true,
    reach: true,
    cpm: true,
    cpc: true,
    conversions: true,
    conversion_value: true,
    frequency: true,
  });

  // Reset form state when project or existingConfig changes
  useEffect(() => {
    setInstanceId(existingConfig?.instance_id || null);
    setTargetType(existingConfig?.target_type as 'phone' | 'group' || 'phone');
    setPhoneNumber(existingConfig?.phone_number || '');
    setGroupId(existingConfig?.group_id || null);
    setGroupName(existingConfig?.group_name || null);
    setReportEnabled(existingConfig?.report_enabled ?? true);
    setReportDayOfWeek(existingConfig?.report_day_of_week ?? 1);
    setReportTime(existingConfig?.report_time || '08:00');
    setReportPeriod(existingConfig?.report_period || 'last_7_days');
    setMessageTemplate(existingConfig?.message_template || '');
    setBalanceAlertEnabled(existingConfig?.balance_alert_enabled ?? false);
    setBalanceAlertThreshold(existingConfig?.balance_alert_threshold ?? 3);
    setMetricsEnabled({
      spend: existingConfig?.include_spend ?? true,
      leads: existingConfig?.include_leads ?? true,
      cpl: existingConfig?.include_cpl ?? true,
      impressions: existingConfig?.include_impressions ?? true,
      clicks: existingConfig?.include_clicks ?? true,
      ctr: existingConfig?.include_ctr ?? true,
      roas: existingConfig?.include_roas ?? true,
      reach: existingConfig?.include_reach ?? true,
      cpm: existingConfig?.include_cpm ?? true,
      cpc: existingConfig?.include_cpc ?? true,
      conversions: existingConfig?.include_conversions ?? true,
      conversion_value: existingConfig?.include_conversion_value ?? true,
      frequency: existingConfig?.include_frequency ?? true,
    });
    setGroups([]);
    setShowPreview(false);
    setEditingMessage(false);
  }, [project.id, existingConfig]);

  const connectedInstances = instances.filter(i => i.instance_status === 'connected');

  const availableMetrics = METRICS_CONFIG.filter(m => 
    m.all || (m.models && m.models.includes(project.business_model))
  );

  // Fetch real metrics from database
  const fetchRealMetrics = useCallback(async () => {
    setLoadingMetrics(true);
    try {
      // Calculate date range based on period
      const now = new Date();
      let startDate: Date;
      let endDate = new Date(now);

      switch (reportPeriod) {
        case 'last_7_days':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'last_14_days':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 14);
          break;
        case 'last_30_days':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 30);
          break;
        case 'this_week':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - startDate.getDay());
          break;
        case 'last_week':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - startDate.getDay() - 7);
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 6);
          break;
        case 'this_month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'last_month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), 0);
          break;
        default:
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 7);
      }

      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];

      // Fetch metrics from ads_daily_metrics
      const { data: metricsData, error: metricsError } = await supabase
        .from('ads_daily_metrics')
        .select('spend, leads_count, clicks, impressions, reach, conversion_value, conversions, frequency')
        .eq('project_id', project.id)
        .gte('date', startStr)
        .lte('date', endStr);

      if (metricsError) throw metricsError;

      // Aggregate metrics
      const aggregated = (metricsData || []).reduce((acc, row) => ({
        spend: (acc.spend || 0) + (row.spend || 0),
        leads: (acc.leads || 0) + (row.leads_count || 0),
        clicks: (acc.clicks || 0) + (row.clicks || 0),
        impressions: (acc.impressions || 0) + (row.impressions || 0),
        reach: (acc.reach || 0) + (row.reach || 0),
        conversion_value: (acc.conversion_value || 0) + (row.conversion_value || 0),
        conversions: (acc.conversions || 0) + (row.conversions || 0),
        frequency: row.frequency || acc.frequency || 0,
      }), {} as Record<string, number>);

      // Calculate derived metrics
      const spend = aggregated.spend || 0;
      const clicks = aggregated.clicks || 0;
      const impressions = aggregated.impressions || 0;
      const leads = aggregated.leads || 0;
      const conversions = aggregated.conversions || 0;
      const conversionValue = aggregated.conversion_value || 0;

      setRealMetrics({
        spend,
        reach: aggregated.reach || 0,
        impressions,
        frequency: aggregated.frequency || 0,
        clicks,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
        cpc: clicks > 0 ? spend / clicks : 0,
        leads,
        cpl: leads > 0 ? spend / leads : 0,
        conversions,
        conversion_value: conversionValue,
        roas: spend > 0 ? conversionValue / spend : 0,
      });

      // Fetch account balance
      const { data: projectData } = await supabase
        .from('projects')
        .select('account_balance')
        .eq('id', project.id)
        .single();

      setAccountBalance(projectData?.account_balance || null);

    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoadingMetrics(false);
    }
  }, [project.id, reportPeriod]);

  // Fetch metrics when dialog opens or period changes
  useEffect(() => {
    if (open) {
      fetchRealMetrics();
    }
  }, [open, reportPeriod, fetchRealMetrics]);

  // Generate template with real metrics
  const generateDefaultTemplate = useCallback(() => {
    const periodLabel = PERIOD_OPTIONS.find(p => p.value === reportPeriod)?.label || reportPeriod;
    const enabledMetricsList = availableMetrics.filter(m => metricsEnabled[m.id]);
    
    let msg = `📊 *Relatório ${project.name}*\n`;
    msg += `📅 Período: ${periodLabel}\n\n`;
    
    const formatNumber = (n: number) => n.toLocaleString('pt-BR');
    const formatCurrency = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const formatPercent = (n: number) => `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

    const metricsFormatted: Record<string, string> = {
      spend: `💰 Investimento: ${formatCurrency(realMetrics.spend || 0)}`,
      reach: `👁️ Alcance: ${formatNumber(realMetrics.reach || 0)}`,
      impressions: `📺 Impressões: ${formatNumber(realMetrics.impressions || 0)}`,
      frequency: `🔄 Frequência: ${(realMetrics.frequency || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`,
      clicks: `👆 Cliques: ${formatNumber(realMetrics.clicks || 0)}`,
      ctr: `📈 CTR: ${formatPercent(realMetrics.ctr || 0)}`,
      cpm: `💵 CPM: ${formatCurrency(realMetrics.cpm || 0)}`,
      cpc: `💳 CPC: ${formatCurrency(realMetrics.cpc || 0)}`,
      leads: `🎯 Leads: ${formatNumber(realMetrics.leads || 0)}`,
      cpl: `📊 CPL: ${formatCurrency(realMetrics.cpl || 0)}`,
      conversions: `🛒 Conversões: ${formatNumber(realMetrics.conversions || 0)}`,
      conversion_value: `💎 Valor: ${formatCurrency(realMetrics.conversion_value || 0)}`,
      roas: `🚀 ROAS: ${(realMetrics.roas || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}x`,
    };

    enabledMetricsList.forEach(metric => {
      if (metricsFormatted[metric.id]) {
        msg += metricsFormatted[metric.id] + '\n';
      }
    });

    msg += '\n_Relatório automático via V4 Dashboard_';
    return msg;
  }, [project.name, reportPeriod, metricsEnabled, availableMetrics, realMetrics]);

  // Initialize message template with real data when metrics load
  useEffect(() => {
    if (open && !existingConfig?.message_template && Object.keys(realMetrics).length > 0) {
      setMessageTemplate(generateDefaultTemplate());
    }
  }, [open, realMetrics]);

  // The message that will be sent (what's in the textarea)
  const currentMessage = messageTemplate || generateDefaultTemplate();

  // Load groups when instance changes
  useEffect(() => {
    if (instanceId && targetType === 'group') {
      loadGroups();
    }
  }, [instanceId, targetType]);

  const loadGroups = async () => {
    if (!instanceId) return;
    setLoadingGroups(true);
    try {
      const groupList = await onListGroups(instanceId);
      setGroups(groupList);
    } finally {
      setLoadingGroups(false);
    }
  };

  const getTargetNumber = () => {
    if (targetType === 'phone') {
      return phoneNumber.replace(/\D/g, '');
    }
    return groupId || '';
  };

  const handleTestReport = async () => {
    if (!instanceId) return;
    
    const target = getTargetNumber();
    if (!target) {
      toast.error('Configure o número ou grupo de destino primeiro');
      return;
    }

    setTestingReport(true);
    try {
      const instance = instances.find(i => i.id === instanceId);
      if (!instance) throw new Error('Instância não encontrada');

      const messageToSend = currentMessage;

      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: {
          instanceId,
          targetType,
          phone: targetType === 'phone' ? target : undefined,
          groupId: targetType === 'group' ? target : undefined,
          message: `🧪 *TESTE DE RELATÓRIO*\n\n${messageToSend}`,
        }
      });

      if (error) throw error;
      toast.success('Mensagem de teste enviada com sucesso!');
    } catch (error: any) {
      console.error('Error sending test report:', error);
      toast.error('Erro ao enviar teste: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setTestingReport(false);
    }
  };

  const handleTestBalanceAlert = async () => {
    if (!instanceId) return;
    
    const target = getTargetNumber();
    if (!target) {
      toast.error('Configure o número ou grupo de destino primeiro');
      return;
    }

    setTestingBalanceAlert(true);
    try {
      const instance = instances.find(i => i.id === instanceId);
      if (!instance) throw new Error('Instância não encontrada');

      const formatCurrency = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const currentBalance = accountBalance || 0;
      const dailySpend = realMetrics.spend ? realMetrics.spend / 7 : 0; // Estimate from last 7 days
      const estimatedDays = dailySpend > 0 ? Math.floor(currentBalance / dailySpend) : 0;

      const alertMessage = `⚠️ *TESTE DE ALERTA DE SALDO*\n\n🚨 *Atenção: Saldo Baixo!*\n\n📊 Projeto: ${project.name}\n💰 Saldo atual: ${formatCurrency(currentBalance)}\n📅 Duração estimada: ${estimatedDays} dias\n\n_Este é um teste do sistema de alertas_`;

      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: {
          instanceId,
          targetType,
          phone: targetType === 'phone' ? target : undefined,
          groupId: targetType === 'group' ? target : undefined,
          message: alertMessage,
        }
      });

      if (error) throw error;
      toast.success('Alerta de teste enviado com sucesso!');
    } catch (error: any) {
      console.error('Error sending test balance alert:', error);
      toast.error('Erro ao enviar teste: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setTestingBalanceAlert(false);
    }
  };

  const handleSave = async () => {
    if (!instanceId) return;

    setSaving(true);
    try {
      const config: Partial<ReportConfig> & { project_id: string } = {
        project_id: project.id,
        instance_id: instanceId,
        target_type: targetType,
        phone_number: targetType === 'phone' ? phoneNumber.replace(/\D/g, '') : null,
        group_id: targetType === 'group' ? groupId : null,
        group_name: targetType === 'group' ? groupName : null,
        report_enabled: reportEnabled,
        report_day_of_week: reportDayOfWeek,
        report_time: reportTime,
        report_period: reportPeriod,
        message_template: messageTemplate || null,
        balance_alert_enabled: balanceAlertEnabled,
        balance_alert_threshold: balanceAlertThreshold,
        include_spend: metricsEnabled.spend,
        include_leads: metricsEnabled.leads,
        include_cpl: metricsEnabled.cpl,
        include_impressions: metricsEnabled.impressions,
        include_clicks: metricsEnabled.clicks,
        include_ctr: metricsEnabled.ctr,
        include_roas: metricsEnabled.roas,
        include_reach: metricsEnabled.reach,
        include_cpm: metricsEnabled.cpm,
        include_cpc: metricsEnabled.cpc,
        include_conversions: metricsEnabled.conversions,
        include_conversion_value: metricsEnabled.conversion_value,
        include_frequency: metricsEnabled.frequency,
      };

      const success = await onSave(config);
      if (success) {
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Configurar Relatório - {project.name}</DialogTitle>
          <DialogDescription>
            Configure o envio automático de relatórios para este projeto
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 -mr-2">
          <div className="space-y-6 py-4">
            {/* WhatsApp Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Conexão WhatsApp</Label>
              {connectedInstances.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum WhatsApp conectado. Conecte um primeiro.
                </p>
              ) : (
                <Select value={instanceId || ''} onValueChange={setInstanceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma conexão" />
                  </SelectTrigger>
                  <SelectContent>
                    {connectedInstances.map(inst => (
                      <SelectItem key={inst.id} value={inst.id}>
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4" />
                          <span>{inst.display_name}</span>
                          {inst.phone_connected && (
                            <span className="text-muted-foreground">
                              ({inst.phone_connected})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {instanceId && (
              <>
                {/* Target Type */}
                <Tabs value={targetType} onValueChange={(v) => setTargetType(v as 'phone' | 'group')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="phone" className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4" /> Número
                    </TabsTrigger>
                    <TabsTrigger value="group" className="flex items-center gap-2">
                      <Users className="w-4 h-4" /> Grupo
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="phone" className="mt-4">
                    <div className="space-y-2">
                      <Label>Número do WhatsApp</Label>
                      <Input
                        placeholder="(11) 99999-9999"
                        value={formatPhoneNumber(phoneNumber)}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="group" className="mt-4">
                    <WhatsAppGroupSelector
                      groups={groups}
                      selectedGroupId={groupId}
                      onSelectGroup={(id, name) => {
                        setGroupId(id);
                        setGroupName(name);
                      }}
                      onRefresh={loadGroups}
                      isLoading={loadingGroups}
                    />
                  </TabsContent>
                </Tabs>

                {/* Report Settings */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Relatório Semanal</Label>
                      <p className="text-sm text-muted-foreground">Enviar relatório automático</p>
                    </div>
                    <Switch checked={reportEnabled} onCheckedChange={setReportEnabled} />
                  </div>

                  {reportEnabled && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" /> Dia da Semana
                        </Label>
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
                        <Label className="flex items-center gap-2">
                          <Clock className="w-4 h-4" /> Horário
                        </Label>
                        <div className="flex items-center gap-2">
                          <Select 
                            value={reportTime.split(':')[0]} 
                            onValueChange={(h) => setReportTime(`${h}:${reportTime.split(':')[1] || '00'}`)}
                          >
                            <SelectTrigger className="w-20">
                              <SelectValue placeholder="Hora" />
                            </SelectTrigger>
                            <SelectContent>
                              {HOUR_OPTIONS.map(hour => (
                                <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-lg font-medium">:</span>
                          <Select 
                            value={reportTime.split(':')[1] || '00'} 
                            onValueChange={(m) => setReportTime(`${reportTime.split(':')[0] || '08'}:${m}`)}
                          >
                            <SelectTrigger className="w-20">
                              <SelectValue placeholder="Min" />
                            </SelectTrigger>
                            <SelectContent>
                              {MINUTE_OPTIONS.map(min => (
                                <SelectItem key={min} value={min}>{min}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="col-span-2 space-y-2">
                        <Label>Período do Relatório</Label>
                        <Select value={reportPeriod} onValueChange={setReportPeriod}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PERIOD_OPTIONS.map(p => (
                              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Metrics Selection */}
                {reportEnabled && (
                  <div className="space-y-3 pt-4 border-t">
                    <Label>Métricas Incluídas</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {availableMetrics.map(metric => (
                        <label key={metric.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={metricsEnabled[metric.id]}
                            onCheckedChange={(checked) => 
                              setMetricsEnabled(prev => ({ ...prev, [metric.id]: !!checked }))
                            }
                          />
                          {metric.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Balance Alert */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-metric-warning" />
                      <div>
                        <Label>Alerta de Saldo</Label>
                        <p className="text-sm text-muted-foreground">Avisar quando o saldo estiver baixo</p>
                      </div>
                    </div>
                    <Switch checked={balanceAlertEnabled} onCheckedChange={setBalanceAlertEnabled} />
                  </div>

                  {balanceAlertEnabled && (
                    <div className="space-y-2">
                      <Label>Alertar quando restarem menos de (dias)</Label>
                      <Select 
                        value={balanceAlertThreshold.toString()} 
                        onValueChange={(v) => setBalanceAlertThreshold(parseInt(v))}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 5, 7, 10, 14].map(d => (
                            <SelectItem key={d} value={d.toString()}>{d} dias</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Message Editor */}
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Edit3 className="w-4 h-4" />
                      Mensagem do Relatório
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setMessageTemplate(generateDefaultTemplate())}
                      className="text-xs gap-1"
                    >
                      🔄 Gerar novo modelo
                    </Button>
                  </div>
                  
                  {/* Message textarea - pre-filled with template */}
                  <Textarea
                    placeholder="Edite a mensagem do relatório..."
                    value={messageTemplate}
                    onChange={(e) => setMessageTemplate(e.target.value)}
                    rows={10}
                    className="text-sm font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    💡 Use *texto* para <strong>negrito</strong> e _texto_ para <em>itálico</em>
                  </p>

                  {/* Preview WhatsApp style */}
                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPreview(!showPreview)}
                      className="gap-2 w-full"
                    >
                      <Eye className="w-4 h-4" />
                      {showPreview ? 'Ocultar Preview' : 'Ver Preview no WhatsApp'}
                    </Button>
                    
                    {showPreview && (
                      <div className="bg-[#0b141a] rounded-lg p-4 border border-border/50">
                        <div className="bg-[#005c4b] rounded-lg p-3 max-w-[85%] ml-auto">
                          <pre className="text-sm text-white whitespace-pre-wrap font-sans leading-relaxed">
                            {currentMessage}
                          </pre>
                          <span className="text-[10px] text-white/60 float-right mt-1">
                            {reportTime} ✓✓
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Test buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleTestReport}
                      disabled={testingReport || !instanceId}
                      className="flex-1 gap-2"
                    >
                      {testingReport ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      Testar Relatório
                    </Button>
                    
                    {balanceAlertEnabled && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleTestBalanceAlert}
                        disabled={testingBalanceAlert || !instanceId}
                        className="flex-1 gap-2"
                      >
                        {testingBalanceAlert ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <AlertTriangle className="w-4 h-4" />
                        )}
                        Testar Alerta Saldo
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !instanceId}>
            {saving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>
            ) : (
              <><Save className="w-4 h-4 mr-2" /> Salvar</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
