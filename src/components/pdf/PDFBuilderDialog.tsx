import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';

type BusinessModel = 'inside_sales' | 'ecommerce' | 'pdv' | null;

interface MetricsData {
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
}

interface Props {
  projectName: string;
  periodLabel: string;
  metrics: MetricsData;
  businessModel: BusinessModel;
  currency: string;
  chartRef?: React.RefObject<HTMLDivElement>;
  projectId?: string;
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
}

function formatNum(value: number): string {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
  if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
  return value.toLocaleString('pt-BR');
}

export function PDFBuilderDialog({ projectName, periodLabel, metrics, businessModel, currency }: Props) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [title, setTitle] = useState('Relatório - ' + projectName);

  const generate = async () => {
    setGenerating(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const w = pdf.internal.pageSize.getWidth();
      const m = 15;
      let y = m;

      pdf.setFillColor(220, 38, 38);
      pdf.rect(0, 0, w, 8, 'F');
      y = 15;

      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(17, 24, 39);
      pdf.text(title, m, y + 5);
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(107, 114, 128);
      pdf.text(periodLabel, m, y + 12);
      pdf.text('Gerado em ' + format(new Date(), "dd/MM/yyyy 'às' HH:mm"), m, y + 18);
      y += 28;

      pdf.setDrawColor(229, 231, 235);
      pdf.line(m, y, w - m, y);
      y += 10;

      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(17, 24, 39);
      pdf.text('Resumo Executivo', m, y);
      y += 8;

      pdf.setFillColor(249, 250, 251);
      pdf.roundedRect(m, y, w - m * 2, 15, 2, 2, 'F');
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(55, 65, 81);
      
      let summary = '';
      if (businessModel === 'ecommerce') {
        summary = `Investimento: ${formatCurrency(metrics.totalSpend, currency)} | Vendas: ${metrics.totalConversions} | Receita: ${formatCurrency(metrics.totalConversionValue, currency)} | ROAS: ${metrics.roas.toFixed(2)}x`;
      } else if (businessModel === 'inside_sales') {
        summary = `Investimento: ${formatCurrency(metrics.totalSpend, currency)} | Leads: ${metrics.totalConversions} | CPL: ${formatCurrency(metrics.cpa, currency)}`;
      } else {
        summary = `Investimento: ${formatCurrency(metrics.totalSpend, currency)} | Alcance: ${formatNum(metrics.totalReach)} | Cliques: ${metrics.totalClicks}`;
      }
      pdf.text(summary, m + 5, y + 9);
      y += 25;

      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(17, 24, 39);
      pdf.text('Métricas Gerais', m, y);
      y += 8;

      const general = [
        { l: 'Gasto Total', v: formatCurrency(metrics.totalSpend, currency) },
        { l: 'Impressões', v: formatNum(metrics.totalImpressions) },
        { l: 'Cliques', v: formatNum(metrics.totalClicks) },
        { l: 'Alcance', v: formatNum(metrics.totalReach) },
        { l: 'CTR', v: metrics.ctr.toFixed(2) + '%' },
        { l: 'CPM', v: formatCurrency(metrics.cpm, currency) },
        { l: 'CPC', v: formatCurrency(metrics.cpc, currency) },
      ];

      const cw = (w - m * 2 - 9) / 4;
      general.forEach((item, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const x = m + col * (cw + 3);
        const cy = y + row * 20;
        
        pdf.setFillColor(249, 250, 251);
        pdf.roundedRect(x, cy, cw, 18, 2, 2, 'F');
        pdf.setFontSize(8);
        pdf.setTextColor(107, 114, 128);
        pdf.text(item.l, x + 3, cy + 6);
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(17, 24, 39);
        pdf.text(item.v, x + 3, cy + 14);
        pdf.setFont('helvetica', 'normal');
      });
      y += Math.ceil(general.length / 4) * 20 + 10;

      const resultLabel = businessModel === 'ecommerce' ? 'E-commerce' : businessModel === 'inside_sales' ? 'Inside Sales' : 'PDV';
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(17, 24, 39);
      pdf.text('Métricas de Resultado (' + resultLabel + ')', m, y);
      y += 8;

      const result = businessModel === 'ecommerce' ? [
        { l: 'Compras', v: String(metrics.totalConversions) },
        { l: 'Receita', v: formatCurrency(metrics.totalConversionValue, currency) },
        { l: 'ROAS', v: metrics.roas.toFixed(2) + 'x' },
        { l: 'CPA', v: formatCurrency(metrics.cpa, currency) },
      ] : businessModel === 'inside_sales' ? [
        { l: 'Leads', v: String(metrics.totalConversions) },
        { l: 'CPL', v: formatCurrency(metrics.cpa, currency) },
      ] : [
        { l: 'Visitas', v: String(metrics.totalConversions) },
        { l: 'Custo/Visita', v: formatCurrency(metrics.cpa, currency) },
      ];

      result.forEach((item, i) => {
        const x = m + i * (cw + 3);
        pdf.setFillColor(254, 242, 242);
        pdf.roundedRect(x, y, cw, 18, 2, 2, 'F');
        pdf.setFontSize(8);
        pdf.setTextColor(107, 114, 128);
        pdf.text(item.l, x + 3, y + 6);
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(220, 38, 38);
        pdf.text(item.v, x + 3, y + 14);
        pdf.setFont('helvetica', 'normal');
      });

      const h = pdf.internal.pageSize.getHeight();
      pdf.setFillColor(220, 38, 38);
      pdf.rect(0, h - 8, w, 8, 'F');
      pdf.setFontSize(8);
      pdf.setTextColor(156, 163, 175);
      pdf.text(projectName + ' • Relatório gerado automaticamente', w / 2, h - 12, { align: 'center' });

      pdf.save(title.replace(/[^a-zA-Z0-9]/g, '_') + '_' + format(new Date(), 'yyyy-MM-dd') + '.pdf');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileText className="w-4 h-4" />Exportar PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-red-600" />Exportar Relatório PDF
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="pdf-title">Título do Relatório</Label>
            <Input id="pdf-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="text-sm text-muted-foreground">
            <p><strong>Período:</strong> {periodLabel}</p>
            <p><strong>Modelo:</strong> {businessModel === 'ecommerce' ? 'E-commerce' : businessModel === 'inside_sales' ? 'Inside Sales' : 'PDV'}</p>
          </div>
        </div>
        <Button onClick={generate} disabled={generating} className="w-full gap-2 bg-red-600 hover:bg-red-700">
          {generating ? <><Loader2 className="w-4 h-4 animate-spin" />Gerando...</> : <><Download className="w-4 h-4" />Baixar PDF</>}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
