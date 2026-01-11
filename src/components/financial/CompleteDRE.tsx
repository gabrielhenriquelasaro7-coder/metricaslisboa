import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp,
  TrendingDown,
  MinusCircle,
  ChevronRight,
  Settings,
  HelpCircle,
  DollarSign,
  Percent,
  Calculator,
  BarChart3,
  Wallet,
  Calendar,
  Edit3,
  Check,
  X,
  Type,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface DREConfig {
  // Main values (editable)
  grossRevenue: number;
  adSpend: number;
  // Percentage deductions
  platformFeePercent: number;
  taxPercent: number;
  refundPercent: number;
  // Fixed costs
  fixedCosts: number;
  otherCosts: number;
  // Product costs (for ecommerce/pdv)
  productCosts: number;
  // Team costs
  teamCosts: number;
  // Tool/software costs
  toolCosts: number;
}

interface DRELabels {
  grossRevenue: string;
  platformFee: string;
  taxes: string;
  refunds: string;
  netRevenue: string;
  productCosts: string;
  grossProfit: string;
  adSpend: string;
  contributionMargin: string;
  teamCosts: string;
  toolCosts: string;
  fixedCosts: string;
  otherCosts: string;
  ebitda: string;
}

const DEFAULT_LABELS: DRELabels = {
  grossRevenue: 'Receita Bruta de Vendas',
  platformFee: 'Taxa da Plataforma',
  taxes: 'Impostos sobre Vendas',
  refunds: 'Devoluções e Chargebacks',
  netRevenue: 'Receita Líquida',
  productCosts: 'Custo dos Produtos',
  grossProfit: 'Lucro Bruto',
  adSpend: 'Investimento em Mídia (Ads)',
  contributionMargin: 'Margem de Contribuição',
  teamCosts: 'Equipe / Pessoal',
  toolCosts: 'Ferramentas / Software',
  fixedCosts: 'Custos Fixos',
  otherCosts: 'Outras Despesas',
  ebitda: 'EBITDA (Lucro Operacional)',
};

export type DREPeriod = 'last_7d' | 'last_30d' | 'this_month' | 'last_month' | 'custom';

interface CompleteDREProps {
  // Revenue sources (default values from ads)
  grossRevenue: number;
  adSpend: number;
  businessModel: 'inside_sales' | 'ecommerce' | 'pdv' | 'infoproduto';
  
  // Period
  period?: DREPeriod;
  onPeriodChange?: (period: DREPeriod) => void;
  
  // Optional overrides
  platformFeePercent?: number;
  taxPercent?: number;
  refundPercent?: number;
  fixedCosts?: number;
  otherCosts?: number;
  productCosts?: number;
  teamCosts?: number;
  toolCosts?: number;
  
  // Metadata
  periodLabel?: string;
  isLoading?: boolean;
  onConfigChange?: (config: DREConfig) => void;
}

// Default platform fees by business model
const PLATFORM_DEFAULTS: Record<string, { fee: number; tax: number; refund: number; productCost: number }> = {
  infoproduto: { fee: 9.9, tax: 6.38, refund: 5, productCost: 0 },
  ecommerce: { fee: 4.99, tax: 9.25, refund: 3, productCost: 30 },
  inside_sales: { fee: 0, tax: 6.38, refund: 2, productCost: 0 },
  pdv: { fee: 2.5, tax: 9.25, refund: 1, productCost: 40 },
};

const PERIOD_LABELS: Record<DREPeriod, string> = {
  'last_7d': 'Últimos 7 dias',
  'last_30d': 'Últimos 30 dias',
  'this_month': 'Este mês',
  'last_month': 'Mês passado',
  'custom': 'Personalizado',
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

export function CompleteDRE({
  grossRevenue: initialRevenue,
  adSpend: initialAdSpend,
  businessModel,
  period = 'last_30d',
  onPeriodChange,
  platformFeePercent,
  taxPercent,
  refundPercent,
  fixedCosts = 0,
  otherCosts = 0,
  productCosts = 0,
  teamCosts = 0,
  toolCosts = 0,
  periodLabel,
  isLoading,
  onConfigChange,
}: CompleteDREProps) {
  const defaults = PLATFORM_DEFAULTS[businessModel] || PLATFORM_DEFAULTS.infoproduto;
  
  const [showConfig, setShowConfig] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [tempEditValue, setTempEditValue] = useState<string>('');
  
  const [config, setConfig] = useState<DREConfig>({
    grossRevenue: initialRevenue,
    adSpend: initialAdSpend,
    platformFeePercent: platformFeePercent ?? defaults.fee,
    taxPercent: taxPercent ?? defaults.tax,
    refundPercent: refundPercent ?? defaults.refund,
    fixedCosts,
    otherCosts,
    productCosts: productCosts || (initialRevenue * defaults.productCost / 100),
    teamCosts,
    toolCosts,
  });

  const [labels, setLabels] = useState<DRELabels>(DEFAULT_LABELS);

  // Update config when props change
  useEffect(() => {
    setConfig(prev => ({
      ...prev,
      grossRevenue: initialRevenue,
      adSpend: initialAdSpend,
    }));
  }, [initialRevenue, initialAdSpend]);

  // Calculate DRE items
  const dreData = useMemo(() => {
    const { grossRevenue, adSpend } = config;
    
    const platformFee = grossRevenue * (config.platformFeePercent / 100);
    const taxes = grossRevenue * (config.taxPercent / 100);
    const refunds = grossRevenue * (config.refundPercent / 100);
    
    const totalDeductions = platformFee + taxes + refunds;
    const netRevenue = grossRevenue - totalDeductions;
    
    // Product costs (CMV)
    const cmv = config.productCosts;
    const grossProfit = netRevenue - cmv;
    const grossProfitPercent = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0;
    
    // Marketing costs (CAC)
    const marketingCost = adSpend;
    
    // Contribution margin (after marketing)
    const contributionMargin = grossProfit - marketingCost;
    const contributionMarginPercent = grossRevenue > 0 ? (contributionMargin / grossRevenue) * 100 : 0;
    
    // Operating expenses
    const totalOperatingExpenses = config.fixedCosts + config.otherCosts + config.teamCosts + config.toolCosts;
    
    // EBITDA
    const ebitda = contributionMargin - totalOperatingExpenses;
    const ebitdaMarginPercent = grossRevenue > 0 ? (ebitda / grossRevenue) * 100 : 0;
    
    // ROI and ROAS
    const roas = adSpend > 0 ? grossRevenue / adSpend : 0;
    const roasReal = adSpend > 0 ? netRevenue / adSpend : 0;
    const roi = adSpend > 0 ? ((ebitda / adSpend) * 100) : 0;
    
    return {
      grossRevenue,
      platformFee,
      taxes,
      refunds,
      totalDeductions,
      netRevenue,
      cmv,
      grossProfit,
      grossProfitPercent,
      marketingCost,
      contributionMargin,
      contributionMarginPercent,
      teamCosts: config.teamCosts,
      toolCosts: config.toolCosts,
      fixedCosts: config.fixedCosts,
      otherCosts: config.otherCosts,
      totalOperatingExpenses,
      ebitda,
      ebitdaMarginPercent,
      roas,
      roasReal,
      roi,
    };
  }, [config]);

  const handleSaveConfig = () => {
    onConfigChange?.(config);
    setShowConfig(false);
  };

  const startEditing = (field: string, currentValue: number) => {
    setEditingField(field);
    setTempEditValue(currentValue.toString());
  };

  const saveEdit = (field: keyof DREConfig) => {
    const value = parseFloat(tempEditValue) || 0;
    setConfig(prev => ({ ...prev, [field]: value }));
    setEditingField(null);
    setTempEditValue('');
  };

  const startEditingLabel = (field: string, currentLabel: string) => {
    setEditingLabel(field);
    setTempEditValue(currentLabel);
  };

  const saveLabel = (field: keyof DRELabels) => {
    setLabels(prev => ({ ...prev, [field]: tempEditValue }));
    setEditingLabel(null);
    setTempEditValue('');
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditingLabel(null);
    setTempEditValue('');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5, 6, 7].map(i => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const EditableValue = ({ 
    field, 
    value, 
    isPercent = false,
    className = ''
  }: { 
    field: keyof DREConfig; 
    value: number; 
    isPercent?: boolean;
    className?: string;
  }) => {
    const isEditing = editingField === field;
    
    if (isEditing) {
      return (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            step={isPercent ? "0.1" : "0.01"}
            value={tempEditValue}
            onChange={e => setTempEditValue(e.target.value)}
            className="h-7 w-24 text-right text-sm"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter') saveEdit(field);
              if (e.key === 'Escape') cancelEdit();
            }}
          />
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveEdit(field)}>
            <Check className="h-3 w-3 text-metric-positive" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEdit}>
            <X className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      );
    }

    return (
      <button
        onClick={() => startEditing(field, value)}
        className={cn(
          'group flex items-center gap-1 hover:bg-muted/50 rounded px-2 py-0.5 transition-colors',
          className
        )}
      >
        <span className="tabular-nums">
          {isPercent ? formatPercent(value) : formatCurrency(value)}
        </span>
        <Edit3 className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
      </button>
    );
  };

  const EditableLabel = ({ 
    field, 
    children,
    className = ''
  }: { 
    field: keyof DRELabels; 
    children: string;
    className?: string;
  }) => {
    const isEditing = editingLabel === field;
    
    if (isEditing) {
      return (
        <div className="flex items-center gap-1">
          <Input
            type="text"
            value={tempEditValue}
            onChange={e => setTempEditValue(e.target.value)}
            className="h-7 w-40 text-sm"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter') saveLabel(field);
              if (e.key === 'Escape') cancelEdit();
            }}
          />
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveLabel(field)}>
            <Check className="h-3 w-3 text-metric-positive" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEdit}>
            <X className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      );
    }

    return (
      <button
        onClick={() => startEditingLabel(field, children)}
        className={cn(
          'group flex items-center gap-1 hover:bg-muted/30 rounded px-1 py-0.5 transition-colors text-left',
          className
        )}
      >
        <span>{children}</span>
        <Type className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
      </button>
    );
  };

  const DRELine = ({ 
    labelField,
    value, 
    editableField,
    isSubtraction = false, 
    isTotal = false, 
    highlight = false,
    indent = 0,
    percentage,
    percentageField,
    tooltip,
  }: {
    labelField: keyof DRELabels;
    value: number;
    editableField?: keyof DREConfig;
    isSubtraction?: boolean;
    isTotal?: boolean;
    highlight?: boolean;
    indent?: number;
    percentage?: number;
    percentageField?: keyof DREConfig;
    tooltip?: string;
  }) => (
    <div
      className={cn(
        'flex items-center justify-between py-3 px-4 rounded-lg transition-colors',
        isTotal && 'bg-muted/50 font-medium',
        highlight && 'bg-primary/10 border border-primary/20',
        !isTotal && !highlight && 'hover:bg-muted/30'
      )}
    >
      <div className="flex items-center gap-2">
        {indent > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground/50" />}
        <span
          className={cn(
            'text-sm flex items-center gap-1',
            isSubtraction && 'text-muted-foreground',
            isTotal && 'font-semibold',
            highlight && 'font-bold'
          )}
        >
          {isSubtraction && '(-) '}
          <EditableLabel field={labelField}>
            {labels[labelField]}
          </EditableLabel>
        </span>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/50" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-xs">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="flex items-center gap-3">
        {percentage !== undefined && percentageField && (
          <EditableValue field={percentageField} value={percentage} isPercent />
        )}
        {percentage !== undefined && !percentageField && (
          <Badge variant="outline" className="text-xs font-normal">
            {formatPercent(percentage)}
          </Badge>
        )}
        {editableField ? (
          <EditableValue 
            field={editableField} 
            value={value}
            className={cn(
              isSubtraction && 'text-muted-foreground',
              isTotal && 'font-semibold',
              highlight && 'font-bold text-lg',
              highlight && value >= 0 && 'text-metric-positive',
              highlight && value < 0 && 'text-destructive'
            )}
          />
        ) : (
          <span
            className={cn(
              'tabular-nums text-right min-w-[100px]',
              isSubtraction && 'text-muted-foreground',
              isTotal && 'font-semibold',
              highlight && 'font-bold text-lg',
              highlight && value >= 0 && 'text-metric-positive',
              highlight && value < 0 && 'text-destructive'
            )}
          >
            {formatCurrency(value)}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                <CardTitle>DRE Completo</CardTitle>
              </div>
              <CardDescription className="mt-1">
                Clique nos nomes ou valores para editar
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* Period Selector */}
              <Select value={period} onValueChange={(v) => onPeriodChange?.(v as DREPeriod)}>
                <SelectTrigger className="w-[160px] h-9">
                  <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PERIOD_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Badge variant="outline" className="gap-1">
                <BarChart3 className="w-3 h-3" />
                {businessModel === 'infoproduto' ? 'Infoproduto' :
                 businessModel === 'ecommerce' ? 'E-commerce' :
                 businessModel === 'inside_sales' ? 'Inside Sales' : 'PDV'}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowConfig(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {/* Gross Revenue - EDITABLE */}
          <DRELine
            labelField="grossRevenue"
            value={dreData.grossRevenue}
            editableField="grossRevenue"
            highlight
            tooltip="Valor total de vendas no período. Clique para editar."
          />

          {/* Deductions Section */}
          <div className="pt-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 mb-2">
              Deduções da Receita
            </p>
            <DRELine
              labelField="platformFee"
              value={dreData.platformFee}
              isSubtraction
              indent={1}
              percentage={config.platformFeePercent}
              percentageField="platformFeePercent"
              tooltip="Taxa cobrada pela plataforma de vendas"
            />
            <DRELine
              labelField="taxes"
              value={dreData.taxes}
              isSubtraction
              indent={1}
              percentage={config.taxPercent}
              percentageField="taxPercent"
              tooltip="ISS, PIS, COFINS e outros impostos"
            />
            <DRELine
              labelField="refunds"
              value={dreData.refunds}
              isSubtraction
              indent={1}
              percentage={config.refundPercent}
              percentageField="refundPercent"
              tooltip="Reembolsos e estornos"
            />
          </div>

          <Separator className="my-3" />

          {/* Net Revenue */}
          <DRELine
            labelField="netRevenue"
            value={dreData.netRevenue}
            isTotal
            tooltip="Receita bruta menos todas as deduções"
          />

          {/* CMV/Product Costs (for ecommerce/pdv) */}
          {(businessModel === 'ecommerce' || businessModel === 'pdv') && (
            <>
              <div className="pt-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 mb-2">
                  Custo das Mercadorias Vendidas (CMV)
                </p>
                <DRELine
                  labelField="productCosts"
                  value={dreData.cmv}
                  editableField="productCosts"
                  isSubtraction
                  indent={1}
                  tooltip="Custo de aquisição/produção dos produtos vendidos"
                />
              </div>

              <Separator className="my-3" />

              <DRELine
                labelField="grossProfit"
                value={dreData.grossProfit}
                isTotal
                percentage={dreData.grossProfitPercent}
                tooltip="Receita líquida menos custos dos produtos"
              />
            </>
          )}

          {/* Marketing Costs */}
          <div className="pt-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 mb-2">
              Custos de Marketing
            </p>
            <DRELine
              labelField="adSpend"
              value={dreData.marketingCost}
              editableField="adSpend"
              isSubtraction
              indent={1}
              tooltip="Total gasto em anúncios. Clique para editar."
            />
          </div>

          <Separator className="my-3" />

          {/* Contribution Margin */}
          <DRELine
            labelField="contributionMargin"
            value={dreData.contributionMargin}
            isTotal
            percentage={dreData.contributionMarginPercent}
            tooltip="Receita líquida menos custos variáveis"
          />

          {/* Operating Expenses */}
          <div className="pt-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 mb-2">
              Despesas Operacionais
            </p>
            <DRELine
              labelField="teamCosts"
              value={dreData.teamCosts}
              editableField="teamCosts"
              isSubtraction
              indent={1}
              tooltip="Salários, freelancers, comissões"
            />
            <DRELine
              labelField="toolCosts"
              value={dreData.toolCosts}
              editableField="toolCosts"
              isSubtraction
              indent={1}
              tooltip="SaaS, ferramentas de marketing, etc."
            />
            <DRELine
              labelField="fixedCosts"
              value={dreData.fixedCosts}
              editableField="fixedCosts"
              isSubtraction
              indent={1}
              tooltip="Aluguel, internet, energia, etc."
            />
            <DRELine
              labelField="otherCosts"
              value={dreData.otherCosts}
              editableField="otherCosts"
              isSubtraction
              indent={1}
              tooltip="Despesas variáveis diversas"
            />
          </div>

          <Separator className="my-3" />

          {/* EBITDA */}
          <DRELine
            labelField="ebitda"
            value={dreData.ebitda}
            isTotal
            highlight
            percentage={dreData.ebitdaMarginPercent}
            tooltip="Lucro antes de juros, impostos, depreciação e amortização"
          />

          {/* Key Metrics Summary */}
          <div className="mt-6 pt-4 border-t grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground mb-1">ROAS Bruto</p>
              <p className={cn(
                'text-xl font-bold',
                dreData.roas >= 2 ? 'text-metric-positive' : 
                dreData.roas >= 1 ? 'text-yellow-500' : 'text-destructive'
              )}>
                {dreData.roas.toFixed(2)}x
              </p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground mb-1">ROAS Real</p>
              <p className={cn(
                'text-xl font-bold',
                dreData.roasReal >= 1.5 ? 'text-metric-positive' : 
                dreData.roasReal >= 0.8 ? 'text-yellow-500' : 'text-destructive'
              )}>
                {dreData.roasReal.toFixed(2)}x
              </p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground mb-1">ROI</p>
              <p className={cn(
                'text-xl font-bold',
                dreData.roi >= 100 ? 'text-metric-positive' : 
                dreData.roi >= 0 ? 'text-yellow-500' : 'text-destructive'
              )}>
                {dreData.roi.toFixed(0)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Config Dialog for batch editing */}
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurar DRE Completo
            </DialogTitle>
            <DialogDescription>
              Ajuste todos os valores e taxas do seu DRE
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto">
            {/* Main Values */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Valores Principais
              </h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="grossRevenue">Receita Bruta (R$)</Label>
                  <Input
                    id="grossRevenue"
                    type="number"
                    value={config.grossRevenue}
                    onChange={e => setConfig(c => ({ ...c, grossRevenue: parseFloat(e.target.value) || 0 }))}
                  />
                  <p className="text-xs text-muted-foreground">Faturamento total</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adSpend">Investimento Ads (R$)</Label>
                  <Input
                    id="adSpend"
                    type="number"
                    value={config.adSpend}
                    onChange={e => setConfig(c => ({ ...c, adSpend: parseFloat(e.target.value) || 0 }))}
                  />
                  <p className="text-xs text-muted-foreground">Meta + Google Ads</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Percentage Deductions */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Percent className="h-4 w-4 text-primary" />
                Percentuais sobre a Receita
              </h4>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="platformFee">Taxa Plataforma (%)</Label>
                  <Input
                    id="platformFee"
                    type="number"
                    step="0.1"
                    value={config.platformFeePercent}
                    onChange={e => setConfig(c => ({ ...c, platformFeePercent: parseFloat(e.target.value) || 0 }))}
                  />
                  <p className="text-xs text-muted-foreground">Ex: Hotmart 9.9%</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxPercent">Impostos (%)</Label>
                  <Input
                    id="taxPercent"
                    type="number"
                    step="0.1"
                    value={config.taxPercent}
                    onChange={e => setConfig(c => ({ ...c, taxPercent: parseFloat(e.target.value) || 0 }))}
                  />
                  <p className="text-xs text-muted-foreground">ISS, PIS, COFINS</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="refundPercent">Reembolsos (%)</Label>
                  <Input
                    id="refundPercent"
                    type="number"
                    step="0.1"
                    value={config.refundPercent}
                    onChange={e => setConfig(c => ({ ...c, refundPercent: parseFloat(e.target.value) || 0 }))}
                  />
                  <p className="text-xs text-muted-foreground">Chargebacks</p>
                </div>
              </div>
            </div>

            {/* Product Costs */}
            {(businessModel === 'ecommerce' || businessModel === 'pdv') && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-primary" />
                    Custo dos Produtos (CMV)
                  </h4>
                  
                  <div className="space-y-2">
                    <Label htmlFor="productCosts">Custo dos Produtos (R$)</Label>
                    <Input
                      id="productCosts"
                      type="number"
                      value={config.productCosts}
                      onChange={e => setConfig(c => ({ ...c, productCosts: parseFloat(e.target.value) || 0 }))}
                    />
                    <p className="text-xs text-muted-foreground">Custo de aquisição/produção</p>
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Operating Expenses */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary" />
                Despesas Operacionais
              </h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="teamCosts">Equipe / Pessoal (R$)</Label>
                  <Input
                    id="teamCosts"
                    type="number"
                    value={config.teamCosts}
                    onChange={e => setConfig(c => ({ ...c, teamCosts: parseFloat(e.target.value) || 0 }))}
                  />
                  <p className="text-xs text-muted-foreground">Salários, freelancers</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="toolCosts">Ferramentas (R$)</Label>
                  <Input
                    id="toolCosts"
                    type="number"
                    value={config.toolCosts}
                    onChange={e => setConfig(c => ({ ...c, toolCosts: parseFloat(e.target.value) || 0 }))}
                  />
                  <p className="text-xs text-muted-foreground">SaaS, softwares</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fixedCosts">Custos Fixos (R$)</Label>
                  <Input
                    id="fixedCosts"
                    type="number"
                    value={config.fixedCosts}
                    onChange={e => setConfig(c => ({ ...c, fixedCosts: parseFloat(e.target.value) || 0 }))}
                  />
                  <p className="text-xs text-muted-foreground">Aluguel, energia, etc.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="otherCosts">Outras Despesas (R$)</Label>
                  <Input
                    id="otherCosts"
                    type="number"
                    value={config.otherCosts}
                    onChange={e => setConfig(c => ({ ...c, otherCosts: parseFloat(e.target.value) || 0 }))}
                  />
                  <p className="text-xs text-muted-foreground">Despesas variáveis</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Label Customization */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Type className="h-4 w-4 text-primary" />
                Personalizar Nomes dos Campos
              </h4>
              
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(labels).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={`label-${key}`} className="text-xs text-muted-foreground capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </Label>
                    <Input
                      id={`label-${key}`}
                      type="text"
                      value={value}
                      onChange={e => setLabels(l => ({ ...l, [key]: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfig(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveConfig}>
              Salvar Configurações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
