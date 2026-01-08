import { useState, useEffect, useCallback } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Save, Smartphone, Users, Calendar, Clock, Wallet } from 'lucide-react';
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

  // Form state
  const [instanceId, setInstanceId] = useState<string | null>(existingConfig?.instance_id || null);
  const [targetType, setTargetType] = useState<'phone' | 'group'>(existingConfig?.target_type as 'phone' | 'group' || 'phone');
  const [phoneNumber, setPhoneNumber] = useState(existingConfig?.phone_number || '');
  const [groupId, setGroupId] = useState<string | null>(existingConfig?.group_id || null);
  const [groupName, setGroupName] = useState<string | null>(existingConfig?.group_name || null);
  const [reportEnabled, setReportEnabled] = useState(existingConfig?.report_enabled ?? true);
  const [reportDayOfWeek, setReportDayOfWeek] = useState(existingConfig?.report_day_of_week ?? 1);
  const [reportTime, setReportTime] = useState(existingConfig?.report_time || '08:00');
  const [reportPeriod, setReportPeriod] = useState(existingConfig?.report_period || 'last_7_days');
  const [messageTemplate, setMessageTemplate] = useState(existingConfig?.message_template || '');
  const [balanceAlertEnabled, setBalanceAlertEnabled] = useState(existingConfig?.balance_alert_enabled ?? false);
  const [balanceAlertThreshold, setBalanceAlertThreshold] = useState(existingConfig?.balance_alert_threshold ?? 3);

  const [metricsEnabled, setMetricsEnabled] = useState<Record<string, boolean>>({
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

  const connectedInstances = instances.filter(i => i.instance_status === 'connected');

  const availableMetrics = METRICS_CONFIG.filter(m => 
    m.all || (m.models && m.models.includes(project.business_model))
  );

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
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Configurar Relatório - {project.name}</DialogTitle>
          <DialogDescription>
            Configure o envio automático de relatórios para este projeto
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
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
                        <Select value={reportTime} onValueChange={setReportTime}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_OPTIONS.map(time => (
                              <SelectItem key={time} value={time}>{time}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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

                {/* Custom Template */}
                <div className="space-y-2 pt-4 border-t">
                  <Label>Modelo de Mensagem (opcional)</Label>
                  <Textarea
                    placeholder="Deixe vazio para usar o modelo padrão"
                    value={messageTemplate}
                    onChange={(e) => setMessageTemplate(e.target.value)}
                    rows={4}
                  />
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
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
