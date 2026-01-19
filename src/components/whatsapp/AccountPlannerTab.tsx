import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Loader2, Smartphone, Users, Link2, Target, TrendingUp, Plus, Trash2, Send, Eye, EyeOff, Edit3, Clock, History, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { ManagerInstance, WhatsAppGroup } from '@/hooks/useWhatsAppManager';
import type { PlannerConfig, SubMeta } from '@/hooks/useWhatsAppPlannerConfig';
import { WhatsAppGroupSelector } from './WhatsAppGroupSelector';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Project {
  id: string;
  name: string;
}

interface PlannerHistoryItem {
  id: string;
  sent_at: string;
  target_type: string;
  target_name: string | null;
  status: string;
}

interface AccountPlannerTabProps {
  project: Project;
  instances: ManagerInstance[];
  existingConfig?: PlannerConfig;
  onSave: (config: Partial<PlannerConfig> & { project_id: string }) => Promise<boolean>;
  onListGroups: (instanceId: string) => Promise<WhatsAppGroup[]>;
  onClose: () => void;
}

const STEP_OPTIONS = ['V0', 'V1', 'V2', 'V3', 'V4'];

function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

function getNextStep(currentStep: string): string {
  const stepIndex = STEP_OPTIONS.indexOf(currentStep);
  if (stepIndex === -1 || stepIndex >= STEP_OPTIONS.length - 1) {
    return STEP_OPTIONS[STEP_OPTIONS.length - 1];
  }
  return STEP_OPTIONS[stepIndex + 1];
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function AccountPlannerTab({
  project,
  instances,
  existingConfig,
  onSave,
  onListGroups,
  onClose,
}: AccountPlannerTabProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [sendingPlanner, setSendingPlanner] = useState(false);
  const [realCPL, setRealCPL] = useState<number | null>(null);
  const [sendHistory, setSendHistory] = useState<PlannerHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form state
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [targetType, setTargetType] = useState<'phone' | 'group'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string | null>(null);

  // Planner fields
  const [currentStep, setCurrentStep] = useState('V1');
  const [metricType, setMetricType] = useState<'roi' | 'roas'>('roi');
  const [roiAtual, setRoiAtual] = useState('');
  const [roasAtual, setRoasAtual] = useState('');
  const [cacAtual, setCacAtual] = useState('');
  const [investimentoMensal, setInvestimentoMensal] = useState('');
  const [faturamentoMarketing, setFaturamentoMarketing] = useState('');
  const [metaPrincipalQuarter, setMetaPrincipalQuarter] = useState('');
  const [subMetas, setSubMetas] = useState<SubMeta[]>([]);
  const [criteriosMudancaStep, setCriteriosMudancaStep] = useState<SubMeta[]>([]);
  const [metaSemana, setMetaSemana] = useState('');
  const [metaSemanaPorque, setMetaSemanaPorque] = useState('');
  const [linkForecasting, setLinkForecasting] = useState('');
  const [linkPlanoMidia, setLinkPlanoMidia] = useState('');
  const [linkPlanejamentoQuarter, setLinkPlanejamentoQuarter] = useState('');
  const [hiddenFields, setHiddenFields] = useState<string[]>([]);
  const [messageTemplate, setMessageTemplate] = useState('');
  const [metricsLoaded, setMetricsLoaded] = useState(false);
  const connectedInstances = instances.filter(i => i.instance_status === 'connected');
  const targetStep = getNextStep(currentStep);

  // Initialize form only once when existingConfig is first available
  const [initialized, setInitialized] = useState(false);
  
  useEffect(() => {
    if (existingConfig && !initialized) {
      setInstanceId(existingConfig.instance_id || null);
      setTargetType(existingConfig.target_type || 'phone');
      setPhoneNumber(existingConfig.phone_number || '');
      setGroupId(existingConfig.group_id || null);
      setGroupName(existingConfig.group_name || null);
      // Note: planner_enabled, report_day_of_week, report_time removed - manual sending only
      setCurrentStep(existingConfig.current_step || 'V1');
      setMetricType(existingConfig.metric_type || 'roi');
      setRoiAtual(existingConfig.roi_atual?.toString() || '');
      setRoasAtual(existingConfig.roas_atual?.toString() || '');
      setCacAtual(existingConfig.cac_atual?.toString() || '');
      setInvestimentoMensal(existingConfig.investimento_mensal?.toString() || '');
      setFaturamentoMarketing(existingConfig.faturamento_marketing?.toString() || '');
      setMetaPrincipalQuarter(existingConfig.meta_principal_quarter || '');
      setSubMetas(existingConfig.sub_metas || []);
      setCriteriosMudancaStep(existingConfig.criterios_mudanca_step || []);
      setMetaSemana(existingConfig.meta_semana || '');
      setMetaSemanaPorque(existingConfig.meta_semana_porque || '');
      setLinkForecasting(existingConfig.link_forecasting || '');
      setLinkPlanoMidia(existingConfig.link_plano_midia || '');
      setLinkPlanejamentoQuarter(existingConfig.link_planejamento_quarter || '');
      setHiddenFields(existingConfig.hidden_fields || []);
      setMessageTemplate(existingConfig.custom_message || '');
      setInitialized(true);
    }
  }, [existingConfig, initialized]);

  // Fetch real CPL and ROAS from database
  useEffect(() => {
    const fetchMetrics = async () => {
      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
      
      const { data } = await supabase
        .from('ads_daily_metrics')
        .select('spend, leads_count, conversion_value')
        .eq('project_id', project.id)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', now.toISOString().split('T')[0]);

      if (data && data.length > 0) {
        const totalSpend = data.reduce((acc, row) => acc + (row.spend || 0), 0);
        const totalLeads = data.reduce((acc, row) => acc + (row.leads_count || 0), 0);
        const totalConversionValue = data.reduce((acc, row) => acc + (row.conversion_value || 0), 0);
        
        const cpl = totalLeads > 0 ? totalSpend / totalLeads : null;
        
        console.log('AccountPlannerTab metrics:', { totalSpend, totalLeads, cpl });
        
        setRealCPL(cpl);
        setMetricsLoaded(true);
      } else {
        console.log('AccountPlannerTab: No data found for project', project.id);
        setRealCPL(null);
        setMetricsLoaded(true);
      }
    };
    
    fetchMetrics();
  }, [project.id]);

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

  const addSubMeta = () => {
    setSubMetas([...subMetas, { id: generateId(), text: '', completed: false }]);
  };

  const updateSubMeta = (id: string, text: string) => {
    setSubMetas(subMetas.map(m => m.id === id ? { ...m, text } : m));
  };

  const toggleSubMeta = (id: string) => {
    setSubMetas(subMetas.map(m => m.id === id ? { ...m, completed: !m.completed } : m));
  };

  const removeSubMeta = (id: string) => {
    setSubMetas(subMetas.filter(m => m.id !== id));
  };

  const addCriterio = () => {
    setCriteriosMudancaStep([...criteriosMudancaStep, { id: generateId(), text: '', completed: false }]);
  };

  const updateCriterio = (id: string, text: string) => {
    setCriteriosMudancaStep(criteriosMudancaStep.map(c => c.id === id ? { ...c, text } : c));
  };

  const toggleCriterio = (id: string) => {
    setCriteriosMudancaStep(criteriosMudancaStep.map(c => c.id === id ? { ...c, completed: !c.completed } : c));
  };

  const removeCriterio = (id: string) => {
    setCriteriosMudancaStep(criteriosMudancaStep.filter(c => c.id !== id));
  };

  const toggleHiddenField = (field: string) => {
    setHiddenFields(prev => 
      prev.includes(field) 
        ? prev.filter(f => f !== field)
        : [...prev, field]
    );
  };

  const isFieldHidden = (field: string) => hiddenFields.includes(field);

  const formatCurrency = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Generate the default template message
  const generateDefaultTemplate = useCallback(() => {
    // Determine metric display based on user choice
    let metricLabel: string;
    let metricValue: string;
    
    if (metricType === 'roi') {
      metricLabel = 'ROI atual';
      metricValue = roiAtual ? `${Math.round(parseFloat(roiAtual))}x` : '____';
    } else {
      metricLabel = 'ROAS atual';
      metricValue = roasAtual ? `${Math.round(parseFloat(roasAtual))}x` : '____';
    }

    // CPL display: show R$ 0,00 or message if no leads
    const cplDisplay = realCPL !== null 
      ? formatCurrency(realCPL) 
      : 'Não teve leads nos últimos 7 dias';
    
    let msg = `📊 *Diagnóstico Atual do Cliente (Ponto de Partida)*\n`;
    msg += `📋 Projeto: *${project.name}*\n\n`;
    msg += `🎯 Step Atual: *${currentStep}*\n`;
    msg += `🎯 Step Alvo no Q1: *${targetStep}*\n\n`;
    
    msg += `📈 *Métricas Atuais* - Últimos 7 dias\n`;
    if (!isFieldHidden('metric_retorno')) {
      msg += `• ${metricLabel}: ${metricValue}\n`;
    }
    if (!isFieldHidden('cpl')) {
      msg += `• CPL atual: ${cplDisplay}\n`;
    }
    if (!isFieldHidden('cac')) {
      msg += `• CAC atual: ${cacAtual ? formatCurrency(parseFloat(cacAtual)) : '____'}\n`;
    }
    if (!isFieldHidden('investimento')) {
      msg += `• Investimento mensal em mídia: ${investimentoMensal ? formatCurrency(parseFloat(investimentoMensal)) : '____'}\n`;
    }
    if (!isFieldHidden('faturamento')) {
      msg += `• Faturamento do marketing: ${faturamentoMarketing ? formatCurrency(parseFloat(faturamentoMarketing)) : '____'}\n`;
    }
    msg += '\n';
    
    msg += `🎯 *Meta Principal do Cliente – Quarter (Q1)*\n`;
    msg += `${metaPrincipalQuarter || '(não definida)'}\n\n`;
    
    if (subMetas.length > 0) {
      msg += `🔧 *Sub-metas de Suporte (Q1)*\n`;
      subMetas.forEach(m => {
        msg += `${m.completed ? '✅' : '⬜'} ${m.text}\n`;
      });
      msg += '\n';
    }
    
    msg += `🧭 *Critério Objetivo de Mudança de Step*\n`;
    msg += `Para sair do Step ${currentStep} e atingir o ${targetStep}, este cliente precisa:\n`;
    criteriosMudancaStep.forEach(c => {
      msg += `${c.completed ? '✅' : '⬜'} ${c.text}\n`;
    });
    msg += '\n';
    
    msg += `📆 *Meta da Semana* (Próximos 7 dias)\n`;
    msg += `Meta: ${metaSemana || '(não definida)'}\n`;
    if (metaSemanaPorque) {
      msg += `Por quê: ${metaSemanaPorque}\n`;
    }
    msg += '\n';
    
    // Only show links section if at least one link is visible
    const hasVisibleLinks = (!isFieldHidden('link_forecasting') && linkForecasting) ||
                           (!isFieldHidden('link_plano_midia') && linkPlanoMidia) ||
                           (!isFieldHidden('link_planejamento_quarter') && linkPlanejamentoQuarter);
    
    if (hasVisibleLinks) {
      msg += `🔗 *Links Operacionais do Cliente*\n`;
      if (!isFieldHidden('link_forecasting') && linkForecasting) {
        msg += `• Forecasting: ${linkForecasting}\n`;
      }
      if (!isFieldHidden('link_plano_midia') && linkPlanoMidia) {
        msg += `• Plano de Mídia: ${linkPlanoMidia}\n`;
      }
      if (!isFieldHidden('link_planejamento_quarter') && linkPlanejamentoQuarter) {
        msg += `• Planejamento Quarter: ${linkPlanejamentoQuarter}\n`;
      }
      msg += '\n';
    }
    
    msg += `_Relatório automático via V4 Dashboard_`;
    
    return msg;
  }, [
    project.name, currentStep, targetStep, metricType, roiAtual, roasAtual, realCPL, cacAtual,
    investimentoMensal, faturamentoMarketing, metaPrincipalQuarter,
    subMetas, criteriosMudancaStep, metaSemana, metaSemanaPorque,
    linkForecasting, linkPlanoMidia, linkPlanejamentoQuarter, hiddenFields
  ]);

  // Pre-populate message template when metrics load
  useEffect(() => {
    if (metricsLoaded && !messageTemplate && !existingConfig?.custom_message) {
      setMessageTemplate(generateDefaultTemplate());
    }
  }, [metricsLoaded, existingConfig?.custom_message]);

  // Update template when form fields change (only if user hasn't customized)
  const handleRefreshTemplate = () => {
    setMessageTemplate(generateDefaultTemplate());
    toast.success('Mensagem atualizada com os dados atuais');
  };

  // The current message to send - always use the editable template
  const currentMessage = messageTemplate || generateDefaultTemplate();

  // Load send history
  const loadSendHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_planner_history')
        .select('id, sent_at, target_type, target_name, status')
        .eq('project_id', project.id)
        .order('sent_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setSendHistory(data || []);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Load history on mount
  useEffect(() => {
    loadSendHistory();
  }, [project.id]);

  const handleSendPlanner = async () => {
    if (!instanceId || !user) return;
    
    const target = targetType === 'phone' ? phoneNumber.replace(/\D/g, '') : groupId;
    if (!target) {
      toast.error('Configure o número ou grupo de destino primeiro');
      return;
    }

    setSendingPlanner(true);
    try {
      const messageToSend = currentMessage;

      const { error } = await supabase.functions.invoke('whatsapp-send', {
        body: {
          instanceId,
          targetType,
          phone: targetType === 'phone' ? target : undefined,
          groupId: targetType === 'group' ? target : undefined,
          message: messageToSend,
        }
      });

      if (error) throw error;

      // Record send history
      await supabase.from('whatsapp_planner_history').insert({
        project_id: project.id,
        config_id: existingConfig?.id || null,
        user_id: user.id,
        message_content: messageToSend,
        target_type: targetType,
        target_identifier: target,
        target_name: targetType === 'group' ? groupName : phoneNumber,
        instance_id: instanceId,
        status: 'sent'
      });

      toast.success('Planner Monday enviado com sucesso!');
      loadSendHistory(); // Refresh history
    } catch (error: any) {
      console.error('Error sending planner:', error);
      toast.error('Erro ao enviar: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setSendingPlanner(false);
    }
  };

  const handleSave = async () => {
    if (!instanceId) return;

    setSaving(true);
    try {
      const config: Partial<PlannerConfig> & { project_id: string } = {
        project_id: project.id,
        instance_id: instanceId,
        target_type: targetType,
        phone_number: targetType === 'phone' ? phoneNumber.replace(/\D/g, '') : null,
        group_id: targetType === 'group' ? groupId : null,
        group_name: targetType === 'group' ? groupName : null,
        // Note: Removed automatic scheduling - manual sending only
        current_step: currentStep,
        target_step: targetStep,
        metric_type: metricType,
        roi_atual: metricType === 'roi' && roiAtual ? parseFloat(roiAtual) : null,
        roas_atual: metricType === 'roas' && roasAtual ? parseFloat(roasAtual) : null,
        cac_atual: cacAtual ? parseFloat(cacAtual) : null,
        investimento_mensal: investimentoMensal ? parseFloat(investimentoMensal) : null,
        faturamento_marketing: faturamentoMarketing ? parseFloat(faturamentoMarketing) : null,
        meta_principal_quarter: metaPrincipalQuarter || null,
        sub_metas: subMetas.filter(m => m.text.trim()),
        criterios_mudanca_step: criteriosMudancaStep.filter(c => c.text.trim()),
        meta_semana: metaSemana || null,
        meta_semana_porque: metaSemanaPorque || null,
        link_forecasting: linkForecasting || null,
        link_plano_midia: linkPlanoMidia || null,
        link_planejamento_quarter: linkPlanejamentoQuarter || null,
        hidden_fields: hiddenFields,
        custom_message: messageTemplate || null,
      };

      const success = await onSave(config);
      if (success) {
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
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

          {/* Step Configuration */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              <Label className="text-base font-semibold">Diagnóstico do Cliente</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Step Atual</Label>
                <Select value={currentStep} onValueChange={setCurrentStep}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STEP_OPTIONS.map(step => (
                      <SelectItem key={step} value={step}>{step}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Step Alvo Q1</Label>
                <Input value={targetStep} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">Sempre um a mais do atual</p>
              </div>
            </div>
          </div>

          {/* Manual Metrics */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <Label className="text-base font-semibold">Métricas Atuais - Últimos 7 dias</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Métrica de Retorno</Label>
                <Select value={metricType} onValueChange={(v) => setMetricType(v as 'roi' | 'roas')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="roi">ROI (manual)</SelectItem>
                    <SelectItem value="roas">ROAS (manual)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                {metricType === 'roi' ? (
                  <>
                    <Label>ROI atual (número inteiro)</Label>
                    <Input
                      placeholder="Ex: 5"
                      value={roiAtual}
                      onChange={(e) => setRoiAtual(e.target.value)}
                      type="number"
                      step="1"
                    />
                  </>
                ) : (
                  <>
                    <Label>ROAS atual (número inteiro)</Label>
                    <Input
                      placeholder="Ex: 3"
                      value={roasAtual}
                      onChange={(e) => setRoasAtual(e.target.value)}
                      type="number"
                      step="1"
                    />
                  </>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>CPL atual (automático)</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleHiddenField('cpl')}
                    className="h-6 px-2 text-xs gap-1"
                  >
                    {isFieldHidden('cpl') ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {isFieldHidden('cpl') ? 'Oculto' : 'Visível'}
                  </Button>
                </div>
                <Input
                  value={realCPL ? formatCurrency(realCPL) : 'Sem leads nos últimos 7 dias'}
                  disabled
                  className={`bg-muted ${isFieldHidden('cpl') ? 'opacity-50' : ''}`}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>CAC atual (manual)</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleHiddenField('cac')}
                    className="h-6 px-2 text-xs gap-1"
                  >
                    {isFieldHidden('cac') ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {isFieldHidden('cac') ? 'Oculto' : 'Visível'}
                  </Button>
                </div>
                <Input
                  placeholder="Ex: 250.00"
                  value={cacAtual}
                  onChange={(e) => setCacAtual(e.target.value)}
                  type="number"
                  step="0.01"
                  className={isFieldHidden('cac') ? 'opacity-50' : ''}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Investimento mensal em mídia</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleHiddenField('investimento')}
                    className="h-6 px-2 text-xs gap-1"
                  >
                    {isFieldHidden('investimento') ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {isFieldHidden('investimento') ? 'Oculto' : 'Visível'}
                  </Button>
                </div>
                <Input
                  placeholder="Ex: 15000.00"
                  value={investimentoMensal}
                  onChange={(e) => setInvestimentoMensal(e.target.value)}
                  type="number"
                  step="0.01"
                  className={isFieldHidden('investimento') ? 'opacity-50' : ''}
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Faturamento gerado pelo marketing</Label>
                <Input
                  placeholder="Ex: 85000.00"
                  value={faturamentoMarketing}
                  onChange={(e) => setFaturamentoMarketing(e.target.value)}
                  type="number"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          {/* Main Goal */}
          <div className="space-y-4 pt-4 border-t">
            <Label className="text-base font-semibold">🎯 Meta Principal do Cliente – Quarter (Q1)</Label>
            <p className="text-sm text-muted-foreground">
              Até 01/04, este cliente considera o trimestre um sucesso se:
            </p>
            <Textarea
              placeholder="Ex: Gerar 300 MQLs, com 20% de taxa de conversão, alcançando um faturamento de 450 mil reais no quarter."
              value={metaPrincipalQuarter}
              onChange={(e) => setMetaPrincipalQuarter(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              COLOQUE META NUMÉRICA. Se for step V0, coloque o que precisa encontrar/estruturar de maneira que seja MENSURÁVEL!
            </p>
          </div>

          {/* Sub Goals */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">🔧 Sub-metas de Suporte (Q1)</Label>
              <Button type="button" variant="outline" size="sm" onClick={addSubMeta} className="gap-1">
                <Plus className="w-4 h-4" /> Adicionar
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">São as alavancas que sustentam a meta principal</p>
            
            <div className="space-y-2">
              {subMetas.map((meta) => (
                <div key={meta.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={meta.completed}
                    onCheckedChange={() => toggleSubMeta(meta.id)}
                  />
                  <Input
                    placeholder="Ex: Melhorar eficiência das campanhas com CPL de 12 reais"
                    value={meta.text}
                    onChange={(e) => updateSubMeta(meta.id, e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSubMeta(meta.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {subMetas.length === 0 && (
                <p className="text-sm text-muted-foreground italic">Nenhuma sub-meta adicionada</p>
              )}
            </div>
          </div>

          {/* Step Change Criteria */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">🧭 Critério Objetivo de Mudança de Step</Label>
              <Button type="button" variant="outline" size="sm" onClick={addCriterio} className="gap-1">
                <Plus className="w-4 h-4" /> Adicionar
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Para sair do Step {currentStep} e atingir o {targetStep}, este cliente precisa:
            </p>
            
            <div className="space-y-2">
              {criteriosMudancaStep.map((criterio) => (
                <div key={criterio.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={criterio.completed}
                    onCheckedChange={() => toggleCriterio(criterio.id)}
                  />
                  <Input
                    placeholder="Ex: Atingir ROI de 7 ou mais"
                    value={criterio.text}
                    onChange={(e) => updateCriterio(criterio.id, e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCriterio(criterio.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {criteriosMudancaStep.length === 0 && (
                <p className="text-sm text-muted-foreground italic">Nenhum critério adicionado</p>
              )}
            </div>
          </div>

          {/* Weekly Goal */}
          <div className="space-y-4 pt-4 border-t">
            <Label className="text-base font-semibold">📆 Meta da Semana (Próximos 7 dias)</Label>
            <p className="text-sm text-muted-foreground">
              Se essa meta acontecer essa semana, o cliente avança mais rápido para o objetivo do quarter.
            </p>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Meta da Semana</Label>
                <Input
                  placeholder="Descreva a meta da semana"
                  value={metaSemana}
                  onChange={(e) => setMetaSemana(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Por que essa meta é prioritária agora?</Label>
                <Textarea
                  placeholder="Explique a prioridade dessa meta"
                  value={metaSemanaPorque}
                  onChange={(e) => setMetaSemanaPorque(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Operational Links */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" />
              <Label className="text-base font-semibold">Links Operacionais do Cliente</Label>
            </div>
            <p className="text-sm text-muted-foreground">Opcional - preencha se quiser incluir na mensagem</p>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Link do Forecasting</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleHiddenField('link_forecasting')}
                    className="h-6 px-2 text-xs gap-1"
                  >
                    {isFieldHidden('link_forecasting') ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {isFieldHidden('link_forecasting') ? 'Oculto' : 'Visível'}
                  </Button>
                </div>
                <Input
                  placeholder="https://..."
                  value={linkForecasting}
                  onChange={(e) => setLinkForecasting(e.target.value)}
                  className={isFieldHidden('link_forecasting') ? 'opacity-50' : ''}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Link do Plano de Mídia</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleHiddenField('link_plano_midia')}
                    className="h-6 px-2 text-xs gap-1"
                  >
                    {isFieldHidden('link_plano_midia') ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {isFieldHidden('link_plano_midia') ? 'Oculto' : 'Visível'}
                  </Button>
                </div>
                <Input
                  placeholder="https://..."
                  value={linkPlanoMidia}
                  onChange={(e) => setLinkPlanoMidia(e.target.value)}
                  className={isFieldHidden('link_plano_midia') ? 'opacity-50' : ''}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Link do Planejamento do Quarter</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleHiddenField('link_planejamento_quarter')}
                    className="h-6 px-2 text-xs gap-1"
                  >
                    {isFieldHidden('link_planejamento_quarter') ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {isFieldHidden('link_planejamento_quarter') ? 'Oculto' : 'Visível'}
                  </Button>
                </div>
                <Input
                  placeholder="https://..."
                  value={linkPlanejamentoQuarter}
                  onChange={(e) => setLinkPlanejamentoQuarter(e.target.value)}
                  className={isFieldHidden('link_planejamento_quarter') ? 'opacity-50' : ''}
                />
              </div>
            </div>
          </div>

          {/* Editable Message Template */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-primary" />
                <Label className="text-base font-semibold">Mensagem do Planner Monday</Label>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRefreshTemplate}
                className="gap-1 text-xs"
              >
                <RefreshCw className="w-3 h-3" />
                Atualizar com dados
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Edite a mensagem conforme necessário. Use *texto* para negrito, _texto_ para itálico
            </p>
            
            <div className="space-y-2">
              <Textarea
                placeholder="A mensagem será gerada automaticamente..."
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                rows={16}
                className="font-mono text-sm"
              />
            </div>

            {/* WhatsApp Preview */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Preview no WhatsApp:</Label>
              <div className="bg-[#0b141a] rounded-lg p-4 border border-border/50 max-h-80 overflow-y-auto">
                <div className="bg-[#005c4b] rounded-lg p-3 max-w-[85%] ml-auto">
                  <pre className="text-sm text-white whitespace-pre-wrap font-sans leading-relaxed">
                    {currentMessage}
                  </pre>
                  <span className="text-[10px] text-white/60 float-right mt-1">
                    Agora ✓✓
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Send History */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                <Label className="text-base font-semibold">Histórico de Envios</Label>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={loadSendHistory}
                disabled={loadingHistory}
                className="gap-1 text-xs"
              >
                {loadingHistory ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Atualizar
              </Button>
            </div>

            {sendHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhum envio registrado ainda</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {sendHistory.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>{format(new Date(item.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {item.target_type === 'group' ? <Users className="w-3 h-3" /> : <Smartphone className="w-3 h-3" />}
                      <span className="text-xs">{item.target_name || 'Destino'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-4 border-t">
            <Button
              type="button"
              onClick={handleSendPlanner}
              disabled={sendingPlanner || !instanceId || !(targetType === 'phone' ? phoneNumber : groupId)}
              className="w-full gap-2"
            >
              {sendingPlanner ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Enviar Planner Monday
            </Button>
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t">
            <Button onClick={handleSave} disabled={saving || !instanceId} className="w-full">
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>
              ) : (
                'Salvar Configuração'
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
