import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { FileText, Download, Loader2, Calendar, Palette, BarChart3, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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
  { key: 'spend', label: 'Investimento', type: 'currency' },
  { key: 'impressions', label: 'Impressões', type: 'number' },
  { key: 'reach', label: 'Alcance', type: 'number' },
  { key: 'clicks', label: 'Cliques', type: 'number' },
  { key: 'ctr', label: 'CTR', type: 'percent' },
  { key: 'cpm', label: 'CPM', type: 'currency' },
  { key: 'cpc', label: 'CPC', type: 'currency' },
  { key: 'frequency', label: 'Frequência', type: 'decimal' },
];

const RESULT_METRICS: Record<string, MetricDef[]> = {
  ecommerce: [
    { key: 'conversions', label: 'Vendas', type: 'number' },
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
  const sym = curr === 'BRL' ? 'R$' : curr === 'USD' ? '$' : '€';
  return `${sym} ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  return v.toFixed(2);
}

function fmtDateRange(since: string, until: string): string {
  const s = new Date(since + 'T00:00:00');
  const e = new Date(until + 'T00:00:00');
  return `${format(s, "dd 'de' MMMM", { locale: ptBR })} a ${format(e, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
}

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
  const [secondaryColor, setSecondaryColor] = useState('#374151');
  const [includeChart, setIncludeChart] = useState(false);
  
  const { dailyData, totals, loading, loadMetrics } = usePDFMetrics(projectId);

  useEffect(() => {
    if (!open) return;
    if (useDashboardPeriod) {
      loadMetrics(currentPeriod.since, currentPeriod.until);
    } else if (customStart && customEnd) {
      loadMetrics(format(customStart, 'yyyy-MM-dd'), format(customEnd, 'yyyy-MM-dd'));
    }
  }, [open, useDashboardPeriod, customStart, customEnd, currentPeriod, loadMetrics]);

  const toggleGeneral = (k: string) => setSelGeneral(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);
  const toggleResult = (k: string) => setSelResult(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);

  const getActivePeriod = () => {
    if (useDashboardPeriod) return currentPeriod;
    if (customStart && customEnd) return { since: format(customStart, 'yyyy-MM-dd'), until: format(customEnd, 'yyyy-MM-dd') };
    return currentPeriod;
  };

  const generate = async () => {
    if (!totals) return;
    setGenerating(true);
    
    try {
      const doc = new jsPDF();
      const pw = doc.internal.pageSize.getWidth();
      const m = 20;
      let y = 20;
      
      doc.setFillColor(primaryColor);
      doc.rect(0, 0, pw, 25, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(title, m, 16);
      
      y = 40;
      const period = getActivePeriod();
      doc.setTextColor(secondaryColor);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Período: ${fmtDateRange(period.since, period.until)}`, m, y);
      y += 8;
      doc.text(`Projeto: ${projectName}`, m, y);
      y += 15;
      
      // Executive Summary
      doc.setFillColor(primaryColor);
      doc.rect(m, y, 3, 8, 'F');
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(secondaryColor);
      doc.text('Resumo Executivo', m + 8, y + 6);
      y += 18;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const summaryItems = [
        `Investimento Total: ${fmtCurrency(totals.spend, currency)}`,
        `Alcance: ${fmtNumber(totals.reach)} pessoas`,
        `Cliques: ${fmtNumber(totals.clicks)}`,
      ];
      
      if (businessModel === 'ecommerce') {
        summaryItems.push(`Receita: ${fmtCurrency(totals.conversion_value, currency)}`);
        summaryItems.push(`ROAS: ${totals.roas.toFixed(2)}x`);
      } else if (businessModel === 'inside_sales') {
        summaryItems.push(`Leads: ${fmtNumber(totals.conversions)}`);
        summaryItems.push(`CPL: ${fmtCurrency(totals.cpa, currency)}`);
      } else if (businessModel === 'pdv') {
        summaryItems.push(`Visitas: ${fmtNumber(totals.conversions)}`);
      }
      
      summaryItems.forEach(item => {
        doc.text(item, m, y);
        y += 6;
      });
      y += 10;
      
      // General Metrics
      const activeGeneral = GENERAL_METRICS.filter(x => selGeneral.includes(x.key));
      if (activeGeneral.length > 0) {
        doc.setFillColor(primaryColor);
        doc.rect(m, y, 3, 8, 'F');
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Métricas Gerais', m + 8, y + 6);
        y += 18;
        
        doc.setFontSize(10);
        const cw = (pw - 2 * m) / 2;
        let col = 0;
        let ry = y;
        
        activeGeneral.forEach(met => {
          const val = (totals as unknown as Record<string, number>)[met.key] || 0;
          const x = m + col * cw;
          doc.setFont('helvetica', 'bold');
          doc.text(met.label, x, ry);
          doc.setFont('helvetica', 'normal');
          doc.text(fmtValue(val, met.type, currency), x, ry + 5);
          col++;
          if (col >= 2) { col = 0; ry += 14; }
        });
        y = ry + (col > 0 ? 14 : 0) + 10;
      }
      
      // Result Metrics
      const resultDefs = businessModel ? RESULT_METRICS[businessModel] || [] : [];
      const activeResult = resultDefs.filter(x => selResult.includes(x.key));
      if (activeResult.length > 0) {
        doc.setFillColor(primaryColor);
        doc.rect(m, y, 3, 8, 'F');
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        const sectionTitle = businessModel === 'ecommerce' ? 'Resultados de Vendas' :
                            businessModel === 'inside_sales' ? 'Resultados de Leads' : 'Resultados de Visitas';
        doc.text(sectionTitle, m + 8, y + 6);
        y += 18;
        
        doc.setFontSize(10);
        const cw = (pw - 2 * m) / 2;
        let col = 0;
        let ry = y;
        
        activeResult.forEach(met => {
          const val = (totals as unknown as Record<string, number>)[met.key] || 0;
          const x = m + col * cw;
          doc.setFont('helvetica', 'bold');
          doc.text(met.label, x, ry);
          doc.setFont('helvetica', 'normal');
          doc.text(fmtValue(val, met.type, currency), x, ry + 5);
          col++;
          if (col >= 2) { col = 0; ry += 14; }
        });
        y = ry + (col > 0 ? 14 : 0) + 10;
      }
      
      // Chart
      if (includeChart && chartRef?.current) {
        try {
          const canvas = await html2canvas(chartRef.current, { scale: 2, backgroundColor: '#fff', logging: false });
          const imgData = canvas.toDataURL('image/png');
          const imgW = pw - 2 * m;
          const imgH = (canvas.height / canvas.width) * imgW;
          
          if (y + imgH + 20 > doc.internal.pageSize.getHeight() - 30) {
            doc.addPage();
            y = 20;
          }
          
          doc.setFillColor(primaryColor);
          doc.rect(m, y, 3, 8, 'F');
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text('Evolução Diária', m + 8, y + 6);
          y += 15;
          
          doc.addImage(imgData, 'PNG', m, y, imgW, imgH);
        } catch (e) {
          console.error('Chart capture error:', e);
        }
      }
      
      // Footer
      const fY = doc.internal.pageSize.getHeight() - 15;
      doc.setFillColor(primaryColor);
      doc.rect(0, fY - 5, pw, 20, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, m, fY + 3);
      doc.text('V4 Company', pw - m - 25, fY + 3);
      
      doc.save(`${title.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
      setOpen(false);
    } catch (err) {
      console.error('PDF error:', err);
    } finally {
      setGenerating(false);
    }
  };

  const resultDefs = businessModel ? RESULT_METRICS[businessModel] || [] : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileText className="h-4 w-4" />
          Gerar PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Construtor de Relatório PDF</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="content" className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="content" className="gap-1 text-xs sm:text-sm">
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">Conteúdo</span>
            </TabsTrigger>
            <TabsTrigger value="metrics" className="gap-1 text-xs sm:text-sm">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Métricas</span>
            </TabsTrigger>
            <TabsTrigger value="style" className="gap-1 text-xs sm:text-sm">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Estilo</span>
            </TabsTrigger>
            <TabsTrigger value="chart" className="gap-1 text-xs sm:text-sm">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Gráfico</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="content" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Título do Relatório</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nome do relatório" />
            </div>
            
            <div className="space-y-3">
              <Label>Período</Label>
              <div className="flex items-center space-x-2">
                <Switch checked={useDashboardPeriod} onCheckedChange={setUseDashboardPeriod} />
                <Label className="font-normal">
                  Usar período do dashboard ({fmtDateRange(currentPeriod.since, currentPeriod.until)})
                </Label>
              </div>
              
              {!useDashboardPeriod && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Data Inicial</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <Calendar className="mr-2 h-4 w-4" />
                          {customStart ? format(customStart, 'dd/MM/yyyy') : 'Selecionar'}
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
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Data Final</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <Calendar className="mr-2 h-4 w-4" />
                          {customEnd ? format(customEnd, 'dd/MM/yyyy') : 'Selecionar'}
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
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="metrics" className="space-y-6 mt-4">
            <div className="space-y-3">
              <Label>Métricas Gerais</Label>
              <div className="grid grid-cols-2 gap-3">
                {GENERAL_METRICS.map(m => (
                  <div key={m.key} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`g-${m.key}`}
                      checked={selGeneral.includes(m.key)}
                      onCheckedChange={() => toggleGeneral(m.key)}
                    />
                    <Label htmlFor={`g-${m.key}`} className="font-normal cursor-pointer">{m.label}</Label>
                  </div>
                ))}
              </div>
            </div>
            
            {resultDefs.length > 0 && (
              <div className="space-y-3">
                <Label>
                  Métricas de Resultado
                  <span className="text-muted-foreground text-sm ml-2">
                    ({businessModel === 'ecommerce' ? 'E-commerce' : businessModel === 'inside_sales' ? 'Inside Sales' : 'PDV'})
                  </span>
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {resultDefs.map(m => (
                    <div key={m.key} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`r-${m.key}`}
                        checked={selResult.includes(m.key)}
                        onCheckedChange={() => toggleResult(m.key)}
                      />
                      <Label htmlFor={`r-${m.key}`} className="font-normal cursor-pointer">{m.label}</Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="style" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Cor Principal</Label>
              <div className="flex items-center gap-3">
                <Input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-16 h-10 p-1 cursor-pointer" />
                <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="flex-1" />
                <div className="w-10 h-10 rounded border" style={{ backgroundColor: primaryColor }} />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Cor Secundária</Label>
              <div className="flex items-center gap-3">
                <Input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="w-16 h-10 p-1 cursor-pointer" />
                <Input value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="flex-1" />
                <div className="w-10 h-10 rounded border" style={{ backgroundColor: secondaryColor }} />
              </div>
            </div>
            
            <div className="p-4 rounded-lg border bg-muted/30 mt-4">
              <p className="text-sm text-muted-foreground">
                A cor principal será usada no cabeçalho, rodapé e destaques. A cor secundária nos textos.
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="chart" className="space-y-4 mt-4">
            <div className="flex items-center space-x-2">
              <Switch checked={includeChart} onCheckedChange={setIncludeChart} disabled={!chartRef?.current} />
              <Label className="font-normal">Incluir gráfico de evolução diária</Label>
            </div>
            
            {!chartRef?.current && (
              <p className="text-sm text-muted-foreground">O gráfico não está disponível no momento.</p>
            )}
            
            {includeChart && chartRef?.current && (
              <div className="p-4 rounded-lg border bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  O gráfico de evolução diária será capturado e incluído no PDF.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
        
        <div className="flex justify-between items-center pt-4 border-t mt-4">
          <div className="text-sm text-muted-foreground">
            {loading ? 'Carregando...' : totals ? `${dailyData.length} dias` : 'Sem dados'}
          </div>
          
          <Button onClick={generate} disabled={generating || loading || !totals} className="gap-2">
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Gerando...</>
            ) : (
              <><Download className="h-4 w-4" />Baixar PDF</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
