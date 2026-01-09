import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wallet, AlertTriangle, CheckCircle2, RefreshCw, TrendingDown, CreditCard, Banknote, CircleDollarSign, PauseCircle, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
interface AccountBalanceData {
  balance: number;
  currency: string;
  lastUpdated: string | null;
  daysOfSpendRemaining: number | null;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  avgDailySpend: number;
  autoReloadEnabled: boolean;
  fundingType: number | null;
  accountStatus: number | null;
}
interface AccountBalanceCardProps {
  projectId: string | null;
  currency?: string;
}

// Cache to persist balance data across period changes
const balanceCache = new Map<string, {
  data: AccountBalanceData;
  timestamp: number;
}>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function AccountBalanceCard({
  projectId,
  currency = 'BRL'
}: AccountBalanceCardProps) {
  const [data, setData] = useState<AccountBalanceData | null>(() => {
    // Initialize from cache if available
    if (projectId) {
      const cached = balanceCache.get(projectId);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(false);
  const hasFetched = useRef(false);
  const fetchBalance = useCallback(async (force = false) => {
    if (!projectId) return;

    // Check cache first (unless forced)
    if (!force) {
      const cached = balanceCache.get(projectId);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        setData(cached.data);
        return;
      }
    }
    setLoading(true);
    try {
      const {
        data: result,
        error
      } = await supabase.functions.invoke('predictive-analysis', {
        body: {
          projectId
        }
      });
      if (error) throw error;
      if (result?.accountBalance) {
        const newData: AccountBalanceData = {
          balance: result.accountBalance.balance || 0,
          currency: result.accountBalance.currency || currency,
          lastUpdated: result.accountBalance.lastUpdated,
          daysOfSpendRemaining: result.accountBalance.daysOfSpendRemaining,
          status: result.accountBalance.status || 'unknown',
          avgDailySpend: result.predictions?.trends?.avgDailySpend || 0,
          autoReloadEnabled: result.accountBalance.autoReloadEnabled || false,
          fundingType: result.accountBalance.fundingType || null,
          accountStatus: result.accountBalance.accountStatus || null
        };
        setData(newData);
        // Save to cache
        balanceCache.set(projectId, {
          data: newData,
          timestamp: Date.now()
        });
      }
    } catch (err) {
      console.error('Error fetching balance:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, currency]);
  useEffect(() => {
    // Only fetch on first mount or when projectId changes
    if (!hasFetched.current || !balanceCache.has(projectId || '')) {
      hasFetched.current = true;
      fetchBalance();
    }
  }, [projectId]); // Remove fetchBalance from deps to avoid re-fetching on period change

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: data?.currency || currency
    }).format(value);
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-metric-positive';
      case 'warning':
        return 'text-metric-warning';
      case 'critical':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };
  const getStatusBg = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-metric-positive/10 border-metric-positive/30';
      case 'warning':
        return 'bg-metric-warning/10 border-metric-warning/30';
      case 'critical':
        return 'bg-destructive/10 border-destructive/30';
      default:
        return 'bg-muted/50 border-border';
    }
  };
  const getFundingTypeInfo = (type: number | null) => {
    switch (type) {
      case 1:
        return {
          label: 'Cartão de Crédito',
          icon: CreditCard
        };
      case 2:
        return {
          label: 'Cupom Facebook',
          icon: CircleDollarSign
        };
      case 3:
        return {
          label: 'Saldo Pré-pago (PIX)',
          icon: Banknote
        };
      case 4:
        return {
          label: 'PayPal',
          icon: Wallet
        };
      case 5:
        return {
          label: 'Transferência Bancária',
          icon: Banknote
        };
      case 20:
        return {
          label: 'Linha de Crédito / Ad Credits',
          icon: CircleDollarSign
        };
      default:
        return null;
    }
  };
  const getAccountStatusInfo = (status: number | null) => {
    // Meta Account Status codes:
    // 1 = ACTIVE
    // 2 = DISABLED
    // 3 = UNSETTLED (payment issues)
    // 7 = PENDING_REVIEW
    // 9 = IN_GRACE_PERIOD
    // 100 = PENDING_CLOSURE
    // 101 = CLOSED
    switch (status) {
      case 1:
        return {
          label: 'Conta ativa',
          variant: 'default' as const,
          icon: CheckCircle2
        };
      case 2:
        return {
          label: 'Conta desabilitada',
          variant: 'destructive' as const,
          icon: XCircle
        };
      case 3:
        return {
          label: 'Conta pausada - Sem saldo',
          variant: 'destructive' as const,
          icon: PauseCircle
        };
      case 7:
        return {
          label: 'Em análise',
          variant: 'secondary' as const,
          icon: Clock
        };
      case 9:
        return {
          label: 'Período de carência',
          variant: 'secondary' as const,
          icon: Clock
        };
      case 100:
        return {
          label: 'Fechamento pendente',
          variant: 'destructive' as const,
          icon: AlertTriangle
        };
      case 101:
        return {
          label: 'Conta fechada',
          variant: 'destructive' as const,
          icon: XCircle
        };
      default:
        return null;
    }
  };
  if (!projectId) return null;
  const fundingInfo = getFundingTypeInfo(data?.fundingType ?? null);
  const FundingIcon = fundingInfo?.icon ?? Wallet;
  const accountStatusInfo = getAccountStatusInfo(data?.accountStatus ?? null);
  const StatusIcon = accountStatusInfo?.icon;
  return <div className="">
      {/* Top gradient line */}
      <div className={cn("absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent to-transparent", data?.status === 'healthy' && "via-metric-positive/60", data?.status === 'warning' && "via-metric-warning/60", data?.status === 'critical' && "via-destructive/60", (!data || data.status === 'unknown') && "via-primary/40")} />
      
      <div className="pt-4 pb-4 px-6 border-secondary-foreground border border-solid">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-full", data?.status === 'critical' && "bg-destructive/20", data?.status === 'warning' && "bg-metric-warning/20", data?.status === 'healthy' && "bg-metric-positive/20", (!data || data.status === 'unknown') && "bg-muted")}>
              <Wallet className={cn("w-5 h-5", data ? getStatusColor(data.status) : "text-muted-foreground")} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Saldo Meta Ads</p>
              {loading ? <div className="h-7 w-24 bg-muted/50 animate-pulse rounded" /> : <p className={cn("text-xl font-bold", data ? getStatusColor(data.status) : "text-foreground")}>
                  {data ? formatCurrency(data.balance) : '—'}
                </p>}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Funding Type Badge */}
            {data?.fundingType && fundingInfo && <Badge variant="outline" className="text-xs gap-1">
                <FundingIcon className="w-3 h-3" />
                {fundingInfo.label}
              </Badge>}
            
            {/* Account Status Badge */}
            {accountStatusInfo && StatusIcon && <Badge variant={accountStatusInfo.variant} className="text-xs gap-1">
                <StatusIcon className="w-3 h-3" />
                {accountStatusInfo.label}
              </Badge>}
            
            {/* Days Remaining Badge */}
            {data?.daysOfSpendRemaining !== null && data?.daysOfSpendRemaining !== undefined && data.status !== 'critical' && <Badge variant={data.status === 'warning' ? 'secondary' : 'outline'} className="text-xs whitespace-nowrap">
                {data.daysOfSpendRemaining} dias de saldo
              </Badge>}
            
            {/* Auto Reload Indicator */}
            {data?.autoReloadEnabled && <Badge variant="outline" className="text-xs gap-1 text-metric-positive border-metric-positive/30">
                <CheckCircle2 className="w-3 h-3" />
                Recarga automática
              </Badge>}
            
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fetchBalance(true)} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
        
        {/* Critical Status Message */}
        {data?.status === 'critical' && <div className="mt-3 p-2 rounded-md bg-destructive/10 border border-destructive/20 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive font-medium">
              {data.accountStatus === 3 ? 'Campanhas pausadas por falta de saldo. Recarregue para retomar a veiculação.' : data.accountStatus === 2 ? 'Conta desabilitada. Verifique as políticas de anúncios no Meta Business.' : 'Conta com problemas. Verifique no Meta Ads Manager.'}
            </p>
          </div>}
        
        {/* Average Daily Spend */}
        {data?.avgDailySpend > 0 && data?.status !== 'critical' && <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingDown className="w-3 h-3" />
            <span>Gasto médio: {formatCurrency(data.avgDailySpend)}/dia</span>
          </div>}
      </div>
    </div>;
}