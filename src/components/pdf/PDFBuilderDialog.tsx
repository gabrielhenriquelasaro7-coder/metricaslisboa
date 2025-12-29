import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';

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

const formatValue = (value: number, key: string, currency: string) => {
  const currencyMetrics = ['spend', 'conversion_value', 'cpm', 'cpc', 'cpa'];
  if (currencyMetrics.includes(key)) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
  }
  if (key === 'ctr') return `${value.toFixed(2)}%`;
  if (key === 'roas') return `${value.toFixed(2)}x`;
  if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
  if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
  return value.toLocaleString('pt-BR');
};

export function PDFBuilderDialog({ projectName, periodLabel, metrics, businessModel, currency }: PDFBuilderDialogProps) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reportTitle, setReportTitle] = useState(`Relatório - ${projectName}`);

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;
      let yPos = margin;

      // Header bar
      pdf.setFillColor(220, 38, 38);
      pdf.rect(0, 0, pageWidth, 8, 'F');
      yPos = 15;

      // Title
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(17, 24, 39);
      pdf.text(reportTitle, margin, yPos + 5);
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(107, 114, 128);
      pdf.text(periodLabel, margin, yPos + 12);
      pdf.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, margin, yPos + 18);
      yPos += 28;

      // Separator
      pdf.setDrawColor(229, 231, 235);
      pdf.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 10;

      // Summary
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
      
      const summaryText = businessModel === 'ecommerce' 
        ? `Investimento: ${formatValue(metrics.totalSpend, 'spend', currency)} | Vendas: ${metrics.totalConversions} | Receita: ${formatValue(metrics.totalConversionValue, 'conversion_value', currency)} | ROAS: ${metrics.roas.toFixed(2)}x`
        : businessModel === 'inside_sales' 
        ? `Investimento: ${formatValue(metrics.totalSpend, 'spend', currency)} | Leads: ${metrics.totalConversions} | CPL: ${formatValue(metrics.cpa, 'cpa', currency)}`
        : `Investimento: ${formatValue(metrics.totalSpend, 'spend', currency)} | Alcance: ${formatValue(metrics.totalReach, 'reach', currency)} | Cliques: ${metrics.totalClicks}`;
      
      pdf.text(summaryText, margin + 5, yPos + 9);
      yPos += 25;

      // General Metrics
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(17, 24, 39);
      pdf.text('Métricas Gerais', margin, yPos);
      yPos += 8;

      const generalMetrics = [
        { label: 'Gasto Total', value: formatValue(metrics.totalSpend, 'spend', currency) },
        { label: 'Impressões', value: formatValue(metrics.totalImpressions, 'impressions', currency) },
        { label: 'Cliques', value: formatValue(metrics.totalClicks, 'clicks', currency) },
        { label: 'Alcance', value: formatValue(metrics.totalReach, 'reach', currency) },
        { label: 'CTR', value: `${metrics.ctr.toFixed(2)}%` },
        { label: 'CPM', value: formatValue(metrics.cpm, 'cpm', currency) },
        { label: 'CPC', value: formatValue(metrics.cpc, 'cpc', currency) },
      ];

      const cardWidth = (pageWidth - margin * 2 - 9) / 4;
      generalMetrics.forEach((m, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const x = margin + col * (cardWidth + 3);
        const y = yPos + row * 20;
        
        pdf.setFillColor(249, 250, 251);
        pdf.roundedRect(x, y, cardWidth, 18, 2, 2, 'F');
        pdf.setFontSize(8);
        pdf.setTextColor(107, 114, 128);
        pdf.text(m.label, x + 3, y + 6);
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(17, 24, 39);
        pdf.text(m.value, x + 3, y + 14);
        pdf.setFont('helvetica', 'normal');
      });
      yPos += Math.ceil(generalMetrics.length / 4) * 20 + 10;

      // Result Metrics
      const resultLabel = businessModel === 'ecommerce' ? 'E-commerce' : businessModel === 'inside_sales' ? 'Inside Sales' : 'PDV';
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(17, 24, 39);
      pdf.text(`Métricas de Resultado (${resultLabel})`, margin, yPos);
      yPos += 8;

      const resultMetrics = businessModel === 'ecommerce' ? [
        { label: 'Compras', value: metrics.totalConversions.toString() },
        { label: 'Receita', value: formatValue(metrics.totalConversionValue, 'conversion_value', currency) },
        { label: 'ROAS', value: `${metrics.roas.toFixed(2)}x` },
        { label: 'CPA', value: formatValue(metrics.cpa, 'cpa', currency) },
      ] : businessModel === 'inside_sales' ? [
        { label: 'Leads', value: metrics.totalConversions.toString() },
        { label: 'CPL', value: formatValue(metrics.cpa, 'cpa', currency) },
      ] : [
        { label: 'Visitas', value: metrics.totalConversions.toString() },
        { label: 'Custo/Visita', value: formatValue(metrics.cpa, 'cpa', currency) },
      ];

      resultMetrics.forEach((m, i) => {
        const x = margin + i * (cardWidth + 3);
        pdf.setFillColor(254, 242, 242);
        pdf.roundedRect(x, yPos, cardWidth, 18, 2, 2, 'F');
        pdf.setFontSize(8);
        pdf.setTextColor(107, 114, 128);
        pdf.text(m.label, x + 3, yPos + 6);
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(220, 38, 38);
        pdf.text(m.value, x + 3, yPos + 14);
        pdf.setFont('helvetica', 'normal');
      });

      // Footer
      const pageHeight = pdf.internal.pageSize.getHeight();
      pdf.setFillColor(220, 38, 38);
      pdf.rect(0, pageHeight - 8, pageWidth, 8, 'F');
      pdf.setFontSize(8);
      pdf.setTextColor(156, 163, 175);
      pdf.text(`${projectName} • Relatório gerado automaticamente`, pageWidth / 2, pageHeight - 12, { align: 'center' });

      pdf.save(`${reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileText className="w-4 h-4" />
          Exportar PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-red-600" />
            Exportar Relatório PDF
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título do Relatório</Label>
            <Input
              id="title"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder="Nome do relatório"
            />
          </div>
          
          <div className="text-sm text-muted-foreground">
            <p><strong>Período:</strong> {periodLabel}</p>
            <p><strong>Modelo:</strong> {businessModel === 'ecommerce' ? 'E-commerce' : businessModel === 'inside_sales' ? 'Inside Sales' : 'PDV'}</p>
          </div>
        </div>

        <Button 
          onClick={generatePDF} 
          disabled={generating}
          className="w-full gap-2 bg-red-600 hover:bg-red-700"
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
      </DialogContent>
    </Dialog>
  );
}
