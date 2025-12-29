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
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { usePDFMetrics } from '@/hooks/usePDFMetrics';
import jsPDF from 'jspdf';
import { PDFPreview } from './PDFPreview';
import { 
  ChartConfig, 
  ChartType, 
  MetricKey, 
  MetricItem, 
  PageStyle, 
  PDFBuilderDialogProps,
  METRIC_LABELS, 
  COLOR_PRESETS, 
  PERIOD_PRESETS, 
  FONT_OPTIONS,
  CURRENCY_METRICS 
} from './types';

const chartTypeIcons = {
  line: LineChart,
  bar: BarChart3,
  area: AreaChart,
  composed: TrendingUp,
};

export function PDFBuilderDialog({ 
  projectName, 
  periodLabel, 
  metrics: initialMetrics, 
  businessModel, 
  currency, 
  projectId 
}: PDFBuilderDialogProps) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reportTitle, setReportTitle] = useState(`Relatório - ${projectName}`);
  const [logoFile, setLogoFile] = useState<string | null>(null);
  const [periodPreset, setPeriodPreset] = useState('30d');
  const [showCustomCalendar, setShowCustomCalendar] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const end = new Date();
    const start = subDays(end, 30);
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
  
  // Metric selection
  const [selectedMetrics, setSelectedMetrics] = useState<Set<MetricKey>>(new Set([
    'spend', 'impressions', 'clicks', 'reach', 'ctr', 'cpm', 'cpc', 
    'conversions', 'conversion_value', 'roas', 'cpa'
  ]));
  
  // Chart config
  const [chartConfig, setChartConfig] = useState<ChartConfig>({
    type: 'composed',
    primaryMetric: 'spend',
    secondaryMetric: businessModel === 'ecommerce' ? 'conversion_value' : 'conversions',
    primaryColor: '#dc2626',
    secondaryColor: '#22c55e',
    showGrid: true,
  });

  // Page style - NEW!
  const [pageStyle, setPageStyle] = useState<PageStyle>({
    headerColor: '#dc2626', // V4 Red
    footerColor: '#dc2626', // V4 Red
    accentColor: '#dc2626', // V4 Red
    fontFamily: 'helvetica',
    showHeaderBar: true,
    showFooterBar: true,
  });

  const { dailyData, totals, loading: metricsLoading, loadMetrics, getAvailableDateRange } = usePDFMetrics(projectId);
  const pdfChartRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle period preset change
  const handlePeriodPresetChange = useCallback((value: string) => {
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
      const lastMonth = subMonths(today, 1);
      setDateRange({ from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) });
    } else {
      const preset = PERIOD_PRESETS.find(p => p.value === value);
      if (preset && preset.days > 0) {
        setDateRange({ from: subDays(today, preset.days), to: today });
      }
    }
  }, []);

  useEffect(() => {
    if (open && projectId) {
      getAvailableDateRange().then(range => {
        if (range) {
          // Keep current selection, don't auto-set
        }
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

  // Format with currency symbol when appropriate
  const formatValue = (value: number, metricKey: MetricKey): string => {
    if (CURRENCY_METRICS.includes(metricKey)) {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
    }
    if (metricKey === 'ctr') {
      return `${value.toFixed(2)}%`;
    }
    if (metricKey === 'roas') {
      return `${value.toFixed(2)}x`;
    }
    return value >= 1000000 
      ? (value / 1000000).toFixed(1) + 'M' 
      : value >= 1000 
      ? (value / 1000).toFixed(1) + 'K' 
      : value.toLocaleString('pt-BR');
  };

  // Build metrics list
  const allMetrics: MetricItem[] = useMemo(() => {
    const base: MetricItem[] = [
      { key: 'spend', label: 'Gasto Total', value: formatValue(currentMetrics.spend, 'spend'), category: 'general', isCurrency: true },
      { key: 'impressions', label: 'Impressões', value: formatValue(currentMetrics.impressions, 'impressions'), category: 'general' },
      { key: 'clicks', label: 'Cliques', value: formatValue(currentMetrics.clicks, 'clicks'), category: 'general' },
      { key: 'reach', label: 'Alcance', value: formatValue(currentMetrics.reach, 'reach'), category: 'general' },
      { key: 'ctr', label: 'CTR', value: formatValue(currentMetrics.ctr, 'ctr'), category: 'general' },
      { key: 'cpm', label: 'CPM', value: formatValue(currentMetrics.cpm, 'cpm'), category: 'general', isCurrency: true },
      { key: 'cpc', label: 'CPC', value: formatValue(currentMetrics.cpc, 'cpc'), category: 'general', isCurrency: true },
    ];
    
    if (businessModel === 'ecommerce') {
      return [...base,
        { key: 'conversions' as MetricKey, label: 'Compras', value: formatValue(currentMetrics.conversions, 'conversions'), category: 'result' as const },
        { key: 'conversion_value' as MetricKey, label: 'Receita', value: formatValue(currentMetrics.conversion_value, 'conversion_value'), category: 'result' as const, isCurrency: true },
        { key: 'roas' as MetricKey, label: 'ROAS', value: formatValue(currentMetrics.roas, 'roas'), category: 'result' as const },
        { key: 'cpa' as MetricKey, label: 'CPA', value: formatValue(currentMetrics.cpa, 'cpa'), category: 'result' as const, isCurrency: true },
      ];
    }
    if (businessModel === 'inside_sales') {
      return [...base,
        { key: 'conversions' as MetricKey, label: 'Leads', value: formatValue(currentMetrics.conversions, 'conversions'), category: 'result' as const },
        { key: 'cpa' as MetricKey, label: 'CPL', value: formatValue(currentMetrics.cpa, 'cpa'), category: 'result' as const, isCurrency: true },
      ];
    }
    if (businessModel === 'pdv') {
      return [...base,
        { key: 'conversions' as MetricKey, label: 'Visitas', value: formatValue(currentMetrics.conversions, 'conversions'), category: 'result' as const },
        { key: 'cpa' as MetricKey, label: 'Custo/Visita', value: formatValue(currentMetrics.cpa, 'cpa'), category: 'result' as const, isCurrency: true },
      ];
    }
    return base;
  }, [currentMetrics, businessModel, currency]);

  const filteredMetrics = useMemo(() => allMetrics.filter(m => selectedMetrics.has(m.key)), [allMetrics, selectedMetrics]);
  const generalMetrics = filteredMetrics.filter(m => m.category === 'general');
  const resultMetrics = filteredMetrics.filter(m => m.category === 'result');
  const chartData = useMemo(() => dailyData.map(d => ({ ...d, date: format(new Date(d.date), 'dd/MM', { locale: ptBR }) })), [dailyData]);

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;
      let yPos = margin;

      pdf.setFont(pageStyle.fontFamily);

      // Header bar
      if (pageStyle.showHeaderBar) {
        const [r, g, b] = hexToRgb(pageStyle.headerColor);
        pdf.setFillColor(r, g, b);
        pdf.rect(0, 0, pageWidth, 8, 'F');
        yPos = 12;
      }

      if (sections.header) {
        if (logoFile) { 
          try { pdf.addImage(logoFile, 'PNG', margin, yPos, 25, 25); } catch {} 
        }
        pdf.setFontSize(18); 
        pdf.setFont(pageStyle.fontFamily, 'bold');
        pdf.setTextColor(17, 24, 39);
        pdf.text(reportTitle, logoFile ? margin + 30 : margin, yPos + 10);
        pdf.setFontSize(10); 
        pdf.setFont(pageStyle.fontFamily, 'normal'); 
        pdf.setTextColor(107, 114, 128);
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
        pdf.setFont(pageStyle.fontFamily, 'bold'); 
        pdf.setTextColor(17, 24, 39);
        pdf.text('Resumo Executivo', margin, yPos); 
        yPos += 8;
        
        pdf.setFillColor(249, 250, 251);
        pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 15, 2, 2, 'F');
        
        pdf.setFontSize(9); 
        pdf.setFont(pageStyle.fontFamily, 'normal');
        pdf.setTextColor(55, 65, 81);
        const summary = businessModel === 'ecommerce' 
          ? `Investimento: ${formatValue(currentMetrics.spend, 'spend')} | Vendas: ${formatValue(currentMetrics.conversions, 'conversions')} | Receita: ${formatValue(currentMetrics.conversion_value, 'conversion_value')} | ROAS: ${formatValue(currentMetrics.roas, 'roas')}`
          : businessModel === 'inside_sales' 
          ? `Investimento: ${formatValue(currentMetrics.spend, 'spend')} | Leads: ${formatValue(currentMetrics.conversions, 'conversions')} | CPL: ${formatValue(currentMetrics.cpa, 'cpa')}`
          : `Investimento: ${formatValue(currentMetrics.spend, 'spend')} | Alcance: ${formatValue(currentMetrics.reach, 'reach')} | Cliques: ${formatValue(currentMetrics.clicks, 'clicks')}`;
        pdf.text(summary, margin + 5, yPos + 9); 
        yPos += 22;
      }

      if (sections.generalMetrics && generalMetrics.length > 0) {
        pdf.setFontSize(12); 
        pdf.setFont(pageStyle.fontFamily, 'bold'); 
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
          pdf.setFont(pageStyle.fontFamily, 'bold'); 
          pdf.setTextColor(17, 24, 39); 
          pdf.text(m.value, x + 3, y + 14);
          pdf.setFont(pageStyle.fontFamily, 'normal');
        });
        yPos += Math.ceil(generalMetrics.length / 4) * 20 + 8;
      }

      if (sections.resultMetrics && resultMetrics.length > 0) {
        pdf.setFontSize(12); 
        pdf.setFont(pageStyle.fontFamily, 'bold'); 
        pdf.setTextColor(17, 24, 39);
        const resultLabel = businessModel === 'ecommerce' ? 'E-commerce' : businessModel === 'inside_sales' ? 'Inside Sales' : 'PDV';
        pdf.text(`Métricas de Resultado (${resultLabel})`, margin, yPos); 
        yPos += 8;
        
        const cardW = (pageWidth - margin * 2 - 9) / 4;
        const [ar, ag, ab] = hexToRgb(pageStyle.accentColor);
        
        resultMetrics.forEach((m, i) => {
          const x = margin + i * (cardW + 3);
          // Use accent color with light opacity
          pdf.setFillColor(254, 242, 242); 
          pdf.roundedRect(x, yPos, cardW, 18, 2, 2, 'F');
          pdf.setFontSize(8); 
          pdf.setTextColor(107, 114, 128); 
          pdf.text(m.label, x + 3, yPos + 6);
          pdf.setFontSize(11); 
          pdf.setFont(pageStyle.fontFamily, 'bold'); 
          pdf.setTextColor(ar, ag, ab); // Accent color
          pdf.text(m.value, x + 3, yPos + 14);
          pdf.setFont(pageStyle.fontFamily, 'normal');
        });
        yPos += 26;
      }

      if (sections.chart && pdfChartRef.current) {
        pdf.setFontSize(12); 
        pdf.setFont(pageStyle.fontFamily, 'bold'); 
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

      // Footer bar
      const pageHeight = pdf.internal.pageSize.getHeight();
      if (pageStyle.showFooterBar) {
        const [r, g, b] = hexToRgb(pageStyle.footerColor);
        pdf.setFillColor(r, g, b);
        pdf.rect(0, pageHeight - 8, pageWidth, 8, 'F');
      }
      
      // Footer text
      pdf.setFontSize(8);
      pdf.setTextColor(156, 163, 175);
      pdf.text(`${projectName} • Relatório gerado automaticamente`, pageWidth / 2, pageHeight - (pageStyle.showFooterBar ? 12 : 10), { align: 'center' });

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
              
              {/* CONTENT TAB */}
              <TabsContent value="content" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Título do Relatório</Label>
                  <Input value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} />
                </div>
                
                {/* Period Presets */}
                <div className="space-y-2">
                  <Label>Período</Label>
                  <Select value={periodPreset} onValueChange={handlePeriodPresetChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o período" />
                    </SelectTrigger>
                    <SelectContent>
                      {PERIOD_PRESETS.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* Custom Calendar */}
                  {showCustomCalendar && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start mt-2", !dateRange && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange?.from ? (dateRange.to ? `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}` : format(dateRange.from, "dd/MM/yyyy")) : "Selecione as datas"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ptBR} className="pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  )}
                  
                  {/* Show selected period */}
                  {dateRange?.from && dateRange?.to && !showCustomCalendar && (
                    <p className="text-xs text-muted-foreground">
                      {format(dateRange.from, "dd/MM/yyyy")} - {format(dateRange.to, "dd/MM/yyyy")}
                    </p>
                  )}
                </div>
                
                {/* Logo Upload */}
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
              
              {/* METRICS TAB */}
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
              
              {/* CHART TAB */}
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

                <Separator />
                
                <div className="space-y-2">
                  <Label>Cor Principal do Gráfico</Label>
                  <div className="flex gap-2 flex-wrap">
                    {COLOR_PRESETS.map(c => (
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
                  <Label>Cor Secundária do Gráfico</Label>
                  <div className="flex gap-2 flex-wrap">
                    {COLOR_PRESETS.map(c => (
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
                
                <div className="flex items-center justify-between">
                  <Label>Mostrar Grade</Label>
                  <Switch checked={chartConfig.showGrid} onCheckedChange={(c) => setChartConfig(p => ({ ...p, showGrid: c }))} />
                </div>
              </TabsContent>
              
              {/* STYLE TAB - NEW! */}
              <TabsContent value="style" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipografia</Label>
                    <Select value={pageStyle.fontFamily} onValueChange={(v) => setPageStyle(p => ({ ...p, fontFamily: v as 'helvetica' | 'times' | 'courier' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FONT_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />
                  
                  <div className="space-y-2">
                    <Label>Cor do Cabeçalho (Barra superior)</Label>
                    <div className="flex gap-2 flex-wrap">
                      {COLOR_PRESETS.map(c => (
                        <button 
                          key={c} 
                          className={cn(
                            "w-8 h-8 rounded-full border-2 transition-all hover:scale-110",
                            pageStyle.headerColor === c ? "border-foreground scale-110" : "border-transparent"
                          )} 
                          style={{ backgroundColor: c }} 
                          onClick={() => setPageStyle(p => ({ ...p, headerColor: c }))} 
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <Label className="text-sm">Mostrar barra do cabeçalho</Label>
                      <Switch checked={pageStyle.showHeaderBar} onCheckedChange={(c) => setPageStyle(p => ({ ...p, showHeaderBar: c }))} />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Cor do Rodapé (Barra inferior)</Label>
                    <div className="flex gap-2 flex-wrap">
                      {COLOR_PRESETS.map(c => (
                        <button 
                          key={c} 
                          className={cn(
                            "w-8 h-8 rounded-full border-2 transition-all hover:scale-110",
                            pageStyle.footerColor === c ? "border-foreground scale-110" : "border-transparent"
                          )} 
                          style={{ backgroundColor: c }} 
                          onClick={() => setPageStyle(p => ({ ...p, footerColor: c }))} 
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <Label className="text-sm">Mostrar barra do rodapé</Label>
                      <Switch checked={pageStyle.showFooterBar} onCheckedChange={(c) => setPageStyle(p => ({ ...p, showFooterBar: c }))} />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Cor de Destaque (Métricas de resultado)</Label>
                    <div className="flex gap-2 flex-wrap">
                      {COLOR_PRESETS.map(c => (
                        <button 
                          key={c} 
                          className={cn(
                            "w-8 h-8 rounded-full border-2 transition-all hover:scale-110",
                            pageStyle.accentColor === c ? "border-foreground scale-110" : "border-transparent"
                          )} 
                          style={{ backgroundColor: c }} 
                          onClick={() => setPageStyle(p => ({ ...p, accentColor: c }))} 
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          
          {/* Preview Panel */}
          <div className="border rounded-lg overflow-hidden flex flex-col">
            <div className="p-3 border-b bg-muted/50 flex items-center justify-between">
              <span className="text-sm font-medium">Preview do PDF</span>
              {metricsLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
            <ScrollArea className="flex-1">
              <PDFPreview
                ref={pdfChartRef}
                reportTitle={reportTitle}
                dateRange={dateRange}
                periodLabel={periodLabel}
                logoFile={logoFile}
                sections={sections}
                generalMetrics={generalMetrics}
                resultMetrics={resultMetrics}
                currentMetrics={currentMetrics}
                businessModel={businessModel}
                currency={currency}
                chartConfig={chartConfig}
                chartData={chartData}
                pageStyle={pageStyle}
              />
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

// Helper function to convert hex to RGB
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result 
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [220, 38, 38]; // Default to V4 red
}
