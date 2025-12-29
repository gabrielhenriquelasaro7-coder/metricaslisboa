import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Download, Loader2, CalendarIcon, BarChart3, LineChart, AreaChart, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { usePDFMetrics } from '@/hooks/usePDFMetrics';
import jsPDF from 'jspdf';
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart as RechartsLineChart,
  BarChart as RechartsBarChart,
  AreaChart as RechartsAreaChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

type ChartType = 'line' | 'bar' | 'area' | 'composed';
type MetricKey = 'spend' | 'impressions' | 'clicks' | 'reach' | 'conversions' | 'conversion_value' | 'ctr' | 'cpm' | 'cpc' | 'roas' | 'cpa';

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

interface ChartConfig {
  type: ChartType;
  primaryMetric: MetricKey;
  secondaryMetric: MetricKey | 'none';
  primaryColor: string;
  secondaryColor: string;
  showGrid: boolean;
}

const metricLabels: Record<MetricKey, string> = {
  spend: 'Gasto',
  impressions: 'Impressões',
  clicks: 'Cliques',
  reach: 'Alcance',
  conversions: 'Conversões',
  conversion_value: 'Receita',
  ctr: 'CTR (%)',
  cpm: 'CPM',
  cpc: 'CPC',
  roas: 'ROAS',
  cpa: 'CPA',
};

const chartTypeIcons = {
  line: LineChart,
  bar: BarChart3,
  area: AreaChart,
  composed: TrendingUp,
};

const colorPresets = ['#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#6366f1'];

export function PDFBuilderDialog({ projectName, periodLabel, metrics: initialMetrics, businessModel, currency, projectId }: PDFBuilderDialogProps) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reportTitle, setReportTitle] = useState(`Relatório - ${projectName}`);
  const [logoFile, setLogoFile] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return { from: start, to: end };
  });
  const [sections, setSections] = useState({ header: true, summary: true, generalMetrics: true, resultMetrics: true, chart: true });
  const [chartConfig, setChartConfig] = useState<ChartConfig>({
    type: 'composed',
    primaryMetric: 'spend',
    secondaryMetric: businessModel === 'ecommerce' ? 'conversion_value' : 'conversions',
    primaryColor: '#8b5cf6',
    secondaryColor: '#22c55e',
    showGrid: true,
  });

  const { dailyData, totals, loading: metricsLoading, loadMetrics, getAvailableDateRange } = usePDFMetrics(projectId);
  const pdfChartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && projectId) {
      getAvailableDateRange().then(range => {
        if (range) setDateRange({ from: new Date(range.minDate), to: new Date(range.maxDate) });
      });
    }
  }, [open, projectId, getAvailableDateRange]);

  useEffect(() => {
    if (open && projectId && dateRange?.from && dateRange?.to) {
      loadMetrics(format(dateRange.from, 'yyyy-MM-dd'), format(dateRange.to, 'yyyy-MM-dd'));
    }
  }, [open, projectId, dateRange, loadMetrics]);

  const currentMetrics = totals || {
    spend: initialMetrics.totalSpend, impressions: initialMetrics.totalImpressions, clicks: initialMetrics.totalClicks,
    reach: initialMetrics.totalReach, conversions: initialMetrics.totalConversions, conversion_value: initialMetrics.totalConversionValue,
    ctr: initialMetrics.ctr, cpm: initialMetrics.cpm, cpc: initialMetrics.cpc, roas: initialMetrics.roas, cpa: initialMetrics.cpa, frequency: initialMetrics.avgFrequency || 0,
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setLogoFile(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const formatCurrencyValue = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
  const formatNumber = (num: number) => num >= 1000000 ? (num / 1000000).toFixed(1) + 'M' : num >= 1000 ? (num / 1000).toFixed(1) + 'K' : num.toLocaleString('pt-BR');

  const availableMetrics = useMemo(() => {
    const base = [
      { key: 'spend' as MetricKey, label: 'Gasto Total', value: formatCurrencyValue(currentMetrics.spend) },
      { key: 'impressions' as MetricKey, label: 'Impressões', value: formatNumber(currentMetrics.impressions) },
      { key: 'clicks' as MetricKey, label: 'Cliques', value: formatNumber(currentMetrics.clicks) },
      { key: 'reach' as MetricKey, label: 'Alcance', value: formatNumber(currentMetrics.reach) },
      { key: 'ctr' as MetricKey, label: 'CTR', value: `${currentMetrics.ctr.toFixed(2)}%` },
      { key: 'cpm' as MetricKey, label: 'CPM', value: formatCurrencyValue(currentMetrics.cpm) },
      { key: 'cpc' as MetricKey, label: 'CPC', value: formatCurrencyValue(currentMetrics.cpc) },
    ];
    if (businessModel === 'ecommerce') return [...base,
      { key: 'conversions' as MetricKey, label: 'Compras', value: formatNumber(currentMetrics.conversions) },
      { key: 'conversion_value' as MetricKey, label: 'Receita', value: formatCurrencyValue(currentMetrics.conversion_value) },
      { key: 'roas' as MetricKey, label: 'ROAS', value: `${currentMetrics.roas.toFixed(2)}x` },
      { key: 'cpa' as MetricKey, label: 'CPA', value: formatCurrencyValue(currentMetrics.cpa) },
    ];
    if (businessModel === 'inside_sales') return [...base,
      { key: 'conversions' as MetricKey, label: 'Leads', value: formatNumber(currentMetrics.conversions) },
      { key: 'cpa' as MetricKey, label: 'CPL', value: formatCurrencyValue(currentMetrics.cpa) },
    ];
    if (businessModel === 'pdv') return [...base,
      { key: 'conversions' as MetricKey, label: 'Visitas', value: formatNumber(currentMetrics.conversions) },
      { key: 'cpa' as MetricKey, label: 'Custo/Visita', value: formatCurrencyValue(currentMetrics.cpa) },
    ];
    return base;
  }, [currentMetrics, businessModel, currency]);

  const chartData = useMemo(() => dailyData.map(d => ({ ...d, date: format(new Date(d.date), 'dd/MM', { locale: ptBR }) })), [dailyData]);

  const renderChart = useCallback(() => {
    if (!chartData.length) return <div className="flex items-center justify-center h-full text-muted-foreground">Sem dados</div>;
    const ChartComponent = chartConfig.type === 'line' ? RechartsLineChart : chartConfig.type === 'bar' ? RechartsBarChart : chartConfig.type === 'area' ? RechartsAreaChart : ComposedChart;
    return (
      <ChartComponent data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        {chartConfig.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />}
        <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="left" tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false} />
        {chartConfig.secondaryMetric !== 'none' && <YAxis yAxisId="right" orientation="right" tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false} />}
        <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
        <Legend />
        {chartConfig.type === 'bar' || chartConfig.type === 'composed' ? (
          <Bar yAxisId="left" dataKey={chartConfig.primaryMetric} fill={chartConfig.primaryColor} radius={[4, 4, 0, 0]} name={metricLabels[chartConfig.primaryMetric]} />
        ) : chartConfig.type === 'area' ? (
          <Area yAxisId="left" type="monotone" dataKey={chartConfig.primaryMetric} stroke={chartConfig.primaryColor} fill={chartConfig.primaryColor} fillOpacity={0.3} name={metricLabels[chartConfig.primaryMetric]} />
        ) : (
          <Line yAxisId="left" type="monotone" dataKey={chartConfig.primaryMetric} stroke={chartConfig.primaryColor} strokeWidth={2} dot={false} name={metricLabels[chartConfig.primaryMetric]} />
        )}
        {chartConfig.secondaryMetric !== 'none' && (
          <Line yAxisId="right" type="monotone" dataKey={chartConfig.secondaryMetric} stroke={chartConfig.secondaryColor} strokeWidth={2} dot={false} name={metricLabels[chartConfig.secondaryMetric]} />
        )}
      </ChartComponent>
    );
  }, [chartData, chartConfig]);

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;
      let yPos = margin;

      if (sections.header) {
        if (logoFile) { try { pdf.addImage(logoFile, 'PNG', margin, yPos, 25, 25); } catch {} }
        pdf.setFontSize(18); pdf.setFont('helvetica', 'bold');
        pdf.text(reportTitle, logoFile ? margin + 30 : margin, yPos + 10);
        pdf.setFontSize(10); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(100);
        const periodText = dateRange?.from && dateRange?.to ? `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}` : periodLabel;
        pdf.text(periodText, logoFile ? margin + 30 : margin, yPos + 18);
        pdf.setTextColor(0); yPos += 35;
        pdf.setDrawColor(200); pdf.line(margin, yPos, pageWidth - margin, yPos); yPos += 8;
      }

      if (sections.summary) {
        pdf.setFontSize(12); pdf.setFont('helvetica', 'bold'); pdf.text('Resumo', margin, yPos); yPos += 6;
        pdf.setFontSize(9); pdf.setFont('helvetica', 'normal');
        const summary = businessModel === 'ecommerce' ? `Investimento: ${formatCurrencyValue(currentMetrics.spend)} | Vendas: ${formatNumber(currentMetrics.conversions)} | Receita: ${formatCurrencyValue(currentMetrics.conversion_value)} | ROAS: ${currentMetrics.roas.toFixed(2)}x`
          : businessModel === 'inside_sales' ? `Investimento: ${formatCurrencyValue(currentMetrics.spend)} | Leads: ${formatNumber(currentMetrics.conversions)} | CPL: ${formatCurrencyValue(currentMetrics.cpa)}`
          : `Investimento: ${formatCurrencyValue(currentMetrics.spend)} | Alcance: ${formatNumber(currentMetrics.reach)} | Cliques: ${formatNumber(currentMetrics.clicks)}`;
        pdf.text(summary, margin, yPos); yPos += 12;
      }

      if (sections.generalMetrics) {
        pdf.setFontSize(12); pdf.setFont('helvetica', 'bold'); pdf.text('Métricas Gerais', margin, yPos); yPos += 8;
        const cardW = (pageWidth - margin * 2 - 6) / 4;
        availableMetrics.slice(0, 7).forEach((m, i) => {
          const col = i % 4; const row = Math.floor(i / 4);
          const x = margin + col * (cardW + 2); const y = yPos + row * 18;
          pdf.setFillColor(248, 248, 248); pdf.roundedRect(x, y, cardW, 16, 2, 2, 'F');
          pdf.setFontSize(7); pdf.setTextColor(100); pdf.text(m.label, x + 2, y + 5);
          pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0); pdf.text(m.value, x + 2, y + 12);
          pdf.setFont('helvetica', 'normal');
        });
        yPos += Math.ceil(Math.min(availableMetrics.length, 7) / 4) * 18 + 8;
      }

      if (sections.resultMetrics && businessModel && availableMetrics.length > 7) {
        pdf.setFontSize(12); pdf.setFont('helvetica', 'bold'); pdf.text('Métricas de Resultado', margin, yPos); yPos += 8;
        const cardW = (pageWidth - margin * 2 - 6) / 4;
        availableMetrics.slice(7).forEach((m, i) => {
          const x = margin + i * (cardW + 2);
          pdf.setFillColor(240, 250, 240); pdf.roundedRect(x, yPos, cardW, 16, 2, 2, 'F');
          pdf.setFontSize(7); pdf.setTextColor(100); pdf.text(m.label, x + 2, yPos + 5);
          pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0); pdf.text(m.value, x + 2, yPos + 12);
          pdf.setFont('helvetica', 'normal');
        });
        yPos += 24;
      }

      if (sections.chart && pdfChartRef.current) {
        pdf.setFontSize(12); pdf.setFont('helvetica', 'bold'); pdf.text('Evolução Diária', margin, yPos); yPos += 6;
        try {
          const html2canvas = (await import('html2canvas')).default;
          const canvas = await html2canvas(pdfChartRef.current, { backgroundColor: '#0a0a0a', scale: 3 });
          const imgData = canvas.toDataURL('image/png');
          const imgWidth = pageWidth - margin * 2;
          const imgHeight = (canvas.height / canvas.width) * imgWidth;
          pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, Math.min(imgHeight, 70));
        } catch (e) { console.error(e); }
      }

      pdf.save(`${reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } finally { setGenerating(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2"><FileText className="w-4 h-4" />Exportar PDF</Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5" />Construtor de Relatório PDF</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(90vh-120px)]">
          <div className="space-y-4 overflow-y-auto pr-2">
            <Tabs defaultValue="content" className="w-full">
              <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="content">Conteúdo</TabsTrigger><TabsTrigger value="chart">Gráfico</TabsTrigger><TabsTrigger value="style">Estilo</TabsTrigger></TabsList>
              <TabsContent value="content" className="space-y-4 mt-4">
                <div className="space-y-2"><Label>Título</Label><Input value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} /></div>
                <div className="space-y-2">
                  <Label>Período</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start", !dateRange && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (dateRange.to ? `${format(dateRange.from, "dd/MM/yy")} - ${format(dateRange.to, "dd/MM/yy")}` : format(dateRange.from, "dd/MM/yy")) : "Selecione"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start"><Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ptBR} className="pointer-events-auto" /></PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2"><Label>Logo</Label><Input type="file" accept="image/*" onChange={handleLogoUpload} />{logoFile && <img src={logoFile} alt="Logo" className="h-10" />}</div>
                <Separator />
                <div className="space-y-3"><Label>Seções</Label>
                  {[{ key: 'header', label: 'Cabeçalho' }, { key: 'summary', label: 'Resumo' }, { key: 'generalMetrics', label: 'Métricas Gerais' }, { key: 'resultMetrics', label: 'Métricas Resultado' }, { key: 'chart', label: 'Gráfico' }].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between"><Label>{label}</Label><Switch checked={sections[key as keyof typeof sections]} onCheckedChange={(c) => setSections(p => ({ ...p, [key]: c }))} /></div>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="chart" className="space-y-4 mt-4">
                <div className="space-y-2"><Label>Tipo</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['line', 'bar', 'area', 'composed'] as ChartType[]).map(t => { const Icon = chartTypeIcons[t]; return (
                      <Button key={t} variant={chartConfig.type === t ? 'default' : 'outline'} size="sm" className="flex flex-col gap-1 h-auto py-2" onClick={() => setChartConfig(p => ({ ...p, type: t }))}>
                        <Icon className="w-4 h-4" /><span className="text-xs">{t === 'composed' ? 'Misto' : t === 'line' ? 'Linha' : t === 'bar' ? 'Barra' : 'Área'}</span>
                      </Button>
                    ); })}
                  </div>
                </div>
                <div className="space-y-2"><Label>Métrica Principal</Label>
                  <Select value={chartConfig.primaryMetric} onValueChange={(v) => setChartConfig(p => ({ ...p, primaryMetric: v as MetricKey }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{availableMetrics.map(m => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Métrica Secundária</Label>
                  <Select value={chartConfig.secondaryMetric} onValueChange={(v) => setChartConfig(p => ({ ...p, secondaryMetric: v as MetricKey | 'none' }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Nenhuma</SelectItem>{availableMetrics.filter(m => m.key !== chartConfig.primaryMetric).map(m => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between"><Label>Mostrar Grade</Label><Switch checked={chartConfig.showGrid} onCheckedChange={(c) => setChartConfig(p => ({ ...p, showGrid: c }))} /></div>
              </TabsContent>
              <TabsContent value="style" className="space-y-4 mt-4">
                <div className="space-y-2"><Label>Cor Principal</Label><div className="flex gap-2 flex-wrap">{colorPresets.map(c => <button key={c} className={cn("w-8 h-8 rounded-full border-2", chartConfig.primaryColor === c ? "border-white scale-110" : "border-transparent")} style={{ backgroundColor: c }} onClick={() => setChartConfig(p => ({ ...p, primaryColor: c }))} />)}</div></div>
                <div className="space-y-2"><Label>Cor Secundária</Label><div className="flex gap-2 flex-wrap">{colorPresets.map(c => <button key={c} className={cn("w-8 h-8 rounded-full border-2", chartConfig.secondaryColor === c ? "border-white scale-110" : "border-transparent")} style={{ backgroundColor: c }} onClick={() => setChartConfig(p => ({ ...p, secondaryColor: c }))} />)}</div></div>
              </TabsContent>
            </Tabs>
          </div>
          <div className="border rounded-lg bg-card overflow-hidden flex flex-col">
            <div className="p-3 border-b bg-muted/50 flex items-center justify-between"><span className="text-sm font-medium">Preview</span>{metricsLoading && <Loader2 className="w-4 h-4 animate-spin" />}</div>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4 bg-background min-h-full text-sm">
                {sections.header && <div className="flex items-start gap-3">{logoFile && <img src={logoFile} alt="Logo" className="h-10 w-10 object-contain" />}<div><h1 className="text-lg font-bold">{reportTitle}</h1><p className="text-xs text-muted-foreground">{dateRange?.from && dateRange?.to ? `${format(dateRange.from, "dd/MM/yy")} - ${format(dateRange.to, "dd/MM/yy")}` : periodLabel}</p></div></div>}
                {sections.header && <Separator />}
                {sections.summary && <div className="p-2 bg-muted/30 rounded text-xs">{businessModel === 'ecommerce' ? `Investimento ${formatCurrencyValue(currentMetrics.spend)} → ${formatNumber(currentMetrics.conversions)} vendas, ${formatCurrencyValue(currentMetrics.conversion_value)} receita, ROAS ${currentMetrics.roas.toFixed(2)}x` : businessModel === 'inside_sales' ? `Investimento ${formatCurrencyValue(currentMetrics.spend)} → ${formatNumber(currentMetrics.conversions)} leads, CPL ${formatCurrencyValue(currentMetrics.cpa)}` : `Investimento ${formatCurrencyValue(currentMetrics.spend)} → ${formatNumber(currentMetrics.reach)} alcance, ${formatNumber(currentMetrics.clicks)} cliques`}</div>}
                {sections.generalMetrics && <div className="space-y-1"><h2 className="text-xs font-semibold">Métricas Gerais</h2><div className="grid grid-cols-3 gap-1">{availableMetrics.slice(0, 6).map(m => <div key={m.key} className="p-1.5 bg-muted/20 rounded text-center"><p className="text-[10px] text-muted-foreground">{m.label}</p><p className="text-xs font-semibold">{m.value}</p></div>)}</div></div>}
                {sections.resultMetrics && businessModel && availableMetrics.length > 7 && <div className="space-y-1"><h2 className="text-xs font-semibold">Métricas de Resultado</h2><div className="grid grid-cols-2 gap-1">{availableMetrics.slice(7).map(m => <div key={m.key} className="p-1.5 bg-green-500/10 rounded text-center"><p className="text-[10px] text-muted-foreground">{m.label}</p><p className="text-xs font-semibold text-green-500">{m.value}</p></div>)}</div></div>}
                {sections.chart && <div className="space-y-1"><h2 className="text-xs font-semibold">Evolução Diária</h2><div ref={pdfChartRef} className="h-40 bg-[#0a0a0a] rounded-lg p-2"><ResponsiveContainer width="100%" height="100%">{renderChart()}</ResponsiveContainer></div></div>}
              </div>
            </ScrollArea>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-3 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={generatePDF} disabled={generating} className="gap-2">{generating ? <><Loader2 className="w-4 h-4 animate-spin" />Gerando...</> : <><Download className="w-4 h-4" />Baixar PDF</>}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
