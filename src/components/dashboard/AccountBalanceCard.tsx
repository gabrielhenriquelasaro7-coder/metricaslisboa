import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wallet, AlertTriangle, CheckCircle2, RefreshCw, TrendingDown } from 'lucide-react';
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
}

interface AccountBalanceCardProps {
  projectId: string | null;
  currency?: string;
}

export function AccountBalanceCard({ projectId, currency = 'BRL' }: AccountBalanceCardProps) {
  const [data, setData] = useState<AccountBalanceData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('predictive-analysis', {
        body: { projectId }
      });

      if (error) throw error;

      if (result?.accountBalance) {
        setData({
          balance: result.accountBalance.balance || 0,
          currency: result.accountBalance.currency || currency,
          lastUpdated: result.accountBalance.lastUpdated,
          daysOfSpendRemaining: result.accountBalance.daysOfSpendRemaining,
          status: result.accountBalance.status || 'unknown',
          avgDailySpend: result.predictions?.trends?.avgDailySpend || 0,
          autoReloadEnabled: result.accountBalance.autoReloadEnabled || false,
        });
      }
    } catch (err) {
      console.error('Error fetching balance:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, currency]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: data?.currency || currency,
    }).format(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-metric-positive';
      case 'warning': return 'text-metric-warning';
      case 'critical': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-metric-positive/10 border-metric-positive/30';
      case 'warning': return 'bg-metric-warning/10 border-metric-warning/30';
      case 'critical': return 'bg-destructive/10 border-destructive/30';
      default: return 'bg-muted/50 border-border';
    }
  };

  if (!projectId) return null;

  return (
    <Card className={cn(
      "border transition-colors",
      data ? getStatusBg(data.status) : "bg-muted/50"
    )}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2.5 rounded-full",
              data?.status === 'critical' && "bg-destructive/20",
              data?.status === 'warning' && "bg-metric-warning/20",
              data?.status === 'healthy' && "bg-metric-positive/20",
              (!data || data.status === 'unknown') && "bg-muted"
            )}>
              <Wallet className={cn(
                "w-5 h-5",
                data ? getStatusColor(data.status) : "text-muted-foreground"
              )} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Saldo Meta Ads</p>
              {loading ? (
                <div className="h-7 w-24 bg-muted/50 animate-pulse rounded" />
              ) : (
                <p className={cn(
                  "text-xl font-bold",
                  data ? getStatusColor(data.status) : "text-foreground"
                )}>
                  {data ? formatCurrency(data.balance) : '—'}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {data?.daysOfSpendRemaining !== null && data?.daysOfSpendRemaining !== undefined && (
              <Badge variant={
                data.status === 'critical' ? 'destructive' :
                data.status === 'warning' ? 'secondary' : 'outline'
              } className="text-xs whitespace-nowrap">
                {data.daysOfSpendRemaining} dias
              </Badge>
            )}
            
            {data?.status === 'critical' && !data?.autoReloadEnabled && (
              <AlertTriangle className="w-4 h-4 text-destructive" />
            )}
            
            {data?.autoReloadEnabled && (
              <CheckCircle2 className="w-4 h-4 text-metric-positive" />
            )}
            
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={fetchBalance}
              disabled={loading}
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
        
        {data?.avgDailySpend > 0 && (
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingDown className="w-3 h-3" />
            <span>Gasto médio: {formatCurrency(data.avgDailySpend)}/dia</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
