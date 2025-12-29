import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Download, Loader2, CalendarIcon, BarChart3, LineChart, AreaChart, TrendingUp, Upload } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { usePDFMetrics } from '@/hooks/usePDFMetrics';
import jsPDF from 'jspdf';
import { ResponsiveContainer, ComposedChart, LineChart as RLineChart, BarChart, AreaChart as RAreaChart, Line, Bar, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

// Types
type ChartType = 'line' | 'bar' | 'area' | 'composed';
type MetricKey = 'spend' | 'impressions' | 'clicks' | 'reach' | 'conversions' | 'conversion_value' | 'ctr' | 'cpm' | 'cpc' | 'roas' | 'cpa';

interface DateRangeType { from?: Date; to?: Date; }

interface PDFBuilderDialogProps {
  projectName: string;
  periodLabel: string;
  metrics: {
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalReach: number;
    totalConversions: number;
    totalConversionValue: number;
    ctr: number;
    cpm: number;
    cpc: number;
    cpa: number;
    roas: number;
    avgFrequency?: number;
    campaignCount: number;
  };
  businessModel: 'inside_sales' | 'ecommerce' | 'pdv' | null;
  currency: string;
  projectId?: string;
}

// Constants
const METRIC_LABELS: Record<MetricKey, string> = {
  spend: 'Gasto', impressions: 'Impressões', clicks: 'Cliques', reach: 'Alcance',
  conversions: 'Conversões', conversion_value: 'Receita', ctr: 'CTR (%)',
  cpm: 'CPM', cpc: 'CPC', roas: 'ROAS', cpa: 'CPA',
};

const CURRENCY_METRICS: MetricKey[] = ['spend', 'conversion_value', 'cpm', 'cpc', 'cpa'];

const COLOR_PRESETS = ['#dc2626', '#ef4444', '#1f2937', '#374151', '#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b'];

const PERIOD_PRESETS = [
  { label: 'Últimos 7 dias', value: '7d', days: 7 },
  { label: 'Últimos 14 dias', value: '14d', days: 14 },
  { label: 'Últimos 30 dias', value: '30d', days: 30 },
  { label: 'Últimos 60 dias', value: '60d', days: 60 },
  { label: 'Últimos 90 dias', value: '90d', days: 90 },
  { label: 'Este mês', value: 'this_month', days: 0 },
  { label: 'Mês passado', value: 'last_month', days: 0 },
  { label: 'Personalizar', value: 'custom', days: 0 },
];

const FONT_OPTIONS = [
  { label: 'Helvetica (Moderno)', value: 'helvetica' },
  { label: 'Times (Clássico)', value: 'times' },
  { label: 'Courier (Técnico)', value: 'courier' },
];

// Helpers
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [220, 38, 38];
}

function formatMetricValue(value: number, key: MetricKey, currency: string): string {
  if (CURRENCY_METRICS.includes(key)) return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
  if (key === 'ctr') return `${value.toFixed(2)}%`;
  if (key === 'roas') return `${value.toFixed(2)}x`;
  return value >= 1000000 ? (value / 1000000).toFixed(1) + 'M' : value >= 1000 ? (value / 1000).toFixed(1) + 'K' : value.toLocaleString('pt-BR');
}

export function PDFBuilderDialog({ projectName, periodLabel, metrics: initialMetrics, businessModel, currency, projectId }: PDFBuilderDialogProps) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reportTitle, setReportTitle] = useState(`Relatório - ${projectName}`);
  const [logoFile, setLogoFile] = useState<string | null>(null);
  const [periodPreset, setPeriodPreset] = useState('30d');
  const [showCustomCalendar, setShowCustomCalendar] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeType | undefined>(() => ({ from: subDays(new Date(), 30), to: new Date() }));
  
  const [sections, setSections] = useState({ header: true, summary: true, generalMetrics: true, resultMetrics: true, chart: true });
  const [selectedMetrics, setSelectedMetrics] = useState<Set<MetricKey>>(new Set(['spend', 'impressions', 'clicks', 'reach', 'ctr', 'cpm', 'cpc', 'conversions', 'conversion_value', 'roas', 'cpa']));
  
  const [chartType, setChartType] = useState<ChartType>('composed');
  const [primaryMetric, setPrimaryMetric] = useState<MetricKey>('spend');
  const [secondaryMetric, setSecondaryMetric] = useState<string>(businessModel === 'ecommerce' ? 'conversion_value' : 'conversions');
  const [primaryColor, setPrimaryColor] = useState('#dc2626');
  const [secondaryColor, setSecondaryColor] = useState('#22c55e');
  const [showGrid, setShowGrid] = useState(true);

  const [headerColor, setHeaderColor] = useState('#dc2626');
  const [footerColor, setFooterColor] = useState('#dc2626');
  const [accentColor, setAccentColor] = useState('#dc2626');
  const [fontFamily, setFontFamily] = useState<'helvetica' | 'times' | 'courier'>('helvetica');
  const [showHeaderBar, setShowHeaderBar] = useState(true);
  const [showFooterBar, setShowFooterBar] = useState(true);

  const { dailyData, totals, loading: metricsLoading, loadMetrics, getAvailableDateRange } = usePDFMetrics(projectId);
  const pdfChartRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePeriodChange = useCallback((value: string) => {
    setPeriodPreset(value);
    if (value === 'custom') { setShowCustomCalendar(true); return; }
    setShowCustomCalendar(false);
    const today = new Date();
    if (value === 'this_month') setDateRange({ from: startOfMonth(today), to: today });
    else if (value === 'last_month') { const lm = subMonths(today, 1); setDateRange({ from: startOfMonth(lm), to: endOfMonth(lm) }); }
    else { const p = PERIOD_PRESETS.find(x => x.value === value); if (p?.days) setDateRange({ from: subDays(today, p.days), to: today }); }
  }, []);

  useEffect(() => { if (open && projectId) getAvailableDateRange(); }, [open, projectId, getAvailableDateRange]);
  useEffect(() => { if (open && projectId && dateRange?.from && dateRange?.to) loadMetrics(format(dateRange.from, 'yyyy-MM-dd'), format(dateRange.to, 'yyyy-MM-dd')); }, [open, projectId, dateRange, loadMetrics]);

  const currentMetrics = totals || {
    spend: initialMetrics.totalSpend, impressions: initialMetrics.totalImpressions, clicks: initialMetrics.totalClicks,
    reach: initialMetrics.totalReach, conversions: initialMetrics.totalConversions, conversion_value: initialMetrics.totalConversionValue,
    ctr: initialMetrics.ctr, cpm: initialMetrics.cpm, cpc: initialMetrics.cpc, roas: initialMetrics.roas, cpa: initialMetrics.cpa, frequency: initialMetrics.avgFrequency || 0,
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const reader = new FileReader(); reader.onload = (ev) => setLogoFile(ev.target?.result as string); reader.readAsDataURL(file); }
  };

  const toggleMetric = (key: MetricKey) => setSelectedMetrics(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const fmtVal = (v: number, k: MetricKey) => formatMetricValue(v, k, currency);

  const allMetrics = useMemo(() => {
    const base = [
      { key: 'spend' as MetricKey, label: 'Gasto Total', value: fmtVal(currentMetrics.spend, 'spend'), cat: 'general' },
      { key: 'impressions' as MetricKey, label: 'Impressões', value: fmtVal(currentMetrics.impressions, 'impressions'), cat: 'general' },
      { key: 'clicks' as MetricKey, label: 'Cliques', value: fmtVal(currentMetrics.clicks, 'clicks'), cat: 'general' },
      { key: 'reach' as MetricKey, label: 'Alcance', value: fmtVal(currentMetrics.reach, 'reach'), cat: 'general' },
      { key: 'ctr' as MetricKey, label: 'CTR', value: fmtVal(currentMetrics.ctr, 'ctr'), cat: 'general' },
      { key: 'cpm' as MetricKey, label: 'CPM', value: fmtVal(currentMetrics.cpm, 'cpm'), cat: 'general' },
      { key: 'cpc' as MetricKey, label: 'CPC', value: fmtVal(currentMetrics.cpc, 'cpc'), cat: 'general' },
    ];
    if (businessModel === 'ecommerce') return [...base,
      { key: 'conversions' as MetricKey, label: 'Compras', value: fmtVal(currentMetrics.conversions, 'conversions'), cat: 'result' },
      { key: 'conversion_value' as MetricKey, label: 'Receita', value: fmtVal(currentMetrics.conversion_value, 'conversion_value'), cat: 'result' },
      { key: 'roas' as MetricKey, label: 'ROAS', value: fmtVal(currentMetrics.roas, 'roas'), cat: 'result' },
      { key: 'cpa' as MetricKey, label: 'CPA', value: fmtVal(currentMetrics.cpa, 'cpa'), cat: 'result' },
    ];
    if (businessModel === 'inside_sales') return [...base,
      { key: 'conversions' as MetricKey, label: 'Leads', value: fmtVal(currentMetrics.conversions, 'conversions'), cat: 'result' },
      { key: 'cpa' as MetricKey, label: 'CPL', value: fmtVal(currentMetrics.cpa, 'cpa'), cat: 'result' },
    ];
    if (businessModel === 'pdv') return [...base,
      { key: 'conversions' as MetricKey, label: 'Visitas', value: fmtVal(currentMetrics.conversions, 'conversions'), cat: 'result' },
      { key: 'cpa' as MetricKey, label: 'Custo/Visita', value: fmtVal(currentMetrics.cpa, 'cpa'), cat: 'result' },
    ];
    return base;
  }, [currentMetrics, businessModel, currency]);

  const filteredMetrics = useMemo(() => allMetrics.filter(m => selectedMetrics.has(m.key)), [allMetrics, selectedMetrics]);
  const generalMetrics = filteredMetrics.filter(m => m.cat === 'general');
  const resultMetrics = filteredMetrics.filter(m => m.cat === 'result');
  const chartData = useMemo(() => dailyData.map(d => ({ ...d, date: format(new Date(d.date), 'dd/MM', { locale: ptBR }) })), [dailyData]);

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;
      let yPos = margin;
      pdf.setFont(fontFamily);

      if (showHeaderBar) { const [r, g, b] = hexToRgb(headerColor); pdf.setFillColor(r, g, b); pdf.rect(0, 0, pageWidth, 8, 'F'); yPos = 12; }

      if (sections.header) {
        if (logoFile) try { pdf.addImage(logoFile, 'PNG', margin, yPos, 25, 25); } catch {}
        pdf.setFontSize(18); pdf.setFont(fontFamily, 'bold'); pdf.setTextColor(17, 24, 39);
        pdf.text(reportTitle, logoFile ? margin + 30 : margin, yPos + 10);
        pdf.setFontSize(10); pdf.setFont(fontFamily, 'normal'); pdf.setTextColor(107, 114, 128);
        const periodText = dateRange?.from && dateRange?.to ? `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}` : periodLabel;
        pdf.text(periodText, logoFile ? margin + 30 : margin, yPos + 18);
        pdf.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, logoFile ? margin + 30 : margin, yPos + 25);
        yPos += 38; pdf.setDrawColor(229, 231, 235); pdf.line(margin, yPos, pageWidth - margin, yPos); yPos += 8;
      }

      if (sections.summary) {
        pdf.setFontSize(12); pdf.setFont(fontFamily, 'bold'); pdf.setTextColor(17, 24, 39); pdf.text('Resumo Executivo', margin, yPos); yPos += 8;
        pdf.setFillColor(249, 250, 251); pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 15, 2, 2, 'F');
        pdf.setFontSize(9); pdf.setFont(fontFamily, 'normal'); pdf.setTextColor(55, 65, 81);
        const summary = businessModel === 'ecommerce' 
          ? `Investimento: ${fmtVal(currentMetrics.spend, 'spend')} | Vendas: ${fmtVal(currentMetrics.conversions, 'conversions')} | Receita: ${fmtVal(currentMetrics.conversion_value, 'conversion_value')} | ROAS: ${fmtVal(currentMetrics.roas, 'roas')}`
          : businessModel === 'inside_sales' ? `Investimento: ${fmtVal(currentMetrics.spend, 'spend')} | Leads: ${fmtVal(currentMetrics.conversions, 'conversions')} | CPL: ${fmtVal(currentMetrics.cpa, 'cpa')}`
          : `Investimento: ${fmtVal(currentMetrics.spend, 'spend')} | Alcance: ${fmtVal(currentMetrics.reach, 'reach')} | Cliques: ${fmtVal(currentMetrics.clicks, 'clicks')}`;
        pdf.text(summary, margin + 5, yPos + 9); yPos += 22;
      }

      if (sections.generalMetrics && generalMetrics.length > 0) {
        pdf.setFontSize(12); pdf.setFont(fontFamily, 'bold'); pdf.setTextColor(17, 24, 39); pdf.text('Métricas Gerais', margin, yPos); yPos += 8;
        const cardW = (pageWidth - margin * 2 - 9) / 4;
        generalMetrics.forEach((m, i) => {
          const col = i % 4, row = Math.floor(i / 4), x = margin + col * (cardW + 3), y = yPos + row * 20;
          pdf.setFillColor(249, 250, 251); pdf.roundedRect(x, y, cardW, 18, 2, 2, 'F');
          pdf.setFontSize(8); pdf.setTextColor(107, 114, 128); pdf.text(m.label, x + 3, y + 6);
          pdf.setFontSize(11); pdf.setFont(fontFamily, 'bold'); pdf.setTextColor(17, 24, 39); pdf.text(m.value, x + 3, y + 14);
          pdf.setFont(fontFamily, 'normal');
        });
        yPos += Math.ceil(generalMetrics.length / 4) * 20 + 8;
      }

      if (sections.resultMetrics && resultMetrics.length > 0) {
        pdf.setFontSize(12); pdf.setFont(fontFamily, 'bold'); pdf.setTextColor(17, 24, 39);
        const resultLabel = businessModel === 'ecommerce' ? 'E-commerce' : businessModel === 'inside_sales' ? 'Inside Sales' : 'PDV';
        pdf.text(`Métricas de Resultado (${resultLabel})`, margin, yPos); yPos += 8;
        const cardW = (pageWidth - margin * 2 - 9) / 4;
        const [ar, ag, ab] = hexToRgb(accentColor);
        resultMetrics.forEach((m, i) => {
          const x = margin + i * (cardW + 3);
          pdf.setFillColor(254, 242, 242); pdf.roundedRect(x, yPos, cardW, 18, 2, 2, 'F');
          pdf.setFontSize(8); pdf.setTextColor(107, 114, 128); pdf.text(m.label, x + 3, yPos + 6);
          pdf.setFontSize(11); pdf.setFont(fontFamily, 'bold'); pdf.setTextColor(ar, ag, ab); pdf.text(m.value, x + 3, yPos + 14);
          pdf.setFont(fontFamily, 'normal');
        });
        yPos += 26;
      }

      if (sections.chart && pdfChartRef.current) {
        pdf.setFontSize(12); pdf.setFont(fontFamily, 'bold'); pdf.setTextColor(17, 24, 39); pdf.text('Evolução Diária', margin, yPos); yPos += 6;
        try {
          const html2canvas = (await import('html2canvas')).default;
          const canvas = await html2canvas(pdfChartRef.current, { backgroundColor: '#ffffff', scale: 3 });
          const imgData = canvas.toDataURL('image/png');
          const imgWidth = pageWidth - margin * 2;
          const imgHeight = (canvas.height / canvas.width) * imgWidth;
          pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, Math.min(imgHeight, 75));
        } catch (e) { console.error(e); }
      }

      const pageHeight = pdf.internal.pageSize.getHeight();
      if (showFooterBar) { const [r, g, b] = hexToRgb(footerColor); pdf.setFillColor(r, g, b); pdf.rect(0, pageHeight - 8, pageWidth, 8, 'F'); }
      pdf.setFontSize(8); pdf.setTextColor(156, 163, 175); pdf.text(`${projectName} • Relatório gerado automaticamente`, pageWidth / 2, pageHeight - (showFooterBar ? 12 : 10), { align: 'center' });

      pdf.save(`${reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } finally { setGenerating(false); }
  };

  const renderChart = () => {
    if (!chartData.length) return <div className="flex items-center justify-center h-full text-gray-500">Sem dados para o período</div>;
    const ChartComponent = chartType === 'line' ? RLineChart : chartType === 'bar' ? BarChart : chartType === 'area' ? RAreaChart : ComposedChart;
    return (
      <ChartComponent data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
        <XAxis dataKey="date" tick={{ fill: '#374151', fontSize: 10 }} axisLine={{ stroke: '#d1d5db' }} tickLine={{ stroke: '#d1d5db' }} />
        <YAxis yAxisId="left" tick={{ fill: '#374151', fontSize: 10 }} axisLine={{ stroke: '#d1d5db' }} tickLine={{ stroke: '#d1d5db' }} />
        {secondaryMetric !== 'none' && <YAxis yAxisId="right" orientation="right" tick={{ fill: '#374151', fontSize: 10 }} axisLine={{ stroke: '#d1d5db' }} tickLine={{ stroke: '#d1d5db' }} />}
        <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', color: '#111' }} />
        <Legend wrapperStyle={{ color: '#374151' }} />
        {chartType === 'bar' || chartType === 'composed' ? (
          <Bar yAxisId="left" dataKey={primaryMetric} fill={primaryColor} radius={[4, 4, 0, 0]} name={METRIC_LABELS[primaryMetric]} />
        ) : chartType === 'area' ? (
          <Area yAxisId="left" type="monotone" dataKey={primaryMetric} stroke={primaryColor} fill={primaryColor} fillOpacity={0.3} name={METRIC_LABELS[primaryMetric]} />
        ) : (
          <Line yAxisId="left" type="monotone" dataKey={primaryMetric} stroke={primaryColor} strokeWidth={2} dot={false} name={METRIC_LABELS[primaryMetric]} />
        )}
        {secondaryMetric !== 'none' && <Line yAxisId="right" type="monotone" dataKey={secondaryMetric} stroke={secondaryColor} strokeWidth={2} dot={false} name={METRIC_LABELS[secondaryMetric as MetricKey]} />}
      </ChartComponent>
    );
  };

  const getSummaryText = () => {
    if (businessModel === 'ecommerce') return `Investimento ${fmtVal(currentMetrics.spend, 'spend')} → ${fmtVal(currentMetrics.conversions, 'conversions')} vendas, ${fmtVal(currentMetrics.conversion_value, 'conversion_value')} receita, ROAS ${currentMetrics.roas.toFixed(2)}x`;
    if (businessModel === 'inside_sales') return `Investimento ${fmtVal(currentMetrics.spend, 'spend')} → ${fmtVal(currentMetrics.conversions, 'conversions')} leads, CPL ${fmtVal(currentMetrics.cpa, 'cpa')}`;
    return `Investimento ${fmtVal(currentMetrics.spend, 'spend')} → ${fmtVal(currentMetrics.reach, 'reach')} alcance, ${fmtVal(currentMetrics.clicks, 'clicks')} cliques`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2"><FileText className="w-4 h-4" />Exportar PDF</Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-red-600" />Construtor de Relatório PDF</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(90vh-120px)]">
          <div className="space-y-4 overflow-y-auto pr-2">
            <Tabs defaultValue="content" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="content">Conteúdo</TabsTrigger>
                <TabsTrigger value="metrics">Métricas</TabsTrigger>
                <TabsTrigger value="chart">Gráfico</TabsTrigger>
                <TabsTrigger value="style">Estilo</TabsTrigger>
              </TabsList>
              
              <TabsContent value="content" className="space-y-4 mt-4">
                <div className="space-y-2"><Label>Título do Relatório</Label><Input value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} /></div>
                <div className="space-y-2">
                  <Label>Período</Label>
                  <Select value={periodPreset} onValueChange={handlePeriodChange}><SelectTrigger><SelectValue placeholder="Selecione o período" /></SelectTrigger><SelectContent>{PERIOD_PRESETS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select>
                  {showCustomCalendar && (
                    <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start mt-2", !dateRange && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{dateRange?.from ? (dateRange.to ? `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}` : format(dateRange.from, "dd/MM/yyyy")) : "Selecione as datas"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="range" selected={dateRange} onSelect={setDateRange as any} numberOfMonths={2} locale={ptBR} className="pointer-events-auto" /></PopoverContent></Popover>
                  )}
                  {dateRange?.from && dateRange?.to && !showCustomCalendar && <p className="text-xs text-muted-foreground">{format(dateRange.from, "dd/MM/yyyy")} - {format(dateRange.to, "dd/MM/yyyy")}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Logo da Empresa</Label>
                  <div className="flex items-center gap-3">
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2"><Upload className="w-4 h-4" />{logoFile ? 'Trocar Logo' : 'Carregar Logo'}</Button>
                    {logoFile && <Button variant="ghost" size="sm" onClick={() => setLogoFile(null)} className="text-muted-foreground">Remover</Button>}
                  </div>
                  {logoFile && <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg"><img src={logoFile} alt="Logo" className="h-10 w-10 object-contain rounded" /><span className="text-xs text-muted-foreground">Logo carregado</span></div>}
                </div>
                <Separator />
                <div className="space-y-3"><Label className="text-sm font-medium">Seções do Relatório</Label>
                  {[{ key: 'header', label: 'Cabeçalho com Logo' },{ key: 'summary', label: 'Resumo Executivo' },{ key: 'generalMetrics', label: 'Métricas Gerais' },{ key: 'resultMetrics', label: 'Métricas de Resultado' },{ key: 'chart', label: 'Gráfico de Evolução' }].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between"><Label className="cursor-pointer">{label}</Label><Switch checked={sections[key as keyof typeof sections]} onCheckedChange={(c) => setSections(p => ({ ...p, [key]: c }))} /></div>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="metrics" className="space-y-4 mt-4">
                <div className="space-y-3"><Label className="text-sm font-medium">Selecione as Métricas</Label><p className="text-xs text-muted-foreground">Escolha quais métricas incluir no relatório</p>
                  <div className="space-y-4">
                    <div><h4 className="text-xs font-semibold text-muted-foreground mb-2">MÉTRICAS GERAIS</h4><div className="space-y-2">{allMetrics.filter(m => m.cat === 'general').map(m => (<div key={m.key} className="flex items-center gap-2"><Checkbox id={m.key} checked={selectedMetrics.has(m.key)} onCheckedChange={() => toggleMetric(m.key)} /><Label htmlFor={m.key} className="text-sm cursor-pointer flex-1">{m.label}</Label><span className="text-xs text-muted-foreground">{m.value}</span></div>))}</div></div>
                    {businessModel && <div><h4 className="text-xs font-semibold text-muted-foreground mb-2">MÉTRICAS DE RESULTADO ({businessModel === 'ecommerce' ? 'E-COMMERCE' : businessModel === 'inside_sales' ? 'INSIDE SALES' : 'PDV'})</h4><div className="space-y-2">{allMetrics.filter(m => m.cat === 'result').map(m => (<div key={m.key} className="flex items-center gap-2"><Checkbox id={`result-${m.key}`} checked={selectedMetrics.has(m.key)} onCheckedChange={() => toggleMetric(m.key)} /><Label htmlFor={`result-${m.key}`} className="text-sm cursor-pointer flex-1">{m.label}</Label><span className="text-xs text-red-500 font-medium">{m.value}</span></div>))}</div></div>}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="chart" className="space-y-4 mt-4">
                <div className="space-y-2"><Label>Tipo de Gráfico</Label>
                  <div className="grid grid-cols-4 gap-2">{(['line', 'bar', 'area', 'composed'] as ChartType[]).map(t => { const Icon = { line: LineChart, bar: BarChart3, area: AreaChart, composed: TrendingUp }[t]; return (<Button key={t} variant={chartType === t ? 'default' : 'outline'} size="sm" className="flex flex-col gap-1 h-auto py-2" onClick={() => setChartType(t)}><Icon className="w-4 h-4" /><span className="text-xs">{t === 'composed' ? 'Misto' : t === 'line' ? 'Linha' : t === 'bar' ? 'Barra' : 'Área'}</span></Button>); })}</div>
                </div>
                <div className="space-y-2"><Label>Métrica Principal</Label><Select value={primaryMetric} onValueChange={(v) => setPrimaryMetric(v as MetricKey)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{allMetrics.map(m => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Métrica Secundária</Label><Select value={secondaryMetric} onValueChange={setSecondaryMetric}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Nenhuma</SelectItem>{allMetrics.filter(m => m.key !== primaryMetric).map(m => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}</SelectContent></Select></div>
                <Separator />
                <div className="space-y-2"><Label>Cor Principal do Gráfico</Label><div className="flex gap-2 flex-wrap">{COLOR_PRESETS.map(c => (<button key={c} className={cn("w-8 h-8 rounded-full border-2 transition-all hover:scale-110", primaryColor === c ? "border-foreground scale-110" : "border-transparent")} style={{ backgroundColor: c }} onClick={() => setPrimaryColor(c)} />))}</div></div>
                <div className="space-y-2"><Label>Cor Secundária do Gráfico</Label><div className="flex gap-2 flex-wrap">{COLOR_PRESETS.map(c => (<button key={c} className={cn("w-8 h-8 rounded-full border-2 transition-all hover:scale-110", secondaryColor === c ? "border-foreground scale-110" : "border-transparent")} style={{ backgroundColor: c }} onClick={() => setSecondaryColor(c)} />))}</div></div>
                <div className="flex items-center justify-between"><Label>Mostrar Grade</Label><Switch checked={showGrid} onCheckedChange={setShowGrid} /></div>
              </TabsContent>
              
              <TabsContent value="style" className="space-y-4 mt-4">
                <div className="space-y-2"><Label>Tipografia</Label><Select value={fontFamily} onValueChange={(v) => setFontFamily(v as 'helvetica' | 'times' | 'courier')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FONT_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent></Select></div>
                <Separator />
                <div className="space-y-2"><Label>Cor do Cabeçalho (Barra superior)</Label><div className="flex gap-2 flex-wrap">{COLOR_PRESETS.map(c => (<button key={c} className={cn("w-8 h-8 rounded-full border-2 transition-all hover:scale-110", headerColor === c ? "border-foreground scale-110" : "border-transparent")} style={{ backgroundColor: c }} onClick={() => setHeaderColor(c)} />))}</div><div className="flex items-center justify-between mt-2"><Label className="text-sm">Mostrar barra do cabeçalho</Label><Switch checked={showHeaderBar} onCheckedChange={setShowHeaderBar} /></div></div>
                <div className="space-y-2"><Label>Cor do Rodapé (Barra inferior)</Label><div className="flex gap-2 flex-wrap">{COLOR_PRESETS.map(c => (<button key={c} className={cn("w-8 h-8 rounded-full border-2 transition-all hover:scale-110", footerColor === c ? "border-foreground scale-110" : "border-transparent")} style={{ backgroundColor: c }} onClick={() => setFooterColor(c)} />))}</div><div className="flex items-center justify-between mt-2"><Label className="text-sm">Mostrar barra do rodapé</Label><Switch checked={showFooterBar} onCheckedChange={setShowFooterBar} /></div></div>
                <div className="space-y-2"><Label>Cor de Destaque (Métricas de resultado)</Label><div className="flex gap-2 flex-wrap">{COLOR_PRESETS.map(c => (<button key={c} className={cn("w-8 h-8 rounded-full border-2 transition-all hover:scale-110", accentColor === c ? "border-foreground scale-110" : "border-transparent")} style={{ backgroundColor: c }} onClick={() => setAccentColor(c)} />))}</div></div>
              </TabsContent>
            </Tabs>
          </div>
          
          <div className="border rounded-lg overflow-hidden flex flex-col">
            <div className="p-3 border-b bg-muted/50 flex items-center justify-between"><span className="text-sm font-medium">Preview do PDF</span>{metricsLoading && <Loader2 className="w-4 h-4 animate-spin" />}</div>
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-4 bg-white text-gray-900 min-h-full">
                {showHeaderBar && <div className="h-2 rounded-full" style={{ backgroundColor: headerColor }} />}
                {sections.header && (<><div className="flex items-start gap-4">{logoFile && <img src={logoFile} alt="Logo" className="h-12 w-12 object-contain rounded" />}<div><h1 className="text-xl font-bold text-gray-900">{reportTitle}</h1><p className="text-sm text-gray-500">{dateRange?.from && dateRange?.to ? `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}` : periodLabel}</p><p className="text-xs text-gray-400">Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p></div></div><Separator className="bg-gray-200" /></>)}
                {sections.summary && <div className="p-3 rounded-lg" style={{ backgroundColor: `${accentColor}10` }}><h3 className="text-xs font-semibold text-gray-600 mb-1">Resumo Executivo</h3><p className="text-sm text-gray-700">{getSummaryText()}</p></div>}
                {sections.generalMetrics && generalMetrics.length > 0 && <div className="space-y-2"><h2 className="text-sm font-semibold text-gray-800">Métricas Gerais</h2><div className="grid grid-cols-3 gap-2">{generalMetrics.map(m => <div key={m.key} className="p-2 bg-gray-50 rounded text-center"><p className="text-[10px] text-gray-500">{m.label}</p><p className="text-sm font-semibold text-gray-900">{m.value}</p></div>)}</div></div>}
                {sections.resultMetrics && resultMetrics.length > 0 && <div className="space-y-2"><h2 className="text-sm font-semibold text-gray-800">Métricas de Resultado</h2><div className="grid grid-cols-2 gap-2">{resultMetrics.map(m => <div key={m.key} className="p-2 rounded text-center" style={{ backgroundColor: `${accentColor}10` }}><p className="text-[10px] text-gray-500">{m.label}</p><p className="text-sm font-semibold" style={{ color: accentColor }}>{m.value}</p></div>)}</div></div>}
                {sections.chart && <div className="space-y-2"><h2 className="text-sm font-semibold text-gray-800">Evolução Diária</h2><div ref={pdfChartRef} className="h-48 bg-white rounded-lg border border-gray-200 p-3"><ResponsiveContainer width="100%" height="100%">{renderChart()}</ResponsiveContainer></div></div>}
                {showFooterBar && <div className="h-2 rounded-full mt-4" style={{ backgroundColor: footerColor }} />}
              </div>
            </ScrollArea>
          </div>
        </div>
        
        <div className="flex justify-end gap-3 pt-3 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={generatePDF} disabled={generating} className="gap-2 bg-red-600 hover:bg-red-700">{generating ? <><Loader2 className="w-4 h-4 animate-spin" />Gerando...</> : <><Download className="w-4 h-4" />Baixar PDF</>}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
