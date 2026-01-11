import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import { useDailyMetrics } from '@/hooks/useDailyMetrics';
import { useCRMConnection, CRMProvider } from '@/hooks/useCRMConnection';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FinancialMetricsGrid,
  CRMConnectionCard,
  SyncStatusCard,
  ROASRealCard,
  InsideSalesFunnel,
  FinancialDRECard
} from '@/components/financial';
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
  Sparkles
} from 'lucide-react';

const BUSINESS_MODEL_LABELS: Record<string, { label: string; icon: React.ElementType; description: string }> = {
  inside_sales: { label: 'Inside Sales', icon: Users, description: 'Vendas consultivas B2B ou B2C' },
  ecommerce: { label: 'E-commerce', icon: ShoppingCart, description: 'Loja online com vendas diretas' },
  pdv: { label: 'PDV', icon: Store, description: 'Ponto de Venda físico' },
};

const ALLOWED_BUSINESS_MODELS = ['inside_sales', 'ecommerce', 'pdv'];

export default function Financial() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { projects, loading: projectsLoading } = useProjects();
  
  const selectedProjectId = localStorage.getItem('selectedProjectId');
  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0];
  const businessModel = selectedProject?.business_model as 'inside_sales' | 'ecommerce' | 'pdv' | undefined;

  const { 
    status: crmStatus, 
    isLoading: crmLoading, 
    isConnecting, 
    connectionError,
    connect: connectCRM, 
    disconnect: disconnectCRM,
    triggerSync 
  } = useCRMConnection(selectedProjectId || undefined);

  const { dailyData } = useDailyMetrics(selectedProjectId || undefined, 'last_30d');
  
  const totalAdSpend = useMemo(() => {
    if (!dailyData?.length) return 0;
    return dailyData.reduce((acc, day) => acc + (day.spend || 0), 0);
  }, [dailyData]);

  const connectedCRM = crmStatus?.connected ? crmStatus.provider : null;
  const syncStatus = crmStatus?.sync?.status === 'syncing' ? 'syncing' : 
                     crmStatus?.sync?.status === 'completed' ? 'synced' : 
                     crmStatus?.sync?.status === 'failed' ? 'error' : 'pending';

  const ALLOWED_EMAIL = 'gabrielhenriquelasaro7@gmail.com';
  const isAuthorized = user?.email === ALLOWED_EMAIL;
  const isBusinessModelAllowed = businessModel && ALLOWED_BUSINESS_MODELS.includes(businessModel);
  const businessModelInfo = businessModel ? BUSINESS_MODEL_LABELS[businessModel] : null;

  useEffect(() => {
    if (!authLoading && !isAuthorized) {
      navigate('/dashboard');
    }
  }, [authLoading, isAuthorized, navigate]);

  const crmMetrics = useMemo(() => ({
    revenue: crmStatus?.stats?.total_revenue || 0,
    sales: crmStatus?.stats?.won_deals || 0,
    averageTicket: crmStatus?.stats?.won_deals ? (crmStatus.stats.total_revenue / crmStatus.stats.won_deals) : 0,
    conversionRate: crmStatus?.stats?.total_deals ? (crmStatus.stats.won_deals / crmStatus.stats.total_deals * 100) : 0,
    leadsReceived: crmStatus?.stats?.total_deals || 0,
    leadsContacted: Math.round((crmStatus?.stats?.total_deals || 0) * 0.83),
    meetingsScheduled: Math.round((crmStatus?.stats?.total_deals || 0) * 0.24),
    proposalsSent: Math.round((crmStatus?.stats?.total_deals || 0) * 0.16),
    dealsClosed: crmStatus?.stats?.won_deals || 0,
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

  if (authLoading || projectsLoading || crmLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAuthorized) return null;

  if (!selectedProject) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <AlertCircle className="w-12 h-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Nenhum projeto selecionado</h2>
          <Button onClick={() => navigate('/projects')}>Ir para Projetos</Button>
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
      <div className="space-y-8 pb-8">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6 md:p-8">
          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20">
                  <Wallet className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Central Financeira de Vendas</h1>
                  <p className="text-muted-foreground mt-2 max-w-xl">
                    Acompanhe faturamento, ticket médio, conversão e ROI real do seu projeto.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <Badge className="gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border-primary/20">
                      <BusinessModelIcon className="w-3.5 h-3.5" />
                      {businessModelInfo?.label}
                    </Badge>
                    {connectedCRM && (
                      <Badge className="gap-1.5 px-3 py-1.5 bg-metric-positive/10 text-metric-positive border-metric-positive/20">
                        <Sparkles className="w-3.5 h-3.5" />
                        CRM Conectado
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              {connectedCRM && crmMetrics.revenue > 0 && (
                <div className="flex items-center gap-4 p-4 rounded-xl bg-card/50 border">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-primary">R$ {(crmMetrics.revenue / 1000).toFixed(0)}k</p>
                    <p className="text-xs text-muted-foreground">Faturamento</p>
                  </div>
                  <div className="w-px h-12 bg-border" />
                  <div className="text-center">
                    <p className="text-3xl font-bold text-metric-positive">{(crmMetrics.revenue / (totalAdSpend || 1)).toFixed(1)}x</p>
                    <p className="text-xs text-muted-foreground">ROAS Real</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CRM Connection */}
        {!connectedCRM ? (
          <CRMConnectionCard
            projectName={selectedProject.name}
            onConnect={handleConnectCRM}
            connectedCRM={connectedCRM}
            onDisconnect={disconnectCRM}
            isConnecting={!!isConnecting}
            connectionError={connectionError}
          />
        ) : (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
              <TabsTrigger value="overview" className="gap-2"><LayoutDashboard className="w-4 h-4" /><span className="hidden sm:inline">Visão Geral</span></TabsTrigger>
              <TabsTrigger value="funnel" className="gap-2"><BarChart3 className="w-4 h-4" /><span className="hidden sm:inline">Funil</span></TabsTrigger>
              <TabsTrigger value="roas" className="gap-2"><TrendingUp className="w-4 h-4" /><span className="hidden sm:inline">ROAS</span></TabsTrigger>
              <TabsTrigger value="dre" className="gap-2"><PieChart className="w-4 h-4" /><span className="hidden sm:inline">DRE</span></TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-3">
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
              <FinancialMetricsGrid businessModel={businessModel!} metrics={crmMetrics} />
              <div className="grid gap-6 lg:grid-cols-2">
                <ROASRealCard adSpend={totalAdSpend || 0} crmRevenue={crmMetrics.revenue} periodLabel="Últimos 30 dias" />
                {businessModel === 'inside_sales' ? (
                  <InsideSalesFunnel {...crmMetrics} />
                ) : (
                  <FinancialDRECard {...dreData} />
                )}
              </div>
            </TabsContent>

            <TabsContent value="funnel" className="space-y-6">
              <InsideSalesFunnel {...crmMetrics} />
            </TabsContent>

            <TabsContent value="roas" className="space-y-6">
              <ROASRealCard adSpend={totalAdSpend || 0} crmRevenue={crmMetrics.revenue} periodLabel="Últimos 30 dias" />
            </TabsContent>

            <TabsContent value="dre" className="space-y-6">
              <FinancialDRECard {...dreData} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
