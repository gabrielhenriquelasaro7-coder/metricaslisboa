import { jsPDF } from 'jspdf';
import { PredictiveAnalysisData } from '@/hooks/usePredictiveAnalysis';

export const generatePredictiveReportPDF = (data: PredictiveAnalysisData): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = 0;
  
  // Business model logic
  const isInsideSales = data.project.businessModel === 'inside_sales';
  const isEcommerce = data.project.businessModel === 'ecommerce';
  const isPDV = data.project.businessModel === 'pdv';
  const isCustom = data.project.businessModel === 'custom';
  const showCPL = isInsideSales || isCustom || isPDV;
  const showROAS = isEcommerce || isCustom;
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: data.project.currency || 'BRL',
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(Math.round(value));
  };

  const getBusinessModelLabel = (model: string) => {
    switch (model) {
      case 'inside_sales': return 'Inside Sales';
      case 'ecommerce': return 'E-commerce';
      case 'pdv': return 'PDV';
      case 'custom': return 'Personalizado';
      default: return model;
    }
  };

  const addHeader = () => {
    // Red header background
    doc.setFillColor(185, 28, 28); // red-700
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    // White text on red background
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatorio de Analise Preditiva', margin, 20);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Projeto: ${data.project.name}`, margin, 30);
    doc.text(`Modelo: ${getBusinessModelLabel(data.project.businessModel)}`, margin, 38);
    
    // Right side info
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date(data.generatedAt).toLocaleDateString('pt-BR')}`, pageWidth - margin, 30, { align: 'right' });
    doc.text(`${new Date(data.generatedAt).toLocaleTimeString('pt-BR')}`, pageWidth - margin, 38, { align: 'right' });
    
    yPos = 60;
  };

  const addSectionTitle = (text: string) => {
    checkNewPage(30);
    yPos += 8;
    
    // Section background
    doc.setFillColor(254, 226, 226); // red-100
    doc.rect(margin - 5, yPos - 8, pageWidth - (margin * 2) + 10, 14, 'F');
    
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(153, 27, 27); // red-800
    doc.text(text, margin, yPos);
    yPos += 14;
    
    // Reset text color
    doc.setTextColor(55, 65, 81); // gray-700
  };

  const addText = (text: string, size: number = 10, isBold: boolean = false) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setTextColor(55, 65, 81);
    
    // Handle long text with word wrap
    const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
    doc.text(lines, margin, yPos);
    yPos += lines.length * (size * 0.45) + 3;
  };

  const addKeyValue = (label: string, value: string, highlight: boolean = false) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128); // gray-500
    doc.text(label, margin, yPos);
    
    doc.setFont('helvetica', 'bold');
    if (highlight) {
      doc.setTextColor(22, 163, 74); // green-600
    } else {
      doc.setTextColor(31, 41, 55); // gray-800
    }
    doc.text(value, pageWidth - margin, yPos, { align: 'right' });
    yPos += 8;
  };

  const addSubtitle = (text: string) => {
    yPos += 5;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(75, 85, 99); // gray-600
    doc.text(text, margin, yPos);
    yPos += 8;
  };

  // Footer space: line at 15, text at 8 from bottom = reserve 25 minimum
  const footerSpace = 25;
  
  const checkNewPage = (neededSpace: number = 30) => {
    if (yPos > pageHeight - footerSpace - neededSpace) {
      doc.addPage();
      yPos = 25;
    }
  };

  // === Start Building PDF ===
  
  // Header
  addHeader();

  // Account Balance
  addSectionTitle('Saldo da Conta Meta Ads');
  addKeyValue('Saldo Atual', formatCurrency(data.accountBalance.balance));
  if (data.accountBalance.daysOfSpendRemaining !== null) {
    const statusLabel = data.accountBalance.status === 'critical' ? ' (CRITICO!)' : 
                       data.accountBalance.status === 'warning' ? ' (Atencao)' : ' (Saudavel)';
    addKeyValue('Dias de Saldo Restante', `${data.accountBalance.daysOfSpendRemaining} dias${statusLabel}`);
  }
  addKeyValue('Gasto Medio Diario', formatCurrency(data.predictions.trends.avgDailySpend));

  // Predictions
  addSectionTitle('Previsoes de Performance');
  
  addSubtitle('Proximos 7 Dias');
  addKeyValue('Gasto Estimado', formatCurrency(data.predictions.next7Days.estimatedSpend));
  addKeyValue(showCPL ? 'Leads Estimados' : 'Conversoes Estimadas', formatNumber(data.predictions.next7Days.estimatedConversions));
  if (showROAS && !showCPL) {
    addKeyValue('Receita Estimada', formatCurrency(data.predictions.next7Days.estimatedRevenue));
  }

  yPos += 3;
  addSubtitle('Proximos 30 Dias');
  addKeyValue('Gasto Estimado', formatCurrency(data.predictions.next30Days.estimatedSpend));
  addKeyValue(showCPL ? 'Leads Estimados' : 'Conversoes Estimadas', formatNumber(data.predictions.next30Days.estimatedConversions));
  if (showROAS && !showCPL) {
    addKeyValue('Receita Estimada', formatCurrency(data.predictions.next30Days.estimatedRevenue));
  }

  // Trends
  checkNewPage();
  addSectionTitle('Tendencias Medias Diarias');
  addKeyValue('Gasto Medio/Dia', formatCurrency(data.predictions.trends.avgDailySpend));
  addKeyValue(showCPL ? 'Leads Medios/Dia' : 'Conversoes Medias/Dia', formatNumber(data.predictions.trends.avgDailyConversions));
  if (showCPL && data.predictions.trends.avgDailyCpl !== null) {
    addKeyValue('CPL Medio', formatCurrency(data.predictions.trends.avgDailyCpl));
  }
  if (showROAS && !showCPL && data.predictions.trends.avgDailyRoas !== null) {
    addKeyValue('ROAS Medio', `${data.predictions.trends.avgDailyRoas.toFixed(2)}x`);
  }
  if (data.predictions.trends.avgCtr !== null) {
    addKeyValue('CTR Medio', `${data.predictions.trends.avgCtr.toFixed(2)}%`);
  }
  const trendDirection = data.predictions.trends.spendTrend > 0 ? '+' : '';
  addKeyValue('Tendencia de Gasto', `${trendDirection}${data.predictions.trends.spendTrend.toFixed(1)}% vs semana anterior`);

  // 30 Days Summary
  checkNewPage();
  addSectionTitle('Resumo dos Ultimos 30 Dias');
  addKeyValue('Total Gasto', formatCurrency(data.totals.spend30Days));
  addKeyValue(showCPL ? 'Total Leads' : 'Total Conversoes', formatNumber(data.totals.conversions30Days));
  if (showROAS && !showCPL) {
    addKeyValue('Total Receita', formatCurrency(data.totals.revenue30Days));
  }
  addKeyValue('Total Cliques', formatNumber(data.totals.clicks30Days));
  addKeyValue('Total Impressoes', formatNumber(data.totals.impressions30Days));

  // Campaign Goals
  const campaignsWithData = data.campaignGoalsProgress.filter(c => c.spend > 0).slice(0, 10);
  if (campaignsWithData.length > 0) {
    checkNewPage(50);
    addSectionTitle('Performance por Campanha');
    
    campaignsWithData.forEach((campaign, index) => {
      checkNewPage(35);
      
      // Campaign name
      yPos += 3;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 41, 55);
      const campaignName = campaign.campaignName.length > 50 
        ? campaign.campaignName.slice(0, 50) + '...' 
        : campaign.campaignName;
      doc.text(`${index + 1}. ${campaignName}`, margin, yPos);
      yPos += 7;
      
      addKeyValue('   Investido', formatCurrency(campaign.spend));
      addKeyValue(showCPL ? '   Leads' : '   Conversoes', formatNumber(campaign.conversions));
      
      if (showROAS && !showCPL && campaign.roas !== null) {
        const roasStatus = campaign.roasStatus === 'success' ? ' (OK)' : 
                          campaign.roasStatus === 'warning' ? ' (!)' : ' (X)';
        addKeyValue('   ROAS', `${campaign.roas.toFixed(2)}x (meta: ${campaign.targetRoas}x)${roasStatus}`);
      }
      if (showCPL && campaign.cpl !== null) {
        const cplStatus = campaign.cplStatus === 'success' ? ' (OK)' : 
                         campaign.cplStatus === 'warning' ? ' (!)' : ' (X)';
        addKeyValue('   CPL', `${formatCurrency(campaign.cpl)} (meta: ${formatCurrency(campaign.targetCpl)})${cplStatus}`);
      }
      yPos += 3;
    });
  }

  // Suggestions
  checkNewPage(60);
  addSectionTitle('Sugestoes de Otimizacao');
  
  data.suggestions.forEach((suggestion, index) => {
    checkNewPage(35);
    
    const priorityLabel = suggestion.priority === 'high' ? 'Alta' : 
                         suggestion.priority === 'medium' ? 'Media' : 'Baixa';
    
    yPos += 3;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text(`${index + 1}. ${suggestion.title}`, margin, yPos);
    yPos += 7;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(
      suggestion.priority === 'high' ? 185 : suggestion.priority === 'medium' ? 161 : 34,
      suggestion.priority === 'high' ? 28 : suggestion.priority === 'medium' ? 98 : 197,
      suggestion.priority === 'high' ? 28 : suggestion.priority === 'medium' ? 7 : 94
    );
    doc.text(`Prioridade: ${priorityLabel}`, margin + 5, yPos);
    yPos += 6;
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    const descLines = doc.splitTextToSize(suggestion.description, pageWidth - margin * 2 - 10);
    doc.text(descLines, margin + 5, yPos);
    yPos += descLines.length * 4 + 3;
    
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    const reasonLines = doc.splitTextToSize(`Motivo: ${suggestion.reason}`, pageWidth - margin * 2 - 10);
    doc.text(reasonLines, margin + 5, yPos);
    yPos += reasonLines.length * 3.5 + 5;
  });

  // Footer on each page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Footer line
    doc.setDrawColor(185, 28, 28);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
    
    // Footer text
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(
      `Relatorio gerado automaticamente - ${new Date().toLocaleString('pt-BR')}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
    doc.text(`Pagina ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  // Save
  const fileName = `analise-preditiva-${data.project.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};
