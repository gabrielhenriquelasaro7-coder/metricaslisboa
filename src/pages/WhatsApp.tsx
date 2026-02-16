import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import { useWhatsAppInstances, WhatsAppGroup } from '@/hooks/useWhatsAppInstances';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths, format as formatDate } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  RotateCcw,
  History,
  Plus,
  Smartphone,
  Users,
  Wallet,
  AlertTriangle,
  FileText,
  BarChart3
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { WhatsAppInstanceCard } from '@/components/whatsapp/WhatsAppInstanceCard';
import { WhatsAppQRModal } from '@/components/whatsapp/WhatsAppQRModal';
import { WhatsAppGroupSelector } from '@/components/whatsapp/WhatsAppGroupSelector';
import { AnomalyAlertsCard } from '@/components/alerts/AnomalyAlertsCard';
import { useBalanceAlert, generateBalanceAlertMessage } from '@/hooks/useBalanceAlert';
import { WhatsAppSkeleton } from '@/components/skeletons';
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/layout/PageTransition';
import whatsappIcon from '@/assets/whatsapp-icon.png';

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
  instance_id?: string | null;
  target_type?: 'phone' | 'group';
  group_id?: string | null;
  group_name?: string | null;
  balance_alert_enabled?: boolean | null;
  balance_alert_threshold?: number | null;
  last_balance_alert_at?: string | null;
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

const DEFAULT_INSIDE_SALES_TEMPLATE = `📊 *Relatório de Tráfego - {projeto}*
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
{leads}
{cpl}

━━━━━━━━━━━━━━━━━━━━━

_Relatório gerado automaticamente_`;

const DEFAULT_ECOMMERCE_TEMPLATE = `📊 *Relatório de Tráfego - {projeto}*
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
{cpa}
{roas}

━━━━━━━━━━━━━━━━━━━━━

_Relatório gerado automaticamente_`;

const getDefaultTemplate = (businessModel: 'inside_sales' | 'ecommerce' | 'pdv' | 'custom' | 'infoproduto' | null): string => {
  if (businessModel === 'ecommerce' || businessModel === 'pdv') {
    return DEFAULT_ECOMMERCE_TEMPLATE;
  }
  return DEFAULT_INSIDE_SALES_TEMPLATE;
};

interface MetricConfig {
  id: string;
  key: string;
  label: string;
  emoji: string;
  preview: string;
  businessModels: ('inside_sales' | 'ecommerce' | 'pdv' | 'custom' | 'infoproduto')[];
}

const ALL_METRICS_CONFIG: MetricConfig[] = [
  { id: 'spend', key: 'investimento', label: '💰 Investimento', emoji: '💰', preview: 'R$ 5.234,50', businessModels: ['inside_sales', 'ecommerce', 'pdv', 'custom', 'infoproduto'] },
  { id: 'reach', key: 'alcance', label: '👁️ Alcance', emoji: '👁️', preview: '32.5K', businessModels: ['inside_sales', 'ecommerce', 'pdv', 'custom', 'infoproduto'] },
  { id: 'impressions', key: 'impressoes', label: '📺 Impressões', emoji: '📺', preview: '45.2K', businessModels: ['inside_sales', 'ecommerce', 'pdv', 'custom', 'infoproduto'] },
  { id: 'frequency', key: 'frequencia', label: '🔄 Frequência', emoji: '🔄', preview: '1.39', businessModels: ['inside_sales', 'ecommerce', 'pdv', 'custom', 'infoproduto'] },
  { id: 'clicks', key: 'cliques', label: '👆 Cliques', emoji: '👆', preview: '1.823', businessModels: ['inside_sales', 'ecommerce', 'pdv', 'custom', 'infoproduto'] },
  { id: 'ctr', key: 'ctr', label: '📈 CTR', emoji: '📈', preview: '3.98%', businessModels: ['inside_sales', 'ecommerce', 'pdv', 'custom', 'infoproduto'] },
  { id: 'cpm', key: 'cpm', label: '💵 CPM', emoji: '💵', preview: 'R$ 115,78', businessModels: ['inside_sales', 'ecommerce', 'pdv', 'custom', 'infoproduto'] },
  { id: 'cpc', key: 'cpc', label: '💳 CPC', emoji: '💳', preview: 'R$ 2,87', businessModels: ['inside_sales', 'ecommerce', 'pdv', 'custom', 'infoproduto'] },
  { id: 'leads', key: 'leads', label: '🎯 Leads', emoji: '🎯', preview: '127', businessModels: ['inside_sales', 'custom', 'infoproduto'] },
  { id: 'cpl', key: 'cpl', label: '📊 CPL', emoji: '📊', preview: 'R$ 41,22', businessModels: ['inside_sales', 'custom', 'infoproduto'] },
  { id: 'conversions', key: 'conversoes', label: '🛒 Conversões', emoji: '🛒', preview: '127', businessModels: ['ecommerce', 'pdv', 'custom', 'infoproduto'] },
  { id: 'conversion_value', key: 'valor_conversao', label: '💎 Valor Conversão', emoji: '💎', preview: 'R$ 23.545,00', businessModels: ['ecommerce', 'pdv', 'custom', 'infoproduto'] },
  { id: 'roas', key: 'roas', label: '🚀 ROAS', emoji: '🚀', preview: '4.5x', businessModels: ['ecommerce', 'pdv', 'custom', 'infoproduto'] },
  { id: 'cpa', key: 'cpa', label: '💳 CPA', emoji: '💳', preview: 'R$ 41,22', businessModels: ['ecommerce', 'pdv', 'custom', 'infoproduto'] },
];

const getMetricsForBusinessModel = (businessModel: 'inside_sales' | 'ecommerce' | 'pdv' | 'custom' | 'infoproduto' | null): MetricConfig[] => {
  const model = businessModel || 'inside_sales';
  return ALL_METRICS_CONFIG.filter(m => m.businessModels.includes(model));
};

function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

function getDateRangeForPeriod(period: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;

  switch (period) {
    case 'last_7_days': startDate = subDays(now, 7); break;
    case 'last_14_days': startDate = subDays(now, 14); break;
    case 'last_30_days': startDate = subDays(now, 30); break;
    case 'this_week': startDate = startOfWeek(now, { weekStartsOn: 1 }); endDate = endOfWeek(now, { weekStartsOn: 1 }); break;
    case 'last_week': { const lw = subWeeks(now, 1); startDate = startOfWeek(lw, { weekStartsOn: 1 }); endDate = endOfWeek(lw, { weekStartsOn: 1 }); break; }
    case 'this_month': startDate = startOfMonth(now); endDate = endOfMonth(now); break;
    case 'last_month': { const lm = subMonths(now, 1); startDate = startOfMonth(lm); endDate = endOfMonth(lm); break; }
    default: startDate = subDays(now, 7);
  }

  return { startDate, endDate };
}

function formatCurrencyWA(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumberWA(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString('pt-BR');
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

interface AggregatedMetrics {
  spend: number; impressions: number; clicks: number; reach: number;
  conversions: number; conversion_value: number; ctr: number; cpm: number;
  cpc: number; frequency: number; leads: number; cpl: number; roas: number; cpa: number;
}

function generatePreviewWithData(
  template: string, projectName: string, period: string,
  enabledMetrics: Record<string, boolean>,
  businessModel: 'inside_sales' | 'ecommerce' | 'pdv' | 'custom' | 'infoproduto' | null,
  metrics: AggregatedMetrics | null
): string {
  const periodLabel = PERIOD_OPTIONS.find(p => p.value === period)?.label || 'Últimos 7 dias';
  const metricsConfig = getMetricsForBusinessModel(businessModel);
  
  let result = template.replace('{periodo}', periodLabel).replace('{projeto}', projectName);
  
  const formattedValues: Record<string, string> = metrics ? {
    investimento: formatCurrencyWA(metrics.spend), alcance: formatNumberWA(metrics.reach),
    impressoes: formatNumberWA(metrics.impressions), frequencia: metrics.frequency.toFixed(2),
    cliques: formatNumberWA(metrics.clicks), ctr: formatPercent(metrics.ctr),
    cpm: formatCurrencyWA(metrics.cpm), cpc: formatCurrencyWA(metrics.cpc),
    leads: formatNumberWA(metrics.leads), cpl: formatCurrencyWA(metrics.cpl),
    conversoes: formatNumberWA(metrics.conversions), valor_conversao: formatCurrencyWA(metrics.conversion_value),
    roas: `${metrics.roas.toFixed(2)}x`, cpa: formatCurrencyWA(metrics.cpa),
  } : {};

  ALL_METRICS_CONFIG.forEach(metric => {
    const varName = `{${metric.key}}`;
    const isAvailable = metricsConfig.some(m => m.id === metric.id);
    const isEnabled = isAvailable && (enabledMetrics[metric.id] ?? true);
    
    if (isEnabled && metrics) {
      const value = formattedValues[metric.key] || '0';
      result = result.replace(varName, `${metric.emoji} ${metric.label.replace(/^[^\s]+ /, '')}: ${value}`);
    } else {
      result = result.replace(new RegExp(`.*\\\\{${metric.key}\\\\}.*\\n?`, 'g'), '');
    }
  });
  
  result = result.replace(/\n{3,}/g, '\n\n');
  return result;
}

export default function WhatsApp() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { projects } = useProjects();
  
  const selectedProjectId = localStorage.getItem('selectedProjectId');
  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0];
  
  const businessModel = selectedProject?.business_model || 'inside_sales';
  const availableMetrics = getMetricsForBusinessModel(businessModel);

  // New report dialog
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportProjectId, setReportProjectId] = useState<string | null>(null);
  const [reportType, setReportType] = useState<'metrics' | 'planner'>('metrics');

  // WhatsApp Instances
  const {
    instances, loading: instancesLoading, creating: creatingInstance,
    createInstance, connectInstance, checkStatus, disconnectInstance,
    deleteInstance, listGroups, updateDisplayName,
  } = useWhatsAppInstances(selectedProject?.id || null);

  // QR Modal state
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrModalData, setQrModalData] = useState<{ instanceId: string; qrCode: string | null; expiresAt: string | null }>({ instanceId: '', qrCode: null, expiresAt: null });
  const [connectingInstanceId, setConnectingInstanceId] = useState<string | null>(null);

  // Groups state
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Subscription state
  const [subscription, setSubscription] = useState<WhatsAppSubscription | null>(null);
  const [messageLogs, setMessageLogs] = useState<WhatsAppMessageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingBalanceTest, setSendingBalanceTest] = useState(false);
  
  const [realMetrics, setRealMetrics] = useState<AggregatedMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  const { calculateBalanceStatus } = useBalanceAlert(selectedProject?.id || null);
  const [balancePreview, setBalancePreview] = useState<{ balance: number; daysRemaining: number; avgDailySpend: number } | null>(null);

  // Form state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [weeklyReportEnabled, setWeeklyReportEnabled] = useState(true);
  const [reportDayOfWeek, setReportDayOfWeek] = useState(1);
  const [reportTime, setReportTime] = useState('08:00');
  const [reportPeriod, setReportPeriod] = useState('last_7_days');
  const [messageTemplate, setMessageTemplate] = useState(() => getDefaultTemplate(businessModel));
  const [hasChanges, setHasChanges] = useState(false);

  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [targetType, setTargetType] = useState<'phone' | 'group'>('phone');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(null);
  
  const [balanceAlertEnabled, setBalanceAlertEnabled] = useState(false);
  const [balanceAlertThreshold, setBalanceAlertThreshold] = useState(3);

  const [metricsEnabled, setMetricsEnabled] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    ALL_METRICS_CONFIG.forEach(m => { initial[m.id] = true; });
    return initial;
  });

  const toggleMetric = (id: string) => {
    setMetricsEnabled(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const connectedInstances = instances.filter(i => i.instance_status === 'connected');
  
  // Fetch real metrics for preview
  const fetchRealMetrics = useCallback(async () => {
    if (!selectedProject) return;
    setLoadingMetrics(true);
    try {
      const { startDate, endDate } = getDateRangeForPeriod(reportPeriod);
      const startStr = formatDate(startDate, 'yyyy-MM-dd');
      const endStr = formatDate(endDate, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('ads_daily_metrics')
        .select('spend, impressions, clicks, reach, conversions, conversion_value')
        .eq('project_id', selectedProject.id)
        .gte('date', startStr)
        .lte('date', endStr);
      
      if (error) throw error;
      
      const aggregated: AggregatedMetrics = {
        spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, conversion_value: 0,
        ctr: 0, cpm: 0, cpc: 0, frequency: 0, leads: 0, cpl: 0, roas: 0, cpa: 0,
      };
      
      if (data && data.length > 0) {
        data.forEach(row => {
          aggregated.spend += Number(row.spend) || 0;
          aggregated.impressions += Number(row.impressions) || 0;
          aggregated.clicks += Number(row.clicks) || 0;
          aggregated.reach += Number(row.reach) || 0;
          aggregated.conversions += Number(row.conversions) || 0;
          aggregated.conversion_value += Number(row.conversion_value) || 0;
        });
        
        if (aggregated.impressions > 0) {
          aggregated.ctr = (aggregated.clicks / aggregated.impressions) * 100;
          aggregated.cpm = (aggregated.spend / aggregated.impressions) * 1000;
        }
        if (aggregated.clicks > 0) {
          aggregated.cpc = aggregated.spend / aggregated.clicks;
        }
        if (aggregated.reach > 0) {
          aggregated.frequency = aggregated.impressions / aggregated.reach;
        }
        aggregated.leads = aggregated.conversions;
        if (aggregated.conversions > 0) {
          aggregated.cpl = aggregated.spend / aggregated.conversions;
          aggregated.cpa = aggregated.spend / aggregated.conversions;
        }
        if (aggregated.spend > 0) {
          aggregated.roas = aggregated.conversion_value / aggregated.spend;
        }
      }
      
      setRealMetrics(aggregated);
    } catch (error) {
      console.error('Error fetching metrics for preview:', error);
      setRealMetrics(null);
    } finally {
      setLoadingMetrics(false);
    }
  }, [selectedProject, reportPeriod]);
  
  useEffect(() => { fetchRealMetrics(); }, [fetchRealMetrics]);

  useEffect(() => {
    const loadBalancePreview = async () => {
      if (balanceAlertEnabled && selectedProject?.id) {
        const data = await calculateBalanceStatus();
        if (data) setBalancePreview({ balance: data.balance, daysRemaining: data.daysRemaining, avgDailySpend: data.avgDailySpend });
      }
    };
    loadBalancePreview();
  }, [balanceAlertEnabled, selectedProject?.id, calculateBalanceStatus]);

  const fetchSubscription = useCallback(async () => {
    if (!user || !selectedProject) { setLoading(false); return; }
    try {
      const { data, error } = await supabase.from('whatsapp_subscriptions').select('*').eq('user_id', user.id).eq('project_id', selectedProject.id).maybeSingle();
      if (error) throw error;
      setSubscription(data as WhatsAppSubscription | null);
    } catch (error) { console.error('Error fetching WhatsApp subscription:', error); }
    finally { setLoading(false); }
  }, [user, selectedProject]);

  const fetchMessageLogs = useCallback(async () => {
    if (!subscription) return;
    try {
      const { data, error } = await supabase.from('whatsapp_messages_log').select('*').eq('subscription_id', subscription.id).order('created_at', { ascending: false }).limit(10);
      if (error) throw error;
      setMessageLogs(data || []);
    } catch (error) { console.error('Error fetching message logs:', error); }
  }, [subscription]);

  useEffect(() => { fetchSubscription(); }, [fetchSubscription]);
  useEffect(() => { if (subscription) fetchMessageLogs(); }, [subscription, fetchMessageLogs]);

  useEffect(() => {
    if (subscription) {
      setPhoneNumber(formatPhoneNumber(subscription.phone_number));
      setWeeklyReportEnabled(subscription.weekly_report_enabled);
      setReportDayOfWeek(subscription.report_day_of_week);
      setReportTime(subscription.report_time?.slice(0, 5) || '08:00');
      setReportPeriod(subscription.report_period || 'last_7_days');
      setMessageTemplate(subscription.message_template || getDefaultTemplate(businessModel));
      setSelectedInstanceId(subscription.instance_id || null);
      setTargetType(subscription.target_type || 'phone');
      setSelectedGroupId(subscription.group_id || null);
      setSelectedGroupName(subscription.group_name || null);
      setBalanceAlertEnabled(subscription.balance_alert_enabled ?? false);
      setBalanceAlertThreshold(subscription.balance_alert_threshold ?? 3);
      setMetricsEnabled({
        spend: subscription.include_spend ?? true, reach: subscription.include_reach ?? true,
        impressions: subscription.include_impressions ?? true, frequency: subscription.include_frequency ?? true,
        clicks: subscription.include_clicks ?? true, ctr: subscription.include_ctr ?? true,
        cpm: subscription.include_cpm ?? true, cpc: subscription.include_cpc ?? true,
        conversions: subscription.include_conversions ?? true, conversion_value: subscription.include_conversion_value ?? true,
        leads: subscription.include_leads ?? true, cpl: subscription.include_cpl ?? true,
        cpa: subscription.include_cpc ?? true, roas: subscription.include_roas ?? true,
      });
    }
  }, [subscription, businessModel]);

  useEffect(() => {
    if (selectedInstanceId) { loadGroups(selectedInstanceId); } else { setGroups([]); }
  }, [selectedInstanceId]);

  const loadGroups = async (instanceId: string) => {
    setLoadingGroups(true);
    const fetchedGroups = await listGroups(instanceId);
    setGroups(fetchedGroups);
    setLoadingGroups(false);
  };

  useEffect(() => {
    if (!subscription) { setHasChanges(phoneNumber.length > 0 || selectedInstanceId !== null); return; }
    const phoneChanged = phoneNumber.replace(/\D/g, '') !== subscription.phone_number.replace(/\D/g, '');
    const enabledChanged = weeklyReportEnabled !== subscription.weekly_report_enabled;
    const dayChanged = reportDayOfWeek !== subscription.report_day_of_week;
    const timeChanged = reportTime !== subscription.report_time?.slice(0, 5);
    const periodChanged = reportPeriod !== (subscription.report_period || 'last_7_days');
    const templateChanged = messageTemplate !== (subscription.message_template || getDefaultTemplate(businessModel));
    const instanceChanged = selectedInstanceId !== (subscription.instance_id || null);
    const targetTypeChanged = targetType !== (subscription.target_type || 'phone');
    const groupChanged = selectedGroupId !== (subscription.group_id || null);
    const metricsChanged = metricsEnabled.spend !== (subscription.include_spend ?? true) ||
      metricsEnabled.reach !== (subscription.include_reach ?? true) || metricsEnabled.impressions !== (subscription.include_impressions ?? true) ||
      metricsEnabled.frequency !== (subscription.include_frequency ?? true) || metricsEnabled.clicks !== (subscription.include_clicks ?? true) ||
      metricsEnabled.ctr !== (subscription.include_ctr ?? true) || metricsEnabled.cpm !== (subscription.include_cpm ?? true) ||
      metricsEnabled.cpc !== (subscription.include_cpc ?? true) || metricsEnabled.conversions !== (subscription.include_conversions ?? true) ||
      metricsEnabled.conversion_value !== (subscription.include_conversion_value ?? true) || metricsEnabled.leads !== (subscription.include_leads ?? true) ||
      metricsEnabled.roas !== (subscription.include_roas ?? true);
    setHasChanges(phoneChanged || enabledChanged || dayChanged || timeChanged || periodChanged || templateChanged || metricsChanged || instanceChanged || targetTypeChanged || groupChanged);
  }, [subscription, phoneNumber, weeklyReportEnabled, reportDayOfWeek, reportTime, reportPeriod, messageTemplate, metricsEnabled, selectedInstanceId, targetType, selectedGroupId, businessModel]);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  const handleCreateInstance = async () => {
    const instance = await createInstance('Nova Conexão');
    if (instance) handleConnectInstance(instance.id);
  };

  const handleConnectInstance = async (instanceId: string) => {
    setConnectingInstanceId(instanceId);
    const result = await connectInstance(instanceId);
    setConnectingInstanceId(null);
    if (result) {
      setQrModalData({ instanceId, qrCode: result.qrCode, expiresAt: result.expiresAt });
      setQrModalOpen(true);
    }
  };

  const handleRefreshQR = async () => {
    if (!qrModalData.instanceId) return;
    const result = await connectInstance(qrModalData.instanceId);
    if (result) setQrModalData({ ...qrModalData, qrCode: result.qrCode, expiresAt: result.expiresAt });
  };

  const handleCheckStatus = async () => {
    if (!qrModalData.instanceId) return null;
    return await checkStatus(qrModalData.instanceId);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhoneNumber(formatPhoneNumber(e.target.value));
  };

  const handleSave = async () => {
    if (!user || !selectedProject) return;
    if (targetType === 'phone') {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      if (cleanPhone.length < 10) { toast.error('Número de telefone inválido'); return; }
    } else if (targetType === 'group') {
      if (!selectedInstanceId) { toast.error('Selecione uma conexão WhatsApp'); return; }
      if (!selectedGroupId) { toast.error('Selecione um grupo'); return; }
    }

    setSaving(true);
    try {
      const updateData = {
        phone_number: phoneNumber.replace(/\D/g, '') || '0', weekly_report_enabled: weeklyReportEnabled,
        report_day_of_week: reportDayOfWeek, report_time: reportTime, report_period: reportPeriod,
        message_template: messageTemplate, instance_id: selectedInstanceId, target_type: targetType,
        group_id: targetType === 'group' ? selectedGroupId : null, group_name: targetType === 'group' ? selectedGroupName : null,
        balance_alert_enabled: balanceAlertEnabled, balance_alert_threshold: balanceAlertThreshold,
        include_spend: metricsEnabled.spend, include_reach: metricsEnabled.reach,
        include_impressions: metricsEnabled.impressions, include_frequency: metricsEnabled.frequency,
        include_clicks: metricsEnabled.clicks, include_ctr: metricsEnabled.ctr,
        include_cpm: metricsEnabled.cpm, include_cpc: metricsEnabled.cpc,
        include_conversions: metricsEnabled.conversions, include_conversion_value: metricsEnabled.conversion_value,
        include_leads: metricsEnabled.leads, include_cpl: metricsEnabled.cpl ?? metricsEnabled.leads,
        include_roas: metricsEnabled.roas,
      };

      if (subscription) {
        const { error } = await supabase.from('whatsapp_subscriptions').update(updateData).eq('id', subscription.id);
        if (error) throw error;
        toast.success('Configurações salvas!');
      } else {
        const { data: newSub, error } = await supabase.from('whatsapp_subscriptions').insert({ user_id: user.id, project_id: selectedProject.id, ...updateData }).select().single();
        if (error) throw error;
        setSubscription(newSub as WhatsAppSubscription);
        toast.success('Configurações salvas!');
      }
      await fetchSubscription();
    } catch (error: any) { console.error('Error saving subscription:', error); toast.error('Erro ao salvar configurações'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!subscription) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('whatsapp_subscriptions').delete().eq('id', subscription.id);
      if (error) throw error;
      setSubscription(null); setMessageLogs([]); setPhoneNumber('');
      setWeeklyReportEnabled(true); setReportDayOfWeek(1); setReportTime('08:00');
      setReportPeriod('last_7_days'); setMessageTemplate(getDefaultTemplate(businessModel));
      setSelectedInstanceId(null); setTargetType('phone'); setSelectedGroupId(null); setSelectedGroupName(null);
      const initialMetrics: Record<string, boolean> = {};
      ALL_METRICS_CONFIG.forEach(m => { initialMetrics[m.id] = true; });
      setMetricsEnabled(initialMetrics);
      toast.success('Configurações removidas');
    } catch (error) { console.error('Error deleting subscription:', error); toast.error('Erro ao remover configurações'); }
    finally { setSaving(false); }
  };

  const sendTestReport = async () => {
    if (!subscription) { toast.error('Configure e salve suas configurações primeiro'); return; }
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-weekly-report', { body: { subscriptionId: subscription.id } });
      if (error) throw error;
      const result = data.results?.[0];
      if (result?.success && !result?.skipped) { toast.success('Relatório de teste enviado!'); await fetchMessageLogs(); }
      else if (result?.skipped) { toast.warning(`Relatório não enviado: ${result.reason === 'no_data' ? 'Sem dados no período' : result.reason}`); }
      else { toast.error(result?.error || 'Erro ao enviar relatório de teste'); }
    } catch (error: any) { toast.error(error.message || 'Erro ao enviar relatório de teste'); }
    finally { setSendingTest(false); }
  };

  const sendBalanceAlertTest = async () => {
    if (!subscription) { toast.error('Configure e salve suas configurações primeiro'); return; }
    if (!selectedInstanceId) { toast.error('Selecione uma conexão WhatsApp primeiro'); return; }
    if (!balancePreview) { toast.error('Não foi possível obter dados de saldo'); return; }
    setSendingBalanceTest(true);
    try {
      const message = generateBalanceAlertMessage(selectedProject?.name || 'Projeto', balancePreview.balance, balancePreview.daysRemaining, balancePreview.avgDailySpend);
      const payload: Record<string, unknown> = { message, subscriptionId: subscription.id, messageType: 'balance_alert_test', instanceId: selectedInstanceId, targetType };
      if (targetType === 'group' && selectedGroupId) payload.groupId = selectedGroupId;
      else payload.phone = phoneNumber;
      const { data, error } = await supabase.functions.invoke('whatsapp-send', { body: payload });
      if (error) throw error;
      if (data.success) { toast.success('Alerta de saldo de teste enviado!'); await fetchMessageLogs(); }
      else toast.error('Erro ao enviar alerta de teste');
    } catch (error: any) { toast.error(error.message || 'Erro ao enviar alerta de teste'); }
    finally { setSendingBalanceTest(false); }
  };

  const resetTemplate = () => {
    setMessageTemplate(getDefaultTemplate(businessModel));
    toast.success('Template restaurado para o padrão');
  };

  const getStatusBadge = (status: string) => {
    if (status === 'sent') return <Badge variant="outline" className="bg-metric-positive/10 text-metric-positive border-metric-positive/20"><CheckCircle2 className="w-3 h-3 mr-1" />Enviado</Badge>;
    if (status === 'failed') return <Badge variant="outline" className="bg-metric-negative/10 text-metric-negative border-metric-negative/20"><XCircle className="w-3 h-3 mr-1" />Falhou</Badge>;
    return <Badge variant="outline" className="bg-muted text-muted-foreground"><Clock className="w-3 h-3 mr-1" />{status}</Badge>;
  };

  const previewMessage = generatePreviewWithData(messageTemplate, selectedProject?.name || 'Projeto', reportPeriod, metricsEnabled, businessModel, realMetrics);

  if (authLoading || loading) {
    return <DashboardLayout><div className="p-6 lg:p-8"><WhatsAppSkeleton /></div></DashboardLayout>;
  }

  if (!selectedProject) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8 flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-muted-foreground">Selecione um projeto primeiro</p>
          <Button onClick={() => navigate('/dashboard')}>Ir para Projetos</Button>
        </div>
      </DashboardLayout>
    );
  }

  const activeProjects = projects.filter(p => !p.archived);

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 overflow-x-hidden">
        {/* Hero Header with WhatsApp logo */}
        <FadeIn>
          <div className="glass-card overflow-hidden">
            <div className="bg-gradient-to-r from-green-600/20 via-green-500/10 to-transparent p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0">
                    <img src={whatsappIcon} alt="WhatsApp" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <h1 className="text-lg sm:text-xl lg:text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>WhatsApp</h1>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Gerencie conexões e relatórios automáticos</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => setReportDialogOpen(true)} size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white">
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Novo Relatório</span>
                    <span className="sm:hidden">Novo</span>
                  </Button>
                  <Button onClick={handleCreateInstance} disabled={creatingInstance || instances.length >= 3} size="sm" variant="outline" className="gap-1.5">
                    {creatingInstance ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Smartphone className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">Conexão</span>
                  </Button>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="bg-background/40 backdrop-blur-sm rounded-lg p-2.5 sm:p-3 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <Smartphone className="w-3.5 h-3.5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm sm:text-lg font-bold">{instances.length}</p>
                    <p className="text-[9px] sm:text-[10px] text-muted-foreground">Conexões</p>
                  </div>
                </div>
                <div className="bg-background/40 backdrop-blur-sm rounded-lg p-2.5 sm:p-3 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm sm:text-lg font-bold">{connectedInstances.length > 0 ? 'Conectado' : 'Offline'}</p>
                    <p className="text-[9px] sm:text-[10px] text-muted-foreground">Status</p>
                  </div>
                </div>
                <div className="bg-background/40 backdrop-blur-sm rounded-lg p-2.5 sm:p-3 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm sm:text-lg font-bold">{weeklyReportEnabled ? 'Ativo' : 'Inativo'}</p>
                    <p className="text-[9px] sm:text-[10px] text-muted-foreground">Automação</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Instances grid inside card */}
            {instances.length > 0 && (
              <div className="p-3 sm:p-4 border-t border-border/30">
                <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {instances.map((instance) => (
                    <WhatsAppInstanceCard
                      key={instance.id}
                      instance={instance}
                      onConnect={handleConnectInstance}
                      onDisconnect={disconnectInstance}
                      onDelete={deleteInstance}
                      onUpdateName={updateDisplayName}
                      isConnecting={connectingInstanceId === instance.id}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </FadeIn>

        {/* New Report Dialog */}
        <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
          <DialogContent className="max-w-lg bg-card/95 backdrop-blur-xl border-border">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Criar Novo Relatório</DialogTitle>
              <DialogDescription>Selecione o projeto e o tipo de relatório</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {/* Project Selection */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Projeto</Label>
                <Select value={reportProjectId || ''} onValueChange={setReportProjectId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selecione um projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeProjects.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0">
                            {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-[8px] font-bold">{p.name.charAt(0)}</span>}
                          </div>
                          <span className="text-sm">{p.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Report Type */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Tipo de Relatório</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setReportType('metrics')}
                    className={`glass-card p-4 text-left transition-all ${reportType === 'metrics' ? 'ring-2 ring-green-500' : 'hover:ring-1 hover:ring-border'}`}
                  >
                    <BarChart3 className="w-5 h-5 text-green-400 mb-2" />
                    <p className="text-sm font-medium">Relatório de Métricas</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Últimos 7 dias de performance</p>
                  </button>
                  <button
                    onClick={() => setReportType('planner')}
                    className={`glass-card p-4 text-left transition-all ${reportType === 'planner' ? 'ring-2 ring-green-500' : 'hover:ring-1 hover:ring-border'}`}
                  >
                    <FileText className="w-5 h-5 text-blue-400 mb-2" />
                    <p className="text-sm font-medium">Planner Monday</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Planejamento semanal</p>
                  </button>
                </div>
              </div>

              <Button
                onClick={() => {
                  if (!reportProjectId) { toast.error('Selecione um projeto'); return; }
                  setReportDialogOpen(false);
                  // Navigate or open the appropriate config
                  toast.success(`Configurando ${reportType === 'metrics' ? 'relatório de métricas' : 'planner'} para o projeto`);
                }}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                disabled={!reportProjectId}
              >
                Continuar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Anomaly Alerts Card */}
        <StaggerItem>
          <AnomalyAlertsCard projectId={selectedProject.id} />
        </StaggerItem>

        <StaggerContainer staggerDelay={0.05}>
          <StaggerItem>
            <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
              {/* Left Column - Configuration */}
              <div className="space-y-4 sm:space-y-6">
                {/* Basic Settings Card */}
                <Card className="glass-card border-border/50">
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-base sm:text-lg">Configurar Envio</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Configure quando e para onde enviar</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0 space-y-4 sm:space-y-5">
                    {connectedInstances.length > 0 && (
                      <>
                        <div className="space-y-2">
                          <Label className="text-xs sm:text-sm">Conexão WhatsApp</Label>
                          <Select value={selectedInstanceId || ''} onValueChange={setSelectedInstanceId}>
                            <SelectTrigger className="h-10 text-sm">
                              <SelectValue placeholder="Selecione uma conexão">
                                {selectedInstanceId && (
                                  <div className="flex items-center gap-2">
                                    <Smartphone className="h-3.5 w-3.5" />
                                    <span className="truncate">{instances.find(i => i.id === selectedInstanceId)?.display_name || 'Conexão'}</span>
                                  </div>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {connectedInstances.map(inst => (
                                <SelectItem key={inst.id} value={inst.id}>
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                    <span>{inst.display_name || inst.instance_name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {selectedInstanceId && (
                          <div className="space-y-2">
                            <Label className="text-xs sm:text-sm">Enviar para</Label>
                            <Tabs value={targetType} onValueChange={(v) => setTargetType(v as 'phone' | 'group')}>
                              <TabsList className="grid w-full grid-cols-2 h-9">
                                <TabsTrigger value="phone" className="text-xs gap-1"><MessageSquare className="w-3 h-3" />Número</TabsTrigger>
                                <TabsTrigger value="group" className="text-xs gap-1"><Users className="w-3 h-3" />Grupo</TabsTrigger>
                              </TabsList>
                            </Tabs>
                          </div>
                        )}
                      </>
                    )}

                    {targetType === 'phone' && (
                      <div className="space-y-2">
                        <Label className="text-xs sm:text-sm">Número WhatsApp</Label>
                        <Input value={phoneNumber} onChange={handlePhoneChange} placeholder="(11) 99999-9999" className="h-10" />
                      </div>
                    )}

                    {targetType === 'group' && selectedInstanceId && (
                      <WhatsAppGroupSelector
                        groups={groups} isLoading={loadingGroups}
                        selectedGroupId={selectedGroupId}
                        onSelectGroup={(id, name) => { setSelectedGroupId(id); setSelectedGroupName(name); }}
                        onRefresh={() => loadGroups(selectedInstanceId)}
                      />
                    )}

                    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                      <div>
                        <Label className="text-xs sm:text-sm font-medium">Relatório Automático</Label>
                        <p className="text-[10px] text-muted-foreground">Envio semanal programado</p>
                      </div>
                      <Switch checked={weeklyReportEnabled} onCheckedChange={setWeeklyReportEnabled} />
                    </div>

                    {weeklyReportEnabled && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Dia</Label>
                          <Select value={String(reportDayOfWeek)} onValueChange={(v) => setReportDayOfWeek(Number(v))}>
                            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{DAYS_OF_WEEK.map(d => <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Horário</Label>
                          <Select value={reportTime} onValueChange={setReportTime}>
                            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{TIME_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label className="text-xs">Período dos Dados</Label>
                      <Select value={reportPeriod} onValueChange={setReportPeriod}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{PERIOD_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>

                    {/* Balance Alert */}
                    <div className="space-y-3 p-3 rounded-lg border border-border/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-warning" />
                          <Label className="text-xs font-medium">Alerta de Saldo</Label>
                        </div>
                        <Switch checked={balanceAlertEnabled} onCheckedChange={setBalanceAlertEnabled} />
                      </div>
                      {balanceAlertEnabled && (
                        <div className="space-y-1.5">
                          <Label className="text-[10px] text-muted-foreground">Alertar quando saldo durar menos de (dias)</Label>
                          <Input type="number" value={balanceAlertThreshold} onChange={(e) => setBalanceAlertThreshold(Number(e.target.value))} className="h-8 text-xs" min={1} max={30} />
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button onClick={handleSave} disabled={saving || !hasChanges} size="sm" className="gap-1.5 flex-1">
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Salvar
                      </Button>
                      <Button onClick={sendTestReport} disabled={sendingTest || !subscription} variant="outline" size="sm" className="gap-1.5">
                        {sendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Testar
                      </Button>
                      {subscription && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover configurações?</AlertDialogTitle>
                              <AlertDialogDescription>Isso removerá todas as configurações de WhatsApp para este projeto.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column - Template & Preview */}
              <div className="space-y-4 sm:space-y-6">
                {/* Metrics Selection */}
                <Card className="glass-card border-border/50">
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm">Métricas do Relatório</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="grid grid-cols-2 gap-2">
                      {availableMetrics.map(metric => (
                        <label key={metric.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/30 cursor-pointer transition-colors">
                          <Checkbox checked={metricsEnabled[metric.id] ?? true} onCheckedChange={() => toggleMetric(metric.id)} className="h-3.5 w-3.5" />
                          <span className="text-xs">{metric.label}</span>
                        </label>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Template Editor */}
                <Card className="glass-card border-border/50">
                  <CardHeader className="p-4 flex-row items-center justify-between">
                    <CardTitle className="text-sm">Template da Mensagem</CardTitle>
                    <Button variant="ghost" size="sm" onClick={resetTemplate} className="h-7 text-[10px] gap-1">
                      <RotateCcw className="w-3 h-3" /> Reset
                    </Button>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <Textarea value={messageTemplate} onChange={(e) => setMessageTemplate(e.target.value)} className="min-h-[200px] text-xs font-mono" />
                  </CardContent>
                </Card>

                {/* Preview */}
                <Card className="glass-card border-border/50">
                  <CardHeader className="p-4">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-muted-foreground" />
                      <CardTitle className="text-sm">Pré-visualização</CardTitle>
                      {loadingMetrics && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="bg-secondary/30 rounded-lg p-3 border border-border/30">
                      <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed">{previewMessage}</pre>
                    </div>
                  </CardContent>
                </Card>

                {/* Message Log */}
                {messageLogs.length > 0 && (
                  <Card className="glass-card border-border/50">
                    <CardHeader className="p-4">
                      <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-muted-foreground" />
                        <CardTitle className="text-sm">Histórico de Envios</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {messageLogs.map(log => (
                          <div key={log.id} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/20 border border-border/20">
                            <div className="flex items-center gap-2 min-w-0">
                              {getStatusBadge(log.status)}
                              <span className="text-[10px] text-muted-foreground truncate">
                                {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                            <Badge variant="outline" className="text-[9px] flex-shrink-0">
                              {log.message_type === 'weekly_report' ? 'Relatório' : log.message_type === 'balance_alert' ? 'Saldo' : log.message_type}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </StaggerItem>
        </StaggerContainer>

        {/* QR Modal */}
        <WhatsAppQRModal
          open={qrModalOpen}
          onOpenChange={setQrModalOpen}
          qrCode={qrModalData.qrCode}
          expiresAt={qrModalData.expiresAt}
          onRefreshQR={handleRefreshQR}
          onCheckStatus={handleCheckStatus}
        />
      </div>
    </DashboardLayout>
  );
}
