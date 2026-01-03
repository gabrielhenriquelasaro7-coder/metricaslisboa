import { jsPDF } from 'jspdf';
import { PredictiveAnalysisData } from '@/hooks/usePredictiveAnalysis';

export const generatePredictiveReportPDF = (data: PredictiveAnalysisData): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: data.project.currency || 'BRL',
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(Math.round(value));
  };

  const addTitle = (text: string, size: number = 16) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(41, 37, 36); // stone-800
    doc.text(text, margin, yPos);
    yPos += size * 0.5 + 5;
  };

  const addText = (text: string, size: number = 10, color: number[] = [82, 82, 91]) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(color[0], color[1], color[2]);
    
    // Handle long text with word wrap
    const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
    doc.text(lines, margin, yPos);
    yPos += lines.length * (size * 0.4) + 3;
  };

  const addSection = (title: string) => {
    yPos += 8;
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, yPos - 4, pageWidth - margin, yPos - 4);
    addTitle(title, 14);
  };

  const addKeyValue = (label: string, value: string, highlight: boolean = false) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(82, 82, 91);
    doc.text(label, margin, yPos);
    
    doc.setFont('helvetica', 'bold');
    if (highlight) {
      doc.setTextColor(22, 163, 74); // green-600
    }
    doc.text(value, pageWidth - margin, yPos, { align: 'right' });
    yPos += 7;
  };

  const checkNewPage = (neededSpace: number = 30) => {
    if (yPos > doc.internal.pageSize.getHeight() - neededSpace) {
      doc.addPage();
      yPos = 20;
    }
  };

  // Header
  addTitle('Relatório de Análise Preditiva', 20);
  addText(`Projeto: ${data.project.name}`, 12);
  addText(`Gerado em: ${new Date(data.generatedAt).toLocaleString('pt-BR')}`, 10);

  // Account Balance
  addSection('Saldo da Conta');
  addKeyValue('Saldo Atual', formatCurrency(data.accountBalance.balance));
  if (data.accountBalance.daysOfSpendRemaining !== null) {
    const statusText = data.accountBalance.status === 'critical' ? ' (CRÍTICO!)' : 
                       data.accountBalance.status === 'warning' ? ' (Atenção)' : '';
    addKeyValue('Dias de Saldo Restante', `${data.accountBalance.daysOfSpendRemaining} dias${statusText}`);
  }

  // Predictions
  addSection('Previsões de Performance');
  addTitle('Próximos 7 Dias', 12);
  addKeyValue('Gasto Estimado', formatCurrency(data.predictions.next7Days.estimatedSpend));
  addKeyValue('Conversões Estimadas', formatNumber(data.predictions.next7Days.estimatedConversions));
  addKeyValue('Receita Estimada', formatCurrency(data.predictions.next7Days.estimatedRevenue));

  yPos += 5;
  addTitle('Próximos 30 Dias', 12);
  addKeyValue('Gasto Estimado', formatCurrency(data.predictions.next30Days.estimatedSpend));
  addKeyValue('Conversões Estimadas', formatNumber(data.predictions.next30Days.estimatedConversions));
  addKeyValue('Receita Estimada', formatCurrency(data.predictions.next30Days.estimatedRevenue));

  // Trends
  checkNewPage();
  addSection('Tendências Médias Diárias');
  addKeyValue('Gasto Médio/Dia', formatCurrency(data.predictions.trends.avgDailySpend));
  addKeyValue('Conversões Médias/Dia', formatNumber(data.predictions.trends.avgDailyConversions));
  if (data.predictions.trends.avgDailyCpl !== null) {
    addKeyValue('CPL Médio', formatCurrency(data.predictions.trends.avgDailyCpl));
  }
  if (data.predictions.trends.avgDailyRoas !== null) {
    addKeyValue('ROAS Médio', `${data.predictions.trends.avgDailyRoas.toFixed(2)}x`);
  }
  const trendDirection = data.predictions.trends.spendTrend > 0 ? '+' : '';
  addKeyValue('Tendência de Gasto', `${trendDirection}${data.predictions.trends.spendTrend.toFixed(1)}% vs semana anterior`);

  // 30 Days Summary
  checkNewPage();
  addSection('Resumo dos Últimos 30 Dias');
  addKeyValue('Total Gasto', formatCurrency(data.totals.spend30Days));
  addKeyValue('Total Conversões', formatNumber(data.totals.conversions30Days));
  addKeyValue('Total Receita', formatCurrency(data.totals.revenue30Days));
  addKeyValue('Total Cliques', formatNumber(data.totals.clicks30Days));
  addKeyValue('Total Impressões', formatNumber(data.totals.impressions30Days));

  // Budget Alerts
  const criticalAlerts = data.budgetAlerts.filter(a => a.budgetStatus === 'critical' || a.budgetStatus === 'warning');
  if (criticalAlerts.length > 0) {
    checkNewPage();
    addSection('Alertas de Orçamento');
    criticalAlerts.forEach(alert => {
      const status = alert.budgetStatus === 'critical' ? '🚨 CRÍTICO' : '⚠️ Atenção';
      addText(`${status}: ${alert.campaignName}`);
      addKeyValue('  Gasto/Limite', `${formatCurrency(alert.currentSpend)} / ${formatCurrency(alert.lifetimeBudget)}`);
      if (alert.daysRemaining !== null) {
        addKeyValue('  Dias Restantes', `${alert.daysRemaining} dias`);
      }
      yPos += 3;
    });
  }

  // Campaign Goals
  const campaignsWithData = data.campaignGoalsProgress.filter(c => c.spend > 0).slice(0, 10);
  if (campaignsWithData.length > 0) {
    checkNewPage(50);
    addSection('Performance por Campanha');
    
    campaignsWithData.forEach((campaign, index) => {
      checkNewPage(40);
      addTitle(`${index + 1}. ${campaign.campaignName.slice(0, 40)}...`, 11);
      addKeyValue('  Investido', formatCurrency(campaign.spend));
      addKeyValue('  Conversões', formatNumber(campaign.conversions));
      if (campaign.roas !== null) {
        const roasStatus = campaign.roasStatus === 'success' ? '✓' : 
                          campaign.roasStatus === 'warning' ? '!' : '✗';
        addKeyValue('  ROAS', `${campaign.roas.toFixed(2)}x (meta: ${campaign.targetRoas}x) ${roasStatus}`);
      }
      if (campaign.cpl !== null) {
        const cplStatus = campaign.cplStatus === 'success' ? '✓' : 
                         campaign.cplStatus === 'warning' ? '!' : '✗';
        addKeyValue('  CPL', `${formatCurrency(campaign.cpl)} (meta: ${formatCurrency(campaign.targetCpl)}) ${cplStatus}`);
      }
      yPos += 5;
    });
  }

  // Suggestions
  checkNewPage(60);
  addSection('Sugestões de Otimização');
  
  data.suggestions.forEach((suggestion, index) => {
    checkNewPage(30);
    const priorityLabel = suggestion.priority === 'high' ? '🔴 Alta' : 
                         suggestion.priority === 'medium' ? '🟡 Média' : '🟢 Baixa';
    
    addTitle(`${index + 1}. ${suggestion.title}`, 11);
    addText(`   Prioridade: ${priorityLabel}`, 9);
    addText(`   ${suggestion.description}`, 10);
    addText(`   Motivo: ${suggestion.reason}`, 9, [107, 114, 128]);
    yPos += 5;
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text(
    `Relatório gerado automaticamente - ${new Date().toLocaleString('pt-BR')}`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: 'center' }
  );

  // Save
  const fileName = `analise-preditiva-${data.project.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};
