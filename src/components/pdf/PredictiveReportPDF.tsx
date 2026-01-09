import { jsPDF } from 'jspdf';
import { PredictiveAnalysisData } from '@/hooks/usePredictiveAnalysis';

const sanitize = (text: string): string => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x00-\x7F]/g, '')
    .trim();
};

export const generatePredictiveReportPDF = (data: PredictiveAnalysisData): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let y = 0;

  // Cores - VERMELHO
  const RED = { r: 185, g: 28, b: 28 };
  const RED_DARK = { r: 127, g: 29, b: 29 };
  const RED_LIGHT = { r: 254, g: 226, b: 226 };
  const BLACK = { r: 0, g: 0, b: 0 };
  const GRAY = { r: 100, g: 100, b: 100 };
  const WHITE = { r: 255, g: 255, b: 255 };

  const isInsideSales = data.project.businessModel === 'inside_sales';
  const isEcommerce = data.project.businessModel === 'ecommerce';
  const isPDV = data.project.businessModel === 'pdv';
  const isCustom = data.project.businessModel === 'custom';
  const showCPL = isInsideSales || isCustom || isPDV;
  const showROAS = isEcommerce || isCustom;

  const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const fmtNum = (v: number) => Math.round(v).toLocaleString('pt-BR');

  const checkPage = (need: number = 30) => {
    if (y > pageHeight - 20 - need) {
      doc.addPage();
      y = 25;
    }
  };

  // =====================
  // HEADER VERMELHO
  // =====================
  doc.setFillColor(RED.r, RED.g, RED.b);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATORIO PREDITIVO', margin, 18);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(sanitize(data.project.name), margin, 28);

  doc.setFontSize(9);
  doc.text(new Date(data.generatedAt).toLocaleDateString('pt-BR'), pageWidth - margin, 28, { align: 'right' });

  y = 50;

  // =====================
  // 1. TENDENCIA
  // =====================
  doc.setFillColor(RED_LIGHT.r, RED_LIGHT.g, RED_LIGHT.b);
  doc.rect(margin, y, pageWidth - margin * 2, 10, 'F');
  doc.setTextColor(RED_DARK.r, RED_DARK.g, RED_DARK.b);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('1. ANALISE DE TENDENCIA', margin + 3, y + 7);
  y += 15;

  doc.setTextColor(BLACK.r, BLACK.g, BLACK.b);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const metrics = [
    ['Gasto Medio/Dia:', fmt(data.predictions.trends.avgDailySpend)],
    [showCPL ? 'Leads/Dia:' : 'Conversoes/Dia:', fmtNum(data.predictions.trends.avgDailyConversions)],
  ];
  if (showCPL && data.predictions.trends.avgDailyCpl) {
    metrics.push(['CPL Medio:', fmt(data.predictions.trends.avgDailyCpl)]);
  }
  if (showROAS && data.predictions.trends.avgDailyRoas) {
    metrics.push(['ROAS Medio:', data.predictions.trends.avgDailyRoas.toFixed(2) + 'x']);
  }
  if (data.predictions.trends.avgCtr) {
    metrics.push(['CTR Medio:', data.predictions.trends.avgCtr.toFixed(2) + '%']);
  }
  metrics.push(['Saldo da Conta:', fmt(data.accountBalance.balance)]);
  if (data.accountBalance.daysOfSpendRemaining) {
    metrics.push(['Dias de Saldo:', data.accountBalance.daysOfSpendRemaining + ' dias']);
  }

  metrics.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(GRAY.r, GRAY.g, GRAY.b);
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(BLACK.r, BLACK.g, BLACK.b);
    doc.text(value, pageWidth - margin, y, { align: 'right' });
    y += 7;
  });

  y += 5;

  // =====================
  // 2. PROJECOES - TABELA
  // =====================
  checkPage(50);
  doc.setFillColor(RED_LIGHT.r, RED_LIGHT.g, RED_LIGHT.b);
  doc.rect(margin, y, pageWidth - margin * 2, 10, 'F');
  doc.setTextColor(RED_DARK.r, RED_DARK.g, RED_DARK.b);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('2. PROJECOES DE PERFORMANCE', margin + 3, y + 7);
  y += 15;

  // Calcular resto do ano
  const today = new Date();
  const endYear = new Date(today.getFullYear(), 11, 31);
  const daysLeft = Math.ceil((endYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const yearSpend = data.predictions.trends.avgDailySpend * daysLeft;
  const yearConv = data.predictions.trends.avgDailyConversions * daysLeft;

  // Header da tabela
  const colW = (pageWidth - margin * 2) / 4;
  doc.setFillColor(RED.r, RED.g, RED.b);
  doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('METRICA', margin + colW / 2, y + 5.5, { align: 'center' });
  doc.text('7 DIAS', margin + colW * 1.5, y + 5.5, { align: 'center' });
  doc.text('30 DIAS', margin + colW * 2.5, y + 5.5, { align: 'center' });
  doc.text('ANO', margin + colW * 3.5, y + 5.5, { align: 'center' });
  y += 8;

  // Rows
  const tableRows = [
    ['Investimento', fmt(data.predictions.next7Days.estimatedSpend), fmt(data.predictions.next30Days.estimatedSpend), fmt(yearSpend)],
    [showCPL ? 'Leads' : 'Conversoes', fmtNum(data.predictions.next7Days.estimatedConversions), fmtNum(data.predictions.next30Days.estimatedConversions), fmtNum(yearConv)],
  ];

  tableRows.forEach((row, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(RED_LIGHT.r, RED_LIGHT.g, RED_LIGHT.b);
      doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
    }
    doc.setTextColor(BLACK.r, BLACK.g, BLACK.b);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(row[0], margin + colW / 2, y + 5.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(row[1], margin + colW * 1.5, y + 5.5, { align: 'center' });
    doc.text(row[2], margin + colW * 2.5, y + 5.5, { align: 'center' });
    doc.text(row[3], margin + colW * 3.5, y + 5.5, { align: 'center' });
    y += 8;
  });

  // Borda da tabela
  doc.setDrawColor(RED.r, RED.g, RED.b);
  doc.setLineWidth(0.5);
  doc.rect(margin, y - 16 - 8, pageWidth - margin * 2, 24, 'S');

  y += 10;

  // =====================
  // 3. DESEMPENHO 30 DIAS
  // =====================
  checkPage(50);
  doc.setFillColor(RED_LIGHT.r, RED_LIGHT.g, RED_LIGHT.b);
  doc.rect(margin, y, pageWidth - margin * 2, 10, 'F');
  doc.setTextColor(RED_DARK.r, RED_DARK.g, RED_DARK.b);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('3. DESEMPENHO DOS ULTIMOS 30 DIAS', margin + 3, y + 7);
  y += 15;

  doc.setTextColor(BLACK.r, BLACK.g, BLACK.b);
  doc.setFontSize(10);

  const avgCpl = data.totals.conversions30Days > 0 ? data.totals.spend30Days / data.totals.conversions30Days : 0;
  const perf = [
    ['Total Investido:', fmt(data.totals.spend30Days)],
    [showCPL ? 'Total Leads:' : 'Total Conversoes:', fmtNum(data.totals.conversions30Days)],
    [showCPL ? 'CPL Medio:' : 'ROAS Medio:', showCPL ? fmt(avgCpl) : (data.totals.revenue30Days / data.totals.spend30Days).toFixed(2) + 'x'],
    ['Total Cliques:', fmtNum(data.totals.clicks30Days)],
    ['Total Impressoes:', fmtNum(data.totals.impressions30Days)],
  ];

  perf.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(GRAY.r, GRAY.g, GRAY.b);
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(BLACK.r, BLACK.g, BLACK.b);
    doc.text(value, pageWidth - margin, y, { align: 'right' });
    y += 7;
  });

  y += 5;

  // =====================
  // 4. METAS POR CAMPANHA
  // =====================
  const camps = data.campaignGoalsProgress.filter(c => c.spend > 0).slice(0, 6);
  if (camps.length > 0) {
    checkPage(60);
    doc.setFillColor(RED_LIGHT.r, RED_LIGHT.g, RED_LIGHT.b);
    doc.rect(margin, y, pageWidth - margin * 2, 10, 'F');
    doc.setTextColor(RED_DARK.r, RED_DARK.g, RED_DARK.b);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('4. PROGRESSO DE METAS', margin + 3, y + 7);
    y += 15;

    camps.forEach((c, i) => {
      checkPage(15);
      const name = sanitize(c.campaignName).slice(0, 40) + (c.campaignName.length > 40 ? '...' : '');
      const status = showCPL ? c.cplStatus : c.roasStatus;
      const statusIcon = status === 'success' ? '[OK]' : status === 'warning' ? '[!]' : '[X]';

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(BLACK.r, BLACK.g, BLACK.b);
      doc.text((i + 1) + '. ' + name, margin, y);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(GRAY.r, GRAY.g, GRAY.b);
      const info = fmt(c.spend) + ' | ' + fmtNum(c.conversions) + (showCPL ? ' leads' : ' conv') + ' | ' + (showCPL && c.cpl ? 'CPL ' + fmt(c.cpl) : 'ROAS ' + (c.roas?.toFixed(2) || '-') + 'x');
      doc.text(info, margin, y + 5);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(status === 'success' ? 22 : status === 'warning' ? 200 : RED.r, status === 'success' ? 163 : status === 'warning' ? 150 : RED.g, status === 'success' ? 74 : status === 'warning' ? 0 : RED.b);
      doc.text(statusIcon, pageWidth - margin, y + 2, { align: 'right' });

      y += 12;
    });
  }

  y += 5;

  // =====================
  // 5. SUGESTOES
  // =====================
  checkPage(50);
  doc.setFillColor(RED_LIGHT.r, RED_LIGHT.g, RED_LIGHT.b);
  doc.rect(margin, y, pageWidth - margin * 2, 10, 'F');
  doc.setTextColor(RED_DARK.r, RED_DARK.g, RED_DARK.b);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('5. SUGESTOES DE OTIMIZACAO', margin + 3, y + 7);
  y += 15;

  if (data.suggestions.length === 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(GRAY.r, GRAY.g, GRAY.b);
    doc.text('Nenhuma sugestao no momento.', margin, y);
    y += 10;
  } else {
    data.suggestions.slice(0, 5).forEach((s, i) => {
      checkPage(20);

      const pLabel = s.priority === 'high' ? '[ALTA]' : s.priority === 'medium' ? '[MEDIA]' : '[BAIXA]';
      const pColor = s.priority === 'high' ? RED : s.priority === 'medium' ? { r: 200, g: 150, b: 0 } : { r: 22, g: 163, b: 74 };

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(pColor.r, pColor.g, pColor.b);
      doc.text(pLabel, margin, y);

      doc.setTextColor(BLACK.r, BLACK.g, BLACK.b);
      const title = sanitize(s.title).slice(0, 55) + (s.title.length > 55 ? '...' : '');
      doc.text(title, margin + 20, y);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(GRAY.r, GRAY.g, GRAY.b);
      const desc = sanitize(s.description).slice(0, 80) + (s.description.length > 80 ? '...' : '');
      doc.text(desc, margin, y + 5);

      y += 13;
    });
  }

  // =====================
  // FOOTER
  // =====================
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(RED.r, RED.g, RED.b);
    doc.rect(0, pageHeight - 10, pageWidth, 10, 'F');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('Gerado em ' + new Date().toLocaleString('pt-BR'), margin, pageHeight - 4);
    doc.text('Pagina ' + i + '/' + pageCount, pageWidth - margin, pageHeight - 4, { align: 'right' });
  }

  const fileName = 'relatorio-' + sanitize(data.project.name).replace(/\s+/g, '-').toLowerCase() + '.pdf';
  doc.save(fileName);
};