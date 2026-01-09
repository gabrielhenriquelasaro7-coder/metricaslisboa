import { jsPDF } from 'jspdf';
import { PredictiveAnalysisData } from '@/hooks/usePredictiveAnalysis';

// Remove accents and special characters for PDF compatibility
const sanitizeText = (text: string): string => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
};

export const generatePredictiveReportPDF = (data: PredictiveAnalysisData): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let yPos = 0;
  
  // Colors
  const colors = {
    primary: { r: 185, g: 28, b: 28 },
    primaryDark: { r: 127, g: 29, b: 29 },
    accent: { r: 239, g: 68, b: 68 },
    success: { r: 22, g: 163, b: 74 },
    warning: { r: 234, g: 179, b: 8 },
    blue: { r: 59, g: 130, b: 246 },
    gray900: { r: 17, g: 24, b: 39 },
    gray700: { r: 55, g: 65, b: 81 },
    gray600: { r: 75, g: 85, b: 99 },
    gray500: { r: 107, g: 114, b: 128 },
    gray400: { r: 156, g: 163, b: 175 },
    gray200: { r: 229, g: 231, b: 235 },
    gray100: { r: 243, g: 244, b: 246 },
    gray50: { r: 249, g: 250, b: 251 },
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
    return 'R$ ' + new Intl.NumberFormat('pt-BR', {
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

  const footerSpace = 18;
  
  const checkNewPage = (neededSpace: number = 30) => {
    if (yPos > pageHeight - footerSpace - neededSpace) {
      doc.addPage();
      yPos = 20;
    }
  };

  // === HEADER ===
  const addHeader = () => {
    // Dark header
    doc.setFillColor(colors.gray900.r, colors.gray900.g, colors.gray900.b);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    // Red accent bar
    doc.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.rect(0, 40, pageWidth, 4, 'F');
    
    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATORIO PREDITIVO', margin, 20);
    
    // Subtitle
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.gray400.r, colors.gray400.g, colors.gray400.b);
    doc.text(sanitizeText(data.project.name) + ' | ' + getBusinessModelLabel(data.project.businessModel), margin, 30);
    
    // Date badge
    doc.setFontSize(9);
    doc.setTextColor(colors.gray400.r, colors.gray400.g, colors.gray400.b);
    doc.text(new Date(data.generatedAt).toLocaleDateString('pt-BR'), pageWidth - margin, 25, { align: 'right' });
    
    yPos = 55;
  };

  // === SECTION HEADER ===
  const addSection = (number: string, title: string) => {
    checkNewPage(40);
    yPos += 8;
    
    // Section number circle
    doc.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.circle(margin + 8, yPos - 2, 8, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(number, margin + 8, yPos + 1, { align: 'center' });
    
    // Title
    doc.setFontSize(14);
    doc.setTextColor(colors.gray900.r, colors.gray900.g, colors.gray900.b);
    doc.text(sanitizeText(title), margin + 22, yPos);
    
    yPos += 12;
  };

  // === METRIC CARD ===
  const drawCard = (x: number, y: number, w: number, h: number, label: string, value: string, isHighlight: boolean = false) => {
    // Card background
    doc.setFillColor(colors.white.r, colors.white.g, colors.white.b);
    doc.roundedRect(x, y, w, h, 4, 4, 'F');
    
    // Border
    if (isHighlight) {
      doc.setDrawColor(colors.primary.r, colors.primary.g, colors.primary.b);
      doc.setLineWidth(1.5);
    } else {
      doc.setDrawColor(colors.gray200.r, colors.gray200.g, colors.gray200.b);
      doc.setLineWidth(0.5);
    }
    doc.roundedRect(x, y, w, h, 4, 4, 'S');
    
    // Label
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.gray500.r, colors.gray500.g, colors.gray500.b);
    doc.text(sanitizeText(label).toUpperCase(), x + w / 2, y + 12, { align: 'center' });
    
    // Value
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    if (isHighlight) {
      doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
    } else {
      doc.setTextColor(colors.gray900.r, colors.gray900.g, colors.gray900.b);
    }
    doc.text(value, x + w / 2, y + 26, { align: 'center' });
  };

  // === TABLE ===
  const drawTable = (headers: string[], rows: string[][], colWidths: number[]) => {
    const tableX = margin;
    const rowHeight = 14;
    const headerHeight = 12;
    let tableWidth = colWidths.reduce((a, b) => a + b, 0);
    
    // Header
    doc.setFillColor(colors.gray900.r, colors.gray900.g, colors.gray900.b);
    doc.roundedRect(tableX, yPos, tableWidth, headerHeight, 3, 3, 'F');
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    
    let xOffset = tableX;
    headers.forEach((h, i) => {
      doc.text(sanitizeText(h), xOffset + colWidths[i] / 2, yPos + 8, { align: 'center' });
      xOffset += colWidths[i];
    });
    
    yPos += headerHeight;
    
    // Rows
    rows.forEach((row, rowIndex) => {
      // Alternate background
      if (rowIndex % 2 === 0) {
        doc.setFillColor(colors.gray50.r, colors.gray50.g, colors.gray50.b);
      } else {
        doc.setFillColor(colors.white.r, colors.white.g, colors.white.b);
      }
      doc.rect(tableX, yPos, tableWidth, rowHeight, 'F');
      
      xOffset = tableX;
      row.forEach((cell, colIndex) => {
        doc.setFontSize(9);
        if (colIndex === 0) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(colors.gray700.r, colors.gray700.g, colors.gray700.b);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(colors.gray900.r, colors.gray900.g, colors.gray900.b);
        }
        doc.text(sanitizeText(cell), xOffset + colWidths[colIndex] / 2, yPos + 9, { align: 'center' });
        xOffset += colWidths[colIndex];
      });
      
      yPos += rowHeight;
    });
    
    // Border
    doc.setDrawColor(colors.gray200.r, colors.gray200.g, colors.gray200.b);
    doc.setLineWidth(0.5);
    doc.roundedRect(tableX, yPos - (rows.length * rowHeight) - headerHeight, tableWidth, headerHeight + (rows.length * rowHeight), 3, 3, 'S');
    
    yPos += 8;
  };

  // === INFO ROW ===
  const addInfoRow = (label: string, value: string, color?: typeof colors.success) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.gray600.r, colors.gray600.g, colors.gray600.b);
    doc.text(sanitizeText(label), margin + 5, yPos);
    
    doc.setFont('helvetica', 'bold');
    if (color) {
      doc.setTextColor(color.r, color.g, color.b);
    } else {
      doc.setTextColor(colors.gray900.r, colors.gray900.g, colors.gray900.b);
    }
    doc.text(value, pageWidth - margin - 5, yPos, { align: 'right' });
    yPos += 8;
  };

  // === START PDF ===
  addHeader();

  // ========================================
  // 1. ANALISE DE TENDENCIA
  // ========================================
  addSection('1', 'Analise de Tendencia');
  
  // Metric cards row
  const cardW = (contentWidth - 15) / 4;
  const cardH = 35;
  
  drawCard(margin, yPos, cardW, cardH, 'Gasto Medio/Dia', formatCurrency(data.predictions.trends.avgDailySpend), true);
  drawCard(margin + cardW + 5, yPos, cardW, cardH, showCPL ? 'Leads/Dia' : 'Conv/Dia', formatNumber(data.predictions.trends.avgDailyConversions));
  
  if (showCPL && data.predictions.trends.avgDailyCpl !== null) {
    drawCard(margin + (cardW + 5) * 2, yPos, cardW, cardH, 'CPL Medio', formatCurrency(data.predictions.trends.avgDailyCpl), true);
  } else if (showROAS && data.predictions.trends.avgDailyRoas !== null) {
    drawCard(margin + (cardW + 5) * 2, yPos, cardW, cardH, 'ROAS Medio', data.predictions.trends.avgDailyRoas.toFixed(2) + 'x');
  } else {
    drawCard(margin + (cardW + 5) * 2, yPos, cardW, cardH, 'CTR Medio', (data.predictions.trends.avgCtr || 0).toFixed(2) + '%');
  }
  
  drawCard(margin + (cardW + 5) * 3, yPos, cardW, cardH, 'CTR Medio', (data.predictions.trends.avgCtr || 0).toFixed(2) + '%');
  
  yPos += cardH + 10;
  
  // Balance info box
  const balanceStatus = data.accountBalance.status;
  const statusColor = balanceStatus === 'critical' ? colors.primary : balanceStatus === 'warning' ? colors.warning : colors.success;
  
  doc.setFillColor(colors.gray50.r, colors.gray50.g, colors.gray50.b);
  doc.roundedRect(margin, yPos, contentWidth, 22, 4, 4, 'F');
  doc.setDrawColor(colors.gray200.r, colors.gray200.g, colors.gray200.b);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, yPos, contentWidth, 22, 4, 4, 'S');
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.gray600.r, colors.gray600.g, colors.gray600.b);
  doc.text('Saldo da Conta:', margin + 8, yPos + 10);
  
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(statusColor.r, statusColor.g, statusColor.b);
  doc.text(formatCurrency(data.accountBalance.balance), margin + 55, yPos + 10);
  
  if (data.accountBalance.daysOfSpendRemaining !== null) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.gray500.r, colors.gray500.g, colors.gray500.b);
    const statusLabel = balanceStatus === 'critical' ? 'CRITICO' : balanceStatus === 'warning' ? 'ATENCAO' : 'OK';
    doc.text(data.accountBalance.daysOfSpendRemaining + ' dias restantes (' + statusLabel + ')', margin + 8, yPos + 18);
  }
  
  yPos += 32;

  // ========================================
  // 2. PROJECOES
  // ========================================
  checkNewPage(60);
  addSection('2', 'Projecoes de Performance');
  
  // Calculate year projections
  const today = new Date();
  const endOfYear = new Date(today.getFullYear(), 11, 31);
  const daysRemaining = Math.ceil((endOfYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const projectedSpendYear = data.predictions.trends.avgDailySpend * daysRemaining;
  const projectedConversionsYear = data.predictions.trends.avgDailyConversions * daysRemaining;
  
  const headers = ['Metrica', 'Prox. 7 Dias', 'Prox. 30 Dias', 'Resto do Ano'];
  const rows = [
    ['Investimento', formatCurrency(data.predictions.next7Days.estimatedSpend), formatCurrency(data.predictions.next30Days.estimatedSpend), formatCurrency(projectedSpendYear)],
    [showCPL ? 'Leads' : 'Conversoes', formatNumber(data.predictions.next7Days.estimatedConversions), formatNumber(data.predictions.next30Days.estimatedConversions), formatNumber(projectedConversionsYear)],
  ];
  
  if (showROAS && !showCPL) {
    const projectedRevenueYear = data.predictions.trends.avgDailyRoas !== null
      ? projectedSpendYear * data.predictions.trends.avgDailyRoas
      : 0;
    rows.push(['Receita', formatCurrency(data.predictions.next7Days.estimatedRevenue), formatCurrency(data.predictions.next30Days.estimatedRevenue), formatCurrency(projectedRevenueYear)]);
  }
  
  const colWidths = [45, 45, 45, 45];
  drawTable(headers, rows, colWidths);

  // ========================================
  // 3. DESEMPENHO 30 DIAS
  // ========================================
  checkNewPage(60);
  addSection('3', 'Desempenho dos Ultimos 30 Dias');
  
  // Performance cards
  const perfCardW = (contentWidth - 10) / 3;
  
  drawCard(margin, yPos, perfCardW, cardH, 'Total Investido', formatCurrency(data.totals.spend30Days), true);
  drawCard(margin + perfCardW + 5, yPos, perfCardW, cardH, showCPL ? 'Total Leads' : 'Total Conv', formatNumber(data.totals.conversions30Days));
  
  if (showCPL && data.totals.conversions30Days > 0) {
    const avgCpl = data.totals.spend30Days / data.totals.conversions30Days;
    drawCard(margin + (perfCardW + 5) * 2, yPos, perfCardW, cardH, 'CPL Medio', formatCurrency(avgCpl), true);
  } else if (showROAS && data.totals.revenue30Days > 0) {
    const avgRoas = data.totals.revenue30Days / data.totals.spend30Days;
    drawCard(margin + (perfCardW + 5) * 2, yPos, perfCardW, cardH, 'ROAS Medio', avgRoas.toFixed(2) + 'x');
  } else {
    drawCard(margin + (perfCardW + 5) * 2, yPos, perfCardW, cardH, 'Cliques', formatNumber(data.totals.clicks30Days));
  }
  
  yPos += cardH + 10;
  
  // Additional metrics
  doc.setFillColor(colors.gray50.r, colors.gray50.g, colors.gray50.b);
  doc.roundedRect(margin, yPos, contentWidth, 35, 4, 4, 'F');
  yPos += 8;
  
  addInfoRow('Total de Cliques', formatNumber(data.totals.clicks30Days));
  addInfoRow('Total de Impressoes', formatNumber(data.totals.impressions30Days));
  addInfoRow('Media Diaria (' + (showCPL ? 'Leads' : 'Conv') + ')', formatNumber(data.totals.conversions30Days / 30));
  
  yPos += 5;
  
  // Best/Worst analysis
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
      
      yPos += 5;
      addInfoRow('Melhor Dia: ' + bestDay.date, formatNumber(bestDay.conversions) + ' ' + (showCPL ? 'leads' : 'conv') + ' | CPL ' + formatCurrency(bestDay.spend / bestDay.conversions), colors.success);
      addInfoRow('Pior Dia: ' + worstDay.date, formatNumber(worstDay.conversions) + ' ' + (showCPL ? 'leads' : 'conv') + ' | CPL ' + formatCurrency(worstDay.spend / worstDay.conversions), colors.primary);
    }
  }

  // ========================================
  // 4. PROGRESSO DE METAS
  // ========================================
  const campaignsWithData = data.campaignGoalsProgress.filter(c => c.spend > 0).slice(0, 8);
  if (campaignsWithData.length > 0) {
    checkNewPage(60);
    addSection('4', 'Progresso de Metas por Campanha');
    
    // Campaign table
    const campHeaders = ['Campanha', 'Investido', showCPL ? 'Leads' : 'Conv', showCPL ? 'CPL' : 'ROAS', 'Status'];
    const campRows = campaignsWithData.map(c => {
      const name = c.campaignName.length > 28 ? c.campaignName.slice(0, 28) + '...' : c.campaignName;
      const status = showCPL ? c.cplStatus : c.roasStatus;
      const statusText = status === 'success' ? 'OK' : status === 'warning' ? '!' : 'X';
      return [
        name,
        formatCurrency(c.spend),
        formatNumber(c.conversions),
        showCPL && c.cpl !== null ? formatCurrency(c.cpl) : (c.roas !== null ? c.roas.toFixed(2) + 'x' : '-'),
        statusText
      ];
    });
    
    const campColWidths = [70, 35, 25, 30, 20];
    drawTable(campHeaders, campRows, campColWidths);
  }

  // ========================================
  // 5. SUGESTOES
  // ========================================
  checkNewPage(50);
  addSection('5', 'Sugestoes de Otimizacao');
  
  if (data.suggestions.length === 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.gray500.r, colors.gray500.g, colors.gray500.b);
    doc.text('Nenhuma sugestao de otimizacao no momento.', margin + 5, yPos);
    yPos += 15;
  } else {
    data.suggestions.slice(0, 5).forEach((suggestion) => {
      checkNewPage(25);
      
      const priorityColor = suggestion.priority === 'high' ? colors.primary : 
                           suggestion.priority === 'medium' ? colors.warning : colors.success;
      const priorityLabel = suggestion.priority === 'high' ? 'ALTA' : 
                           suggestion.priority === 'medium' ? 'MEDIA' : 'BAIXA';
      
      // Card
      doc.setFillColor(colors.white.r, colors.white.g, colors.white.b);
      doc.roundedRect(margin, yPos, contentWidth, 22, 4, 4, 'F');
      doc.setDrawColor(colors.gray200.r, colors.gray200.g, colors.gray200.b);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, yPos, contentWidth, 22, 4, 4, 'S');
      
      // Priority indicator
      doc.setFillColor(priorityColor.r, priorityColor.g, priorityColor.b);
      doc.rect(margin, yPos, 4, 22, 'F');
      
      // Title
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(colors.gray900.r, colors.gray900.g, colors.gray900.b);
      const title = sanitizeText(suggestion.title);
      const truncTitle = title.length > 60 ? title.slice(0, 60) + '...' : title;
      doc.text(truncTitle, margin + 10, yPos + 9);
      
      // Priority badge
      doc.setFontSize(7);
      doc.setTextColor(priorityColor.r, priorityColor.g, priorityColor.b);
      doc.text(priorityLabel, pageWidth - margin - 5, yPos + 9, { align: 'right' });
      
      // Description
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.gray600.r, colors.gray600.g, colors.gray600.b);
      const desc = sanitizeText(suggestion.description);
      const truncDesc = desc.length > 90 ? desc.slice(0, 90) + '...' : desc;
      doc.text(truncDesc, margin + 10, yPos + 17);
      
      yPos += 27;
    });
  }

  // === FOOTER ===
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Footer line
    doc.setDrawColor(colors.gray200.r, colors.gray200.g, colors.gray200.b);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    
    // Footer text
    doc.setFontSize(7);
    doc.setTextColor(colors.gray500.r, colors.gray500.g, colors.gray500.b);
    doc.text('Relatorio gerado em ' + new Date().toLocaleString('pt-BR'), margin, pageHeight - 6);
    doc.text('Pagina ' + i + ' de ' + pageCount, pageWidth - margin, pageHeight - 6, { align: 'right' });
  }

  // Save
  const fileName = 'analise-preditiva-' + sanitizeText(data.project.name).replace(/\s+/g, '-').toLowerCase() + '-' + new Date().toISOString().split('T')[0] + '.pdf';
  doc.save(fileName);
};