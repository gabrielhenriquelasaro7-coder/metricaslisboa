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
import { FileText, Download, Loader2, CalendarIcon, BarChart3, LineChart, AreaChart, Upload } from 'lucide-react';
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
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>(() => ({ 
    from: subDays(new Date(), 30), 
    to: new Date() 
  }));
  
  // Section toggles
  const [sections, setSections] = useState({ 
    header: true, 
    summary: true, 
    generalMetrics: true, 
    resultMetrics: true, 
    chart: true 
  });
  
  // Metric selection
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(
    new Set(['spend', 'impressions', 'clicks', 'reach', 'ctr', 'cpm', 'cpc', 'conversions', 'conversion_value', 'roas', 'cpa'])
  );
  
  // Chart options
  const [chartType, setChartType] = useState<'line' | 'bar' | 'area' | 'composed'>('composed');
  const [primaryMetric, setPrimaryMetric] = useState('spend');
  const [secondaryMetric, setSecondaryMetric] = useState(businessModel === 'ecommerce' ? 'conversion_value' : 'conversions');
  const [primaryColor, setPrimaryColor] = useState('#dc2626');
  const [secondaryColor, setSecondaryColor] = useState('#22c55e');
  const [showGrid, setShowGrid] = useState(true);
  
  // Style options
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
    if (value === 'custom') { 
      setShowCustomCalendar(true); 
      return; 
    }
    setShowCustomCalendar(false);
    const today = new Date();
    if (value === 'this_month') {
      setDateRange({ from: startOfMonth(today), to: today });
    } else if (value === 'last_month') { 
      const lm = subMonths(today, 1); 
      setDateRange({ from: startOfMonth(lm), to: endOfMonth(lm) }); 
    } else { 
      const p = PERIOD_PRESETS.find(x => x.value === value); 
      if (p?.days) setDateRange({ from: subDays(today, p.days), to: today }); 
    }
  }, []);

  useEffect(() => { 
    if (open && projectId) getAvailableDateRange(); 
  }, [open, projectId, getAvailableDateRange]);
  
  useEffect(() => { 
    if (open && projectId && dateRange?.from && dateRange?.to) {
      loadMetrics(format(dateRange.from, 'yyyy-MM-dd'), format(dateRange.to, 'yyyy-MM-dd')); 
    }
  }, [open, projectId, dateRange, loadMetrics]);

  const currentMetrics = totals || {
    spend: initialMetrics.totalSpend, 
    impressions: initialMetrics.totalImpressions, 
    clicks: initialMetrics.totalClicks,
    reach: initialMetrics.totalReach, 
    conversions: initialMetrics.totalConversions, 
    conversion_value: initialMetrics.totalConversionValue,
    ctr: initialMetrics.ctr, 
    cpm: initialMetrics.cpm, 
    cpc: initialMetrics.cpc, 
    roas: initialMetrics.roas, 
    cpa: initialMetrics.cpa, 
    frequency: initialMetrics.avgFrequency || 0,
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { 
      const reader = new FileReader(); 
      reader.onload = (ev) => setLogoFile(ev.target?.result as string); 
      reader.readAsDataURL(file); 
    }
  };

  const toggleMetric = (key: string) => {
    setSelectedMetrics(prev => { 
      const n = new Set(prev); 
      n.has(key) ? n.delete(key) : n.add(key); 
      return n; 
    });
  };
  
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

      if (showHeaderBar) { 
        const [r, g, b] = hexToRgb(headerColor); 
        pdf.setFillColor(r, g, b); 
        pdf.rect(0, 0, pageWidth, 8, 'F'); 
        yPos = 12; 
      }

      if (sections.header) {
        if (logoFile) try { pdf.addImage(logoFile, 'PNG', margin, yPos, 25, 25); } catch {}
        pdf.setFontSize(18); 
        pdf.setFont(fontFamily, 'bold'); 
        pdf.setTextColor(17, 24, 39);
        pdf.text(reportTitle, logoFile ? margin + 30 : margin, yPos + 10);
        pdf.setFontSize(10); 
        pdf.setFont(fontFamily, 'normal'); 
        pdf.setTextColor(107, 114, 128);
        const periodText = dateRange?.from && dateRange?.to ? `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}` : periodLabel;
        pdf.text(periodText, logoFile ? margin + 30 : margin, yPos + 18);
        pdf.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, logoFile ? margin + 30 : margin, yPos + 25);
        yPos += 38; 
        pdf.setDrawColor(229, 231, 235); 
        pdf.line(margin, yPos, pageWidth - margin, yPos); 
        yPos += 8;
      }

      if (sections.summary) {
        pdf.setFontSize(12); 
        pdf.setFont(fontFamily, 'bold'); 
        pdf.setTextColor(17, 24, 39); 
        pdf.text('Resumo Executivo', margin, yPos); 
        yPos += 8;
        pdf.setFillColor(249, 250, 251); 
        pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 15, 2, 2, 'F');
        pdf.setFontSize(9); 
        pdf.setFont(fontFamily, 'normal'); 
        pdf.setTextColor(55, 65, 81);
        const summary = businessModel === 'ecommerce' 
          ? `Investimento: ${fmtVal(currentMetrics.spend, 'spend')} | Vendas: ${fmtVal(currentMetrics.conversions, 'conversions')} | Receita: ${fmtVal(currentMetrics.conversion_value, 'conversion_value')} | ROAS: ${fmtVal(currentMetrics.roas, 'roas')}`
          : businessModel === 'inside_sales' ? `Investimento: ${fmtVal(currentMetrics.spend, 'spend')} | Leads: ${fmtVal(currentMetrics.conversions, 'conversions')} | CPL: ${fmtVal(currentMetrics.cpa, 'cpa')}`
          : `Investimento: ${fmtVal(currentMetrics.spend, 'spend')} | Alcance: ${fmtVal(currentMetrics.reach, 'reach')} | Cliques: ${fmtVal(currentMetrics.clicks, 'clicks')}`;
        pdf.text(summary, margin + 5, yPos + 9); 
        yPos += 22;
      }

      if (sections.generalMetrics && generalMetrics.length > 0) {
        pdf.setFontSize(12); 
        pdf.setFont(fontFamily, 'bold'); 
        pdf.setTextColor(17, 24, 39); 
        pdf.text('Métricas Gerais', margin, yPos); 
        yPos += 8;
        const cardW = (pageWidth - margin * 2 - 9) / 4;
        generalMetrics.forEach((m, i) => {
          const col = i % 4, row = Math.floor(i / 4), x = margin + col * (cardW + 3), y = yPos + row * 20;
          pdf.setFillColor(249, 250, 251); 
          pdf.roundedRect(x, y, cardW, 18, 2, 2, 'F');
          pdf.setFontSize(8); 
          pdf.setTextColor(107, 114, 128); 
          pdf.text(m.label, x + 3, y + 6);
          pdf.setFontSize(11); 
          pdf.setFont(fontFamily, 'bold'); 
          pdf.setTextColor(17, 24, 39); 
          pdf.text(m.value, x + 3, y + 14);
          pdf.setFont(fontFamily, 'normal');
        });
        yPos += Math.ceil(generalMetrics.length / 4) * 20 + 8;
      }

      if (sections.resultMetrics && resultMetrics.length > 0) {
        pdf.setFontSize(12); 
        pdf.setFont(fontFamily, 'bold'); 
        pdf.setTextColor(17, 24, 39);
        const resultLabel = businessModel === 'ecommerce' ? 'E-commerce' : businessModel === 'inside_sales' ? 'Inside Sales' : 'PDV';
        pdf.text(`Métricas de Resultado (${resultLabel})`, margin, yPos); 
        yPos += 8;
        const cardW = (pageWidth - margin * 2 - 9) / 4;
        const [ar, ag, ab] = hexToRgb(accentColor);
        resultMetrics.forEach((m, i) => {
          const x = margin + i * (cardW + 3);
          pdf.setFillColor(254, 242, 242); 
          pdf.roundedRect(x, yPos, cardW, 18, 2, 2, 'F');
          pdf.setFontSize(8); 
          pdf.setTextColor(107, 114, 128); 
          pdf.text(m.label, x + 3, yPos + 6);
          pdf.setFontSize(11); 
          pdf.setFont(fontFamily, 'bold'); 
          pdf.setTextColor(ar, ag, ab); 
          pdf.text(m.value, x + 3, yPos + 14);
          pdf.setFont(fontFamily, 'normal');
        });
        yPos += 26;
      }

      if (sections.chart && pdfChartRef.current) {
        pdf.setFontSize(12); 
        pdf.setFont(fontFamily, 'bold'); 
        pdf.setTextColor(17, 24, 39); 
        pdf.text('Evolução Diária', margin, yPos); 
        yPos += 6;
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
      if (showFooterBar) { 
        const [r, g, b] = hexToRgb(footerColor); 
        pdf.setFillColor(r, g, b); 
        pdf.rect(0, pageHeight - 8, pageWidth, 8, 'F'); 
      }
      pdf.setFontSize(8); 
      pdf.setTextColor(156, 163, 175); 
      pdf.text(`${projectName} • Relatório gerado automaticamente`, pageWidth / 2, pageHeight - (showFooterBar ? 12 : 10), { align: 'center' });

      pdf.save(`${reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } finally { 
      setGenerating(false); 
    }
  };

  const renderChart = () => {
    if (!chartData.length) return <div className="flex items-center justify-center h-full text-muted-foreground">Sem dados para o período</div>;
    const ChartComponent = chartType === 'line' ? RLineChart : chartType === 'bar' ? BarChart : chartType === 'area' ? RAreaChart : ComposedChart;
    return (
      <ChartComponent data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
        <XAxis dataKey="date" tick={{ fill: '#374151', fontSize: 10 }} />
        <YAxis yAxisId="left" tick={{ fill: '#374151', fontSize: 10 }} />
        {secondaryMetric !== 'none' && <YAxis yAxisId="right" orientation="right" tick={{ fill: '#374151', fontSize: 10 }} />}
        <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }} />
        <Legend />
        {chartType === 'bar' || chartType === 'composed' ? (
          <Bar yAxisId="left" dataKey={primaryMetric} fill={primaryColor} name={METRIC_LABELS[primaryMetric]} />
        ) : chartType === 'area' ? (
          <Area yAxisId="left" type="monotone" dataKey={primaryMetric} stroke={primaryColor} fill={primaryColor} fillOpacity={0.3} name={METRIC_LABELS[primaryMetric]} />
        ) : (
          <Line yAxisId="left" type="monotone" dataKey={primaryMetric} stroke={primaryColor} strokeWidth={2} dot={false} name={METRIC_LABELS[primaryMetric]} />
        )}
        {secondaryMetric !== 'none' && (
          <Line yAxisId="right" type="monotone" dataKey={secondaryMetric} stroke={secondaryColor} strokeWidth={2} dot={false} name={METRIC_LABELS[secondaryMetric]} />
        )}
      </ChartComponent>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileText className="w-4 h-4" />Exportar PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-red-600" />Construtor de Relatório PDF
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(90vh-120px)]">
          {/* Left: Controls */}
          <div className="space-y-4 overflow-y-auto pr-2">
            <Tabs defaultValue="content" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="content">Conteúdo</TabsTrigger>
                <TabsTrigger value="metrics">Métricas</TabsTrigger>
                <TabsTrigger value="chart">Gráfico</TabsTrigger>
                <TabsTrigger value="style">Estilo</TabsTrigger>
              </TabsList>
              
              {/* Content Tab */}
              <TabsContent value="content" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Título do Relatório</Label>
                  <Input value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} />
                </div>
                
                <div className="space-y-2">
                  <Label>Logo (opcional)</Label>
                  <div className="flex gap-2">
                    <Input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
                      <Upload className="w-4 h-4" />{logoFile ? 'Alterar Logo' : 'Adicionar Logo'}
                    </Button>
                    {logoFile && <Button variant="ghost" size="sm" onClick={() => setLogoFile(null)}>Remover</Button>}
                  </div>
                  {logoFile && <img src={logoFile} alt="Logo preview" className="w-16 h-16 object-contain mt-2" />}
                </div>
                
                <div className="space-y-2">
                  <Label>Período do Relatório</Label>
                  <Select value={periodPreset} onValueChange={handlePeriodChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PERIOD_PRESETS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {showCustomCalendar && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange?.from ? (dateRange.to ? `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}` : format(dateRange.from, 'dd/MM/yyyy')) : 'Selecionar datas'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="range" selected={dateRange} onSelect={(range) => setDateRange(range)} numberOfMonths={2} className="pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
                
                <Separator />
                
                <div className="space-y-3">
                  <Label>Seções do Relatório</Label>
                  {Object.entries({ header: 'Cabeçalho', summary: 'Resumo Executivo', generalMetrics: 'Métricas Gerais', resultMetrics: 'Métricas de Resultado', chart: 'Gráfico de Evolução' }).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-sm">{label}</span>
                      <Switch checked={sections[key as keyof typeof sections]} onCheckedChange={(c) => setSections(p => ({ ...p, [key]: c }))} />
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              {/* Metrics Tab */}
              <TabsContent value="metrics" className="space-y-4 mt-4">
                <Label>Selecione as métricas a exibir</Label>
                <div className="grid grid-cols-2 gap-2">
                  {allMetrics.map(m => (
                    <div key={m.key} className="flex items-center space-x-2">
                      <Checkbox id={m.key} checked={selectedMetrics.has(m.key)} onCheckedChange={() => toggleMetric(m.key)} />
                      <label htmlFor={m.key} className="text-sm cursor-pointer">{m.label}</label>
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              {/* Chart Tab */}
              <TabsContent value="chart" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Tipo de Gráfico</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {[{ v: 'line', i: LineChart, l: 'Linha' }, { v: 'bar', i: BarChart, l: 'Barras' }, { v: 'area', i: AreaChart, l: 'Área' }, { v: 'composed', i: BarChart3, l: 'Misto' }].map(t => (
                      <Button key={t.v} variant={chartType === t.v ? 'default' : 'outline'} size="sm" onClick={() => setChartType(t.v as typeof chartType)} className="flex-col h-16 gap-1">
                        <t.i className="w-5 h-5" /><span className="text-xs">{t.l}</span>
                      </Button>
                    ))}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Métrica Principal</Label>
                    <Select value={primaryMetric} onValueChange={setPrimaryMetric}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(METRIC_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                    <div className="flex gap-1">{COLOR_PRESETS.map(c => <button key={c} className={cn("w-6 h-6 rounded-full border-2", primaryColor === c ? "border-foreground" : "border-transparent")} style={{ backgroundColor: c }} onClick={() => setPrimaryColor(c)} />)}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Métrica Secundária</Label>
                    <Select value={secondaryMetric} onValueChange={setSecondaryMetric}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {Object.entries(METRIC_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-1">{COLOR_PRESETS.map(c => <button key={c} className={cn("w-6 h-6 rounded-full border-2", secondaryColor === c ? "border-foreground" : "border-transparent")} style={{ backgroundColor: c }} onClick={() => setSecondaryColor(c)} />)}</div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Mostrar Grade</span>
                  <Switch checked={showGrid} onCheckedChange={setShowGrid} />
                </div>
              </TabsContent>
              
              {/* Style Tab */}
              <TabsContent value="style" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Fonte</Label>
                  <Select value={fontFamily} onValueChange={(v) => setFontFamily(v as typeof fontFamily)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{FONT_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Barra do Cabeçalho</span>
                    <Switch checked={showHeaderBar} onCheckedChange={setShowHeaderBar} />
                  </div>
                  {showHeaderBar && (
                    <div className="flex gap-1">{COLOR_PRESETS.map(c => <button key={c} className={cn("w-6 h-6 rounded-full border-2", headerColor === c ? "border-foreground" : "border-transparent")} style={{ backgroundColor: c }} onClick={() => setHeaderColor(c)} />)}</div>
                  )}
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Barra do Rodapé</span>
                    <Switch checked={showFooterBar} onCheckedChange={setShowFooterBar} />
                  </div>
                  {showFooterBar && (
                    <div className="flex gap-1">{COLOR_PRESETS.map(c => <button key={c} className={cn("w-6 h-6 rounded-full border-2", footerColor === c ? "border-foreground" : "border-transparent")} style={{ backgroundColor: c }} onClick={() => setFooterColor(c)} />)}</div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label>Cor de Destaque</Label>
                  <div className="flex gap-1">{COLOR_PRESETS.map(c => <button key={c} className={cn("w-6 h-6 rounded-full border-2", accentColor === c ? "border-foreground" : "border-transparent")} style={{ backgroundColor: c }} onClick={() => setAccentColor(c)} />)}</div>
                </div>
              </TabsContent>
            </Tabs>
            
            <Button onClick={generatePDF} disabled={generating || metricsLoading} className="w-full gap-2 bg-red-600 hover:bg-red-700">
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" />Gerando...</> : <><Download className="w-4 h-4" />Baixar PDF</>}
            </Button>
          </div>
          
          {/* Right: Preview */}
          <div className="bg-white rounded-lg border shadow-sm overflow-y-auto">
            <div className="p-6 space-y-4">
              {showHeaderBar && <div className="h-2 rounded-t" style={{ backgroundColor: headerColor }} />}
              
              {sections.header && (
                <div className="flex items-start gap-4 pb-4 border-b">
                  {logoFile && <img src={logoFile} alt="Logo" className="w-12 h-12 object-contain" />}
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{reportTitle}</h2>
                    <p className="text-xs text-gray-500">{dateRange?.from && dateRange?.to ? `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}` : periodLabel}</p>
                  </div>
                </div>
              )}
              
              {sections.summary && (
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-xs font-medium text-gray-700">Resumo: {businessModel === 'ecommerce' ? `${fmtVal(currentMetrics.spend, 'spend')} → ${fmtVal(currentMetrics.conversions, 'conversions')} vendas, ${fmtVal(currentMetrics.conversion_value, 'conversion_value')} receita` : businessModel === 'inside_sales' ? `${fmtVal(currentMetrics.spend, 'spend')} → ${fmtVal(currentMetrics.conversions, 'conversions')} leads` : `${fmtVal(currentMetrics.spend, 'spend')} → ${fmtVal(currentMetrics.reach, 'reach')} alcance`}</p>
                </div>
              )}
              
              {sections.generalMetrics && generalMetrics.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Métricas Gerais</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {generalMetrics.map(m => (
                      <div key={m.key} className="bg-gray-50 rounded p-2">
                        <p className="text-[10px] text-gray-500">{m.label}</p>
                        <p className="text-sm font-bold">{m.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {sections.resultMetrics && resultMetrics.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Métricas de Resultado</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {resultMetrics.map(m => (
                      <div key={m.key} className="bg-red-50 rounded p-2">
                        <p className="text-[10px] text-gray-500">{m.label}</p>
                        <p className="text-sm font-bold" style={{ color: accentColor }}>{m.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {sections.chart && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Evolução Diária</h3>
                  <div ref={pdfChartRef} className="h-48 bg-white">
                    <ResponsiveContainer width="100%" height="100%">{renderChart()}</ResponsiveContainer>
                  </div>
                </div>
              )}
              
              {showFooterBar && <div className="h-2 rounded-b mt-4" style={{ backgroundColor: footerColor }} />}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
