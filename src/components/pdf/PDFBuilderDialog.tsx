import { useState, useEffect, useMemo, useRef } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { FileText, Download, Loader2, Calendar, Settings2, Eye, Upload, X, LayoutTemplate } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { usePDFMetrics } from '@/hooks/usePDFMetrics';
import { format, differenceInDays, eachWeekOfInterval, eachMonthOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Tooltip,
  ComposedChart,
} from 'recharts';

type BusinessModel = 'ecommerce' | 'inside_sales' | 'pdv' | null;

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
  chartRef?: React.RefObject<HTMLDivElement>;
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

function fmtCurrency(v: number, curr: string): string {
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: curr,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  }).format(v);
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
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 225, g: 29, b: 72 }; // fallback red
}

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

// Templates pré-configurados
interface PDFTemplate {
  id: string;
  name: string;
  description: string;
  generalMetrics: string[];
  resultMetrics: string[];
  includeChart: boolean;
  chartType: 'bar' | 'line';
  chartPrimaryMetric: string;
  chartSecondaryMetric: string;
  showSecondaryMetric: boolean;
  color: string;
}

const TEMPLATES: PDFTemplate[] = [
  {
    id: 'executive',
    name: 'Resumo Executivo',
    description: 'KPIs principais',
    generalMetrics: ['spend', 'ctr', 'cpc'],
    resultMetrics: ['roas', 'conversion_value'],
    includeChart: false,
    chartType: 'bar',
    chartPrimaryMetric: 'spend',
    chartSecondaryMetric: 'conversion_value',
    showSecondaryMetric: false,
    color: '#E11D48'
  },
  {
    id: 'complete',
    name: 'Relatório Completo',
    description: 'Todas as métricas',
    generalMetrics: GENERAL_METRICS.map(m => m.key),
    resultMetrics: ['conversions', 'conversion_value', 'roas', 'cpa'],
    includeChart: true,
    chartType: 'bar',
    chartPrimaryMetric: 'spend',
    chartSecondaryMetric: 'conversion_value',
    showSecondaryMetric: true,
    color: '#E11D48'
  },
  {
    id: 'performance',
    name: 'Análise de Performance',
    description: 'Foco em conversões',
    generalMetrics: ['impressions', 'clicks', 'ctr'],
    resultMetrics: ['conversions', 'cpa'],
    includeChart: true,
    chartType: 'line',
    chartPrimaryMetric: 'conversions',
    chartSecondaryMetric: 'cpa',
    showSecondaryMetric: true,
    color: '#3B82F6'
  }
];

export function PDFBuilderDialog({ 
  projectId, 
  projectName, 
  businessModel, 
  currency,
  currentPeriod,
  chartRef 
}: Props) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [title, setTitle] = useState(`Relatório - ${projectName}`);
  
  const [useDashboardPeriod, setUseDashboardPeriod] = useState(true);
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  
  const [selGeneral, setSelGeneral] = useState<string[]>(GENERAL_METRICS.map(m => m.key));
  const [selResult, setSelResult] = useState<string[]>(
    businessModel ? RESULT_METRICS[businessModel]?.map(m => m.key) || [] : []
  );
  
  const [primaryColor, setPrimaryColor] = useState('#E11D48');
  const [includeChart, setIncludeChart] = useState(true);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [chartPrimaryMetric, setChartPrimaryMetric] = useState('spend');
  const [chartSecondaryMetric, setChartSecondaryMetric] = useState('conversion_value');
  const [showSecondaryMetric, setShowSecondaryMetric] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [multiPageMode, setMultiPageMode] = useState<'single' | 'weekly' | 'monthly'>('single');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  
  const { dailyData, totals, loading, loadMetrics } = usePDFMetrics(projectId);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setLogoUrl(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setLogoUrl(null);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const activePeriod = useMemo(() => {
    if (useDashboardPeriod) return currentPeriod;
    if (customStart && customEnd) {
      return { since: format(customStart, 'yyyy-MM-dd'), until: format(customEnd, 'yyyy-MM-dd') };
    }
    return currentPeriod;
  }, [useDashboardPeriod, customStart, customEnd, currentPeriod]);

  useEffect(() => {
    if (!open) return;
    loadMetrics(activePeriod.since, activePeriod.until);
  }, [open, activePeriod, loadMetrics]);

  const toggleGeneral = (k: string) => setSelGeneral(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);
  const toggleResult = (k: string) => setSelResult(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);

  // Aplicar template
  const applyTemplate = (templateId: string) => {
    const template = TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    
    setSelectedTemplate(templateId);
    setSelGeneral(template.generalMetrics);
    setSelResult(template.resultMetrics.filter(k => resultDefs.some(r => r.key === k)));
    setIncludeChart(template.includeChart);
    setChartType(template.chartType);
    setChartPrimaryMetric(template.chartPrimaryMetric);
    setChartSecondaryMetric(template.chartSecondaryMetric);
    setShowSecondaryMetric(template.showSecondaryMetric);
    setPrimaryColor(template.color);
  };

  // Calcular número de dias do período
  const periodDays = useMemo(() => {
    const start = new Date(activePeriod.since + 'T00:00:00');
    const end = new Date(activePeriod.until + 'T00:00:00');
    return differenceInDays(end, start) + 1;
  }, [activePeriod]);

  const resultDefs = businessModel ? RESULT_METRICS[businessModel] || [] : [];

  // Chart data for preview - now using selected metrics
  const chartData = useMemo(() => {
    return dailyData.map(d => {
      const record: Record<string, any> = {
        date: format(new Date(d.date + 'T00:00:00'), 'dd/MM'),
      };
      record[chartPrimaryMetric] = (d as Record<string, any>)[chartPrimaryMetric] || 0;
      if (showSecondaryMetric && chartSecondaryMetric) {
        record[chartSecondaryMetric] = (d as Record<string, any>)[chartSecondaryMetric] || 0;
      }
      return record;
    });
  }, [dailyData, chartPrimaryMetric, chartSecondaryMetric, showSecondaryMetric]);

  const primaryMetricDef = CHART_METRICS.find(m => m.key === chartPrimaryMetric);
  const secondaryMetricDef = CHART_METRICS.find(m => m.key === chartSecondaryMetric);

  // Summary text
  const summaryText = useMemo(() => {
    if (!totals) return '';
    const parts = [
      `Investimento: ${fmtCurrency(totals.spend, currency)}`,
    ];
    if (businessModel === 'ecommerce') {
      parts.push(`Vendas: ${fmtNumber(totals.conversions)}`);
      parts.push(`Receita: ${fmtCurrency(totals.conversion_value, currency)}`);
      parts.push(`ROAS: ${totals.roas.toFixed(2)}x`);
    } else if (businessModel === 'inside_sales') {
      parts.push(`Leads: ${fmtNumber(totals.conversions)}`);
      parts.push(`CPL: ${fmtCurrency(totals.cpa, currency)}`);
    } else if (businessModel === 'pdv') {
      parts.push(`Visitas: ${fmtNumber(totals.conversions)}`);
    }
    return parts.join(' | ');
  }, [totals, businessModel, currency]);

  const generate = async () => {
    if (!totals) return;
    setGenerating(true);
    
    try {
      const doc = new jsPDF();
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      const m = 15;
      
      // Header Bar - Convert hex to RGB
      const rgb = hexToRgb(primaryColor);
      doc.setFillColor(rgb.r, rgb.g, rgb.b);
      doc.rect(0, 0, pw, 25, 'F');
      
      // Logo (if exists)
      if (logoUrl) {
        try {
          doc.addImage(logoUrl, 'PNG', pw - m - 25, 5, 20, 15);
        } catch (e) {
          console.error('Logo error:', e);
        }
      }
      
      // Title on header
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(title, m, 12);
      
      // Period on header
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(fmtDateRange(activePeriod.since, activePeriod.until), m, 20);
      
      let y = 35;
      
      // Generation date
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(9);
      doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, m, y);
      y += 10;
      
      // Executive Summary
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(33, 33, 33);
      doc.text('Resumo Executivo', m, y);
      y += 8;
      
      doc.setFillColor(254, 242, 242);
      doc.roundedRect(m, y, pw - 2 * m, 12, 2, 2, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(primaryColor);
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
        
        const cols = Math.min(activeGeneral.length, 4);
        const cw = (pw - 2 * m - (cols - 1) * 3) / cols;
        
        activeGeneral.forEach((met, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = m + col * (cw + 3);
          const cy = y + row * 22;
          
          doc.setFillColor(248, 249, 250);
          doc.roundedRect(x, cy, cw, 20, 2, 2, 'F');
          
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          doc.text(met.label, x + 4, cy + 7);
          
          const val = (totals as unknown as Record<string, number>)[met.key] || 0;
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(primaryColor);
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
        const label = businessModel === 'ecommerce' ? 'E-commerce' : 
                      businessModel === 'inside_sales' ? 'Inside Sales' : 'PDV';
        doc.text(`Métricas de Resultado (${label})`, m, y);
        y += 8;
        
        const cols = Math.min(activeResult.length, 4);
        const cw = (pw - 2 * m - (cols - 1) * 3) / cols;
        
        activeResult.forEach((met, i) => {
          const x = m + i * (cw + 3);
          
          doc.setFillColor(254, 242, 242);
          doc.roundedRect(x, y, cw, 20, 2, 2, 'F');
          
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          doc.text(met.label, x + 4, y + 7);
          
          const val = (totals as unknown as Record<string, number>)[met.key] || 0;
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(primaryColor);
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
        
        // Capture chart from preview
        const chartPreview = document.getElementById('pdf-chart-preview');
        if (chartPreview) {
          try {
            const canvas = await html2canvas(chartPreview, { 
              scale: 2, 
              backgroundColor: '#fff',
              logging: false 
            });
            const imgData = canvas.toDataURL('image/png');
            const imgW = pw - 2 * m;
            const imgH = (canvas.height / canvas.width) * imgW;
            doc.addImage(imgData, 'PNG', m, y, imgW, Math.min(imgH, 70));
          } catch (e) {
            console.error('Chart capture error:', e);
          }
        }
      }
      
      // Footer Bar - Convert hex to RGB
      const rgbFooter = hexToRgb(primaryColor);
      doc.setFillColor(rgbFooter.r, rgbFooter.g, rgbFooter.b);
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
      <DialogContent className="max-w-5xl h-[85vh] p-0 gap-0 overflow-hidden">
        <div className="flex h-full">
          {/* Left Panel - Configuration */}
          <div className="w-80 border-r flex flex-col">
            <DialogHeader className="p-4 border-b">
              <DialogTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Configurações
              </DialogTitle>
            </DialogHeader>
            
            <ScrollArea className="flex-1 h-0">
              <div className="p-4 space-y-6">
                {/* Templates */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-1">
                    <LayoutTemplate className="h-3 w-3" />
                    Templates
                  </Label>
                  <div className="grid grid-cols-1 gap-2">
                    {TEMPLATES.map(t => (
                      <Button
                        key={t.id}
                        variant={selectedTemplate === t.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => applyTemplate(t.id)}
                        className="justify-start h-auto py-2 px-3"
                        style={selectedTemplate === t.id ? { backgroundColor: t.color } : undefined}
                      >
                        <div className="text-left">
                          <p className="font-medium text-sm">{t.name}</p>
                          <p className="text-xs opacity-70">{t.description}</p>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
                
                <Separator />
                
                {/* Title */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase text-muted-foreground">Título</Label>
                  <Input 
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                    placeholder="Nome do relatório"
                    className="h-9"
                  />
                </div>
                
                <Separator />
                
                {/* Period */}
                <div className="space-y-3">
                  <Label className="text-xs font-medium uppercase text-muted-foreground">Período</Label>
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={useDashboardPeriod} 
                      onCheckedChange={setUseDashboardPeriod}
                      id="use-dashboard"
                    />
                    <Label htmlFor="use-dashboard" className="text-sm font-normal">
                      Usar período do dashboard
                    </Label>
                  </div>
                  
                  {!useDashboardPeriod && (
                    <div className="grid grid-cols-2 gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="justify-start text-left font-normal h-9">
                            <Calendar className="mr-2 h-3 w-3" />
                            {customStart ? format(customStart, 'dd/MM/yy') : 'Início'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={customStart}
                            onSelect={setCustomStart}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                      
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="justify-start text-left font-normal h-9">
                            <Calendar className="mr-2 h-3 w-3" />
                            {customEnd ? format(customEnd, 'dd/MM/yy') : 'Fim'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={customEnd}
                            onSelect={setCustomEnd}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </div>
                
                <Separator />
                
                {/* General Metrics */}
                <div className="space-y-3">
                  <Label className="text-xs font-medium uppercase text-muted-foreground">Métricas Gerais</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {GENERAL_METRICS.map(m => (
                      <div key={m.key} className="flex items-center gap-2">
                        <Checkbox 
                          id={`g-${m.key}`}
                          checked={selGeneral.includes(m.key)}
                          onCheckedChange={() => toggleGeneral(m.key)}
                        />
                        <Label htmlFor={`g-${m.key}`} className="text-sm font-normal cursor-pointer">
                          {m.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Result Metrics */}
                {resultDefs.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <Label className="text-xs font-medium uppercase text-muted-foreground">
                        Métricas de Resultado
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        {resultDefs.map(m => (
                          <div key={m.key} className="flex items-center gap-2">
                            <Checkbox 
                              id={`r-${m.key}`}
                              checked={selResult.includes(m.key)}
                              onCheckedChange={() => toggleResult(m.key)}
                            />
                            <Label htmlFor={`r-${m.key}`} className="text-sm font-normal cursor-pointer">
                              {m.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                
                <Separator />
                
                {/* Chart Options */}
                <div className="space-y-3">
                  <Label className="text-xs font-medium uppercase text-muted-foreground">Gráfico</Label>
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={includeChart} 
                      onCheckedChange={setIncludeChart}
                      id="include-chart"
                    />
                    <Label htmlFor="include-chart" className="text-sm font-normal">
                      Incluir gráfico
                    </Label>
                  </div>
                  
                  {includeChart && (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Button 
                          variant={chartType === 'bar' ? 'default' : 'outline'} 
                          size="sm"
                          onClick={() => setChartType('bar')}
                          className="flex-1 h-8"
                        >
                          Barras
                        </Button>
                        <Button 
                          variant={chartType === 'line' ? 'default' : 'outline'} 
                          size="sm"
                          onClick={() => setChartType('line')}
                          className="flex-1 h-8"
                        >
                          Linha
                        </Button>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Métrica Principal</Label>
                        <select 
                          value={chartPrimaryMetric}
                          onChange={(e) => setChartPrimaryMetric(e.target.value)}
                          className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                        >
                          {CHART_METRICS.map(m => (
                            <option key={m.key} value={m.key}>{m.label}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={showSecondaryMetric} 
                          onCheckedChange={setShowSecondaryMetric}
                          id="show-secondary"
                        />
                        <Label htmlFor="show-secondary" className="text-sm font-normal">
                          Métrica Secundária
                        </Label>
                      </div>
                      
                      {showSecondaryMetric && (
                        <select 
                          value={chartSecondaryMetric}
                          onChange={(e) => setChartSecondaryMetric(e.target.value)}
                          className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                        >
                          {CHART_METRICS.filter(m => m.key !== chartPrimaryMetric).map(m => (
                            <option key={m.key} value={m.key}>{m.label}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Multi-page option for large periods */}
                {periodDays > 30 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <Label className="text-xs font-medium uppercase text-muted-foreground">
                        Múltiplas Páginas ({periodDays} dias)
                      </Label>
                      <div className="grid grid-cols-1 gap-2">
                        <Button
                          variant={multiPageMode === 'single' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setMultiPageMode('single')}
                          className="justify-start h-8"
                        >
                          Página única
                        </Button>
                        <Button
                          variant={multiPageMode === 'weekly' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setMultiPageMode('weekly')}
                          className="justify-start h-8"
                        >
                          Dividir por semana
                        </Button>
                        <Button
                          variant={multiPageMode === 'monthly' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setMultiPageMode('monthly')}
                          className="justify-start h-8"
                        >
                          Dividir por mês
                        </Button>
                      </div>
                    </div>
                  </>
                )}
                
                <Separator />
                
                {/* Logo */}
                <div className="space-y-3">
                  <Label className="text-xs font-medium uppercase text-muted-foreground">Logo</Label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    ref={logoInputRef}
                    className="hidden"
                  />
                  {logoUrl ? (
                    <div className="flex items-center gap-2">
                      <img src={logoUrl} alt="Logo" className="h-10 w-auto max-w-20 object-contain rounded" />
                      <Button variant="ghost" size="sm" onClick={removeLogo} className="h-8 w-8 p-0">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => logoInputRef.current?.click()}
                      className="gap-2 h-9"
                    >
                      <Upload className="h-4 w-4" />
                      Adicionar Logo
                    </Button>
                  )}
                </div>
                
                <Separator />
                
                {/* Colors */}
                <div className="space-y-3">
                  <Label className="text-xs font-medium uppercase text-muted-foreground">Cor Principal</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="color" 
                      value={primaryColor} 
                      onChange={e => setPrimaryColor(e.target.value)}
                      className="w-12 h-9 p-1 cursor-pointer"
                    />
                    <Input 
                      value={primaryColor} 
                      onChange={e => setPrimaryColor(e.target.value)}
                      className="flex-1 h-9 font-mono text-sm"
                    />
                  </div>
                </div>
              </div>
            </ScrollArea>
            
            {/* Generate Button */}
            <div className="p-4 border-t">
              <Button 
                onClick={generate} 
                disabled={generating || loading || !totals}
                className="w-full gap-2"
                style={{ backgroundColor: primaryColor }}
              >
                {generating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Gerando...</>
                ) : (
                  <><Download className="h-4 w-4" />Baixar PDF</>
                )}
              </Button>
            </div>
          </div>
          
          {/* Right Panel - Preview */}
          <div className="flex-1 flex flex-col bg-muted/30 overflow-hidden">
            <div className="p-4 border-b bg-background flex items-center gap-2 shrink-0">
              <Eye className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">Preview</span>
              {multiPageMode !== 'single' && periodDays > 30 && (
                <span className="text-xs text-muted-foreground ml-auto">
                  ({multiPageMode === 'weekly' ? 'Várias páginas por semana' : 'Várias páginas por mês'})
                </span>
              )}
              {loading && <Loader2 className="h-4 w-4 animate-spin ml-auto" />}
            </div>
            
            <ScrollArea className="flex-1 h-0">
              <div className="p-6">
                <div className="bg-white rounded-lg shadow-lg overflow-hidden max-w-2xl mx-auto">
                {/* Header Bar - Full Red */}
                <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: primaryColor }}>
                  <div>
                    <h1 className="text-xl font-bold text-white">{title}</h1>
                    <p className="text-sm text-white/80">{fmtDateRange(activePeriod.since, activePeriod.until)}</p>
                  </div>
                  {logoUrl && (
                    <img src={logoUrl} alt="Logo" className="h-10 w-auto max-w-24 object-contain" />
                  )}
                </div>
                
                <div className="p-6">
                  {/* Generation Date */}
                  <p className="text-xs text-gray-400 mb-6">Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
                  
                  {/* Executive Summary */}
                  <h2 className="text-sm font-semibold text-gray-900 mb-3">Resumo Executivo</h2>
                  <div className="rounded-lg border p-3 mb-6" style={{ borderColor: primaryColor, backgroundColor: `${primaryColor}08` }}>
                    <p className="text-sm font-medium" style={{ color: primaryColor }}>
                      {loading ? 'Carregando...' : summaryText || 'Sem dados'}
                    </p>
                  </div>
                  
                  {/* General Metrics */}
                  {selGeneral.length > 0 && totals && (
                    <>
                      <h2 className="text-sm font-semibold text-gray-900 mb-3">Métricas Gerais</h2>
                      <div className="grid grid-cols-3 gap-3 mb-6">
                        {GENERAL_METRICS.filter(m => selGeneral.includes(m.key)).map(m => {
                          const val = (totals as unknown as Record<string, number>)[m.key] || 0;
                          return (
                            <div key={m.key} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                              <p className="text-xs text-gray-500 mb-1">{m.label}</p>
                              <p className="text-lg font-bold" style={{ color: primaryColor }}>
                                {fmtValue(val, m.type, currency)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                  
                  {/* Result Metrics */}
                  {selResult.length > 0 && totals && resultDefs.length > 0 && (
                    <>
                      <h2 className="text-sm font-semibold text-gray-900 mb-3">
                        Métricas de Resultado ({businessModel === 'ecommerce' ? 'E-commerce' : 
                          businessModel === 'inside_sales' ? 'Inside Sales' : 'PDV'})
                      </h2>
                      <div className="grid grid-cols-4 gap-3 mb-6">
                        {resultDefs.filter(m => selResult.includes(m.key)).map(m => {
                          const val = (totals as unknown as Record<string, number>)[m.key] || 0;
                          return (
                            <div key={m.key} className="rounded-lg p-4 border" style={{ borderColor: primaryColor, backgroundColor: `${primaryColor}08` }}>
                              <p className="text-xs text-gray-500 mb-1">{m.label}</p>
                              <p className="text-lg font-bold" style={{ color: primaryColor }}>
                                {fmtValue(val, m.type, currency)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                  
                  {/* Chart */}
                  {includeChart && chartData.length > 0 && (
                    <>
                      <h2 className="text-sm font-semibold text-gray-900 mb-3">Evolução Diária</h2>
                      <div id="pdf-chart-preview" className="bg-white rounded-lg border p-4" style={{ height: 220 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          {chartType === 'bar' ? (
                            <ComposedChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                              <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtNumber(v)} />
                              {showSecondaryMetric && (
                                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtNumber(v)} />
                              )}
                              <Tooltip 
                                formatter={(value: number, name: string) => {
                                  const met = CHART_METRICS.find(m => m.label === name);
                                  if (met?.type === 'currency') return [fmtCurrency(value, currency), name];
                                  if (met?.type === 'percent') return [`${value.toFixed(2)}%`, name];
                                  if (met?.type === 'decimal') return [`${value.toFixed(2)}x`, name];
                                  return [fmtNumber(value), name];
                                }} 
                              />
                              <Legend wrapperStyle={{ fontSize: 11 }} />
                              <Bar yAxisId="left" dataKey={chartPrimaryMetric} name={primaryMetricDef?.label || 'Primária'} fill={primaryColor} radius={[2, 2, 0, 0]} />
                              {showSecondaryMetric && (
                                <Line yAxisId="right" type="monotone" dataKey={chartSecondaryMetric} name={secondaryMetricDef?.label || 'Secundária'} stroke="#22c55e" strokeWidth={2} dot={false} />
                              )}
                            </ComposedChart>
                          ) : (
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                              <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtNumber(v)} />
                              {showSecondaryMetric && (
                                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtNumber(v)} />
                              )}
                              <Tooltip 
                                formatter={(value: number, name: string) => {
                                  const met = CHART_METRICS.find(m => m.label === name);
                                  if (met?.type === 'currency') return [fmtCurrency(value, currency), name];
                                  if (met?.type === 'percent') return [`${value.toFixed(2)}%`, name];
                                  if (met?.type === 'decimal') return [`${value.toFixed(2)}x`, name];
                                  return [fmtNumber(value), name];
                                }} 
                              />
                              <Legend wrapperStyle={{ fontSize: 11 }} />
                              <Line yAxisId="left" type="monotone" dataKey={chartPrimaryMetric} name={primaryMetricDef?.label || 'Primária'} stroke={primaryColor} strokeWidth={2} dot={false} />
                              {showSecondaryMetric && (
                                <Line yAxisId="right" type="monotone" dataKey={chartSecondaryMetric} name={secondaryMetricDef?.label || 'Secundária'} stroke="#22c55e" strokeWidth={2} dot={false} />
                              )}
                            </LineChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}
                </div>
                
                {/* Footer Bar - Full Red */}
                <div className="px-6 py-3 text-center" style={{ backgroundColor: primaryColor }}>
                  <p className="text-xs text-white/80">{projectName} • Relatório gerado automaticamente</p>
                </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
