import { jsPDF } from 'jspdf';
import { PredictiveAnalysisData } from '@/hooks/usePredictiveAnalysis';

export const generatePredictiveReportPDF = (data: PredictiveAnalysisData): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let yPos = 0;
  
  // Colors
  const colors = {
    primary: { r: 220, g: 38, b: 38 }, // red-600
    primaryDark: { r: 153, g: 27, b: 27 }, // red-800
    primaryLight: { r: 254, g: 226, b: 226 }, // red-100
    accent: { r: 249, g: 115, b: 22 }, // orange-500
    success: { r: 22, g: 163, b: 74 }, // green-600
    warning: { r: 234, g: 179, b: 8 }, // yellow-500
    gray900: { r: 17, g: 24, b: 39 },
    gray700: { r: 55, g: 65, b: 81 },
    gray500: { r: 107, g: 114, b: 128 },
    gray300: { r: 209, g: 213, b: 219 },
    gray100: { r: 243, g: 244, b: 246 },
    white: { r: 255, g: 255, b: 255 },
  };
  
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
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
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
      case 'infoproduto': return 'Infoproduto';
      default: return model;
    }
  };

  // Footer space
  const footerSpace = 20;
  
  const checkNewPage = (neededSpace: number = 30) => {
    if (yPos > pageHeight - footerSpace - neededSpace) {
      doc.addPage();
      yPos = 20;
    }
  };

  // === HEADER ===
  const addHeader = () => {
    // Gradient-like header with darker top
    doc.setFillColor(colors.primaryDark.r, colors.primaryDark.g, colors.primaryDark.b);
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.rect(0, 35, pageWidth, 10, 'F');
    
    // Header text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('ANALISE PREDITIVA', margin, 18);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(data.project.name, margin, 28);
    
    // Right side badge
    doc.setFontSize(9);
    const modelLabel = getBusinessModelLabel(data.project.businessModel);
    doc.text(modelLabel, pageWidth - margin, 18, { align: 'right' });
    doc.text(new Date(data.generatedAt).toLocaleDateString('pt-BR'), pageWidth - margin, 28, { align: 'right' });
    
    yPos = 55;
  };

  // === SECTION TITLE ===
  const addSectionTitle = (number: string, text: string) => {
    checkNewPage(35);
    yPos += 5;
    
    // Number badge
    doc.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.roundedRect(margin, yPos - 6, 20, 10, 2, 2, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(number, margin + 10, yPos, { align: 'center' });
    
    // Title text
    doc.setFontSize(13);
    doc.setTextColor(colors.gray900.r, colors.gray900.g, colors.gray900.b);
    doc.text(text, margin + 25, yPos);
    
    // Underline
    doc.setDrawColor(colors.gray300.r, colors.gray300.g, colors.gray300.b);
    doc.setLineWidth(0.3);
    doc.line(margin, yPos + 5, pageWidth - margin, yPos + 5);
    
    yPos += 14;
  };

  // === METRIC BOX ===
  const drawMetricBox = (x: number, y: number, width: number, height: number, label: string, value: string, highlight: boolean = false) => {
    // Background
    if (highlight) {
      doc.setFillColor(colors.primaryLight.r, colors.primaryLight.g, colors.primaryLight.b);
    } else {
      doc.setFillColor(colors.gray100.r, colors.gray100.g, colors.gray100.b);
    }
    doc.roundedRect(x, y, width, height, 3, 3, 'F');
    
    // Label
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.gray500.r, colors.gray500.g, colors.gray500.b);
    doc.text(label, x + width / 2, y + 10, { align: 'center' });
    
    // Value
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    if (highlight) {
      doc.setTextColor(colors.primaryDark.r, colors.primaryDark.g, colors.primaryDark.b);
    } else {
      doc.setTextColor(colors.gray900.r, colors.gray900.g, colors.gray900.b);
    }
    doc.text(value, x + width / 2, y + 22, { align: 'center' });
  };

  // === PROJECTION TABLE ===
  const drawProjectionTable = () => {
    const tableY = yPos;
    const colWidth = (contentWidth - 10) / 4; // 4 columns: label + 3 periods
    const rowHeight = 18;
    const headerHeight = 14;
    
    // Header row
    doc.setFillColor(colors.gray900.r, colors.gray900.g, colors.gray900.b);
    doc.roundedRect(margin, tableY, contentWidth, headerHeight, 2, 2, 'F');
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    
    const headers = ['Metrica', 'Prox. 7 Dias', 'Prox. 30 Dias', 'Resto do Ano'];
    headers.forEach((h, i) => {
      const x = margin + (i * colWidth) + colWidth / 2;
      doc.text(h, x, tableY + 9, { align: 'center' });
    });
    
    // Data rows
    const today = new Date();
    const endOfYear = new Date(today.getFullYear(), 11, 31);
    const daysRemaining = Math.ceil((endOfYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    const avgDailySpend = data.predictions.trends.avgDailySpend;
    const avgDailyConversions = data.predictions.trends.avgDailyConversions;
    const projectedSpendYear = avgDailySpend * daysRemaining;
    const projectedConversionsYear = avgDailyConversions * daysRemaining;
    const projectedRevenueYear = showROAS && data.predictions.trends.avgDailyRoas !== null
      ? projectedSpendYear * data.predictions.trends.avgDailyRoas
      : 0;
    
    const rows = [
      ['Investimento', formatCurrency(data.predictions.next7Days.estimatedSpend), formatCurrency(data.predictions.next30Days.estimatedSpend), formatCurrency(projectedSpendYear)],
      [showCPL ? 'Leads' : 'Conversoes', formatNumber(data.predictions.next7Days.estimatedConversions), formatNumber(data.predictions.next30Days.estimatedConversions), formatNumber(projectedConversionsYear)],
    ];
    
    if (showROAS && !showCPL) {
      rows.push(['Receita', formatCurrency(data.predictions.next7Days.estimatedRevenue), formatCurrency(data.predictions.next30Days.estimatedRevenue), formatCurrency(projectedRevenueYear)]);
    }
    
    let currentY = tableY + headerHeight;
    rows.forEach((row, rowIndex) => {
      // Alternating row background
      if (rowIndex % 2 === 0) {
        doc.setFillColor(colors.gray100.r, colors.gray100.g, colors.gray100.b);
      } else {
        doc.setFillColor(255, 255, 255);
      }
      doc.rect(margin, currentY, contentWidth, rowHeight, 'F');
      
      // Row data
      row.forEach((cell, colIndex) => {
        const x = margin + (colIndex * colWidth) + colWidth / 2;
        doc.setFontSize(9);
        if (colIndex === 0) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(colors.gray700.r, colors.gray700.g, colors.gray700.b);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(colors.gray900.r, colors.gray900.g, colors.gray900.b);
        }
        doc.text(cell, x, currentY + 11, { align: 'center' });
      });
      
      currentY += rowHeight;
    });
    
    // Border
    doc.setDrawColor(colors.gray300.r, colors.gray300.g, colors.gray300.b);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, tableY, contentWidth, headerHeight + (rows.length * rowHeight), 2, 2, 'S');
    
    yPos = currentY + 8;
  };

  // === SIMPLE ROW ===
  const addSimpleRow = (label: string, value: string, highlight: boolean = false) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.gray500.r, colors.gray500.g, colors.gray500.b);
    doc.text(label, margin + 5, yPos);
    
    doc.setFont('helvetica', 'bold');
    if (highlight) {
      doc.setTextColor(colors.success.r, colors.success.g, colors.success.b);
    } else {
      doc.setTextColor(colors.gray900.r, colors.gray900.g, colors.gray900.b);
    }
    doc.text(value, pageWidth - margin - 5, yPos, { align: 'right' });
    yPos += 7;
  };

  // === START BUILDING PDF ===
  addHeader();

  // ========================================
  // 1. ANÁLISE DE TENDÊNCIA
  // ========================================
  addSectionTitle('01', 'Analise de Tendencia');
  
  // Trend metrics in boxes
  const boxWidth = (contentWidth - 15) / 4;
  const boxHeight = 30;
  
  drawMetricBox(margin, yPos, boxWidth, boxHeight, 'Gasto Medio/Dia', formatCurrency(data.predictions.trends.avgDailySpend), true);
  drawMetricBox(margin + boxWidth + 5, yPos, boxWidth, boxHeight, showCPL ? 'Leads/Dia' : 'Conv/Dia', formatNumber(data.predictions.trends.avgDailyConversions));
  
  if (showCPL && data.predictions.trends.avgDailyCpl !== null) {
    drawMetricBox(margin + (boxWidth + 5) * 2, yPos, boxWidth, boxHeight, 'CPL Medio', formatCurrency(data.predictions.trends.avgDailyCpl), true);
  } else if (showROAS && data.predictions.trends.avgDailyRoas !== null) {
    drawMetricBox(margin + (boxWidth + 5) * 2, yPos, boxWidth, boxHeight, 'ROAS Medio', `${data.predictions.trends.avgDailyRoas.toFixed(2)}x`);
  }
  
  if (data.predictions.trends.avgCtr !== null) {
    drawMetricBox(margin + (boxWidth + 5) * 3, yPos, boxWidth, boxHeight, 'CTR Medio', `${data.predictions.trends.avgCtr.toFixed(2)}%`);
  }
  
  yPos += boxHeight + 10;
  
  // Account balance status
  const balanceStatus = data.accountBalance.status;
  const statusColor = balanceStatus === 'critical' ? colors.primary : balanceStatus === 'warning' ? colors.warning : colors.success;
  
  doc.setFillColor(colors.gray100.r, colors.gray100.g, colors.gray100.b);
  doc.roundedRect(margin, yPos, contentWidth, 25, 3, 3, 'F');
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.gray700.r, colors.gray700.g, colors.gray700.b);
  doc.text('Saldo da Conta:', margin + 5, yPos + 10);
  
  doc.setFontSize(12);
  doc.setTextColor(statusColor.r, statusColor.g, statusColor.b);
  doc.text(formatCurrency(data.accountBalance.balance), margin + 60, yPos + 10);
  
  if (data.accountBalance.daysOfSpendRemaining !== null) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.gray500.r, colors.gray500.g, colors.gray500.b);
    const statusLabel = balanceStatus === 'critical' ? 'CRITICO' : balanceStatus === 'warning' ? 'Atencao' : 'OK';
    doc.text(`${data.accountBalance.daysOfSpendRemaining} dias restantes (${statusLabel})`, margin + 5, yPos + 19);
  }
  
  yPos += 35;

  // ========================================
  // 2. PROJEÇÕES
  // ========================================
  checkNewPage(60);
  addSectionTitle('02', 'Projecoes de Performance');
  drawProjectionTable();

  // ========================================
  // 3. DESEMPENHO ÚLTIMOS 30 DIAS
  // ========================================
  checkNewPage(50);
  addSectionTitle('03', 'Desempenho dos Ultimos 30 Dias');
  
  // Performance boxes
  const perfBoxWidth = (contentWidth - 10) / 3;
  const perfBoxHeight = 32;
  
  drawMetricBox(margin, yPos, perfBoxWidth, perfBoxHeight, 'Investido', formatCurrency(data.totals.spend30Days), true);
  drawMetricBox(margin + perfBoxWidth + 5, yPos, perfBoxWidth, perfBoxHeight, showCPL ? 'Leads' : 'Conversoes', formatNumber(data.totals.conversions30Days));
  
  if (showCPL && data.totals.conversions30Days > 0) {
    const avgCpl = data.totals.spend30Days / data.totals.conversions30Days;
    drawMetricBox(margin + (perfBoxWidth + 5) * 2, yPos, perfBoxWidth, perfBoxHeight, 'CPL Medio', formatCurrency(avgCpl), true);
  } else if (showROAS && data.totals.revenue30Days > 0) {
    const avgRoas = data.totals.revenue30Days / data.totals.spend30Days;
    drawMetricBox(margin + (perfBoxWidth + 5) * 2, yPos, perfBoxWidth, perfBoxHeight, 'ROAS Medio', `${avgRoas.toFixed(2)}x`);
  }
  
  yPos += perfBoxHeight + 8;
  
  // Additional metrics
  doc.setFillColor(colors.gray100.r, colors.gray100.g, colors.gray100.b);
  doc.roundedRect(margin, yPos, contentWidth, 30, 3, 3, 'F');
  yPos += 8;
  
  addSimpleRow('Cliques', formatNumber(data.totals.clicks30Days));
  addSimpleRow('Impressoes', formatNumber(data.totals.impressions30Days));
  addSimpleRow(`Media Diaria (${showCPL ? 'Leads' : 'Conv'})`, formatNumber(data.totals.conversions30Days / 30));
  
  yPos += 5;
  
  // Best/Worst day analysis
  if (data.dailyTrend && data.dailyTrend.length > 0) {
    const daysWithConversions = data.dailyTrend.filter(d => d.conversions > 0);
    if (daysWithConversions.length > 0) {
      const bestDay = daysWithConversions.reduce((best, current) => {
        const bestCpl = best.spend / best.conversions;
        const currentCpl = current.spend / current.conversions;
        return currentCpl < bestCpl ? current : best;
      });
      
      const worstDay = daysWithConversions.reduce((worst, current) => {
        const worstCpl = worst.spend / worst.conversions;
        const currentCpl = current.spend / current.conversions;
        return currentCpl > worstCpl ? current : worst;
      });
      
      const bestCpl = bestDay.spend / bestDay.conversions;
      const worstCpl = worstDay.spend / worstDay.conversions;
      
      yPos += 3;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(colors.success.r, colors.success.g, colors.success.b);
      doc.text(`Melhor: ${bestDay.date} - ${formatNumber(bestDay.conversions)} ${showCPL ? 'leads' : 'conv'} (CPL: ${formatCurrency(bestCpl)})`, margin + 5, yPos);
      
      yPos += 6;
      doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
      doc.text(`Pior: ${worstDay.date} - ${formatNumber(worstDay.conversions)} ${showCPL ? 'leads' : 'conv'} (CPL: ${formatCurrency(worstCpl)})`, margin + 5, yPos);
      yPos += 8;
    }
  }

  // ========================================
  // 4. PROGRESSO DE METAS
  // ========================================
  const campaignsWithData = data.campaignGoalsProgress.filter(c => c.spend > 0).slice(0, 8);
  if (campaignsWithData.length > 0) {
    checkNewPage(50);
    addSectionTitle('04', 'Progresso de Metas por Campanha');
    
    // Table header
    doc.setFillColor(colors.gray900.r, colors.gray900.g, colors.gray900.b);
    doc.roundedRect(margin, yPos, contentWidth, 12, 2, 2, 'F');
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Campanha', margin + 5, yPos + 8);
    doc.text('Investido', margin + 90, yPos + 8);
    doc.text(showCPL ? 'Leads' : 'Conv', margin + 120, yPos + 8);
    doc.text(showCPL ? 'CPL' : 'ROAS', margin + 145, yPos + 8);
    doc.text('Status', pageWidth - margin - 10, yPos + 8, { align: 'right' });
    
    yPos += 12;
    
    campaignsWithData.forEach((campaign, index) => {
      checkNewPage(12);
      
      // Alternating background
      if (index % 2 === 0) {
        doc.setFillColor(colors.gray100.r, colors.gray100.g, colors.gray100.b);
        doc.rect(margin, yPos, contentWidth, 10, 'F');
      }
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.gray700.r, colors.gray700.g, colors.gray700.b);
      
      // Campaign name (truncated)
      const campaignName = campaign.campaignName.length > 35 
        ? campaign.campaignName.slice(0, 35) + '...' 
        : campaign.campaignName;
      doc.text(campaignName, margin + 5, yPos + 7);
      
      // Metrics
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(campaign.spend), margin + 90, yPos + 7);
      doc.text(formatNumber(campaign.conversions), margin + 120, yPos + 7);
      
      if (showCPL && campaign.cpl !== null) {
        doc.text(formatCurrency(campaign.cpl), margin + 145, yPos + 7);
      } else if (showROAS && campaign.roas !== null) {
        doc.text(`${campaign.roas.toFixed(2)}x`, margin + 145, yPos + 7);
      }
      
      // Status indicator
      const status = showCPL ? campaign.cplStatus : campaign.roasStatus;
      const statusColor = status === 'success' ? colors.success : status === 'warning' ? colors.warning : colors.primary;
      doc.setFillColor(statusColor.r, statusColor.g, statusColor.b);
      doc.circle(pageWidth - margin - 8, yPos + 5, 3, 'F');
      
      yPos += 10;
    });
    
    yPos += 5;
  }

  // ========================================
  // 5. SUGESTÕES DE OTIMIZAÇÃO
  // ========================================
  checkNewPage(50);
  addSectionTitle('05', 'Sugestoes de Otimizacao');
  
  if (data.suggestions.length === 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.gray500.r, colors.gray500.g, colors.gray500.b);
    doc.text('Nenhuma sugestao de otimizacao no momento.', margin + 5, yPos);
    yPos += 15;
  } else {
    data.suggestions.slice(0, 6).forEach((suggestion, index) => {
      checkNewPage(30);
      
      const priorityColor = suggestion.priority === 'high' ? colors.primary : 
                           suggestion.priority === 'medium' ? colors.accent : colors.success;
      
      // Card background
      doc.setFillColor(colors.gray100.r, colors.gray100.g, colors.gray100.b);
      doc.roundedRect(margin, yPos, contentWidth, 28, 3, 3, 'F');
      
      // Priority bar
      doc.setFillColor(priorityColor.r, priorityColor.g, priorityColor.b);
      doc.rect(margin, yPos, 4, 28, 'F');
      
      // Title
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(colors.gray900.r, colors.gray900.g, colors.gray900.b);
      const title = suggestion.title.length > 65 ? suggestion.title.slice(0, 65) + '...' : suggestion.title;
      doc.text(title, margin + 8, yPos + 9);
      
      // Priority badge
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(priorityColor.r, priorityColor.g, priorityColor.b);
      const priorityLabel = suggestion.priority === 'high' ? 'ALTA' : suggestion.priority === 'medium' ? 'MEDIA' : 'BAIXA';
      doc.text(priorityLabel, pageWidth - margin - 5, yPos + 9, { align: 'right' });
      
      // Description
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.gray700.r, colors.gray700.g, colors.gray700.b);
      const descLines = doc.splitTextToSize(suggestion.description, contentWidth - 20);
      doc.text(descLines.slice(0, 2).join(' '), margin + 8, yPos + 18);
      
      yPos += 33;
    });
  }

  // === FOOTER ===
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Footer bar
    doc.setFillColor(colors.gray900.r, colors.gray900.g, colors.gray900.b);
    doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
    
    // Footer text
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text(`V4 Company - Relatorio gerado em ${new Date().toLocaleString('pt-BR')}`, margin, pageHeight - 5);
    doc.text(`Pagina ${i}/${pageCount}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
  }

  // Save
  const fileName = `analise-preditiva-${data.project.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};