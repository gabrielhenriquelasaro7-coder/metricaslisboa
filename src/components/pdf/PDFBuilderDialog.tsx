import { useState, useEffect, useMemo, useRef } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { FileText, Download, Loader2, Calendar, Upload, X, LayoutTemplate } from 'lucide-react';
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
import { usePDFMetrics } from '@/hooks/usePDFMetrics';
import { format, differenceInDays, eachWeekOfInterval, eachMonthOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
  { id: 'executive', name: 'Resumo Executivo', color: '#E11D48', generalMetrics: ['spend', 'ctr', 'cpc'], resultMetrics: ['roas', 'conversion_value'], includeChart: false },
  { id: 'complete', name: 'Relatório Completo', color: '#E11D48', generalMetrics: GENERAL_METRICS.map(m => m.key), resultMetrics: ['conversions', 'conversion_value', 'roas', 'cpa'], includeChart: true },
  { id: 'performance', name: 'Análise de Performance', color: '#3B82F6', generalMetrics: ['impressions', 'clicks', 'ctr'], resultMetrics: ['conversions', 'cpa'], includeChart: true },
];

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
  
  // Chart
  const [includeChart, setIncludeChart] = useState(true);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [chartPrimaryMetric, setChartPrimaryMetric] = useState('spend');
  const [chartSecondaryMetric, setChartSecondaryMetric] = useState('conversion_value');
  const [showSecondaryMetric, setShowSecondaryMetric] = useState(true);
  
  // Appearance
  const [primaryColor, setPrimaryColor] = useState('#E11D48');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  // Multi-page
  const [multiPageMode, setMultiPageMode] = useState<'single' | 'weekly' | 'monthly'>('single');
  
  const { dailyData, totals, loading, loadMetrics } = usePDFMetrics(projectId);
  const resultDefs = businessModel ? RESULT_METRICS[businessModel] || [] : [];

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
    setPrimaryColor(template.color);
  };

  const chartData = useMemo(() => {
    return dailyData.map(d => ({
      date: format(new Date(d.date + 'T00:00:00'), 'dd/MM'),
      [chartPrimaryMetric]: (d as Record<string, any>)[chartPrimaryMetric] || 0,
      ...(showSecondaryMetric ? { [chartSecondaryMetric]: (d as Record<string, any>)[chartSecondaryMetric] || 0 } : {}),
    }));
  }, [dailyData, chartPrimaryMetric, chartSecondaryMetric, showSecondaryMetric]);

  const primaryMetricDef = CHART_METRICS.find(m => m.key === chartPrimaryMetric);
  const secondaryMetricDef = CHART_METRICS.find(m => m.key === chartSecondaryMetric);

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
          } catch (e) { console.error('Chart capture error:', e); }
        }
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
                <Label className="text-xs font-medium uppercase text-muted-foreground">Gráfico</Label>
                <div className="flex items-center gap-2">
                  <Switch checked={includeChart} onCheckedChange={setIncludeChart} id="include-chart" />
                  <Label htmlFor="include-chart" className="text-sm font-normal">Incluir gráfico</Label>
                </div>
                {includeChart && (
                  <div className="space-y-2 mt-2">
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
                  </div>
                )}
              </div>
              
              {/* Logo */}
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
              {loading && <Loader2 className="h-4 w-4 animate-spin ml-auto" />}
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
                              <YAxis yAxisId="left" tick={{ fontSize: 9 }} tickFormatter={(v) => fmtNumber(v)} />
                              {showSecondaryMetric && <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} tickFormatter={(v) => fmtNumber(v)} />}
                              <Tooltip formatter={(value: number, name: string) => {
                                const met = CHART_METRICS.find(m => m.label === name);
                                if (met?.type === 'currency') return [fmtCurrency(value, currency), name];
                                if (met?.type === 'percent') return [`${value.toFixed(2)}%`, name];
                                if (met?.type === 'decimal') return [`${value.toFixed(2)}x`, name];
                                return [fmtNumber(value), name];
                              }} />
                              <Legend wrapperStyle={{ fontSize: 10 }} />
                              <Bar yAxisId="left" dataKey={chartPrimaryMetric} name={primaryMetricDef?.label || 'Primária'} fill={primaryColor} radius={[2, 2, 0, 0]} />
                              {showSecondaryMetric && <Line yAxisId="right" type="monotone" dataKey={chartSecondaryMetric} name={secondaryMetricDef?.label || 'Secundária'} stroke="#22c55e" strokeWidth={2} dot={false} />}
                            </ComposedChart>
                          ) : (
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                              <YAxis yAxisId="left" tick={{ fontSize: 9 }} tickFormatter={(v) => fmtNumber(v)} />
                              {showSecondaryMetric && <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} tickFormatter={(v) => fmtNumber(v)} />}
                              <Tooltip formatter={(value: number, name: string) => {
                                const met = CHART_METRICS.find(m => m.label === name);
                                if (met?.type === 'currency') return [fmtCurrency(value, currency), name];
                                if (met?.type === 'percent') return [`${value.toFixed(2)}%`, name];
                                if (met?.type === 'decimal') return [`${value.toFixed(2)}x`, name];
                                return [fmtNumber(value), name];
                              }} />
                              <Legend wrapperStyle={{ fontSize: 10 }} />
                              <Line yAxisId="left" type="monotone" dataKey={chartPrimaryMetric} name={primaryMetricDef?.label || 'Primária'} stroke={primaryColor} strokeWidth={2} dot={false} />
                              {showSecondaryMetric && <Line yAxisId="right" type="monotone" dataKey={chartSecondaryMetric} name={secondaryMetricDef?.label || 'Secundária'} stroke="#22c55e" strokeWidth={2} dot={false} />}
                            </LineChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Footer */}
                <div className="px-4 py-2 text-center" style={{ backgroundColor: primaryColor }}>
                  <p className="text-[10px] text-white/80">{projectName} • Relatório gerado automaticamente</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
