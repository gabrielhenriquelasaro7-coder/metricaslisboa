import { forwardRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { Separator } from '@/components/ui/separator';
import { ResponsiveContainer, ComposedChart, LineChart, BarChart, AreaChart, Line, Bar, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ChartConfig, MetricItem, PageStyle, METRIC_LABELS, ChartType } from './types';

interface PDFPreviewProps {
  reportTitle: string;
  dateRange: DateRange | undefined;
  periodLabel: string;
  logoFile: string | null;
  sections: {
    header: boolean;
    summary: boolean;
    generalMetrics: boolean;
    resultMetrics: boolean;
    chart: boolean;
  };
  generalMetrics: MetricItem[];
  resultMetrics: MetricItem[];
  currentMetrics: {
    spend: number;
    conversions: number;
    conversion_value: number;
    roas: number;
    cpa: number;
    reach: number;
    clicks: number;
  };
  businessModel: 'inside_sales' | 'ecommerce' | 'pdv' | null;
  currency: string;
  chartConfig: ChartConfig;
  chartData: Array<{ date: string; [key: string]: string | number }>;
  pageStyle: PageStyle;
}

const formatCurrency = (value: number, currency: string) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);

const formatNumber = (num: number) => 
  num >= 1000000 ? (num / 1000000).toFixed(1) + 'M' : num >= 1000 ? (num / 1000).toFixed(1) + 'K' : num.toLocaleString('pt-BR');

export const PDFPreview = forwardRef<HTMLDivElement, PDFPreviewProps>(({
  reportTitle,
  dateRange,
  periodLabel,
  logoFile,
  sections,
  generalMetrics,
  resultMetrics,
  currentMetrics,
  businessModel,
  currency,
  chartConfig,
  chartData,
  pageStyle,
}, chartRef) => {

  const renderChart = () => {
    if (!chartData.length) {
      return <div className="flex items-center justify-center h-full text-gray-500">Sem dados para o período</div>;
    }

    const ChartComponent = 
      chartConfig.type === 'line' ? LineChart : 
      chartConfig.type === 'bar' ? BarChart : 
      chartConfig.type === 'area' ? AreaChart : 
      ComposedChart;

    return (
      <ChartComponent data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        {chartConfig.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
        <XAxis dataKey="date" tick={{ fill: '#374151', fontSize: 10 }} axisLine={{ stroke: '#d1d5db' }} tickLine={{ stroke: '#d1d5db' }} />
        <YAxis yAxisId="left" tick={{ fill: '#374151', fontSize: 10 }} axisLine={{ stroke: '#d1d5db' }} tickLine={{ stroke: '#d1d5db' }} />
        {chartConfig.secondaryMetric !== 'none' && (
          <YAxis yAxisId="right" orientation="right" tick={{ fill: '#374151', fontSize: 10 }} axisLine={{ stroke: '#d1d5db' }} tickLine={{ stroke: '#d1d5db' }} />
        )}
        <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', color: '#111' }} />
        <Legend wrapperStyle={{ color: '#374151' }} />
        
        {chartConfig.type === 'bar' || chartConfig.type === 'composed' ? (
          <Bar yAxisId="left" dataKey={chartConfig.primaryMetric} fill={chartConfig.primaryColor} radius={[4, 4, 0, 0]} name={METRIC_LABELS[chartConfig.primaryMetric]} />
        ) : chartConfig.type === 'area' ? (
          <Area yAxisId="left" type="monotone" dataKey={chartConfig.primaryMetric} stroke={chartConfig.primaryColor} fill={chartConfig.primaryColor} fillOpacity={0.3} name={METRIC_LABELS[chartConfig.primaryMetric]} />
        ) : (
          <Line yAxisId="left" type="monotone" dataKey={chartConfig.primaryMetric} stroke={chartConfig.primaryColor} strokeWidth={2} dot={false} name={METRIC_LABELS[chartConfig.primaryMetric]} />
        )}
        
        {chartConfig.secondaryMetric !== 'none' && (
          <Line yAxisId="right" type="monotone" dataKey={chartConfig.secondaryMetric} stroke={chartConfig.secondaryColor} strokeWidth={2} dot={false} name={METRIC_LABELS[chartConfig.secondaryMetric]} />
        )}
      </ChartComponent>
    );
  };

  const getSummaryText = () => {
    if (businessModel === 'ecommerce') {
      return `Investimento ${formatCurrency(currentMetrics.spend, currency)} → ${formatNumber(currentMetrics.conversions)} vendas, ${formatCurrency(currentMetrics.conversion_value, currency)} receita, ROAS ${currentMetrics.roas.toFixed(2)}x`;
    }
    if (businessModel === 'inside_sales') {
      return `Investimento ${formatCurrency(currentMetrics.spend, currency)} → ${formatNumber(currentMetrics.conversions)} leads, CPL ${formatCurrency(currentMetrics.cpa, currency)}`;
    }
    return `Investimento ${formatCurrency(currentMetrics.spend, currency)} → ${formatNumber(currentMetrics.reach)} alcance, ${formatNumber(currentMetrics.clicks)} cliques`;
  };

  return (
    <div className="p-6 space-y-4 bg-white text-gray-900 min-h-full">
      {/* Header Bar */}
      {pageStyle.showHeaderBar && (
        <div className="h-2 rounded-full" style={{ backgroundColor: pageStyle.headerColor }} />
      )}

      {/* Header */}
      {sections.header && (
        <div className="flex items-start gap-4">
          {logoFile && <img src={logoFile} alt="Logo" className="h-12 w-12 object-contain rounded" />}
          <div>
            <h1 className="text-xl font-bold text-gray-900">{reportTitle}</h1>
            <p className="text-sm text-gray-500">
              {dateRange?.from && dateRange?.to 
                ? `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}` 
                : periodLabel}
            </p>
            <p className="text-xs text-gray-400">Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
          </div>
        </div>
      )}
      {sections.header && <Separator className="bg-gray-200" />}
      
      {/* Summary */}
      {sections.summary && (
        <div className="p-3 rounded-lg" style={{ backgroundColor: `${pageStyle.accentColor}10` }}>
          <h3 className="text-xs font-semibold text-gray-600 mb-1">Resumo Executivo</h3>
          <p className="text-sm text-gray-700">{getSummaryText()}</p>
        </div>
      )}
      
      {/* General Metrics */}
      {sections.generalMetrics && generalMetrics.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-800">Métricas Gerais</h2>
          <div className="grid grid-cols-3 gap-2">
            {generalMetrics.map(m => (
              <div key={m.key} className="p-2 bg-gray-50 rounded text-center">
                <p className="text-[10px] text-gray-500">{m.label}</p>
                <p className="text-sm font-semibold text-gray-900">{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Result Metrics */}
      {sections.resultMetrics && resultMetrics.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-800">Métricas de Resultado</h2>
          <div className="grid grid-cols-2 gap-2">
            {resultMetrics.map(m => (
              <div 
                key={m.key} 
                className="p-2 rounded text-center"
                style={{ backgroundColor: `${pageStyle.accentColor}10` }}
              >
                <p className="text-[10px] text-gray-500">{m.label}</p>
                <p className="text-sm font-semibold" style={{ color: pageStyle.accentColor }}>{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Chart */}
      {sections.chart && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-800">Evolução Diária</h2>
          <div ref={chartRef} className="h-48 bg-white rounded-lg border border-gray-200 p-3">
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Footer Bar */}
      {pageStyle.showFooterBar && (
        <div className="h-2 rounded-full mt-4" style={{ backgroundColor: pageStyle.footerColor }} />
      )}
    </div>
  );
});

PDFPreview.displayName = 'PDFPreview';
