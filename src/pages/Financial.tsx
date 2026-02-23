import { useState, useEffect, useMemo } from 'react';
import { SmoothLoader } from '@/components/layout/PageTransition';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import { useDailyMetrics } from '@/hooks/useDailyMetrics';
import { useCRMConnection, CRMProvider } from '@/hooks/useCRMConnection';
import { useCargo } from '@/hooks/useCargo';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { DashboardSkeleton } from '@/components/skeletons';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FinancialMetricsGrid,
  CRMConnectionCard,
  SyncStatusCard,
  InsideSalesFunnel,
  FinancialDRECard,
  PipelineSelector,
  KanbanFunnel,
  AttributionAnalysis,
  CompleteDRE,
  StagesMappingConfig,
  FunnelCardsConfig,
  DREPeriodSelector,
  DREHistoryDialog,
} from '@/components/financial';
import type { FunnelCard } from '@/components/financial';
import type { DREPeriod } from '@/components/financial/CompleteDRE';
import { 
  Users, 
  AlertCircle,
  ShoppingCart,
  Store,
  TrendingUp,
  BarChart3,
  PieChart,
  LayoutDashboard,
  Wallet,
  ArrowRight,
  Sparkles,
  Target,
  DollarSign
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import type { DateRange } from 'react-day-picker';

const BUSINESS_MODEL_LABELS: Record<string, { label: string; icon: React.ElementType; description: string }> = {
  inside_sales: { label: 'Inside Sales', icon: Users, description: 'Vendas consultivas B2B ou B2C' },
  ecommerce: { label: 'E-commerce', icon: ShoppingCart, description: 'Loja online com vendas diretas' },
  pdv: { label: 'PDV', icon: Store, description: 'Ponto de Venda físico' },
  infoproduto: { label: 'Infoproduto', icon: Sparkles, description: 'Cursos, mentorias e produtos digitais' },
  custom: { label: 'Personalizado', icon: Target, description: 'Modelo de negócio personalizado' },
};

const ALLOWED_BUSINESS_MODELS = ['inside_sales', 'ecommerce', 'pdv', 'infoproduto', 'custom'];

// Helper function to calculate date range from period
function getDateRangeFromPeriod(period: DREPeriod, customRange?: { from?: Date; to?: Date }): { startDate: string; endDate: string; description: string } {
  const today = new Date();
  let start: Date;
  let end: Date = today;
  
  switch (period) {
    case 'last_7d':
      start = subDays(today, 7);
      break;
    case 'last_30d':
      start = subDays(today, 30);
      break;
    case 'this_month':
      start = startOfMonth(today);
      end = today;
      break;
    case 'last_month': {
      const lastMonth = subMonths(today, 1);
      start = startOfMonth(lastMonth);
      end = endOfMonth(lastMonth);
      break;
    }
    case 'custom':
      if (customRange?.from && customRange?.to) {
        start = customRange.from;
        end = customRange.to;
        break;
      }
      // fallthrough
    default:
      start = startOfMonth(today);
      end = today;
  }
  
  return {
    startDate: format(start, 'yyyy-MM-dd'),
    endDate: format(end, 'yyyy-MM-dd'),
    description: `${format(start, 'dd/MM')} - ${format(end, 'dd/MM')}`,
  };
}

export default function Financial() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { projects, loading: projectsLoading } = useProjects();
  const { isInvestidor, loading: cargoLoading } = useCargo();
  
  const selectedProjectId = localStorage.getItem('selectedProjectId');
  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0];
  const businessModel = selectedProject?.business_model as 'inside_sales' | 'ecommerce' | 'pdv' | 'infoproduto' | 'custom' | undefined;

  const [drePeriod, setDrePeriod] = useState<DREPeriod>('last_30d');
  const [showDREHistory, setShowDREHistory] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  
  // Calculate date range from period for CRM filtering
  const crmDateRange = useMemo(() => getDateRangeFromPeriod(drePeriod, customDateRange), [drePeriod, customDateRange]);

  const { 
    status: crmStatus, 
    isLoading: crmLoading, 
    isConnecting, 
    connectionError,
    connect: connectCRM, 
    disconnect: disconnectCRM,
    triggerSync,
    selectPipeline,
    fetchStatus
  } = useCRMConnection(selectedProjectId || undefined, crmDateRange);
  
  // Map DRE period to daily metrics period
  const metricsTimePeriod = drePeriod === 'last_7d' ? 'last_7d' : 
                            drePeriod === 'last_30d' ? 'last_30d' : 
                            drePeriod === 'this_month' ? 'this_month' : 
                            drePeriod === 'last_month' ? 'last_month' : 'last_30d';

  const { dailyData } = useDailyMetrics(selectedProjectId || undefined, metricsTimePeriod);
  
  // Calculate totals from ads data
  const adsMetrics = useMemo(() => {
    if (!dailyData?.length) return { spend: 0, revenue: 0, conversions: 0 };
    return dailyData.reduce((acc, day) => ({
      spend: acc.spend + (day.spend || 0),
      revenue: acc.revenue + (day.conversion_value || 0),
      conversions: acc.conversions + (day.conversions || 0),
    }), { spend: 0, revenue: 0, conversions: 0 });
  }, [dailyData]);

  const totalAdSpend = adsMetrics.spend;

  const connectedCRM = crmStatus?.connected ? crmStatus.provider : null;
  const syncStatus = crmStatus?.sync?.status === 'syncing' ? 'syncing' : 
                     crmStatus?.sync?.status === 'completed' ? 'synced' : 
                     crmStatus?.sync?.status === 'failed' ? 'error' : 'pending';

  const ALLOWED_EMAIL = 'gabrielhenriquelasaro7@gmail.com';
  // Authorized: admin email OR investidor
  const isAuthorized = user?.email === ALLOWED_EMAIL || isInvestidor;
  const isBusinessModelAllowed = businessModel && ALLOWED_BUSINESS_MODELS.includes(businessModel);
  const businessModelInfo = businessModel ? BUSINESS_MODEL_LABELS[businessModel] : null;

  useEffect(() => {
    if (!authLoading && !cargoLoading && !isAuthorized) {
      navigate('/dashboard');
    }
  }, [authLoading, cargoLoading, isAuthorized, navigate]);

  const crmMetrics = useMemo(() => ({
    revenue: crmStatus?.funnel?.revenue || crmStatus?.stats?.total_revenue || 0,
    sales: crmStatus?.funnel?.sales || crmStatus?.stats?.won_deals || 0,
    averageTicket: crmStatus?.stats?.won_deals ? (crmStatus.stats.total_revenue / crmStatus.stats.won_deals) : 0,
    conversionRate: crmStatus?.stats?.total_deals ? (crmStatus.stats.won_deals / crmStatus.stats.total_deals * 100) : 0,
    // Funnel data
    leads: crmStatus?.funnel?.leads || crmStatus?.stats?.total_deals || 0,
    mql: crmStatus?.funnel?.mql || 0,
    sql: crmStatus?.funnel?.sql || 0,
    // Metrics grid data
    leadsReceived: crmStatus?.funnel?.leads || crmStatus?.stats?.total_deals || 0,
    dealsClosed: crmStatus?.funnel?.sales || crmStatus?.stats?.won_deals || 0,
  }), [crmStatus]);

  const dreData = useMemo(() => ({
    grossRevenue: crmMetrics.revenue,
    deductions: crmMetrics.revenue * 0.1,
    netRevenue: crmMetrics.revenue * 0.9,
    cac: totalAdSpend,
    contributionMargin: crmMetrics.revenue * 0.9 - totalAdSpend,
    operationalExpenses: crmMetrics.revenue * 0.23,
    ebitda: crmMetrics.revenue * 0.67 - totalAdSpend,
  }), [crmMetrics, totalAdSpend]);

  const isPageLoading = authLoading || projectsLoading || crmLoading || cargoLoading;

  if (!isAuthorized) return null;

  if (!selectedProject) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <AlertCircle className="w-12 h-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Nenhum projeto selecionado</h2>
          <Button onClick={() => navigate('/dashboard')}>Selecionar Projeto</Button>
        </div>
      </DashboardLayout>
    );
  }

  if (!isBusinessModelAllowed) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <AlertCircle className="w-12 h-12 text-yellow-500" />
          <h2 className="text-xl font-semibold">Módulo não disponível</h2>
          <p className="text-muted-foreground text-center max-w-md">
            O hub financeiro está disponível apenas para projetos Inside Sales, E-commerce ou PDV.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const handleConnectCRM = async (crmId: string, credentials?: { api_key: string; api_url?: string }) => {
    await connectCRM(crmId as CRMProvider, credentials);
  };

  const BusinessModelIcon = businessModelInfo?.icon || Users;


  return (
    <DashboardLayout>
      <SmoothLoader loading={isPageLoading} skeleton={<div className="p-6"><DashboardSkeleton /></div>}>
      <div className="space-y-8 pb-8 pt-4 sm:pt-0">
        {/* Hero Header - Clean & Minimal */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-2 sm:mt-0">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
              <Wallet className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Central Financeira</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="gap-1.5 text-xs">
                  <BusinessModelIcon className="w-3 h-3" />
                  {businessModelInfo?.label}
                </Badge>
                {connectedCRM && (
                  <Badge variant="outline" className="gap-1.5 text-xs text-metric-positive border-metric-positive/30">
                    <Sparkles className="w-3 h-3" />
                    CRM
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          {/* Period Selector */}
          <DREPeriodSelector 
            value={drePeriod} 
            onChange={setDrePeriod}
            onOpenHistory={() => setShowDREHistory(true)}
            periodDescription={crmDateRange.description}
            customDateRange={customDateRange}
            onCustomDateRangeChange={setCustomDateRange}
          />
        </div>

        {/* DRE History Dialog */}
        {selectedProjectId && (
          <DREHistoryDialog
            open={showDREHistory}
            onOpenChange={setShowDREHistory}
            projectId={selectedProjectId}
          />
        )}

        {/* Content based on business model */}
        {/* For infoproduto/ecommerce - show DRE without CRM requirement */}
        {(businessModel === 'infoproduto' || businessModel === 'ecommerce' || businessModel === 'custom') && !connectedCRM ? (
          <div className="space-y-6">
              {/* Overview metrics from ads - responsive grid */}
              <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
                <Card className="bg-gradient-to-br from-blue-600/20 to-blue-900/30 border-blue-500/30">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                      <span className="text-[10px] sm:text-xs font-medium text-blue-200 uppercase tracking-wider truncate">Receita</span>
                      <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-400 flex-shrink-0" />
                    </div>
                    <p className="text-lg sm:text-2xl font-bold text-blue-100">
                      R$ {(adsMetrics.revenue / 1000).toFixed(1)}k
                    </p>
                    <p className="text-[10px] sm:text-xs text-blue-300/70 mt-0.5 sm:mt-1 truncate">
                      Conversion Value
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-600/20 to-amber-900/30 border-amber-500/30">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                      <span className="text-[10px] sm:text-xs font-medium text-amber-200 uppercase tracking-wider truncate">Investido</span>
                      <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400 flex-shrink-0" />
                    </div>
                    <p className="text-lg sm:text-2xl font-bold text-amber-100">
                      R$ {(totalAdSpend / 1000).toFixed(1)}k
                    </p>
                    <p className="text-[10px] sm:text-xs text-amber-300/70 mt-0.5 sm:mt-1 truncate">
                      Meta + Google
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-600/20 to-emerald-900/30 border-emerald-500/30">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                      <span className="text-[10px] sm:text-xs font-medium text-emerald-200 uppercase tracking-wider">ROAS</span>
                      <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400 flex-shrink-0" />
                    </div>
                    <p className="text-lg sm:text-2xl font-bold text-emerald-100">
                      {(adsMetrics.revenue / (totalAdSpend || 1)).toFixed(2)}x
                    </p>
                    <p className="text-[10px] sm:text-xs text-emerald-300/70 mt-0.5 sm:mt-1 truncate">
                      Retorno
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-600/20 to-purple-900/30 border-purple-500/30">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                      <span className="text-[10px] sm:text-xs font-medium text-purple-200 uppercase tracking-wider truncate">Conversões</span>
                      <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-400 flex-shrink-0" />
                    </div>
                    <p className="text-lg sm:text-2xl font-bold text-purple-100">
                      {adsMetrics.conversions.toLocaleString('pt-BR')}
                    </p>
                    <p className="text-[10px] sm:text-xs text-purple-300/70 mt-0.5 sm:mt-1 truncate">
                      Vendas
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* DRE Maintenance Card */}
              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-yellow-500/10">
                      <AlertCircle className="h-6 w-6 text-yellow-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">DRE em Manutenção</h3>
                      <p className="text-muted-foreground mt-1">
                        O módulo de Demonstração de Resultado (DRE) está temporariamente em manutenção. 
                        Em breve estará disponível com melhorias.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Info card about connecting payment platform */}
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-primary/10">
                      <Sparkles className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Dados em tempo real via Ads</h3>
                      <p className="text-muted-foreground mt-1">
                        Estamos usando os dados de <strong>conversion_value</strong> das suas campanhas Meta/Google Ads. 
                        Para dados mais precisos, você pode integrar sua plataforma de pagamentos (Hotmart, Kiwify, Stripe, etc.) no futuro.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
          </div>
        ) : !connectedCRM ? (
          /* For inside_sales/pdv without CRM - show connection prompt */
          <CRMConnectionCard
            projectName={selectedProject.name}
            onConnect={handleConnectCRM}
            connectedCRM={connectedCRM}
            onDisconnect={disconnectCRM}
            isConnecting={!!isConnecting}
            connectionError={connectionError}
          />
        ) : (
          /* With CRM connected - full experience */
          <Tabs defaultValue="overview" className="space-y-4 sm:space-y-6">
            {/* Header with tabs and pipeline selector */}
            <div className="flex flex-col gap-2">
              {/* Tabs - fixed grid, no scroll needed */}
              <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-muted/50">
                <TabsTrigger value="overview" className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1 sm:px-3 py-2 sm:py-2.5 text-[10px] sm:text-sm data-[state=active]:bg-background">
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Geral</span>
                </TabsTrigger>
                <TabsTrigger value="funnel" className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1 sm:px-3 py-2 sm:py-2.5 text-[10px] sm:text-sm data-[state=active]:bg-background">
                  <BarChart3 className="w-4 h-4" />
                  <span>Funil</span>
                </TabsTrigger>
                <TabsTrigger value="attribution" className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1 sm:px-3 py-2 sm:py-2.5 text-[10px] sm:text-sm data-[state=active]:bg-background">
                  <Target className="w-4 h-4" />
                  <span>Atrib.</span>
                </TabsTrigger>
              </TabsList>
              
              {/* Pipeline Selector and Stage Mapping - only show for Kommo with stages */}
              {crmStatus?.connected && (
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center flex-wrap">
                  {(crmStatus?.pipelines?.length || 0) > 0 && (
                    <PipelineSelector
                      pipelines={crmStatus.pipelines || []}
                      selectedPipelineId={crmStatus.selected_pipeline_id || null}
                      onSelect={selectPipeline}
                      isLoading={crmLoading}
                    />
                  )}
                  {crmStatus?.stages && crmStatus.stages.length > 0 && crmStatus.connection_id && (
                    <>
                      <StagesMappingConfig
                        connectionId={crmStatus.connection_id}
                        stages={crmStatus.stages}
                        currentMqlStages={crmStatus.mql_stage_ids || []}
                        currentSqlStages={crmStatus.sql_stage_ids || []}
                        onSave={() => {
                          setTimeout(() => fetchStatus(), 500);
                        }}
                      />
                      <FunnelCardsConfig
                        connectionId={crmStatus.connection_id}
                        stages={crmStatus.stages}
                        currentConfig={crmStatus.funnel_cards_config as FunnelCard[] | undefined}
                        totalDeals={crmStatus?.stats?.total_deals}
                        onSave={() => {
                          setTimeout(() => fetchStatus(), 500);
                        }}
                      />
                    </>
                  )}
                </div>
              )}
            </div>

            <TabsContent value="overview" className="space-y-4 sm:space-y-6">
              <div className="grid gap-3 sm:gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <CRMConnectionCard
                    projectName={selectedProject.name}
                    onConnect={handleConnectCRM}
                    connectedCRM={connectedCRM}
                    onDisconnect={disconnectCRM}
                    isConnecting={!!isConnecting}
                    connectionError={connectionError}
                    crmStats={crmStatus?.stats}
                    crmUrl={crmStatus?.api_url}
                  />
                </div>
                <SyncStatusCard
                  status={syncStatus as 'pending' | 'syncing' | 'synced' | 'error'}
                  lastSyncAt={crmStatus?.sync?.completed_at ? new Date(crmStatus.sync.completed_at) : new Date()}
                  nextSyncAt={new Date(Date.now() + 5 * 60 * 1000)}
                  progress={100}
                  recordsSynced={crmStatus?.sync?.records_processed || 0}
                  onForceSync={() => triggerSync('incremental')}
                />
              </div>
              <FinancialMetricsGrid 
                businessModel={businessModel!} 
                metrics={crmMetrics} 
                funnelCardsConfig={crmStatus?.funnel_cards_config as FunnelCard[] | undefined}
              />
              {businessModel === 'inside_sales' ? (
                <InsideSalesFunnel 
                  leads={crmMetrics.leads}
                  mql={crmMetrics.mql}
                  sql={crmMetrics.sql}
                  sales={crmMetrics.sales}
                  revenue={crmMetrics.revenue}
                  hasCRMData={crmStatus?.connected && (crmMetrics.mql > 0 || crmMetrics.sql > 0 || crmMetrics.sales > 0)}
                  funnelConfig={crmStatus?.funnel_cards_config as FunnelCard[] | undefined}
                  crmStages={crmStatus?.stages}
                  totalDeals={crmStatus?.stats?.total_deals}
                  onRefresh={() => fetchStatus()}
                  isRefreshing={crmLoading}
                />
              ) : (
                /* DRE Maintenance Card */
                <Card className="border-yellow-500/30 bg-yellow-500/5">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-yellow-500/10">
                        <AlertCircle className="h-6 w-6 text-yellow-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">DRE em Manutenção</h3>
                        <p className="text-muted-foreground mt-1">
                          O módulo de Demonstração de Resultado (DRE) está temporariamente em manutenção. 
                          Em breve estará disponível com melhorias.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="funnel" className="space-y-6">
              {/* Kanban Funnel with real stages */}
              {crmStatus?.stages && crmStatus.stages.length > 0 ? (
                <KanbanFunnel
                  stages={crmStatus.stages}
                  deals={crmStatus.deals || []}
                  isLoading={crmLoading}
                  crmUrl={crmStatus.api_url || undefined}
                />
              ) : (
                <InsideSalesFunnel 
                  leads={crmMetrics.leads}
                  mql={crmMetrics.mql}
                  sql={crmMetrics.sql}
                  sales={crmMetrics.sales}
                  revenue={crmMetrics.revenue}
                  hasCRMData={crmStatus?.connected && (crmMetrics.mql > 0 || crmMetrics.sql > 0 || crmMetrics.sales > 0)}
                />
              )}
            </TabsContent>

            <TabsContent value="attribution" className="space-y-6">
              <AttributionAnalysis
                deals={crmStatus?.deals || []}
                stages={crmStatus?.stages || []}
                adSpend={totalAdSpend}
                isLoading={crmLoading}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
      </SmoothLoader>
    </DashboardLayout>
  );
}
