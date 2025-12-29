import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileDown, 
  BarChart3, 
  LineChart, 
  Table2, 
  TrendingUp,
  Users,
  Loader2,
  Eye,
  Download,
  Upload,
  ShoppingCart,
  Store,
  DollarSign,
  MousePointerClick,
  Target,
  Percent
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface MetricOption {
  id: string;
  label: string;
  icon: React.ElementType;
  enabled: boolean;
  getValue: () => string;
  category: 'general' | 'performance' | 'result';
  businessModels?: ('ecommerce' | 'inside_sales' | 'pdv')[];
}

interface PDFBuilderDialogProps {
  projectName: string;
  periodLabel: string;
  metrics: {
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalReach?: number;
    totalConversions: number;
    totalConversionValue: number;
    ctr: number;
    cpm: number;
    cpc: number;
    cpa: number;
    roas: number;
    avgFrequency?: number;
  };
  businessModel: 'ecommerce' | 'inside_sales' | 'pdv' | null;
  currency?: string;
  chartRef?: React.RefObject<HTMLDivElement>;
}

export function PDFBuilderDialog({ 
  projectName, 
  periodLabel, 
  metrics, 
  businessModel,
  currency = 'BRL',
  chartRef
}: PDFBuilderDialogProps) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [reportTitle, setReportTitle] = useState(`Relatório de Performance - ${projectName}`);
  const [includeChart, setIncludeChart] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Reset title when project changes
  useEffect(() => {
    setReportTitle(`Relatório de Performance - ${projectName}`);
  }, [projectName]);

  const formatNum = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString('pt-BR');
  };

  // Dynamic metrics based on business model
  const [metricOptions, setMetricOptions] = useState<MetricOption[]>([]);

  useEffect(() => {
    const baseMetrics: MetricOption[] = [
      // General metrics (always available)
      { 
        id: 'spend', 
        label: 'Investimento Total', 
        icon: DollarSign, 
        enabled: true, 
        getValue: () => formatCurrency(metrics.totalSpend, currency),
        category: 'general'
      },
      { 
        id: 'impressions', 
        label: 'Impressões', 
        icon: Eye, 
        enabled: true, 
        getValue: () => formatNum(metrics.totalImpressions),
        category: 'general'
      },
      { 
        id: 'clicks', 
        label: 'Cliques', 
        icon: MousePointerClick, 
        enabled: true, 
        getValue: () => formatNum(metrics.totalClicks),
        category: 'general'
      },
      { 
        id: 'reach', 
        label: 'Alcance', 
        icon: Users, 
        enabled: false, 
        getValue: () => formatNum(metrics.totalReach || 0),
        category: 'general'
      },
      
      // Performance metrics
      { 
        id: 'ctr', 
        label: 'CTR', 
        icon: Target, 
        enabled: true, 
        getValue: () => `${metrics.ctr.toFixed(2)}%`,
        category: 'performance'
      },
      { 
        id: 'cpm', 
        label: 'CPM', 
        icon: Eye, 
        enabled: true, 
        getValue: () => formatCurrency(metrics.cpm, currency),
        category: 'performance'
      },
      { 
        id: 'cpc', 
        label: 'CPC', 
        icon: MousePointerClick, 
        enabled: true, 
        getValue: () => formatCurrency(metrics.cpc, currency),
        category: 'performance'
      },
      { 
        id: 'frequency', 
        label: 'Frequência', 
        icon: Percent, 
        enabled: false, 
        getValue: () => (metrics.avgFrequency || 0).toFixed(2),
        category: 'performance'
      },
    ];

    // Result metrics based on business model
    const resultMetrics: MetricOption[] = [];

    if (businessModel === 'ecommerce') {
      resultMetrics.push(
        { 
          id: 'roas', 
          label: 'ROAS', 
          icon: TrendingUp, 
          enabled: true, 
          getValue: () => `${metrics.roas.toFixed(2)}x`,
          category: 'result',
          businessModels: ['ecommerce']
        },
        { 
          id: 'purchases', 
          label: 'Compras', 
          icon: ShoppingCart, 
          enabled: true, 
          getValue: () => formatNum(metrics.totalConversions),
          category: 'result',
          businessModels: ['ecommerce']
        },
        { 
          id: 'revenue', 
          label: 'Receita Total', 
          icon: DollarSign, 
          enabled: true, 
          getValue: () => formatCurrency(metrics.totalConversionValue, currency),
          category: 'result',
          businessModels: ['ecommerce']
        },
        { 
          id: 'cpa', 
          label: 'CPA (Custo por Compra)', 
          icon: Target, 
          enabled: true, 
          getValue: () => formatCurrency(metrics.cpa, currency),
          category: 'result',
          businessModels: ['ecommerce']
        }
      );
    } else if (businessModel === 'inside_sales') {
      resultMetrics.push(
        { 
          id: 'leads', 
          label: 'Leads Gerados', 
          icon: Users, 
          enabled: true, 
          getValue: () => formatNum(metrics.totalConversions),
          category: 'result',
          businessModels: ['inside_sales']
        },
        { 
          id: 'cpl', 
          label: 'CPL (Custo por Lead)', 
          icon: Target, 
          enabled: true, 
          getValue: () => formatCurrency(metrics.cpa, currency),
          category: 'result',
          businessModels: ['inside_sales']
        }
      );
    } else if (businessModel === 'pdv') {
      resultMetrics.push(
        { 
          id: 'visits', 
          label: 'Visitas na Loja', 
          icon: Store, 
          enabled: true, 
          getValue: () => formatNum(metrics.totalConversions),
          category: 'result',
          businessModels: ['pdv']
        },
        { 
          id: 'cpv', 
          label: 'Custo por Visita', 
          icon: Target, 
          enabled: true, 
          getValue: () => formatCurrency(metrics.cpa, currency),
          category: 'result',
          businessModels: ['pdv']
        }
      );
    }

    setMetricOptions([...baseMetrics, ...resultMetrics]);
  }, [businessModel, metrics, currency]);

  const toggleMetric = (metricId: string) => {
    setMetricOptions(prev => prev.map(m => 
      m.id === metricId ? { ...m, enabled: !m.enabled } : m
    ));
  };

  const [chartStyles, setChartStyles] = useState({
    primaryColor: '#ef4444',
    secondaryColor: '#22c55e',
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const captureChart = async (): Promise<string | null> => {
    if (!chartRef?.current || !includeChart) return null;
    
    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#1a1a1a',
        scale: 2,
        logging: false,
      });
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Error capturing chart:', error);
      return null;
    }
  };

  const generatePDF = async () => {
    setGenerating(true);
    
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      let yPos = margin;

      // Colors
      const primaryColor = [239, 68, 68]; // Red
      const textColor = [30, 30, 30];
      const mutedColor = [120, 120, 120];
      const bgColor = [245, 245, 245];

      // Header
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, pageWidth, 35, 'F');
      
      if (logoUrl) {
        try {
          doc.addImage(logoUrl, 'PNG', margin, 6, 22, 22);
        } catch (e) {
          console.error('Error adding logo:', e);
        }
      }

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(reportTitle, logoUrl ? margin + 28 : margin, 16);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Período: ${periodLabel}`, logoUrl ? margin + 28 : margin, 24);
      
      const modelLabel = businessModel === 'ecommerce' ? 'E-commerce' : 
                        businessModel === 'inside_sales' ? 'Inside Sales' : 
                        businessModel === 'pdv' ? 'PDV' : '';
      if (modelLabel) {
        doc.text(`Modelo: ${modelLabel}`, logoUrl ? margin + 28 : margin, 30);
      }
      
      doc.setFontSize(8);
      const today = new Date().toLocaleDateString('pt-BR', { 
        day: '2-digit', month: 'long', year: 'numeric' 
      });
      doc.text(`Gerado em: ${today}`, pageWidth - margin - 40, 24);
      
      yPos = 45;

      // Get enabled metrics by category
      const enabledGeneral = metricOptions.filter(m => m.enabled && m.category === 'general');
      const enabledPerformance = metricOptions.filter(m => m.enabled && m.category === 'performance');
      const enabledResult = metricOptions.filter(m => m.enabled && m.category === 'result');

      // General Metrics Section
      if (enabledGeneral.length > 0) {
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Métricas Gerais', margin, yPos);
        yPos += 8;

        const cardWidth = (pageWidth - margin * 2 - (enabledGeneral.length - 1) * 4) / enabledGeneral.length;
        
        enabledGeneral.forEach((item, index) => {
          const xPos = margin + (index * (cardWidth + 4));
          
          doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
          doc.roundedRect(xPos, yPos, cardWidth, 22, 2, 2, 'F');
          
          doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.rect(xPos, yPos, 2, 22, 'F');
          
          doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.text(item.label, xPos + 6, yPos + 7);
          
          doc.setTextColor(textColor[0], textColor[1], textColor[2]);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text(item.getValue(), xPos + 6, yPos + 16);
        });

        yPos += 30;
      }

      // Performance Metrics Section
      if (enabledPerformance.length > 0) {
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Métricas de Performance', margin, yPos);
        yPos += 8;

        const cardWidth = (pageWidth - margin * 2 - (enabledPerformance.length - 1) * 4) / enabledPerformance.length;
        
        enabledPerformance.forEach((item, index) => {
          const xPos = margin + (index * (cardWidth + 4));
          
          doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
          doc.roundedRect(xPos, yPos, cardWidth, 22, 2, 2, 'F');
          
          doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.text(item.label, xPos + 5, yPos + 7);
          
          doc.setTextColor(textColor[0], textColor[1], textColor[2]);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text(item.getValue(), xPos + 5, yPos + 16);
        });

        yPos += 30;
      }

      // Result Metrics Section (Business Model Specific)
      if (enabledResult.length > 0) {
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        const resultTitle = businessModel === 'ecommerce' ? 'Resultados E-commerce' : 
                           businessModel === 'inside_sales' ? 'Resultados Inside Sales' : 
                           'Resultados PDV';
        doc.text(resultTitle, margin, yPos);
        yPos += 8;

        const cardWidth = (pageWidth - margin * 2 - (enabledResult.length - 1) * 4) / enabledResult.length;
        
        enabledResult.forEach((item, index) => {
          const xPos = margin + (index * (cardWidth + 4));
          const isHighlight = item.id === 'roas' || item.id === 'revenue' || item.id === 'leads' || item.id === 'visits';
          
          if (isHighlight) {
            doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.roundedRect(xPos, yPos, cardWidth, 26, 2, 2, 'F');
            
            doc.setTextColor(255, 255, 255);
          } else {
            doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
            doc.roundedRect(xPos, yPos, cardWidth, 26, 2, 2, 'F');
            
            doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
          }
          
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text(item.label, xPos + 5, yPos + 9);
          
          if (isHighlight) {
            doc.setTextColor(255, 255, 255);
          } else {
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
          }
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text(item.getValue(), xPos + 5, yPos + 20);
        });

        yPos += 34;
      }

      // Chart capture
      if (includeChart && chartRef?.current) {
        const chartImage = await captureChart();
        if (chartImage) {
          doc.setTextColor(textColor[0], textColor[1], textColor[2]);
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text('Evolução no Período', margin, yPos);
          yPos += 6;

          const chartWidth = pageWidth - margin * 2;
          const chartHeight = 60;
          
          try {
            doc.addImage(chartImage, 'PNG', margin, yPos, chartWidth, chartHeight);
            yPos += chartHeight + 10;
          } catch (e) {
            console.error('Error adding chart to PDF:', e);
          }
        }
      }

      // Footer
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(`${projectName} • Relatório gerado automaticamente`, margin, pageHeight - 5);
      doc.text(`Página 1 de 1`, pageWidth - margin - 18, pageHeight - 5);

      // Download
      const fileName = `relatorio-${projectName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setGenerating(false);
    }
  };

  const enabledMetricsCount = metricOptions.filter(m => m.enabled).length;
  const generalMetrics = metricOptions.filter(m => m.category === 'general');
  const performanceMetrics = metricOptions.filter(m => m.category === 'performance');
  const resultMetrics = metricOptions.filter(m => m.category === 'result');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileDown className="w-4 h-4" />
          Exportar PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="w-5 h-5 text-primary" />
            PDF Builder - Relatório Personalizado
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="metrics" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="metrics">Métricas</TabsTrigger>
            <TabsTrigger value="options">Opções</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[55vh]">
            <TabsContent value="metrics" className="space-y-6 mt-4 pr-4">
              <p className="text-sm text-muted-foreground">
                Selecione quais métricas deseja incluir no relatório. As métricas de resultado são específicas para o modelo <span className="font-medium text-primary">{businessModel === 'ecommerce' ? 'E-commerce' : businessModel === 'inside_sales' ? 'Inside Sales' : 'PDV'}</span>.
              </p>

              {/* General Metrics */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Table2 className="w-4 h-4 text-muted-foreground" />
                  Métricas Gerais
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {generalMetrics.map((metric) => {
                    const Icon = metric.icon;
                    return (
                      <div 
                        key={metric.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer",
                          metric.enabled 
                            ? "border-primary/50 bg-primary/5" 
                            : "border-border hover:border-primary/30"
                        )}
                        onClick={() => toggleMetric(metric.id)}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox checked={metric.enabled} />
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{metric.label}</span>
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">
                          {metric.getValue()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Performance Metrics */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  Métricas de Performance
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {performanceMetrics.map((metric) => {
                    const Icon = metric.icon;
                    return (
                      <div 
                        key={metric.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer",
                          metric.enabled 
                            ? "border-primary/50 bg-primary/5" 
                            : "border-border hover:border-primary/30"
                        )}
                        onClick={() => toggleMetric(metric.id)}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox checked={metric.enabled} />
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{metric.label}</span>
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">
                          {metric.getValue()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Result Metrics (Business Model Specific) */}
              {resultMetrics.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    Métricas de Resultado 
                    <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">
                      {businessModel === 'ecommerce' ? 'E-commerce' : businessModel === 'inside_sales' ? 'Inside Sales' : 'PDV'}
                    </span>
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {resultMetrics.map((metric) => {
                      const Icon = metric.icon;
                      return (
                        <div 
                          key={metric.id}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer",
                            metric.enabled 
                              ? "border-primary/50 bg-primary/10" 
                              : "border-border hover:border-primary/30"
                          )}
                          onClick={() => toggleMetric(metric.id)}
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox checked={metric.enabled} />
                            <Icon className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium">{metric.label}</span>
                          </div>
                          <span className="text-xs text-primary font-mono font-medium">
                            {metric.getValue()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="options" className="space-y-4 mt-4 pr-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Título do Relatório</Label>
                <Input 
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  placeholder="Digite o título do relatório"
                />
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Logo do Projeto (opcional)</Label>
                <div className="flex items-center gap-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    {logoUrl ? 'Trocar Logo' : 'Carregar Logo'}
                  </Button>
                  {logoUrl && (
                    <div className="flex items-center gap-2">
                      <img src={logoUrl} alt="Logo" className="h-10 w-auto rounded" />
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setLogoUrl(null)}
                      >
                        Remover
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-lg border">
                <Checkbox 
                  id="includeChart"
                  checked={includeChart}
                  onCheckedChange={(checked) => setIncludeChart(!!checked)}
                />
                <div className="flex-1">
                  <Label htmlFor="includeChart" className="cursor-pointer">
                    Incluir Gráfico de Evolução
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Captura o gráfico de evolução diária do dashboard e adiciona ao PDF
                  </p>
                </div>
                <LineChart className="w-5 h-5 text-muted-foreground" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Cor Principal</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={chartStyles.primaryColor}
                      onChange={(e) => setChartStyles(prev => ({ ...prev, primaryColor: e.target.value }))}
                      className="w-10 h-10 rounded cursor-pointer"
                    />
                    <span className="text-sm text-muted-foreground">{chartStyles.primaryColor}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block">Cor de Destaque</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={chartStyles.secondaryColor}
                      onChange={(e) => setChartStyles(prev => ({ ...prev, secondaryColor: e.target.value }))}
                      className="w-10 h-10 rounded cursor-pointer"
                    />
                    <span className="text-sm text-muted-foreground">{chartStyles.secondaryColor}</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="mt-4 pr-4">
              <div className="border rounded-lg p-4 bg-white text-black min-h-[400px] text-sm">
                {/* Preview Header */}
                <div 
                  className="rounded-t-lg p-3 mb-4 flex items-center gap-3"
                  style={{ backgroundColor: chartStyles.primaryColor }}
                >
                  {logoUrl && (
                    <img src={logoUrl} alt="Logo" className="h-10 w-auto rounded" />
                  )}
                  <div className="text-white flex-1">
                    <h2 className="font-bold">{reportTitle}</h2>
                    <div className="flex items-center gap-4 text-xs opacity-90">
                      <span>Período: {periodLabel}</span>
                      {businessModel && (
                        <span>Modelo: {businessModel === 'ecommerce' ? 'E-commerce' : businessModel === 'inside_sales' ? 'Inside Sales' : 'PDV'}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Preview General */}
                {generalMetrics.filter(m => m.enabled).length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-semibold text-xs mb-2 text-gray-600">Métricas Gerais</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {generalMetrics.filter(m => m.enabled).map((item) => (
                        <div 
                          key={item.id} 
                          className="p-2 rounded bg-gray-100 border-l-2"
                          style={{ borderColor: chartStyles.primaryColor }}
                        >
                          <p className="text-[10px] text-gray-500">{item.label}</p>
                          <p className="font-bold text-xs">{item.getValue()}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preview Performance */}
                {performanceMetrics.filter(m => m.enabled).length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-semibold text-xs mb-2 text-gray-600">Performance</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {performanceMetrics.filter(m => m.enabled).map((item) => (
                        <div key={item.id} className="p-2 rounded bg-gray-100">
                          <p className="text-[10px] text-gray-500">{item.label}</p>
                          <p className="font-bold text-xs">{item.getValue()}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preview Results */}
                {resultMetrics.filter(m => m.enabled).length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-semibold text-xs mb-2 text-gray-600">
                      Resultados ({businessModel === 'ecommerce' ? 'E-commerce' : businessModel === 'inside_sales' ? 'Inside Sales' : 'PDV'})
                    </h3>
                    <div className="grid grid-cols-4 gap-2">
                      {resultMetrics.filter(m => m.enabled).map((item) => {
                        const isHighlight = item.id === 'roas' || item.id === 'revenue' || item.id === 'leads' || item.id === 'visits';
                        return (
                          <div 
                            key={item.id} 
                            className={cn("p-2 rounded", isHighlight ? "text-white" : "bg-gray-100")}
                            style={isHighlight ? { backgroundColor: chartStyles.primaryColor } : undefined}
                          >
                            <p className={cn("text-[10px]", isHighlight ? "opacity-80" : "text-gray-500")}>{item.label}</p>
                            <p className="font-bold text-xs">{item.getValue()}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Preview Chart */}
                {includeChart && (
                  <div className="mb-4">
                    <h3 className="font-semibold text-xs mb-2 text-gray-600">Evolução no Período</h3>
                    <div className="h-20 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">
                      <LineChart className="w-5 h-5 mr-2" />
                      Gráfico será capturado do dashboard
                    </div>
                  </div>
                )}

                {enabledMetricsCount === 0 && !includeChart && (
                  <div className="text-center py-8 text-gray-400">
                    <Eye className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>Selecione métricas para visualizar o preview</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            {enabledMetricsCount} métricas selecionadas
            {includeChart && ' • Gráfico incluído'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="gradient" 
              onClick={generatePDF}
              disabled={generating || (enabledMetricsCount === 0 && !includeChart)}
              className="gap-2"
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
