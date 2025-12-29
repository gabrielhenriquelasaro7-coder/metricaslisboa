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
  chartRef?: React.RefObject<HTMLDivElement>;
  projectId?: string;
}

const METRIC_LABELS: Record<string, string> = {
  spend: 'Gasto', impressions: 'Impressões', clicks: 'Cliques', reach: 'Alcance',
  conversions: 'Conversões', conversion_value: 'Receita', ctr: 'CTR (%)',
  cpm: 'CPM', cpc: 'CPC', roas: 'ROAS', cpa: 'CPA',
};

const CURRENCY_METRICS = ['spend', 'conversion_value', 'cpm', 'cpc', 'cpa'];
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

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [220, 38, 38];
}

export function PDFBuilderDialog({ projectName, periodLabel, metrics: initialMetrics, businessModel, currency, projectId }: PDFBuilderDialogProps) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reportTitle, setReportTitle] = useState(`Relatório - ${projectName}`);
  const [logoFile, setLogoFile] = useState<string | null>(null);
  const [periodPreset, setPeriodPreset] = useState('30d');
  const [showCustomCalendar, setShowCustomCalendar] = useState(false);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>(() => ({ from: subDays(new Date(), 30), to: new Date() }));
  
  const [sections, setSections] = useState({ header: true, summary: true, generalMetrics: true, resultMetrics: true, chart: true });
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(new Set(['spend', 'impressions', 'clicks', 'reach', 'ctr', 'cpm', 'cpc', 'conversions', 'conversion_value', 'roas', 'cpa']));
  
  const [chartType, setChartType] = useState<'line' | 'bar' | 'area' | 'composed'>('composed');
  const [primaryMetric, setPrimaryMetric] = useState('spend');
  const [secondaryMetric, setSecondaryMetric] = useState(businessModel === 'ecommerce' ? 'conversion_value' : 'conversions');
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

  const toggleMetric = (key: string) => setSelectedMetrics(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  
  const fmtVal = (v: number, k: string) => {
    if (CURRENCY_METRICS.includes(k)) return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(v);
    if (k === 'ctr') return `${v.toFixed(2)}%`;
    if (k === 'roas') return `${v.toFixed(2)}x`;
    return v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : v >= 1000 ? (v / 1000).toFixed(1) + 'K' : v.toLocaleString('pt-BR');
  };

  const allMetrics = useMemo(() => {
    const base = [
      { key: 'spend', label: 'Gasto Total', value: fmtVal(currentMetrics.spend, 'spend'), cat: 'general' },
      { key: 'impressions', label: 'Impressões', value: fmtVal(currentMetrics.impressions, 'impressions'), cat: 'general' },
      { key: 'clicks', label: 'Cliques', value: fmtVal(currentMetrics.clicks, 'clicks'), cat: 'general' },
      { key: 'reach', label: 'Alcance', value: fmtVal(currentMetrics.reach, 'reach'), cat: 'general' },
      { key: 'ctr', label: 'CTR', value: fmtVal(currentMetrics.ctr, 'ctr'), cat: 'general' },
      { key: 'cpm', label: 'CPM', value: fmtVal(currentMetrics.cpm, 'cpm'), cat: 'general' },
      { key: 'cpc', label: 'CPC', value: fmtVal(currentMetrics.cpc, 'cpc'), cat: 'general' },
    ];
    if (businessModel === 'ecommerce') return [...base,
      { key: 'conversions', label: 'Compras', value: fmtVal(currentMetrics.conversions, 'conversions'), cat: 'result' },
      { key: 'conversion_value', label: 'Receita', value: fmtVal(currentMetrics.conversion_value, 'conversion_value'), cat: 'result' },
      { key: 'roas', label: 'ROAS', value: fmtVal(currentMetrics.roas, 'roas'), cat: 'result' },
      { key: 'cpa', label: 'CPA', value: fmtVal(currentMetrics.cpa, 'cpa'), cat: 'result' },
    ];
    if (businessModel === 'inside_sales') return [...base,
      { key: 'conversions', label: 'Leads', value: fmtVal(currentMetrics.conversions, 'conversions'), cat: 'result' },
      { key: 'cpa', label: 'CPL', value: fmtVal(currentMetrics.cpa, 'cpa'), cat: 'result' },
    ];
    if (businessModel === 'pdv') return [...base,
      { key: 'conversions', label: 'Visitas', value: fmtVal(currentMetrics.conversions, 'conversions'), cat: 'result' },
      { key: 'cpa', label: 'Custo/Visita', value: fmtVal(currentMetrics.cpa, 'cpa'), cat: 'result' },
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
    if (!chartData.length) return <div className="flex items-center justify-center h-full text-gray-500">Sem dados</div>;
    const ChartComponent = chartType === 'line' ? RLineChart : chartType === 'bar' ? BarChart : chartType === 'area' ? RAreaChart : ComposedChart;
    return (
      <ChartComponent data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
        <XAxis dataKey="date" tick={{ fill: '#374151', fontSize: 10 }} />
        <YAxis yAxisId="left" tick={{ fill: '#374151', fontSize: 10 }} />
        {secondaryMetric !== 'none' && <YAxis yAxisId="right" orientation="right" tick={{ fill: '#374151', fontSize: 10 }} />}
        <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }} />
        <Legend />
        {chartType === 'bar' || chartType === 'composed' ? <Bar yAxisId="left" dataKey={primaryMetric} fill={primaryColor} name={METRIC_LABELS[primaryMetric]} /> : chartType === 'area' ? <Area yAxisId="left" type="monotone" dataKey={primaryMetric} stroke={primaryColor} fill={primaryColor} fillOpacity={0.3} name={METRIC_LABELS[primaryMetric]} /> : <Line yAxisId="left" type="monotone" dataKey={primaryMetric} stroke={primaryColor} strokeWidth={2} dot={false} name={METRIC_LABELS[primaryMetric]} />}
        {secondaryMetric !== 'none' && <Line yAxisId="right" type="monotone" dataKey={secondaryMetric} stroke={secondaryColor} strokeWidth={2} dot={false} name={METRIC_LABELS[secondaryMetric]} />}
      </ChartComponent>
    );
  };

  const getSummaryText = () => {
    if (businessModel === 'ecommerce') return `Investimento ${fmtVal(currentMetrics.spend, 'spend')} → ${fmtVal(currentMetrics.conversions, 'conversions')} vendas, ${fmtVal(currentMetrics.conversion_value, 'conversion_value')} receita`;
    if (businessModel === 'inside_sales') return `Investimento ${fmtVal(currentMetrics.spend, 'spend')} → ${fmtVal(currentMetrics.conversions, 'conversions')} leads`;
    return `Investimento ${fmtVal(currentMetrics.spend, 'spend')} → ${fmtVal(currentMetrics.reach, 'reach')} alcance`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm" className="gap-2"><FileText className="w-4 h-4" />Exportar PDF</Button></DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-red-600" />Construtor de Relatório PDF</DialogTitle></DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(90vh-120px)]">
          <div className="space-y-4 overflow-y-auto pr-2">
            <Tabs defaultValue="content" className="w-full">
              <TabsList className="grid w-full grid-cols-4"><TabsTrigger value="content">Conteúdo</TabsTrigger><TabsTrigger value="metrics">Métricas</TabsTrigger><TabsTrigger value="chart">Gráfico</TabsTrigger><TabsTrigger value="style">Estilo</TabsTrigger></TabsList>
              
              <TabsContent value="content" className="space-y-4 mt-4">
                <div className="space-y-2"><Label>Título</Label><Input value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} /></div>
                <div className="space-y-2">
                  <Label>Período</Label>
                  <Select value={periodPreset} onValueChange={handlePeriodChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PERIOD_PRESETS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select>
                  {showCustomCalendar && <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full mt-2"><CalendarIcon className="mr-2 h-4 w-4" />{dateRange?.from ? `${format(dateRange.from, "dd/MM")} - ${format(dateRange.to || new Date(), "dd/MM")}` : "Selecionar"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="range" selected={dateRange as any} onSelect={setDateRange as any} numberOfMonths={2} locale={ptBR} className="pointer-events-auto" /></PopoverContent></Popover>}
                </div>
                <div className="space-y-2"><Label>Logo</Label><div className="flex gap-2"><input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" /><Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="w-4 h-4 mr-2" />{logoFile ? 'Trocar' : 'Carregar'}</Button>{logoFile && <Button variant="ghost" size="sm" onClick={() => setLogoFile(null)}>Remover</Button>}</div>{logoFile && <img src={logoFile} alt="Logo" className="h-10 w-10 object-contain mt-2" />}</div>
                <Separator />
                <div className="space-y-2">{[{ key: 'header', label: 'Cabeçalho' },{ key: 'summary', label: 'Resumo' },{ key: 'generalMetrics', label: 'Métricas Gerais' },{ key: 'resultMetrics', label: 'Métricas Resultado' },{ key: 'chart', label: 'Gráfico' }].map(({ key, label }) => <div key={key} className="flex justify-between"><Label>{label}</Label><Switch checked={sections[key as keyof typeof sections]} onCheckedChange={(c) => setSections(p => ({ ...p, [key]: c }))} /></div>)}</div>
              </TabsContent>
              
              <TabsContent value="metrics" className="space-y-4 mt-4">
                <div className="space-y-2">{allMetrics.map(m => <div key={m.key} className="flex items-center gap-2"><Checkbox checked={selectedMetrics.has(m.key)} onCheckedChange={() => toggleMetric(m.key)} /><span className="flex-1 text-sm">{m.label}</span><span className={cn("text-xs", m.cat === 'result' ? "text-red-500 font-medium" : "text-muted-foreground")}>{m.value}</span></div>)}</div>
              </TabsContent>
              
              <TabsContent value="chart" className="space-y-4 mt-4">
                <div className="space-y-2"><Label>Tipo</Label><div className="grid grid-cols-4 gap-2">{[{ t: 'line', l: 'Linha', I: LineChart }, { t: 'bar', l: 'Barra', I: BarChart3 }, { t: 'area', l: 'Área', I: AreaChart }, { t: 'composed', l: 'Misto', I: TrendingUp }].map(({ t, l, I }) => <Button key={t} variant={chartType === t ? 'default' : 'outline'} size="sm" className="flex-col h-auto py-2" onClick={() => setChartType(t as any)}><I className="w-4 h-4" /><span className="text-xs">{l}</span></Button>)}</div></div>
                <div className="space-y-2"><Label>Métrica Principal</Label><Select value={primaryMetric} onValueChange={setPrimaryMetric}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{allMetrics.map(m => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Métrica Secundária</Label><Select value={secondaryMetric} onValueChange={setSecondaryMetric}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Nenhuma</SelectItem>{allMetrics.filter(m => m.key !== primaryMetric).map(m => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}</SelectContent></Select></div>
                <Separator />
                <div className="space-y-2"><Label>Cor Principal</Label><div className="flex gap-2 flex-wrap">{COLOR_PRESETS.map(c => <button key={c} className={cn("w-8 h-8 rounded-full border-2", primaryColor === c ? "border-foreground" : "border-transparent")} style={{ backgroundColor: c }} onClick={() => setPrimaryColor(c)} />)}</div></div>
                <div className="space-y-2"><Label>Cor Secundária</Label><div className="flex gap-2 flex-wrap">{COLOR_PRESETS.map(c => <button key={c} className={cn("w-8 h-8 rounded-full border-2", secondaryColor === c ? "border-foreground" : "border-transparent")} style={{ backgroundColor: c }} onClick={() => setSecondaryColor(c)} />)}</div></div>
                <div className="flex justify-between"><Label>Grade</Label><Switch checked={showGrid} onCheckedChange={setShowGrid} /></div>
              </TabsContent>
              
              <TabsContent value="style" className="space-y-4 mt-4">
                <div className="space-y-2"><Label>Fonte</Label><Select value={fontFamily} onValueChange={(v: any) => setFontFamily(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FONT_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent></Select></div>
                <Separator />
                <div className="space-y-2"><Label>Cor Cabeçalho</Label><div className="flex gap-2 flex-wrap">{COLOR_PRESETS.map(c => <button key={c} className={cn("w-8 h-8 rounded-full border-2", headerColor === c ? "border-foreground" : "border-transparent")} style={{ backgroundColor: c }} onClick={() => setHeaderColor(c)} />)}</div><div className="flex justify-between mt-2"><Label className="text-sm">Mostrar barra</Label><Switch checked={showHeaderBar} onCheckedChange={setShowHeaderBar} /></div></div>
                <div className="space-y-2"><Label>Cor Rodapé</Label><div className="flex gap-2 flex-wrap">{COLOR_PRESETS.map(c => <button key={c} className={cn("w-8 h-8 rounded-full border-2", footerColor === c ? "border-foreground" : "border-transparent")} style={{ backgroundColor: c }} onClick={() => setFooterColor(c)} />)}</div><div className="flex justify-between mt-2"><Label className="text-sm">Mostrar barra</Label><Switch checked={showFooterBar} onCheckedChange={setShowFooterBar} /></div></div>
                <div className="space-y-2"><Label>Cor Destaque</Label><div className="flex gap-2 flex-wrap">{COLOR_PRESETS.map(c => <button key={c} className={cn("w-8 h-8 rounded-full border-2", accentColor === c ? "border-foreground" : "border-transparent")} style={{ backgroundColor: c }} onClick={() => setAccentColor(c)} />)}</div></div>
              </TabsContent>
            </Tabs>
          </div>
          
          <div className="border rounded-lg overflow-hidden flex flex-col">
            <div className="p-3 border-b bg-muted/50 flex justify-between"><span className="text-sm font-medium">Preview</span>{metricsLoading && <Loader2 className="w-4 h-4 animate-spin" />}</div>
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-4 bg-white text-gray-900 min-h-full">
                {showHeaderBar && <div className="h-2 rounded-full" style={{ backgroundColor: headerColor }} />}
                {sections.header && <div className="flex gap-4">{logoFile && <img src={logoFile} className="h-12 w-12 object-contain" />}<div><h1 className="text-xl font-bold text-gray-900">{reportTitle}</h1><p className="text-sm text-gray-500">{dateRange?.from && dateRange?.to ? `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}` : periodLabel}</p></div></div>}
                {sections.summary && <div className="p-3 rounded-lg" style={{ backgroundColor: `${accentColor}10` }}><h3 className="text-xs font-semibold text-gray-600 mb-1">Resumo</h3><p className="text-sm text-gray-700">{getSummaryText()}</p></div>}
                {sections.generalMetrics && generalMetrics.length > 0 && <div><h2 className="text-sm font-semibold text-gray-800 mb-2">Métricas Gerais</h2><div className="grid grid-cols-3 gap-2">{generalMetrics.map(m => <div key={m.key} className="p-2 bg-gray-50 rounded text-center"><p className="text-[10px] text-gray-500">{m.label}</p><p className="text-sm font-semibold text-gray-900">{m.value}</p></div>)}</div></div>}
                {sections.resultMetrics && resultMetrics.length > 0 && <div><h2 className="text-sm font-semibold text-gray-800 mb-2">Resultados</h2><div className="grid grid-cols-2 gap-2">{resultMetrics.map(m => <div key={m.key} className="p-2 rounded text-center" style={{ backgroundColor: `${accentColor}10` }}><p className="text-[10px] text-gray-500">{m.label}</p><p className="text-sm font-semibold" style={{ color: accentColor }}>{m.value}</p></div>)}</div></div>}
                {sections.chart && <div><h2 className="text-sm font-semibold text-gray-800 mb-2">Evolução</h2><div ref={pdfChartRef} className="h-48 bg-white border rounded p-3"><ResponsiveContainer width="100%" height="100%">{renderChart()}</ResponsiveContainer></div></div>}
                {showFooterBar && <div className="h-2 rounded-full mt-4" style={{ backgroundColor: footerColor }} />}
              </div>
            </ScrollArea>
          </div>
        </div>
        
        <div className="flex justify-end gap-3 pt-3 border-t"><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={generatePDF} disabled={generating} className="gap-2 bg-red-600 hover:bg-red-700">{generating ? <><Loader2 className="w-4 h-4 animate-spin" />Gerando...</> : <><Download className="w-4 h-4" />Baixar PDF</>}</Button></div>
      </DialogContent>
    </Dialog>
  );
}
