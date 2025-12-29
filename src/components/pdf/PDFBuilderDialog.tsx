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
import { FileText, Download, Loader2, CalendarIcon, BarChart3, LineChart, AreaChart, TrendingUp, Upload, ImageIcon } from 'lucide-react';
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

// V4 Company colors - Red primary
const colorPresets = [
  '#dc2626', // Red (V4 Primary)
  '#ef4444', // Red lighter
  '#1f2937', // Dark gray
  '#374151', // Gray
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#f59e0b', // Amber
];

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
  
  // Sections
  const [sections, setSections] = useState({ 
    header: true, 
    summary: true, 
    generalMetrics: true, 
    resultMetrics: true, 
    chart: true 
  });
  
  // Metric selection (which metrics to show)
  const [selectedMetrics, setSelectedMetrics] = useState<Set<MetricKey>>(new Set([
    'spend', 'impressions', 'clicks', 'reach', 'ctr', 'cpm', 'cpc', 
    'conversions', 'conversion_value', 'roas', 'cpa'
  ]));
  
  // Chart config - V4 Red as default
  const [chartConfig, setChartConfig] = useState<ChartConfig>({
    type: 'composed',
    primaryMetric: 'spend',
    secondaryMetric: businessModel === 'ecommerce' ? 'conversion_value' : 'conversions',
    primaryColor: '#dc2626', // V4 Red
    secondaryColor: '#22c55e', // Green
    showGrid: true,
  });

  const { dailyData, totals, loading: metricsLoading, loadMetrics, getAvailableDateRange } = usePDFMetrics(projectId);
  const pdfChartRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      reader.onload = (event) => setLogoFile(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const toggleMetric = (key: MetricKey) => {
    setSelectedMetrics(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const formatCurrencyValue = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
  const formatNumber = (num: number) => num >= 1000000 ? (num / 1000000).toFixed(1) + 'M' : num >= 1000 ? (num / 1000).toFixed(1) + 'K' : num.toLocaleString('pt-BR');

  // All available metrics based on business model
  const allMetrics = useMemo(() => {
    const base: { key: MetricKey; label: string; value: string; category: 'general' | 'result' }[] = [
      { key: 'spend', label: 'Gasto Total', value: formatCurrencyValue(currentMetrics.spend), category: 'general' },
      { key: 'impressions', label: 'Impressões', value: formatNumber(currentMetrics.impressions), category: 'general' },
      { key: 'clicks', label: 'Cliques', value: formatNumber(currentMetrics.clicks), category: 'general' },
      { key: 'reach', label: 'Alcance', value: formatNumber(currentMetrics.reach), category: 'general' },
      { key: 'ctr', label: 'CTR', value: `${currentMetrics.ctr.toFixed(2)}%`, category: 'general' },
      { key: 'cpm', label: 'CPM', value: formatCurrencyValue(currentMetrics.cpm), category: 'general' },
      { key: 'cpc', label: 'CPC', value: formatCurrencyValue(currentMetrics.cpc), category: 'general' },
    ];
    
    if (businessModel === 'ecommerce') {
      return [...base,
        { key: 'conversions' as MetricKey, label: 'Compras', value: formatNumber(currentMetrics.conversions), category: 'result' as const },
        { key: 'conversion_value' as MetricKey, label: 'Receita', value: formatCurrencyValue(currentMetrics.conversion_value), category: 'result' as const },
        { key: 'roas' as MetricKey, label: 'ROAS', value: `${currentMetrics.roas.toFixed(2)}x`, category: 'result' as const },
        { key: 'cpa' as MetricKey, label: 'CPA', value: formatCurrencyValue(currentMetrics.cpa), category: 'result' as const },
      ];
    }
    if (businessModel === 'inside_sales') {
      return [...base,
        { key: 'conversions' as MetricKey, label: 'Leads', value: formatNumber(currentMetrics.conversions), category: 'result' as const },
        { key: 'cpa' as MetricKey, label: 'CPL', value: formatCurrencyValue(currentMetrics.cpa), category: 'result' as const },
      ];
    }
    if (businessModel === 'pdv') {
      return [...base,
        { key: 'conversions' as MetricKey, label: 'Visitas', value: formatNumber(currentMetrics.conversions), category: 'result' as const },
        { key: 'cpa' as MetricKey, label: 'Custo/Visita', value: formatCurrencyValue(currentMetrics.cpa), category: 'result' as const },
      ];
    }
    return base;
  }, [currentMetrics, businessModel, currency]);

  // Filtered metrics based on selection
  const filteredMetrics = useMemo(() => {
    return allMetrics.filter(m => selectedMetrics.has(m.key));
  }, [allMetrics, selectedMetrics]);

  const generalMetrics = filteredMetrics.filter(m => m.category === 'general');
  const resultMetrics = filteredMetrics.filter(m => m.category === 'result');

  const chartData = useMemo(() => dailyData.map(d => ({ ...d, date: format(new Date(d.date), 'dd/MM', { locale: ptBR }) })), [dailyData]);

  // Chart with WHITE background for PDF
  const renderChart = useCallback(() => {
    if (!chartData.length) return <div className="flex items-center justify-center h-full text-gray-500">Sem dados</div>;
    const ChartComponent = chartConfig.type === 'line' ? RechartsLineChart : chartConfig.type === 'bar' ? RechartsBarChart : chartConfig.type === 'area' ? RechartsAreaChart : ComposedChart;
    return (
      <ChartComponent data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        {chartConfig.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
        <XAxis dataKey="date" tick={{ fill: '#374151', fontSize: 10 }} axisLine={{ stroke: '#d1d5db' }} tickLine={{ stroke: '#d1d5db' }} />
        <YAxis yAxisId="left" tick={{ fill: '#374151', fontSize: 10 }} axisLine={{ stroke: '#d1d5db' }} tickLine={{ stroke: '#d1d5db' }} />
        {chartConfig.secondaryMetric !== 'none' && <YAxis yAxisId="right" orientation="right" tick={{ fill: '#374151', fontSize: 10 }} axisLine={{ stroke: '#d1d5db' }} tickLine={{ stroke: '#d1d5db' }} />}
        <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', color: '#111' }} />
        <Legend wrapperStyle={{ color: '#374151' }} />
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

      // White background is default for PDF

      if (sections.header) {
        if (logoFile) { 
          try { pdf.addImage(logoFile, 'PNG', margin, yPos, 25, 25); } catch {} 
        }
        pdf.setFontSize(18); 
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(17, 24, 39); // Dark gray
        pdf.text(reportTitle, logoFile ? margin + 30 : margin, yPos + 10);
        pdf.setFontSize(10); 
        pdf.setFont('helvetica', 'normal'); 
        pdf.setTextColor(107, 114, 128); // Gray
        const periodText = dateRange?.from && dateRange?.to 
          ? `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}` 
          : periodLabel;
        pdf.text(periodText, logoFile ? margin + 30 : margin, yPos + 18);
        pdf.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, logoFile ? margin + 30 : margin, yPos + 25);
        pdf.setTextColor(0); 
        yPos += 38;
        pdf.setDrawColor(229, 231, 235); 
        pdf.line(margin, yPos, pageWidth - margin, yPos); 
        yPos += 8;
      }

      if (sections.summary) {
        pdf.setFontSize(12); 
        pdf.setFont('helvetica', 'bold'); 
        pdf.setTextColor(17, 24, 39);
        pdf.text('Resumo Executivo', margin, yPos); 
        yPos += 8;
        
        pdf.setFillColor(249, 250, 251);
        pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 15, 2, 2, 'F');
        
        pdf.setFontSize(9); 
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(55, 65, 81);
        const summary = businessModel === 'ecommerce' 
          ? `Investimento: ${formatCurrencyValue(currentMetrics.spend)} | Vendas: ${formatNumber(currentMetrics.conversions)} | Receita: ${formatCurrencyValue(currentMetrics.conversion_value)} | ROAS: ${currentMetrics.roas.toFixed(2)}x`
          : businessModel === 'inside_sales' 
          ? `Investimento: ${formatCurrencyValue(currentMetrics.spend)} | Leads: ${formatNumber(currentMetrics.conversions)} | CPL: ${formatCurrencyValue(currentMetrics.cpa)}`
          : `Investimento: ${formatCurrencyValue(currentMetrics.spend)} | Alcance: ${formatNumber(currentMetrics.reach)} | Cliques: ${formatNumber(currentMetrics.clicks)}`;
        pdf.text(summary, margin + 5, yPos + 9); 
        yPos += 22;
      }

      if (sections.generalMetrics && generalMetrics.length > 0) {
        pdf.setFontSize(12); 
        pdf.setFont('helvetica', 'bold'); 
        pdf.setTextColor(17, 24, 39);
        pdf.text('Métricas Gerais', margin, yPos); 
        yPos += 8;
        
        const cardW = (pageWidth - margin * 2 - 9) / 4;
        generalMetrics.forEach((m, i) => {
          const col = i % 4; 
          const row = Math.floor(i / 4);
          const x = margin + col * (cardW + 3); 
          const y = yPos + row * 20;
          
          pdf.setFillColor(249, 250, 251); 
          pdf.roundedRect(x, y, cardW, 18, 2, 2, 'F');
          pdf.setFontSize(8); 
          pdf.setTextColor(107, 114, 128); 
          pdf.text(m.label, x + 3, y + 6);
          pdf.setFontSize(11); 
          pdf.setFont('helvetica', 'bold'); 
          pdf.setTextColor(17, 24, 39); 
          pdf.text(m.value, x + 3, y + 14);
          pdf.setFont('helvetica', 'normal');
        });
        yPos += Math.ceil(generalMetrics.length / 4) * 20 + 8;
      }

      if (sections.resultMetrics && resultMetrics.length > 0) {
        pdf.setFontSize(12); 
        pdf.setFont('helvetica', 'bold'); 
        pdf.setTextColor(17, 24, 39);
        const resultLabel = businessModel === 'ecommerce' ? 'E-commerce' : businessModel === 'inside_sales' ? 'Inside Sales' : 'PDV';
        pdf.text(`Métricas de Resultado (${resultLabel})`, margin, yPos); 
        yPos += 8;
        
        const cardW = (pageWidth - margin * 2 - 9) / 4;
        resultMetrics.forEach((m, i) => {
          const x = margin + i * (cardW + 3);
          // Light red background for V4
          pdf.setFillColor(254, 242, 242); 
          pdf.roundedRect(x, yPos, cardW, 18, 2, 2, 'F');
          pdf.setFontSize(8); 
          pdf.setTextColor(107, 114, 128); 
          pdf.text(m.label, x + 3, yPos + 6);
          pdf.setFontSize(11); 
          pdf.setFont('helvetica', 'bold'); 
          pdf.setTextColor(220, 38, 38); // V4 Red
          pdf.text(m.value, x + 3, yPos + 14);
          pdf.setFont('helvetica', 'normal');
        });
        yPos += 26;
      }

      if (sections.chart && pdfChartRef.current) {
        pdf.setFontSize(12); 
        pdf.setFont('helvetica', 'bold'); 
        pdf.setTextColor(17, 24, 39);
        pdf.text('Evolução Diária', margin, yPos); 
        yPos += 6;
        try {
          const html2canvas = (await import('html2canvas')).default;
          const canvas = await html2canvas(pdfChartRef.current, { 
            backgroundColor: '#ffffff', 
            scale: 3 
          });
          const imgData = canvas.toDataURL('image/png');
          const imgWidth = pageWidth - margin * 2;
          const imgHeight = (canvas.height / canvas.width) * imgWidth;
          pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, Math.min(imgHeight, 75));
        } catch (e) { console.error(e); }
      }

      // Footer
      const pageHeight = pdf.internal.pageSize.getHeight();
      pdf.setFontSize(8);
      pdf.setTextColor(156, 163, 175);
      pdf.text(`${projectName} • Relatório gerado automaticamente`, pageWidth / 2, pageHeight - 10, { align: 'center' });

      pdf.save(`${reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } finally { setGenerating(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileText className="w-4 h-4" />
          Exportar PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-red-600" />
            Construtor de Relatório PDF
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(90vh-120px)]">
          {/* Configuration Panel */}
          <div className="space-y-4 overflow-y-auto pr-2">
            <Tabs defaultValue="content" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="content">Conteúdo</TabsTrigger>
                <TabsTrigger value="metrics">Métricas</TabsTrigger>
                <TabsTrigger value="chart">Gráfico</TabsTrigger>
                <TabsTrigger value="style">Estilo</TabsTrigger>
              </TabsList>
              
              <TabsContent value="content" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Título do Relatório</Label>
                  <Input value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} />
                </div>
                
                <div className="space-y-2">
                  <Label>Período</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start", !dateRange && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (dateRange.to ? `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}` : format(dateRange.from, "dd/MM/yyyy")) : "Selecione o período"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ptBR} className="pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                
                {/* Improved Logo Upload */}
                <div className="space-y-2">
                  <Label>Logo da Empresa</Label>
                  <div className="flex items-center gap-3">
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      accept="image/*" 
                      onChange={handleLogoUpload} 
                      className="hidden"
                    />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      {logoFile ? 'Trocar Logo' : 'Carregar Logo'}
                    </Button>
                    {logoFile && (
                      <Button variant="ghost" size="sm" onClick={() => setLogoFile(null)} className="text-muted-foreground">
                        Remover
                      </Button>
                    )}
                  </div>
                  {logoFile && (
                    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                      <img src={logoFile} alt="Logo" className="h-10 w-10 object-contain rounded" />
                      <span className="text-xs text-muted-foreground">Logo carregado</span>
                    </div>
                  )}
                </div>
                
                <Separator />
                
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Seções do Relatório</Label>
                  {[
                    { key: 'header', label: 'Cabeçalho com Logo' },
                    { key: 'summary', label: 'Resumo Executivo' },
                    { key: 'generalMetrics', label: 'Métricas Gerais' },
                    { key: 'resultMetrics', label: 'Métricas de Resultado' },
                    { key: 'chart', label: 'Gráfico de Evolução' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between">
                      <Label className="cursor-pointer">{label}</Label>
                      <Switch 
                        checked={sections[key as keyof typeof sections]} 
                        onCheckedChange={(c) => setSections(p => ({ ...p, [key]: c }))} 
                      />
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              {/* NEW: Metrics Selection Tab */}
              <TabsContent value="metrics" className="space-y-4 mt-4">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Selecione as Métricas</Label>
                  <p className="text-xs text-muted-foreground">Escolha quais métricas incluir no relatório</p>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground mb-2">MÉTRICAS GERAIS</h4>
                      <div className="space-y-2">
                        {allMetrics.filter(m => m.category === 'general').map(m => (
                          <div key={m.key} className="flex items-center gap-2">
                            <Checkbox 
                              id={m.key}
                              checked={selectedMetrics.has(m.key)}
                              onCheckedChange={() => toggleMetric(m.key)}
                            />
                            <Label htmlFor={m.key} className="text-sm cursor-pointer flex-1">{m.label}</Label>
                            <span className="text-xs text-muted-foreground">{m.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {businessModel && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                          MÉTRICAS DE RESULTADO ({businessModel === 'ecommerce' ? 'E-COMMERCE' : businessModel === 'inside_sales' ? 'INSIDE SALES' : 'PDV'})
                        </h4>
                        <div className="space-y-2">
                          {allMetrics.filter(m => m.category === 'result').map(m => (
                            <div key={m.key} className="flex items-center gap-2">
                              <Checkbox 
                                id={m.key}
                                checked={selectedMetrics.has(m.key)}
                                onCheckedChange={() => toggleMetric(m.key)}
                              />
                              <Label htmlFor={m.key} className="text-sm cursor-pointer flex-1">{m.label}</Label>
                              <span className="text-xs text-red-500 font-medium">{m.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="chart" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Tipo de Gráfico</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['line', 'bar', 'area', 'composed'] as ChartType[]).map(t => { 
                      const Icon = chartTypeIcons[t]; 
                      return (
                        <Button 
                          key={t} 
                          variant={chartConfig.type === t ? 'default' : 'outline'} 
                          size="sm" 
                          className="flex flex-col gap-1 h-auto py-2" 
                          onClick={() => setChartConfig(p => ({ ...p, type: t }))}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-xs">{t === 'composed' ? 'Misto' : t === 'line' ? 'Linha' : t === 'bar' ? 'Barra' : 'Área'}</span>
                        </Button>
                      ); 
                    })}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Métrica Principal</Label>
                  <Select value={chartConfig.primaryMetric} onValueChange={(v) => setChartConfig(p => ({ ...p, primaryMetric: v as MetricKey }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {allMetrics.map(m => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Métrica Secundária</Label>
                  <Select value={chartConfig.secondaryMetric} onValueChange={(v) => setChartConfig(p => ({ ...p, secondaryMetric: v as MetricKey | 'none' }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {allMetrics.filter(m => m.key !== chartConfig.primaryMetric).map(m => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center justify-between">
                  <Label>Mostrar Grade</Label>
                  <Switch checked={chartConfig.showGrid} onCheckedChange={(c) => setChartConfig(p => ({ ...p, showGrid: c }))} />
                </div>
              </TabsContent>
              
              <TabsContent value="style" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Cor Principal (V4 Vermelho como padrão)</Label>
                  <div className="flex gap-2 flex-wrap">
                    {colorPresets.map(c => (
                      <button 
                        key={c} 
                        className={cn(
                          "w-8 h-8 rounded-full border-2 transition-all hover:scale-110",
                          chartConfig.primaryColor === c ? "border-foreground scale-110" : "border-transparent"
                        )} 
                        style={{ backgroundColor: c }} 
                        onClick={() => setChartConfig(p => ({ ...p, primaryColor: c }))} 
                      />
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Cor Secundária</Label>
                  <div className="flex gap-2 flex-wrap">
                    {colorPresets.map(c => (
                      <button 
                        key={c} 
                        className={cn(
                          "w-8 h-8 rounded-full border-2 transition-all hover:scale-110",
                          chartConfig.secondaryColor === c ? "border-foreground scale-110" : "border-transparent"
                        )} 
                        style={{ backgroundColor: c }} 
                        onClick={() => setChartConfig(p => ({ ...p, secondaryColor: c }))} 
                      />
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          
          {/* Preview Panel - WHITE BACKGROUND */}
          <div className="border rounded-lg overflow-hidden flex flex-col">
            <div className="p-3 border-b bg-muted/50 flex items-center justify-between">
              <span className="text-sm font-medium">Preview do PDF</span>
              {metricsLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
            <ScrollArea className="flex-1">
              {/* White background for PDF preview */}
              <div className="p-6 space-y-4 bg-white text-gray-900 min-h-full">
                {/* Header */}
                {sections.header && (
                  <div className="flex items-start gap-4">
                    {logoFile && <img src={logoFile} alt="Logo" className="h-12 w-12 object-contain rounded" />}
                    <div>
                      <h1 className="text-xl font-bold text-gray-900">{reportTitle}</h1>
                      <p className="text-sm text-gray-500">
                        {dateRange?.from && dateRange?.to 
                          ? `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}` 
                          : periodLabel}
                      </p>
                      <p className="text-xs text-gray-400">Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
                    </div>
                  </div>
                )}
                {sections.header && <Separator className="bg-gray-200" />}
                
                {/* Summary */}
                {sections.summary && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <h3 className="text-xs font-semibold text-gray-600 mb-1">Resumo Executivo</h3>
                    <p className="text-sm text-gray-700">
                      {businessModel === 'ecommerce' 
                        ? `Investimento ${formatCurrencyValue(currentMetrics.spend)} → ${formatNumber(currentMetrics.conversions)} vendas, ${formatCurrencyValue(currentMetrics.conversion_value)} receita, ROAS ${currentMetrics.roas.toFixed(2)}x` 
                        : businessModel === 'inside_sales' 
                        ? `Investimento ${formatCurrencyValue(currentMetrics.spend)} → ${formatNumber(currentMetrics.conversions)} leads, CPL ${formatCurrencyValue(currentMetrics.cpa)}` 
                        : `Investimento ${formatCurrencyValue(currentMetrics.spend)} → ${formatNumber(currentMetrics.reach)} alcance, ${formatNumber(currentMetrics.clicks)} cliques`}
                    </p>
                  </div>
                )}
                
                {/* General Metrics */}
                {sections.generalMetrics && generalMetrics.length > 0 && (
                  <div className="space-y-2">
                    <h2 className="text-sm font-semibold text-gray-800">Métricas Gerais</h2>
                    <div className="grid grid-cols-3 gap-2">
                      {generalMetrics.map(m => (
                        <div key={m.key} className="p-2 bg-gray-50 rounded text-center">
                          <p className="text-[10px] text-gray-500">{m.label}</p>
                          <p className="text-sm font-semibold text-gray-900">{m.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Result Metrics */}
                {sections.resultMetrics && resultMetrics.length > 0 && (
                  <div className="space-y-2">
                    <h2 className="text-sm font-semibold text-gray-800">
                      Métricas de Resultado
                    </h2>
                    <div className="grid grid-cols-2 gap-2">
                      {resultMetrics.map(m => (
                        <div key={m.key} className="p-2 bg-red-50 rounded text-center">
                          <p className="text-[10px] text-gray-500">{m.label}</p>
                          <p className="text-sm font-semibold text-red-600">{m.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Chart - WHITE BACKGROUND */}
                {sections.chart && (
                  <div className="space-y-2">
                    <h2 className="text-sm font-semibold text-gray-800">Evolução Diária</h2>
                    <div ref={pdfChartRef} className="h-48 bg-white rounded-lg border border-gray-200 p-3">
                      <ResponsiveContainer width="100%" height="100%">
                        {renderChart()}
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
        
        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button 
            onClick={generatePDF} 
            disabled={generating} 
            className="gap-2 bg-red-600 hover:bg-red-700"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Baixar PDF
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
