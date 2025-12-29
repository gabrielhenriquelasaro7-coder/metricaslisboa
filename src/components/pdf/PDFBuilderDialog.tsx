import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileDown, 
  Image, 
  BarChart3, 
  LineChart, 
  PieChart, 
  Table2, 
  TrendingUp,
  Users,
  Loader2,
  Eye,
  Download,
  Upload
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import jsPDF from 'jspdf';

interface PDFSection {
  id: string;
  label: string;
  icon: React.ElementType;
  enabled: boolean;
  chartType?: 'line' | 'bar' | 'area';
}

interface PDFBuilderDialogProps {
  projectName: string;
  periodLabel: string;
  metrics: {
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    totalConversionValue: number;
    ctr: number;
    cpm: number;
    cpc: number;
    cpa: number;
    roas: number;
  };
  businessModel: 'ecommerce' | 'inside_sales' | 'pdv' | null;
  currency?: string;
}

export function PDFBuilderDialog({ 
  projectName, 
  periodLabel, 
  metrics, 
  businessModel,
  currency = 'BRL'
}: PDFBuilderDialogProps) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [reportTitle, setReportTitle] = useState(`Relatório de Performance - ${projectName}`);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [sections, setSections] = useState<PDFSection[]>([
    { id: 'header', label: 'Cabeçalho com Logo', icon: Image, enabled: true },
    { id: 'summary', label: 'Resumo de Métricas', icon: Table2, enabled: true },
    { id: 'performance', label: 'Métricas de Performance', icon: TrendingUp, enabled: true },
    { id: 'results', label: 'Métricas de Resultado', icon: BarChart3, enabled: true },
    { id: 'demographics', label: 'Dados Demográficos', icon: Users, enabled: false },
  ]);

  const [chartStyles, setChartStyles] = useState({
    primaryColor: '#ef4444',
    secondaryColor: '#22c55e',
    showGrid: true,
    showLabels: true,
  });

  const toggleSection = (sectionId: string) => {
    setSections(prev => prev.map(s => 
      s.id === sectionId ? { ...s, enabled: !s.enabled } : s
    ));
  };

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

  const formatNum = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString('pt-BR');
  };

  const generatePDF = async () => {
    setGenerating(true);
    
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let yPos = margin;

      // Colors
      const primaryColor = [239, 68, 68]; // Red
      const textColor = [30, 30, 30];
      const mutedColor = [120, 120, 120];
      const bgColor = [250, 250, 250];

      // Header Section
      if (sections.find(s => s.id === 'header')?.enabled) {
        // Background header bar
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(0, 0, pageWidth, 40, 'F');
        
        // Logo if uploaded
        if (logoUrl) {
          try {
            doc.addImage(logoUrl, 'PNG', margin, 8, 25, 25);
          } catch (e) {
            console.error('Error adding logo:', e);
          }
        }

        // Title
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(reportTitle, logoUrl ? margin + 32 : margin, 20);
        
        // Period
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(`Período: ${periodLabel}`, logoUrl ? margin + 32 : margin, 28);
        
        // Date
        doc.setFontSize(9);
        const today = new Date().toLocaleDateString('pt-BR', { 
          day: '2-digit', 
          month: 'long', 
          year: 'numeric' 
        });
        doc.text(`Gerado em: ${today}`, pageWidth - margin - 50, 28);
        
        yPos = 55;
      }

      // Summary Section
      if (sections.find(s => s.id === 'summary')?.enabled) {
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Resumo Executivo', margin, yPos);
        yPos += 10;

        // Summary cards
        const summaryData = [
          { label: 'Investimento Total', value: formatCurrency(metrics.totalSpend, currency) },
          { label: 'Impressões', value: formatNum(metrics.totalImpressions) },
          { label: 'Cliques', value: formatNum(metrics.totalClicks) },
          { label: 'CTR', value: `${metrics.ctr.toFixed(2)}%` },
        ];

        const cardWidth = (pageWidth - margin * 2 - 15) / 4;
        
        summaryData.forEach((item, index) => {
          const xPos = margin + (index * (cardWidth + 5));
          
          // Card background
          doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
          doc.roundedRect(xPos, yPos, cardWidth, 25, 2, 2, 'F');
          
          // Border accent
          doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.rect(xPos, yPos, 3, 25, 'F');
          
          // Label
          doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text(item.label, xPos + 8, yPos + 8);
          
          // Value
          doc.setTextColor(textColor[0], textColor[1], textColor[2]);
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text(item.value, xPos + 8, yPos + 18);
        });

        yPos += 35;
      }

      // Performance Metrics Section
      if (sections.find(s => s.id === 'performance')?.enabled) {
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Métricas de Performance', margin, yPos);
        yPos += 10;

        const perfData = [
          { label: 'CPM (Custo por Mil)', value: formatCurrency(metrics.cpm, currency) },
          { label: 'CPC (Custo por Clique)', value: formatCurrency(metrics.cpc, currency) },
          { label: 'CPA (Custo por Aquisição)', value: formatCurrency(metrics.cpa, currency) },
        ];

        const perfCardWidth = (pageWidth - margin * 2 - 10) / 3;
        
        perfData.forEach((item, index) => {
          const xPos = margin + (index * (perfCardWidth + 5));
          
          doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
          doc.roundedRect(xPos, yPos, perfCardWidth, 22, 2, 2, 'F');
          
          doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text(item.label, xPos + 5, yPos + 8);
          
          doc.setTextColor(textColor[0], textColor[1], textColor[2]);
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.text(item.value, xPos + 5, yPos + 17);
        });

        yPos += 32;
      }

      // Results Metrics Section (Business Model Specific)
      if (sections.find(s => s.id === 'results')?.enabled && businessModel) {
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        
        const modelLabel = businessModel === 'ecommerce' ? 'E-commerce' : 
                          businessModel === 'inside_sales' ? 'Inside Sales' : 'PDV';
        doc.text(`Métricas de Resultado (${modelLabel})`, margin, yPos);
        yPos += 10;

        let resultsData: { label: string; value: string; highlight?: boolean }[] = [];

        if (businessModel === 'ecommerce') {
          resultsData = [
            { label: 'ROAS', value: `${metrics.roas.toFixed(2)}x`, highlight: true },
            { label: 'Compras', value: formatNum(metrics.totalConversions) },
            { label: 'Receita Total', value: formatCurrency(metrics.totalConversionValue, currency), highlight: true },
          ];
        } else if (businessModel === 'inside_sales') {
          resultsData = [
            { label: 'Leads Gerados', value: formatNum(metrics.totalConversions), highlight: true },
            { label: 'CPL', value: formatCurrency(metrics.cpa, currency) },
          ];
        } else if (businessModel === 'pdv') {
          resultsData = [
            { label: 'Visitas', value: formatNum(metrics.totalConversions), highlight: true },
            { label: 'Custo por Visita', value: formatCurrency(metrics.cpa, currency) },
          ];
        }

        const resCardWidth = (pageWidth - margin * 2 - 10) / resultsData.length;
        
        resultsData.forEach((item, index) => {
          const xPos = margin + (index * (resCardWidth + 5));
          
          if (item.highlight) {
            doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.roundedRect(xPos, yPos, resCardWidth, 28, 2, 2, 'F');
            
            doc.setTextColor(255, 255, 255);
          } else {
            doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
            doc.roundedRect(xPos, yPos, resCardWidth, 28, 2, 2, 'F');
            
            doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
          }
          
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.text(item.label, xPos + 5, yPos + 10);
          
          if (item.highlight) {
            doc.setTextColor(255, 255, 255);
          } else {
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
          }
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text(item.value, xPos + 5, yPos + 22);
        });

        yPos += 38;
      }

      // Footer
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`${projectName} • Relatório gerado automaticamente`, margin, pageHeight - 6);
      doc.text(`Página 1 de 1`, pageWidth - margin - 20, pageHeight - 6);

      // Download
      const fileName = `relatorio-${projectName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setGenerating(false);
    }
  };

  const enabledSections = sections.filter(s => s.enabled);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileDown className="w-4 h-4" />
          Exportar PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="w-5 h-5 text-primary" />
            PDF Builder - Relatório Personalizado
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="sections" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sections">Seções</TabsTrigger>
            <TabsTrigger value="style">Estilo</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="sections" className="space-y-4 mt-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Título do Relatório</Label>
              <Input 
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                placeholder="Digite o título do relatório"
              />
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">Logo (opcional)</Label>
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

            <div>
              <Label className="text-sm font-medium mb-3 block">Seções do Relatório</Label>
              <div className="grid grid-cols-1 gap-2">
                {sections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <div 
                      key={section.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer",
                        section.enabled 
                          ? "border-primary/50 bg-primary/5" 
                          : "border-border hover:border-primary/30"
                      )}
                      onClick={() => toggleSection(section.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox 
                          checked={section.enabled} 
                          onCheckedChange={() => toggleSection(section.id)}
                        />
                        <Icon className={cn(
                          "w-4 h-4",
                          section.enabled ? "text-primary" : "text-muted-foreground"
                        )} />
                        <span className={cn(
                          "font-medium",
                          section.enabled ? "text-foreground" : "text-muted-foreground"
                        )}>
                          {section.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="style" className="space-y-4 mt-4">
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

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="showGrid"
                  checked={chartStyles.showGrid}
                  onCheckedChange={(checked) => 
                    setChartStyles(prev => ({ ...prev, showGrid: !!checked }))
                  }
                />
                <Label htmlFor="showGrid">Mostrar grid nos gráficos</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="showLabels"
                  checked={chartStyles.showLabels}
                  onCheckedChange={(checked) => 
                    setChartStyles(prev => ({ ...prev, showLabels: !!checked }))
                  }
                />
                <Label htmlFor="showLabels">Mostrar labels</Label>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="mt-4">
            <div className="border rounded-lg p-4 bg-white text-black min-h-[400px]">
              {/* Preview Header */}
              {sections.find(s => s.id === 'header')?.enabled && (
                <div 
                  className="rounded-t-lg p-4 mb-4 flex items-center gap-4"
                  style={{ backgroundColor: chartStyles.primaryColor }}
                >
                  {logoUrl && (
                    <img src={logoUrl} alt="Logo" className="h-12 w-auto rounded" />
                  )}
                  <div className="text-white">
                    <h2 className="font-bold text-lg">{reportTitle}</h2>
                    <p className="text-sm opacity-90">Período: {periodLabel}</p>
                  </div>
                </div>
              )}

              {/* Preview Summary */}
              {sections.find(s => s.id === 'summary')?.enabled && (
                <div className="mb-4">
                  <h3 className="font-semibold text-sm mb-2">Resumo Executivo</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Investimento', value: formatCurrency(metrics.totalSpend, currency) },
                      { label: 'Impressões', value: formatNum(metrics.totalImpressions) },
                      { label: 'Cliques', value: formatNum(metrics.totalClicks) },
                      { label: 'CTR', value: `${metrics.ctr.toFixed(2)}%` },
                    ].map((item) => (
                      <div 
                        key={item.label} 
                        className="p-2 rounded bg-gray-100 border-l-2"
                        style={{ borderColor: chartStyles.primaryColor }}
                      >
                        <p className="text-xs text-gray-500">{item.label}</p>
                        <p className="font-bold text-sm">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview Performance */}
              {sections.find(s => s.id === 'performance')?.enabled && (
                <div className="mb-4">
                  <h3 className="font-semibold text-sm mb-2">Performance</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'CPM', value: formatCurrency(metrics.cpm, currency) },
                      { label: 'CPC', value: formatCurrency(metrics.cpc, currency) },
                      { label: 'CPA', value: formatCurrency(metrics.cpa, currency) },
                    ].map((item) => (
                      <div key={item.label} className="p-2 rounded bg-gray-100">
                        <p className="text-xs text-gray-500">{item.label}</p>
                        <p className="font-bold text-sm">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview Results */}
              {sections.find(s => s.id === 'results')?.enabled && businessModel && (
                <div className="mb-4">
                  <h3 className="font-semibold text-sm mb-2">
                    Resultados ({businessModel === 'ecommerce' ? 'E-commerce' : 
                               businessModel === 'inside_sales' ? 'Inside Sales' : 'PDV'})
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {businessModel === 'ecommerce' && (
                      <>
                        <div 
                          className="p-2 rounded text-white"
                          style={{ backgroundColor: chartStyles.primaryColor }}
                        >
                          <p className="text-xs opacity-80">ROAS</p>
                          <p className="font-bold">{metrics.roas.toFixed(2)}x</p>
                        </div>
                        <div className="p-2 rounded bg-gray-100">
                          <p className="text-xs text-gray-500">Compras</p>
                          <p className="font-bold text-sm">{formatNum(metrics.totalConversions)}</p>
                        </div>
                        <div 
                          className="p-2 rounded text-white"
                          style={{ backgroundColor: chartStyles.primaryColor }}
                        >
                          <p className="text-xs opacity-80">Receita</p>
                          <p className="font-bold">{formatCurrency(metrics.totalConversionValue, currency)}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {enabledSections.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <Eye className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Selecione seções para visualizar o preview</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button 
            variant="gradient" 
            onClick={generatePDF}
            disabled={generating || enabledSections.length === 0}
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
      </DialogContent>
    </Dialog>
  );
}
