import { useState, useEffect, useMemo, useRef } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { FileText, Download, Loader2, Calendar, Upload, X, LayoutTemplate, PieChart, Users, Smartphone, Globe, TrendingUp, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { usePDFMetrics, CampaignData } from '@/hooks/usePDFMetrics';
import { useDemographicInsights, DemographicData } from '@/hooks/useDemographicInsights';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  LineChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Tooltip,
  ComposedChart,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  BarChart,
} from 'recharts';

type BusinessModel = 'ecommerce' | 'inside_sales' | 'pdv' | null;
type CampaignSortBy = 'spend' | 'conversions' | 'roas';

interface MetricDef {
  key: string;
  label: string;
  type: 'currency' | 'number' | 'percent' | 'decimal';
}

interface Props {
  projectId: string;
  projectName: string;
  businessModel: BusinessModel;
  currency: string;
  currentPeriod: { since: string; until: string };
}

const GENERAL_METRICS: MetricDef[] = [
  { key: 'spend', label: 'Gasto Total', type: 'currency' },
  { key: 'impressions', label: 'Impressões', type: 'number' },
  { key: 'clicks', label: 'Cliques', type: 'number' },
  { key: 'ctr', label: 'CTR', type: 'percent' },
  { key: 'cpm', label: 'CPM', type: 'currency' },
  { key: 'cpc', label: 'CPC', type: 'currency' },
];

const RESULT_METRICS: Record<string, MetricDef[]> = {
  ecommerce: [
    { key: 'conversions', label: 'Compras', type: 'number' },
    { key: 'conversion_value', label: 'Receita', type: 'currency' },
    { key: 'roas', label: 'ROAS', type: 'decimal' },
    { key: 'cpa', label: 'CPA', type: 'currency' },
  ],
  inside_sales: [
    { key: 'conversions', label: 'Leads', type: 'number' },
    { key: 'cpa', label: 'CPL', type: 'currency' },
  ],
  pdv: [
    { key: 'conversions', label: 'Visitas', type: 'number' },
    { key: 'cpa', label: 'Custo/Visita', type: 'currency' },
  ],
};

const CHART_METRICS: MetricDef[] = [
  { key: 'spend', label: 'Gasto', type: 'currency' },
  { key: 'impressions', label: 'Impressões', type: 'number' },
  { key: 'clicks', label: 'Cliques', type: 'number' },
  { key: 'conversions', label: 'Conversões', type: 'number' },
  { key: 'conversion_value', label: 'Receita', type: 'currency' },
  { key: 'ctr', label: 'CTR', type: 'percent' },
  { key: 'cpm', label: 'CPM', type: 'currency' },
  { key: 'cpc', label: 'CPC', type: 'currency' },
  { key: 'roas', label: 'ROAS', type: 'decimal' },
  { key: 'cpa', label: 'CPA', type: 'currency' },
];

const TEMPLATES = [
  { id: 'executive', name: 'Resumo Executivo', color: '#E11D48', generalMetrics: ['spend', 'ctr', 'cpc'], resultMetrics: ['roas', 'conversion_value'], includeChart: false, includeDemographics: false },
  { id: 'complete', name: 'Relatório Completo', color: '#E11D48', generalMetrics: GENERAL_METRICS.map(m => m.key), resultMetrics: ['conversions', 'conversion_value', 'roas', 'cpa'], includeChart: true, includeDemographics: true },
  { id: 'performance', name: 'Análise de Performance', color: '#3B82F6', generalMetrics: ['impressions', 'clicks', 'ctr'], resultMetrics: ['conversions', 'cpa'], includeChart: true, includeDemographics: false },
];

const DEMO_COLORS = ['#3B82F6', '#22C55E', '#A855F7', '#F97316', '#EF4444', '#06B6D4', '#EC4899', '#EAB308'];

const GENDER_LABELS: Record<string, string> = { male: 'Masculino', female: 'Feminino', unknown: 'Desconhecido' };
const DEVICE_LABELS: Record<string, string> = { mobile: 'Mobile', desktop: 'Desktop', tablet: 'Tablet', unknown: 'Desconhecido' };
const PLATFORM_LABELS: Record<string, string> = { facebook: 'Facebook', instagram: 'Instagram', messenger: 'Messenger', audience_network: 'Audience Network', whatsapp: 'WhatsApp', unknown: 'Desconhecido' };

function translateLabel(type: string, value: string): string {
  switch (type) {
    case 'gender': return GENDER_LABELS[value.toLowerCase()] || value;
    case 'device_platform': return DEVICE_LABELS[value.toLowerCase()] || value;
    case 'publisher_platform': return PLATFORM_LABELS[value.toLowerCase()] || value;
    default: return value;
  }
}

function fmtCurrency(v: number, curr: string): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: curr, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function fmtNumber(v: number): string {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return v.toLocaleString('pt-BR');
}

function fmtValue(v: number, t: string, c: string): string {
  if (t === 'currency') return fmtCurrency(v, c);
  if (t === 'number') return fmtNumber(v);
  if (t === 'percent') return `${v.toFixed(2)}%`;
  return `${v.toFixed(2)}x`;
}

function fmtDateRange(since: string, until: string): string {
  const s = new Date(since + 'T00:00:00');
  const e = new Date(until + 'T00:00:00');
  return `${format(s, 'dd/MM/yyyy')} - ${format(e, 'dd/MM/yyyy')}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 225, g: 29, b: 72 };
}

interface DemoPieChartProps {
  data: DemographicData[];
  type: string;
  title: string;
  icon: React.ElementType;
  id: string;
}

function DemoPieChart({ data, type, title, icon: Icon, id }: DemoPieChartProps) {
  const totalSpend = data.reduce((sum, d) => sum + d.spend, 0);
  const chartData = data.slice(0, 5).map((d, i) => ({
    name: translateLabel(type, d.breakdown_value),
    value: d.spend,
    percent: totalSpend > 0 ? (d.spend / totalSpend * 100).toFixed(1) : '0',
    color: DEMO_COLORS[i % DEMO_COLORS.length],
  }));

  if (data.length === 0) return null;

  return (
    <div className="bg-gray-50 rounded p-2 border border-gray-100">
      <p className="text-[10px] text-gray-500 flex items-center gap-1 mb-1">
        <Icon className="w-3 h-3" /> {title}
      </p>
      <div id={id} className="flex items-center gap-2" style={{ height: 80 }}>
        <div style={{ width: 70, height: 70 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RechartsPieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={18} outerRadius={32} dataKey="value" strokeWidth={1} stroke="#fff">
                {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
              </Pie>
            </RechartsPieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-0.5">
          {chartData.slice(0, 4).map((item, index) => (
            <div key={index} className="flex items-center justify-between text-[9px]">
              <div className="flex items-center gap-1 min-w-0 flex-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="truncate text-gray-700">{item.name}</span>
              </div>
              <span className="text-gray-500 shrink-0 ml-1">{item.percent}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AgeBarChartPreview({ data, id }: { data: DemographicData[]; id: string }) {
  const chartData = data.map((d) => ({
    name: d.breakdown_value,
    spend: d.spend,
  })).sort((a, b) => {
    const ageA = parseInt(a.name.split('-')[0]) || 0;
    const ageB = parseInt(b.name.split('-')[0]) || 0;
    return ageA - ageB;
  }).slice(0, 6);

  if (data.length === 0) return null;

  return (
    <div className="bg-gray-50 rounded p-2 border border-gray-100">
      <p className="text-[10px] text-gray-500 flex items-center gap-1 mb-1">
        <Users className="w-3 h-3" /> Faixa Etária
      </p>
      <div id={id} style={{ height: 80 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 8 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 8 }} tickLine={false} axisLine={false} tickFormatter={(v) => fmtNumber(v)} />
            <Bar dataKey="spend" fill="#3B82F6" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function PDFBuilderDialog({ projectId, projectName, businessModel, currency, currentPeriod }: Props) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [title, setTitle] = useState(`Relatório - ${projectName}`);
  
  // Period
  const [useDashboardPeriod, setUseDashboardPeriod] = useState(true);
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  
  // Metrics
  const [selGeneral, setSelGeneral] = useState<string[]>(GENERAL_METRICS.map(m => m.key));
  const [selResult, setSelResult] = useState<string[]>(businessModel ? RESULT_METRICS[businessModel]?.map(m => m.key) || [] : []);
  
  // Chart 1
  const [includeChart, setIncludeChart] = useState(true);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [chartPrimaryMetric, setChartPrimaryMetric] = useState('spend');
  const [chartSecondaryMetric, setChartSecondaryMetric] = useState('conversion_value');
  const [showSecondaryMetric, setShowSecondaryMetric] = useState(true);
  const [chartPrimaryColor, setChartPrimaryColor] = useState('#E11D48');
  const [chartSecondaryColor, setChartSecondaryColor] = useState('#22c55e');
  
  // Chart 2 (additional)
  const [includeChart2, setIncludeChart2] = useState(false);
  const [chart2Type, setChart2Type] = useState<'bar' | 'line'>('line');
  const [chart2PrimaryMetric, setChart2PrimaryMetric] = useState('clicks');
  const [chart2SecondaryMetric, setChart2SecondaryMetric] = useState('ctr');
  const [showChart2Secondary, setShowChart2Secondary] = useState(true);
  const [chart2PrimaryColor, setChart2PrimaryColor] = useState('#3B82F6');
  const [chart2SecondaryColor, setChart2SecondaryColor] = useState('#A855F7');
  
  // Demographics
  const [includeDemographics, setIncludeDemographics] = useState(false);
  const [demoGender, setDemoGender] = useState(true);
  const [demoAge, setDemoAge] = useState(true);
  const [demoDevice, setDemoDevice] = useState(true);
  const [demoPlatform, setDemoPlatform] = useState(true);
  
  // Appearance
  const [primaryColor, setPrimaryColor] = useState('#E11D48');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  // Multi-page
  const [multiPageMode, setMultiPageMode] = useState<'single' | 'weekly' | 'monthly'>('single');
  
  // Top Campaigns
  const [includeCampaigns, setIncludeCampaigns] = useState(false);
  const [campaignCount, setCampaignCount] = useState<'5' | '10'>('5');
  const [campaignSortBy, setCampaignSortBy] = useState<CampaignSortBy>('spend');
  
  const { dailyData, totals, loading, campaigns, loadMetrics } = usePDFMetrics(projectId);
  const resultDefs = businessModel ? RESULT_METRICS[businessModel] || [] : [];
  
  // Sort and filter campaigns
  const topCampaigns = useMemo(() => {
    const sorted = [...campaigns].sort((a, b) => {
      if (campaignSortBy === 'spend') return b.spend - a.spend;
      if (campaignSortBy === 'conversions') return b.conversions - a.conversions;
      return b.roas - a.roas;
    });
    return sorted.slice(0, parseInt(campaignCount));
  }, [campaigns, campaignSortBy, campaignCount]);

  const activePeriod = useMemo(() => {
    if (useDashboardPeriod) return currentPeriod;
    if (customStart && customEnd) {
      return { since: format(customStart, 'yyyy-MM-dd'), until: format(customEnd, 'yyyy-MM-dd') };
    }
    return currentPeriod;
  }, [useDashboardPeriod, customStart, customEnd, currentPeriod]);

  const periodDays = useMemo(() => {
    const start = new Date(activePeriod.since + 'T00:00:00');
    const end = new Date(activePeriod.until + 'T00:00:00');
    return differenceInDays(end, start) + 1;
  }, [activePeriod]);

  // Memoize dates for demographic hook to prevent infinite re-renders
  const demoStartDate = useMemo(() => new Date(activePeriod.since + 'T00:00:00'), [activePeriod.since]);
  const demoEndDate = useMemo(() => new Date(activePeriod.until + 'T00:00:00'), [activePeriod.until]);
  
  // Demographic data - fetch when dialog is open (preload for when user enables demographics)
  const { data: demographicData, isLoading: demoLoading } = useDemographicInsights({
    projectId: open ? projectId : null,
    startDate: demoStartDate,
    endDate: demoEndDate,
  });

  useEffect(() => {
    if (!open) return;
    loadMetrics(activePeriod.since, activePeriod.until);
  }, [open, activePeriod, loadMetrics]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setLogoUrl(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const applyTemplate = (templateId: string) => {
    const template = TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    setSelGeneral(template.generalMetrics);
    setSelResult(template.resultMetrics.filter(k => resultDefs.some(r => r.key === k)));
    setIncludeChart(template.includeChart);
    setIncludeDemographics(template.includeDemographics);
    setPrimaryColor(template.color);
  };

  const chartData = useMemo(() => {
    return dailyData.map(d => ({
      date: format(new Date(d.date + 'T00:00:00'), 'dd/MM'),
      [chartPrimaryMetric]: (d as Record<string, any>)[chartPrimaryMetric] || 0,
      ...(showSecondaryMetric ? { [chartSecondaryMetric]: (d as Record<string, any>)[chartSecondaryMetric] || 0 } : {}),
    }));
  }, [dailyData, chartPrimaryMetric, chartSecondaryMetric, showSecondaryMetric]);

  const chart2Data = useMemo(() => {
    return dailyData.map(d => ({
      date: format(new Date(d.date + 'T00:00:00'), 'dd/MM'),
      [chart2PrimaryMetric]: (d as Record<string, any>)[chart2PrimaryMetric] || 0,
      ...(showChart2Secondary ? { [chart2SecondaryMetric]: (d as Record<string, any>)[chart2SecondaryMetric] || 0 } : {}),
    }));
  }, [dailyData, chart2PrimaryMetric, chart2SecondaryMetric, showChart2Secondary]);

  const primaryMetricDef = CHART_METRICS.find(m => m.key === chartPrimaryMetric);
  const secondaryMetricDef = CHART_METRICS.find(m => m.key === chartSecondaryMetric);
  const chart2PrimaryDef = CHART_METRICS.find(m => m.key === chart2PrimaryMetric);
  const chart2SecondaryDef = CHART_METRICS.find(m => m.key === chart2SecondaryMetric);

  const summaryText = useMemo(() => {
    if (!totals) return '';
    const parts = [`Investimento: ${fmtCurrency(totals.spend, currency)}`];
    if (businessModel === 'ecommerce') {
      parts.push(`Vendas: ${fmtNumber(totals.conversions)}`, `Receita: ${fmtCurrency(totals.conversion_value, currency)}`, `ROAS: ${totals.roas.toFixed(2)}x`);
    } else if (businessModel === 'inside_sales') {
      parts.push(`Leads: ${fmtNumber(totals.conversions)}`, `CPL: ${fmtCurrency(totals.cpa, currency)}`);
    } else if (businessModel === 'pdv') {
      parts.push(`Visitas: ${fmtNumber(totals.conversions)}`);
    }
    return parts.join(' | ');
  }, [totals, businessModel, currency]);

  const hasDemoData = demographicData && (
    (demoGender && demographicData.gender.length > 0) ||
    (demoAge && demographicData.age.length > 0) ||
    (demoDevice && demographicData.device_platform.length > 0) ||
    (demoPlatform && demographicData.publisher_platform.length > 0)
  );

  const generate = async () => {
    if (!totals) return;
    setGenerating(true);
    
    try {
      const doc = new jsPDF();
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      const m = 15;
      const rgb = hexToRgb(primaryColor);
      
      // Header
      doc.setFillColor(rgb.r, rgb.g, rgb.b);
      doc.rect(0, 0, pw, 25, 'F');
      if (logoUrl) {
        try { doc.addImage(logoUrl, 'PNG', pw - m - 25, 5, 20, 15); } catch (e) { console.error('Logo error:', e); }
      }
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(title, m, 12);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(fmtDateRange(activePeriod.since, activePeriod.until), m, 20);
      
      let y = 35;
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(9);
      doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, m, y);
      y += 10;
      
      // Summary
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(33, 33, 33);
      doc.text('Resumo Executivo', m, y);
      y += 8;
      doc.setFillColor(254, 242, 242);
      doc.roundedRect(m, y, pw - 2 * m, 12, 2, 2, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(rgb.r, rgb.g, rgb.b);
      doc.text(summaryText, m + 5, y + 7);
      y += 20;
      
      // General Metrics
      const activeGeneral = GENERAL_METRICS.filter(x => selGeneral.includes(x.key));
      if (activeGeneral.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(33, 33, 33);
        doc.text('Métricas Gerais', m, y);
        y += 8;
        const cols = Math.min(activeGeneral.length, 3);
        const cw = (pw - 2 * m - (cols - 1) * 4) / cols;
        activeGeneral.forEach((met, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = m + col * (cw + 4);
          const cy = y + row * 22;
          doc.setFillColor(248, 249, 250);
          doc.roundedRect(x, cy, cw, 20, 2, 2, 'F');
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          doc.text(met.label, x + 4, cy + 7);
          const val = (totals as unknown as Record<string, number>)[met.key] || 0;
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(rgb.r, rgb.g, rgb.b);
          doc.text(fmtValue(val, met.type, currency), x + 4, cy + 15);
          doc.setFont('helvetica', 'normal');
        });
        y += Math.ceil(activeGeneral.length / cols) * 22 + 8;
      }
      
      // Result Metrics
      const activeResult = resultDefs.filter(x => selResult.includes(x.key));
      if (activeResult.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(33, 33, 33);
        const label = businessModel === 'ecommerce' ? 'E-commerce' : businessModel === 'inside_sales' ? 'Inside Sales' : 'PDV';
        doc.text(`Métricas de Resultado (${label})`, m, y);
        y += 8;
        const cols = Math.min(activeResult.length, 4);
        const cw = (pw - 2 * m - (cols - 1) * 4) / cols;
        activeResult.forEach((met, i) => {
          const x = m + i * (cw + 4);
          doc.setFillColor(254, 242, 242);
          doc.roundedRect(x, y, cw, 20, 2, 2, 'F');
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          doc.text(met.label, x + 4, y + 7);
          const val = (totals as unknown as Record<string, number>)[met.key] || 0;
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(rgb.r, rgb.g, rgb.b);
          doc.text(fmtValue(val, met.type, currency), x + 4, y + 15);
          doc.setFont('helvetica', 'normal');
        });
        y += 28;
      }
      
      // Chart
      if (includeChart && chartData.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(33, 33, 33);
        doc.text('Evolução Diária', m, y);
        y += 5;
        const chartPreview = document.getElementById('pdf-chart-preview');
        if (chartPreview) {
          try {
            const canvas = await html2canvas(chartPreview, { scale: 2, backgroundColor: '#fff', logging: false });
            const imgData = canvas.toDataURL('image/png');
            const imgW = pw - 2 * m;
            const imgH = (canvas.height / canvas.width) * imgW;
            doc.addImage(imgData, 'PNG', m, y, imgW, Math.min(imgH, 70));
            y += Math.min(imgH, 70) + 10;
          } catch (e) { console.error('Chart capture error:', e); }
        }
      }
      
      // Chart 2 (additional)
      if (includeChart2 && chart2Data.length > 0) {
        // Check if we need a new page
        if (y > ph - 90) {
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(33, 33, 33);
        const chart2Title = `${chart2PrimaryDef?.label || 'Métrica'} ${showChart2Secondary ? `vs ${chart2SecondaryDef?.label || ''}` : ''}`.trim();
        doc.text(chart2Title, m, y);
        y += 5;
        const chart2Preview = document.getElementById('pdf-chart2-preview');
        if (chart2Preview) {
          try {
            const canvas = await html2canvas(chart2Preview, { scale: 2, backgroundColor: '#fff', logging: false });
            const imgData = canvas.toDataURL('image/png');
            const imgW = pw - 2 * m;
            const imgH = (canvas.height / canvas.width) * imgW;
            doc.addImage(imgData, 'PNG', m, y, imgW, Math.min(imgH, 70));
            y += Math.min(imgH, 70) + 10;
          } catch (e) { console.error('Chart 2 capture error:', e); }
        }
      }
      
      // Demographics
      if (includeDemographics && hasDemoData) {
        // Check if we need a new page
        if (y > ph - 80) {
          doc.addPage();
          y = 20;
        }
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(33, 33, 33);
        doc.text('Dados Demográficos', m, y);
        y += 5;
        
        const demoCharts: string[] = [];
        if (demoGender && demographicData?.gender.length) demoCharts.push('pdf-demo-gender');
        if (demoAge && demographicData?.age.length) demoCharts.push('pdf-demo-age');
        if (demoDevice && demographicData?.device_platform.length) demoCharts.push('pdf-demo-device');
        if (demoPlatform && demographicData?.publisher_platform.length) demoCharts.push('pdf-demo-platform');
        
        // Capture all demo charts
        const chartWidth = (pw - 2 * m - 4) / 2;
        for (let i = 0; i < demoCharts.length; i++) {
          const el = document.getElementById(demoCharts[i]);
          if (el) {
            try {
              const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#f9fafb', logging: false });
              const imgData = canvas.toDataURL('image/png');
              const imgH = (canvas.height / canvas.width) * chartWidth;
              const col = i % 2;
              const row = Math.floor(i / 2);
              const x = m + col * (chartWidth + 4);
              const cy = y + row * (imgH + 4);
              
              if (cy + imgH > ph - 20) {
                doc.addPage();
                y = 20;
              }
              
              doc.addImage(imgData, 'PNG', x, cy, chartWidth, imgH);
              if (i === demoCharts.length - 1) {
                y = cy + imgH + 10;
              }
            } catch (e) { console.error('Demo chart capture error:', e); }
          }
        }
      }
      
      // Top Campaigns
      if (includeCampaigns && topCampaigns.length > 0) {
        // Check if we need a new page
        if (y > ph - 80) {
          doc.addPage();
          y = 20;
        }
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(33, 33, 33);
        const sortLabel = campaignSortBy === 'spend' ? 'Gasto' : campaignSortBy === 'conversions' ? 'Conversões' : 'ROAS';
        doc.text(`Top ${campaignCount} Campanhas por ${sortLabel}`, m, y);
        y += 8;
        
        // Table header
        const colWidths = [70, 30, 25, 35]; // Campaign, Spend, Conv, ROAS/CPA
        const tableWidth = colWidths.reduce((a, b) => a + b, 0);
        const startX = m;
        
        doc.setFillColor(248, 249, 250);
        doc.rect(startX, y, tableWidth, 8, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(55, 65, 81);
        
        let xPos = startX + 2;
        doc.text('Campanha', xPos, y + 5);
        xPos += colWidths[0];
        doc.text('Gasto', xPos + colWidths[1] - 2, y + 5, { align: 'right' });
        xPos += colWidths[1];
        doc.text('Conv.', xPos + colWidths[2] - 2, y + 5, { align: 'right' });
        xPos += colWidths[2];
        doc.text(businessModel === 'ecommerce' ? 'ROAS' : 'CPA', xPos + colWidths[3] - 2, y + 5, { align: 'right' });
        
        y += 8;
        
        // Table rows
        doc.setFont('helvetica', 'normal');
        topCampaigns.forEach((c, idx) => {
          if (idx % 2 === 0) {
            doc.setFillColor(255, 255, 255);
          } else {
            doc.setFillColor(249, 250, 251);
          }
          doc.rect(startX, y, tableWidth, 7, 'F');
          
          doc.setFontSize(7);
          doc.setTextColor(31, 41, 55);
          
          let xPos = startX + 2;
          const campaignName = c.campaign_name.length > 30 ? c.campaign_name.substring(0, 28) + '...' : c.campaign_name;
          doc.text(campaignName, xPos, y + 5);
          
          xPos += colWidths[0];
          doc.text(fmtCurrency(c.spend, currency), xPos + colWidths[1] - 2, y + 5, { align: 'right' });
          
          xPos += colWidths[1];
          doc.text(fmtNumber(c.conversions), xPos + colWidths[2] - 2, y + 5, { align: 'right' });
          
          xPos += colWidths[2];
          doc.setTextColor(rgb.r, rgb.g, rgb.b);
          const roasValue = businessModel === 'ecommerce' ? `${c.roas.toFixed(2)}x` : fmtCurrency(c.cpa, currency);
          doc.text(roasValue, xPos + colWidths[3] - 2, y + 5, { align: 'right' });
          doc.setTextColor(31, 41, 55);
          
          y += 7;
        });
        
        y += 10;
      }
      
      // Footer
      doc.setFillColor(rgb.r, rgb.g, rgb.b);
      doc.rect(0, ph - 15, pw, 15, 'F');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(`${projectName} • Relatório gerado automaticamente`, pw / 2, ph - 6, { align: 'center' });
      
      doc.save(`${title.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
      setOpen(false);
    } catch (err) {
      console.error('PDF error:', err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileText className="h-4 w-4" />
          Exportar PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle>Construtor de PDF</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-1 min-h-0">
          {/* Left Panel - Configuration */}
          <div className="w-80 border-r flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* Templates */}
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-1">
                  <LayoutTemplate className="h-3 w-3" /> Templates
                </Label>
                <div className="flex gap-2 flex-wrap">
                  {TEMPLATES.map(t => (
                    <Button key={t.id} variant="outline" size="sm" onClick={() => applyTemplate(t.id)} className="text-xs h-7" style={{ borderColor: t.color, color: t.color }}>
                      {t.name}
                    </Button>
                  ))}
                </div>
              </div>
              
              {/* Title */}
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase text-muted-foreground">Título</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nome do relatório" className="h-9" />
              </div>
              
              {/* Period */}
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase text-muted-foreground">Período</Label>
                <div className="flex items-center gap-2">
                  <Switch checked={useDashboardPeriod} onCheckedChange={setUseDashboardPeriod} id="use-dashboard" />
                  <Label htmlFor="use-dashboard" className="text-sm font-normal">Usar período do dashboard</Label>
                </div>
                
                <div className="bg-muted/50 rounded-md p-2 border">
                  <p className="text-xs text-muted-foreground mb-1">Período selecionado:</p>
                  <p className="text-sm font-medium">{fmtDateRange(activePeriod.since, activePeriod.until)}</p>
                  <p className="text-xs text-muted-foreground">({periodDays} dias)</p>
                </div>
                
                {!useDashboardPeriod && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="justify-start text-left font-normal h-9 w-full">
                          <Calendar className="mr-2 h-3 w-3" />
                          {customStart ? format(customStart, 'dd/MM/yy') : 'Início'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                        <CalendarComponent mode="single" selected={customStart} onSelect={setCustomStart} initialFocus className="p-3" />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="justify-start text-left font-normal h-9 w-full">
                          <Calendar className="mr-2 h-3 w-3" />
                          {customEnd ? format(customEnd, 'dd/MM/yy') : 'Fim'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                        <CalendarComponent mode="single" selected={customEnd} onSelect={setCustomEnd} initialFocus className="p-3" />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>
              
              {/* General Metrics */}
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase text-muted-foreground">Métricas Gerais</Label>
                <div className="grid grid-cols-2 gap-1">
                  {GENERAL_METRICS.map(m => (
                    <div key={m.key} className="flex items-center gap-2">
                      <Checkbox id={`g-${m.key}`} checked={selGeneral.includes(m.key)} onCheckedChange={() => setSelGeneral(p => p.includes(m.key) ? p.filter(x => x !== m.key) : [...p, m.key])} />
                      <Label htmlFor={`g-${m.key}`} className="text-xs font-normal cursor-pointer">{m.label}</Label>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Result Metrics */}
              {resultDefs.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase text-muted-foreground">Métricas de Resultado</Label>
                  <div className="grid grid-cols-2 gap-1">
                    {resultDefs.map(m => (
                      <div key={m.key} className="flex items-center gap-2">
                        <Checkbox id={`r-${m.key}`} checked={selResult.includes(m.key)} onCheckedChange={() => setSelResult(p => p.includes(m.key) ? p.filter(x => x !== m.key) : [...p, m.key])} />
                        <Label htmlFor={`r-${m.key}`} className="text-xs font-normal cursor-pointer">{m.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Chart Options */}
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Gráfico de Evolução
                </Label>
                <div className="flex items-center gap-2">
                  <Switch checked={includeChart} onCheckedChange={setIncludeChart} id="include-chart" />
                  <Label htmlFor="include-chart" className="text-sm font-normal">Incluir gráfico</Label>
                </div>
                {includeChart && (
                  <div className="space-y-2 mt-2 pl-2 border-l-2 border-muted">
                    <div className="flex gap-2">
                      <Button variant={chartType === 'bar' ? 'default' : 'outline'} size="sm" onClick={() => setChartType('bar')} className="flex-1 h-7 text-xs">Barras</Button>
                      <Button variant={chartType === 'line' ? 'default' : 'outline'} size="sm" onClick={() => setChartType('line')} className="flex-1 h-7 text-xs">Linha</Button>
                    </div>
                    <Select value={chartPrimaryMetric} onValueChange={setChartPrimaryMetric}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Métrica Principal" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {CHART_METRICS.map(m => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Switch checked={showSecondaryMetric} onCheckedChange={setShowSecondaryMetric} id="show-secondary" />
                      <Label htmlFor="show-secondary" className="text-xs font-normal">Métrica Secundária</Label>
                    </div>
                    {showSecondaryMetric && (
                      <Select value={chartSecondaryMetric} onValueChange={setChartSecondaryMetric}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Métrica Secundária" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          {CHART_METRICS.filter(m => m.key !== chartPrimaryMetric).map(m => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Cor Primária</Label>
                        <input type="color" value={chartPrimaryColor} onChange={e => setChartPrimaryColor(e.target.value)} className="w-full h-7 p-0 border rounded cursor-pointer" />
                      </div>
                      {showSecondaryMetric && (
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Cor Secundária</Label>
                          <input type="color" value={chartSecondaryColor} onChange={e => setChartSecondaryColor(e.target.value)} className="w-full h-7 p-0 border rounded cursor-pointer" />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Chart 2 Options */}
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Gráfico Adicional
                </Label>
                <div className="flex items-center gap-2">
                  <Switch checked={includeChart2} onCheckedChange={setIncludeChart2} id="include-chart2" />
                  <Label htmlFor="include-chart2" className="text-sm font-normal">Adicionar 2º gráfico</Label>
                </div>
                {includeChart2 && (
                  <div className="space-y-2 mt-2 pl-2 border-l-2 border-blue-500/50">
                    <div className="flex gap-2">
                      <Button variant={chart2Type === 'bar' ? 'default' : 'outline'} size="sm" onClick={() => setChart2Type('bar')} className="flex-1 h-7 text-xs">Barras</Button>
                      <Button variant={chart2Type === 'line' ? 'default' : 'outline'} size="sm" onClick={() => setChart2Type('line')} className="flex-1 h-7 text-xs">Linha</Button>
                    </div>
                    <Select value={chart2PrimaryMetric} onValueChange={setChart2PrimaryMetric}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Métrica Principal" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {CHART_METRICS.map(m => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Switch checked={showChart2Secondary} onCheckedChange={setShowChart2Secondary} id="show-chart2-secondary" />
                      <Label htmlFor="show-chart2-secondary" className="text-xs font-normal">Métrica Secundária</Label>
                    </div>
                    {showChart2Secondary && (
                      <Select value={chart2SecondaryMetric} onValueChange={setChart2SecondaryMetric}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Métrica Secundária" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          {CHART_METRICS.filter(m => m.key !== chart2PrimaryMetric).map(m => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Cor Primária</Label>
                        <input type="color" value={chart2PrimaryColor} onChange={e => setChart2PrimaryColor(e.target.value)} className="w-full h-7 p-0 border rounded cursor-pointer" />
                      </div>
                      {showChart2Secondary && (
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Cor Secundária</Label>
                          <input type="color" value={chart2SecondaryColor} onChange={e => setChart2SecondaryColor(e.target.value)} className="w-full h-7 p-0 border rounded cursor-pointer" />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Demographics */}
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-1">
                  <PieChart className="h-3 w-3" /> Dados Demográficos
                </Label>
                <div className="flex items-center gap-2">
                  <Switch checked={includeDemographics} onCheckedChange={setIncludeDemographics} id="include-demo" />
                  <Label htmlFor="include-demo" className="text-sm font-normal">Incluir demográficos</Label>
                </div>
                {includeDemographics && (
                  <div className="space-y-1 mt-2 pl-2 border-l-2 border-muted">
                    <div className="flex items-center gap-2">
                      <Checkbox id="demo-gender" checked={demoGender} onCheckedChange={(c) => setDemoGender(!!c)} />
                      <Label htmlFor="demo-gender" className="text-xs font-normal cursor-pointer flex items-center gap-1">
                        <Users className="w-3 h-3" /> Gênero
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="demo-age" checked={demoAge} onCheckedChange={(c) => setDemoAge(!!c)} />
                      <Label htmlFor="demo-age" className="text-xs font-normal cursor-pointer flex items-center gap-1">
                        <Users className="w-3 h-3" /> Faixa Etária
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="demo-device" checked={demoDevice} onCheckedChange={(c) => setDemoDevice(!!c)} />
                      <Label htmlFor="demo-device" className="text-xs font-normal cursor-pointer flex items-center gap-1">
                        <Smartphone className="w-3 h-3" /> Dispositivos
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="demo-platform" checked={demoPlatform} onCheckedChange={(c) => setDemoPlatform(!!c)} />
                      <Label htmlFor="demo-platform" className="text-xs font-normal cursor-pointer flex items-center gap-1">
                        <Globe className="w-3 h-3" /> Plataformas
                      </Label>
                    </div>
                    {demoLoading && <p className="text-[10px] text-muted-foreground">Carregando dados...</p>}
                    {!demoLoading && !hasDemoData && includeDemographics && (
                      <p className="text-[10px] text-amber-600">Sem dados demográficos para o período</p>
                    )}
                  </div>
                )}
              </div>
              
              {/* Top Campaigns */}
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-1">
                  <Trophy className="h-3 w-3" /> Top Campanhas
                </Label>
                <div className="flex items-center gap-2">
                  <Switch checked={includeCampaigns} onCheckedChange={setIncludeCampaigns} id="include-campaigns" />
                  <Label htmlFor="include-campaigns" className="text-sm font-normal">Incluir top campanhas</Label>
                </div>
                {includeCampaigns && (
                  <div className="space-y-2 mt-2 pl-2 border-l-2 border-amber-500/50">
                    <div className="flex gap-2">
                      <Button variant={campaignCount === '5' ? 'default' : 'outline'} size="sm" onClick={() => setCampaignCount('5')} className="flex-1 h-7 text-xs">Top 5</Button>
                      <Button variant={campaignCount === '10' ? 'default' : 'outline'} size="sm" onClick={() => setCampaignCount('10')} className="flex-1 h-7 text-xs">Top 10</Button>
                    </div>
                    <Select value={campaignSortBy} onValueChange={(v) => setCampaignSortBy(v as CampaignSortBy)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Ordenar por" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="spend">Por Gasto</SelectItem>
                        <SelectItem value="conversions">Por Conversões</SelectItem>
                        <SelectItem value="roas">Por ROAS</SelectItem>
                      </SelectContent>
                    </Select>
                    {campaigns.length === 0 && !loading && (
                      <p className="text-[10px] text-amber-600">Sem dados de campanhas para o período</p>
                    )}
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase text-muted-foreground">Logo</Label>
                <input type="file" accept="image/*" onChange={handleLogoUpload} ref={logoInputRef} className="hidden" />
                {logoUrl ? (
                  <div className="flex items-center gap-2">
                    <img src={logoUrl} alt="Logo" className="h-8 w-auto max-w-16 object-contain rounded" />
                    <Button variant="ghost" size="sm" onClick={() => { setLogoUrl(null); if (logoInputRef.current) logoInputRef.current.value = ''; }} className="h-7 w-7 p-0">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} className="gap-2 h-8 text-xs">
                    <Upload className="h-3 w-3" /> Adicionar Logo
                  </Button>
                )}
              </div>
              
              {/* Color */}
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase text-muted-foreground">Cor Principal</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-10 h-8 p-0 border rounded cursor-pointer" />
                  <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="flex-1 h-8 font-mono text-xs" />
                </div>
              </div>
              
              {/* Multi-page */}
              {periodDays > 30 && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase text-muted-foreground">Múltiplas Páginas ({periodDays} dias)</Label>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant={multiPageMode === 'single' ? 'default' : 'outline'} size="sm" onClick={() => setMultiPageMode('single')} className="h-7 text-xs">Única</Button>
                    <Button variant={multiPageMode === 'weekly' ? 'default' : 'outline'} size="sm" onClick={() => setMultiPageMode('weekly')} className="h-7 text-xs">Semanal</Button>
                    <Button variant={multiPageMode === 'monthly' ? 'default' : 'outline'} size="sm" onClick={() => setMultiPageMode('monthly')} className="h-7 text-xs">Mensal</Button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Generate Button */}
            <div className="p-4 border-t shrink-0">
              <Button onClick={generate} disabled={generating || loading || !totals} className="w-full gap-2" style={{ backgroundColor: primaryColor }}>
                {generating ? <><Loader2 className="h-4 w-4 animate-spin" />Gerando...</> : <><Download className="h-4 w-4" />Baixar PDF</>}
              </Button>
            </div>
          </div>
          
          {/* Right Panel - Preview */}
          <div className="flex-1 flex flex-col min-h-0 bg-muted/30">
            <div className="p-3 border-b bg-background flex items-center gap-2 shrink-0">
              <span className="font-medium text-sm">Preview</span>
              {(loading || demoLoading) && <Loader2 className="h-4 w-4 animate-spin ml-auto" />}
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <div className="bg-white rounded-lg shadow-lg overflow-hidden max-w-xl mx-auto">
                {/* Header */}
                <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: primaryColor }}>
                  <div>
                    <h1 className="text-base font-bold text-white truncate">{title}</h1>
                    <p className="text-xs text-white/80">{fmtDateRange(activePeriod.since, activePeriod.until)}</p>
                  </div>
                  {logoUrl && <img src={logoUrl} alt="Logo" className="h-8 w-auto max-w-16 object-contain" />}
                </div>
                
                <div className="p-4 space-y-4">
                  <p className="text-[10px] text-gray-400">Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
                  
                  {/* Summary */}
                  <div>
                    <h2 className="text-xs font-semibold text-gray-900 mb-2">Resumo Executivo</h2>
                    <div className="rounded border p-2 text-xs" style={{ borderColor: primaryColor, backgroundColor: `${primaryColor}10` }}>
                      <p style={{ color: primaryColor }}>{loading ? 'Carregando...' : summaryText || 'Sem dados'}</p>
                    </div>
                  </div>
                  
                  {/* General Metrics */}
                  {selGeneral.length > 0 && totals && (
                    <div>
                      <h2 className="text-xs font-semibold text-gray-900 mb-2">Métricas Gerais</h2>
                      <div className="grid grid-cols-3 gap-2">
                        {GENERAL_METRICS.filter(m => selGeneral.includes(m.key)).map(m => {
                          const val = (totals as unknown as Record<string, number>)[m.key] || 0;
                          return (
                            <div key={m.key} className="bg-gray-50 rounded p-2 border border-gray-100">
                              <p className="text-[10px] text-gray-500 truncate">{m.label}</p>
                              <p className="text-sm font-bold truncate" style={{ color: primaryColor }}>{fmtValue(val, m.type, currency)}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Result Metrics */}
                  {selResult.length > 0 && totals && resultDefs.length > 0 && (
                    <div>
                      <h2 className="text-xs font-semibold text-gray-900 mb-2">
                        Resultado ({businessModel === 'ecommerce' ? 'E-commerce' : businessModel === 'inside_sales' ? 'Inside Sales' : 'PDV'})
                      </h2>
                      <div className="grid grid-cols-2 gap-2">
                        {resultDefs.filter(m => selResult.includes(m.key)).map(m => {
                          const val = (totals as unknown as Record<string, number>)[m.key] || 0;
                          return (
                            <div key={m.key} className="rounded p-2 border" style={{ borderColor: primaryColor, backgroundColor: `${primaryColor}10` }}>
                              <p className="text-[10px] text-gray-500 truncate">{m.label}</p>
                              <p className="text-sm font-bold truncate" style={{ color: primaryColor }}>{fmtValue(val, m.type, currency)}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Chart */}
                  {includeChart && chartData.length > 0 && (
                    <div>
                      <h2 className="text-xs font-semibold text-gray-900 mb-2">Evolução Diária</h2>
                      <div id="pdf-chart-preview" className="bg-white rounded border p-2" style={{ height: 180 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          {chartType === 'bar' ? (
                            <ComposedChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                              <YAxis 
                                yAxisId="left" 
                                tick={{ fontSize: 9, fill: chartPrimaryColor }} 
                                tickFormatter={(v) => {
                                  if (primaryMetricDef?.type === 'currency') return fmtCurrency(v, currency);
                                  if (primaryMetricDef?.type === 'percent') return `${v.toFixed(1)}%`;
                                  if (primaryMetricDef?.type === 'decimal') return `${v.toFixed(1)}x`;
                                  return fmtNumber(v);
                                }}
                              />
                              {showSecondaryMetric && (
                                <YAxis 
                                  yAxisId="right" 
                                  orientation="right" 
                                  tick={{ fontSize: 9, fill: chartSecondaryColor }} 
                                  tickFormatter={(v) => {
                                    if (secondaryMetricDef?.type === 'currency') return fmtCurrency(v, currency);
                                    if (secondaryMetricDef?.type === 'percent') return `${v.toFixed(1)}%`;
                                    if (secondaryMetricDef?.type === 'decimal') return `${v.toFixed(1)}x`;
                                    return fmtNumber(v);
                                  }}
                                />
                              )}
                              <Tooltip 
                                contentStyle={{ fontSize: 11, backgroundColor: 'white', border: '1px solid #e5e7eb' }}
                                formatter={(value: number, name: string) => {
                                  const met = CHART_METRICS.find(m => m.label === name);
                                  if (met?.type === 'currency') return [fmtCurrency(value, currency), name];
                                  if (met?.type === 'percent') return [`${value.toFixed(2)}%`, name];
                                  if (met?.type === 'decimal') return [`${value.toFixed(2)}x`, name];
                                  return [fmtNumber(value), name];
                                }} 
                              />
                              <Legend wrapperStyle={{ fontSize: 10 }} />
                              <Bar yAxisId="left" dataKey={chartPrimaryMetric} name={primaryMetricDef?.label || 'Primária'} fill={chartPrimaryColor} radius={[2, 2, 0, 0]} />
                              {showSecondaryMetric && <Line yAxisId="right" type="monotone" dataKey={chartSecondaryMetric} name={secondaryMetricDef?.label || 'Secundária'} stroke={chartSecondaryColor} strokeWidth={2} dot={false} />}
                            </ComposedChart>
                          ) : (
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                              <YAxis 
                                yAxisId="left" 
                                tick={{ fontSize: 9, fill: chartPrimaryColor }} 
                                tickFormatter={(v) => {
                                  if (primaryMetricDef?.type === 'currency') return fmtCurrency(v, currency);
                                  if (primaryMetricDef?.type === 'percent') return `${v.toFixed(1)}%`;
                                  if (primaryMetricDef?.type === 'decimal') return `${v.toFixed(1)}x`;
                                  return fmtNumber(v);
                                }}
                              />
                              {showSecondaryMetric && (
                                <YAxis 
                                  yAxisId="right" 
                                  orientation="right" 
                                  tick={{ fontSize: 9, fill: chartSecondaryColor }} 
                                  tickFormatter={(v) => {
                                    if (secondaryMetricDef?.type === 'currency') return fmtCurrency(v, currency);
                                    if (secondaryMetricDef?.type === 'percent') return `${v.toFixed(1)}%`;
                                    if (secondaryMetricDef?.type === 'decimal') return `${v.toFixed(1)}x`;
                                    return fmtNumber(v);
                                  }}
                                />
                              )}
                              <Tooltip 
                                contentStyle={{ fontSize: 11, backgroundColor: 'white', border: '1px solid #e5e7eb' }}
                                formatter={(value: number, name: string) => {
                                  const met = CHART_METRICS.find(m => m.label === name);
                                  if (met?.type === 'currency') return [fmtCurrency(value, currency), name];
                                  if (met?.type === 'percent') return [`${value.toFixed(2)}%`, name];
                                  if (met?.type === 'decimal') return [`${value.toFixed(2)}x`, name];
                                  return [fmtNumber(value), name];
                                }} 
                              />
                              <Legend wrapperStyle={{ fontSize: 10 }} />
                              <Line yAxisId="left" type="monotone" dataKey={chartPrimaryMetric} name={primaryMetricDef?.label || 'Primária'} stroke={chartPrimaryColor} strokeWidth={2} dot={false} />
                              {showSecondaryMetric && <Line yAxisId="right" type="monotone" dataKey={chartSecondaryMetric} name={secondaryMetricDef?.label || 'Secundária'} stroke={chartSecondaryColor} strokeWidth={2} dot={false} />}
                            </LineChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  
                  {/* Chart 2 Preview */}
                  {includeChart2 && chart2Data.length > 0 && (
                    <div>
                      <h2 className="text-xs font-semibold text-gray-900 mb-2">
                        {chart2PrimaryDef?.label || 'Métrica'} {showChart2Secondary ? `vs ${chart2SecondaryDef?.label || ''}` : ''}
                      </h2>
                      <div id="pdf-chart2-preview" className="bg-white rounded border p-2" style={{ height: 180 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          {chart2Type === 'bar' ? (
                            <ComposedChart data={chart2Data}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                              <YAxis 
                                yAxisId="left" 
                                tick={{ fontSize: 9, fill: chart2PrimaryColor }} 
                                tickFormatter={(v) => {
                                  if (chart2PrimaryDef?.type === 'currency') return fmtCurrency(v, currency);
                                  if (chart2PrimaryDef?.type === 'percent') return `${v.toFixed(1)}%`;
                                  if (chart2PrimaryDef?.type === 'decimal') return `${v.toFixed(1)}x`;
                                  return fmtNumber(v);
                                }}
                              />
                              {showChart2Secondary && (
                                <YAxis 
                                  yAxisId="right" 
                                  orientation="right" 
                                  tick={{ fontSize: 9, fill: chart2SecondaryColor }} 
                                  tickFormatter={(v) => {
                                    if (chart2SecondaryDef?.type === 'currency') return fmtCurrency(v, currency);
                                    if (chart2SecondaryDef?.type === 'percent') return `${v.toFixed(1)}%`;
                                    if (chart2SecondaryDef?.type === 'decimal') return `${v.toFixed(1)}x`;
                                    return fmtNumber(v);
                                  }}
                                />
                              )}
                              <Tooltip 
                                contentStyle={{ fontSize: 11, backgroundColor: 'white', border: '1px solid #e5e7eb' }}
                                formatter={(value: number, name: string) => {
                                  const met = CHART_METRICS.find(m => m.label === name);
                                  if (met?.type === 'currency') return [fmtCurrency(value, currency), name];
                                  if (met?.type === 'percent') return [`${value.toFixed(2)}%`, name];
                                  if (met?.type === 'decimal') return [`${value.toFixed(2)}x`, name];
                                  return [fmtNumber(value), name];
                                }} 
                              />
                              <Legend wrapperStyle={{ fontSize: 10 }} />
                              <Bar yAxisId="left" dataKey={chart2PrimaryMetric} name={chart2PrimaryDef?.label || 'Primária'} fill={chart2PrimaryColor} radius={[2, 2, 0, 0]} />
                              {showChart2Secondary && <Line yAxisId="right" type="monotone" dataKey={chart2SecondaryMetric} name={chart2SecondaryDef?.label || 'Secundária'} stroke={chart2SecondaryColor} strokeWidth={2} dot={false} />}
                            </ComposedChart>
                          ) : (
                            <LineChart data={chart2Data}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                              <YAxis 
                                yAxisId="left" 
                                tick={{ fontSize: 9, fill: chart2PrimaryColor }} 
                                tickFormatter={(v) => {
                                  if (chart2PrimaryDef?.type === 'currency') return fmtCurrency(v, currency);
                                  if (chart2PrimaryDef?.type === 'percent') return `${v.toFixed(1)}%`;
                                  if (chart2PrimaryDef?.type === 'decimal') return `${v.toFixed(1)}x`;
                                  return fmtNumber(v);
                                }}
                              />
                              {showChart2Secondary && (
                                <YAxis 
                                  yAxisId="right" 
                                  orientation="right" 
                                  tick={{ fontSize: 9, fill: chart2SecondaryColor }} 
                                  tickFormatter={(v) => {
                                    if (chart2SecondaryDef?.type === 'currency') return fmtCurrency(v, currency);
                                    if (chart2SecondaryDef?.type === 'percent') return `${v.toFixed(1)}%`;
                                    if (chart2SecondaryDef?.type === 'decimal') return `${v.toFixed(1)}x`;
                                    return fmtNumber(v);
                                  }}
                                />
                              )}
                              <Tooltip 
                                contentStyle={{ fontSize: 11, backgroundColor: 'white', border: '1px solid #e5e7eb' }}
                                formatter={(value: number, name: string) => {
                                  const met = CHART_METRICS.find(m => m.label === name);
                                  if (met?.type === 'currency') return [fmtCurrency(value, currency), name];
                                  if (met?.type === 'percent') return [`${value.toFixed(2)}%`, name];
                                  if (met?.type === 'decimal') return [`${value.toFixed(2)}x`, name];
                                  return [fmtNumber(value), name];
                                }} 
                              />
                              <Legend wrapperStyle={{ fontSize: 10 }} />
                              <Line yAxisId="left" type="monotone" dataKey={chart2PrimaryMetric} name={chart2PrimaryDef?.label || 'Primária'} stroke={chart2PrimaryColor} strokeWidth={2} dot={false} />
                              {showChart2Secondary && <Line yAxisId="right" type="monotone" dataKey={chart2SecondaryMetric} name={chart2SecondaryDef?.label || 'Secundária'} stroke={chart2SecondaryColor} strokeWidth={2} dot={false} />}
                            </LineChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  
                  {/* Demographics Preview */}
                  {includeDemographics && hasDemoData && (
                    <div>
                      <h2 className="text-xs font-semibold text-gray-900 mb-2">Dados Demográficos</h2>
                      <div className="grid grid-cols-2 gap-2">
                        {demoGender && demographicData?.gender && demographicData.gender.length > 0 && (
                          <DemoPieChart data={demographicData.gender} type="gender" title="Gênero" icon={Users} id="pdf-demo-gender" />
                        )}
                        {demoAge && demographicData?.age && demographicData.age.length > 0 && (
                          <AgeBarChartPreview data={demographicData.age} id="pdf-demo-age" />
                        )}
                        {demoDevice && demographicData?.device_platform && demographicData.device_platform.length > 0 && (
                          <DemoPieChart data={demographicData.device_platform} type="device_platform" title="Dispositivos" icon={Smartphone} id="pdf-demo-device" />
                        )}
                        {demoPlatform && demographicData?.publisher_platform && demographicData.publisher_platform.length > 0 && (
                          <DemoPieChart data={demographicData.publisher_platform} type="publisher_platform" title="Plataformas" icon={Globe} id="pdf-demo-platform" />
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Top Campaigns Preview */}
                  {includeCampaigns && topCampaigns.length > 0 && (
                    <div>
                      <h2 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-1">
                        <Trophy className="w-3 h-3" /> Top {campaignCount} Campanhas por {campaignSortBy === 'spend' ? 'Gasto' : campaignSortBy === 'conversions' ? 'Conversões' : 'ROAS'}
                      </h2>
                      <div id="pdf-campaigns-table" className="bg-white rounded-lg border overflow-hidden shadow-sm">
                        <table className="w-full text-[9px]">
                          <thead>
                            <tr style={{ backgroundColor: primaryColor }}>
                              <th className="text-left px-2 py-2 font-bold text-white w-8">#</th>
                              <th className="text-left px-2 py-2 font-bold text-white">Campanha</th>
                              <th className="text-right px-2 py-2 font-bold text-white">Gasto</th>
                              <th className="text-right px-2 py-2 font-bold text-white">Conv.</th>
                              <th className="text-right px-2 py-2 font-bold text-white">{businessModel === 'ecommerce' ? 'ROAS' : 'CPA'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {topCampaigns.map((c, idx) => (
                              <tr key={c.campaign_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/70'}>
                                <td className="px-2 py-2 text-center font-bold text-gray-700">{idx + 1}</td>
                                <td className="px-2 py-2 text-gray-800 truncate max-w-[120px] font-medium" title={c.campaign_name}>{c.campaign_name}</td>
                                <td className="text-right px-2 py-2 text-gray-800 font-semibold">{fmtCurrency(c.spend, currency)}</td>
                                <td className="text-right px-2 py-2 text-gray-800">{fmtNumber(c.conversions)}</td>
                                <td className="text-right px-2 py-2 font-bold" style={{ color: primaryColor }}>
                                  {businessModel === 'ecommerce' ? `${c.roas.toFixed(2)}x` : fmtCurrency(c.cpa, currency)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Footer with Period */}
                <div className="px-4 py-2 text-center" style={{ backgroundColor: primaryColor }}>
                  <p className="text-[10px] text-white font-medium">{fmtDateRange(activePeriod.since, activePeriod.until)}</p>
                  <p className="text-[9px] text-white/70">{projectName} • Relatório gerado automaticamente</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
