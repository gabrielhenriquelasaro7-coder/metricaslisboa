import { useMemo, useState } from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface DREConfig {
  platformFeePercent: number;
  taxPercent: number;
  refundPercent: number;
  fixedCosts: number;
  otherCosts: number;
}

interface CompleteDREProps {
  // Revenue sources
  grossRevenue: number;
  adSpend: number;
  businessModel: 'inside_sales' | 'ecommerce' | 'pdv' | 'infoproduto';
  
  // Optional overrides
  platformFeePercent?: number;
  taxPercent?: number;
  refundPercent?: number;
  fixedCosts?: number;
  otherCosts?: number;
  
  // Metadata
  periodLabel?: string;
  isLoading?: boolean;
  onConfigChange?: (config: DREConfig) => void;
}

// Default platform fees by business model
const PLATFORM_DEFAULTS: Record<string, { fee: number; tax: number; refund: number }> = {
  infoproduto: { fee: 9.9, tax: 6.38, refund: 5 }, // Hotmart/Kiwify típico
  ecommerce: { fee: 4.99, tax: 9.25, refund: 3 }, // Stripe/PagSeguro típico
  inside_sales: { fee: 0, tax: 6.38, refund: 2 }, // Sem plataforma
  pdv: { fee: 2.5, tax: 9.25, refund: 1 }, // Maquininha típica
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
  grossRevenue,
  adSpend,
  businessModel,
  platformFeePercent,
  taxPercent,
  refundPercent,
  fixedCosts = 0,
  otherCosts = 0,
  periodLabel = 'Período atual',
  isLoading,
  onConfigChange,
}: CompleteDREProps) {
  const defaults = PLATFORM_DEFAULTS[businessModel] || PLATFORM_DEFAULTS.infoproduto;
  
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<DREConfig>({
    platformFeePercent: platformFeePercent ?? defaults.fee,
    taxPercent: taxPercent ?? defaults.tax,
    refundPercent: refundPercent ?? defaults.refund,
    fixedCosts,
    otherCosts,
  });

  // Calculate DRE items
  const dreData = useMemo(() => {
    const platformFee = grossRevenue * (config.platformFeePercent / 100);
    const taxes = grossRevenue * (config.taxPercent / 100);
    const refunds = grossRevenue * (config.refundPercent / 100);
    
    const totalDeductions = platformFee + taxes + refunds;
    const netRevenue = grossRevenue - totalDeductions;
    
    // Marketing costs (CAC)
    const marketingCost = adSpend;
    
    // Contribution margin
    const contributionMargin = netRevenue - marketingCost;
    const contributionMarginPercent = grossRevenue > 0 ? (contributionMargin / grossRevenue) * 100 : 0;
    
    // Operating expenses
    const totalOperatingExpenses = config.fixedCosts + config.otherCosts;
    
    // EBITDA
    const ebitda = contributionMargin - totalOperatingExpenses;
    const ebitdaMarginPercent = grossRevenue > 0 ? (ebitda / grossRevenue) * 100 : 0;
    
    // ROI and ROAS
    const roas = adSpend > 0 ? grossRevenue / adSpend : 0;
    const roasReal = adSpend > 0 ? netRevenue / adSpend : 0;
    const roi = adSpend > 0 ? ((ebitda / adSpend) * 100) : 0;
    
    // CPL/CPA approximation
    const cpl = grossRevenue > 0 && adSpend > 0 ? adSpend / (grossRevenue / 100) : 0; // Rough estimate
    
    return {
      grossRevenue,
      platformFee,
      taxes,
      refunds,
      totalDeductions,
      netRevenue,
      marketingCost,
      contributionMargin,
      contributionMarginPercent,
      fixedCosts: config.fixedCosts,
      otherCosts: config.otherCosts,
      totalOperatingExpenses,
      ebitda,
      ebitdaMarginPercent,
      roas,
      roasReal,
      roi,
    };
  }, [grossRevenue, adSpend, config]);

  const handleSaveConfig = () => {
    onConfigChange?.(config);
    setShowConfig(false);
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

  const DRELine = ({ 
    label, 
    value, 
    isSubtraction = false, 
    isTotal = false, 
    highlight = false,
    indent = 0,
    percentage,
    tooltip,
  }: {
    label: string;
    value: number;
    isSubtraction?: boolean;
    isTotal?: boolean;
    highlight?: boolean;
    indent?: number;
    percentage?: number;
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
            'text-sm',
            isSubtraction && 'text-muted-foreground',
            isTotal && 'font-semibold',
            highlight && 'font-bold'
          )}
        >
          {isSubtraction && '(-) '}
          {label}
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
        {percentage !== undefined && (
          <Badge variant="outline" className="text-xs font-normal">
            {formatPercent(percentage)}
          </Badge>
        )}
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
                Demonstração de Resultado do Exercício • {periodLabel}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
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
          {/* Gross Revenue */}
          <DRELine
            label="Receita Bruta de Vendas"
            value={dreData.grossRevenue}
            highlight
            tooltip="Valor total de vendas no período (conversion_value dos anúncios ou dados do CRM)"
          />

          {/* Deductions Section */}
          <div className="pt-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 mb-2">
              Deduções da Receita
            </p>
            <DRELine
              label="Taxa da Plataforma"
              value={dreData.platformFee}
              isSubtraction
              indent={1}
              percentage={config.platformFeePercent}
              tooltip="Taxa cobrada pela plataforma de vendas (Hotmart, Kiwify, Stripe, etc.)"
            />
            <DRELine
              label="Impostos sobre Vendas"
              value={dreData.taxes}
              isSubtraction
              indent={1}
              percentage={config.taxPercent}
              tooltip="ISS, PIS, COFINS e outros impostos sobre o faturamento"
            />
            <DRELine
              label="Devoluções e Chargebacks"
              value={dreData.refunds}
              isSubtraction
              indent={1}
              percentage={config.refundPercent}
              tooltip="Reembolsos, estornos e chargebacks do período"
            />
          </div>

          <Separator className="my-3" />

          {/* Net Revenue */}
          <DRELine
            label="Receita Líquida"
            value={dreData.netRevenue}
            isTotal
            tooltip="Receita bruta menos todas as deduções"
          />

          {/* Marketing Costs */}
          <div className="pt-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 mb-2">
              Custos de Aquisição
            </p>
            <DRELine
              label="Investimento em Mídia (Ads)"
              value={dreData.marketingCost}
              isSubtraction
              indent={1}
              tooltip="Total gasto em anúncios Meta Ads + Google Ads"
            />
          </div>

          <Separator className="my-3" />

          {/* Contribution Margin */}
          <DRELine
            label="Margem de Contribuição"
            value={dreData.contributionMargin}
            isTotal
            percentage={dreData.contributionMarginPercent}
            tooltip="Receita líquida menos custos de aquisição de clientes"
          />

          {/* Operating Expenses */}
          {(dreData.fixedCosts > 0 || dreData.otherCosts > 0) && (
            <>
              <div className="pt-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 mb-2">
                  Despesas Operacionais
                </p>
                {dreData.fixedCosts > 0 && (
                  <DRELine
                    label="Custos Fixos"
                    value={dreData.fixedCosts}
                    isSubtraction
                    indent={1}
                    tooltip="Salários, aluguel, ferramentas, etc."
                  />
                )}
                {dreData.otherCosts > 0 && (
                  <DRELine
                    label="Outras Despesas"
                    value={dreData.otherCosts}
                    isSubtraction
                    indent={1}
                  />
                )}
              </div>
              <Separator className="my-3" />
            </>
          )}

          {/* EBITDA */}
          <DRELine
            label="EBITDA (Lucro Operacional)"
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

      {/* Config Dialog */}
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurar Deduções do DRE
            </DialogTitle>
            <DialogDescription>
              Ajuste as taxas e custos de acordo com seu negócio
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
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

            <Separator />

            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Custos Fixos (Opcional)
              </h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fixedCosts">Custos Fixos (R$)</Label>
                  <Input
                    id="fixedCosts"
                    type="number"
                    value={config.fixedCosts}
                    onChange={e => setConfig(c => ({ ...c, fixedCosts: parseFloat(e.target.value) || 0 }))}
                  />
                  <p className="text-xs text-muted-foreground">Salários, ferramentas, etc.</p>
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
