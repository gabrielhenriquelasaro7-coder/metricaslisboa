import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import { useDailyMetrics } from '@/hooks/useDailyMetrics';
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
  DollarSign, 
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
import { cn } from '@/lib/utils';

const BUSINESS_MODEL_LABELS: Record<string, { label: string; icon: React.ElementType; description: string }> = {
  inside_sales: { 
    label: 'Inside Sales', 
    icon: Users, 
    description: 'Vendas consultivas B2B ou B2C' 
  },
  ecommerce: { 
    label: 'E-commerce', 
    icon: ShoppingCart, 
    description: 'Loja online com vendas diretas' 
  },
  pdv: { 
    label: 'PDV', 
    icon: Store, 
    description: 'Ponto de Venda físico' 
  },
};

const ALLOWED_BUSINESS_MODELS = ['inside_sales', 'ecommerce', 'pdv'];

export default function Financial() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { projects, loading: projectsLoading } = useProjects();
  
  const [connectedCRM, setConnectedCRM] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'pending' | 'syncing' | 'synced' | 'error'>('pending');
  const [syncProgress, setSyncProgress] = useState(0);

  const selectedProjectId = localStorage.getItem('selectedProjectId');
  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0];
  const businessModel = selectedProject?.business_model as 'inside_sales' | 'ecommerce' | 'pdv' | undefined;

  // Fetch ad spend data from daily metrics
  const { dailyData } = useDailyMetrics(selectedProjectId || undefined, 'last_30d');
  
  const totalAdSpend = useMemo(() => {
    if (!dailyData?.length) return 0;
    return dailyData.reduce((acc, day) => acc + (day.spend || 0), 0);
  }, [dailyData]);

  const ALLOWED_EMAIL = 'gabrielhenriquelasaro7@gmail.com';
  const isAuthorized = user?.email === ALLOWED_EMAIL;
  const isBusinessModelAllowed = businessModel && ALLOWED_BUSINESS_MODELS.includes(businessModel);
  const businessModelInfo = businessModel ? BUSINESS_MODEL_LABELS[businessModel] : null;

  useEffect(() => {
    if (!authLoading && !isAuthorized) {
      navigate('/dashboard');
    }
  }, [authLoading, isAuthorized, navigate]);

  // Simula métricas do CRM (futuramente virá do backend)
  const mockCRMMetrics = useMemo(() => ({
    revenue: connectedCRM ? 125750.00 : 0,
    sales: connectedCRM ? 47 : 0,
    averageTicket: connectedCRM ? 2675.53 : 0,
    conversionRate: connectedCRM ? 12.5 : 0,
    leadsReceived: connectedCRM ? 376 : 0,
    leadsContacted: connectedCRM ? 312 : 0,
    meetingsScheduled: connectedCRM ? 89 : 0,
    proposalsSent: connectedCRM ? 62 : 0,
    dealsClosed: connectedCRM ? 47 : 0,
  }), [connectedCRM]);

  // Simula DRE (futuramente virá do backend)
  const mockDRE = useMemo(() => ({
    grossRevenue: connectedCRM ? 125750.00 : 0,
    deductions: connectedCRM ? 12575.00 : 0,
    netRevenue: connectedCRM ? 113175.00 : 0,
    cac: connectedCRM ? totalAdSpend || 15890.00 : 0,
    contributionMargin: connectedCRM ? 97285.00 : 0,
    operationalExpenses: connectedCRM ? 28500.00 : 0,
    ebitda: connectedCRM ? 68785.00 : 0,
  }), [connectedCRM, totalAdSpend]);

  if (authLoading || projectsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  if (!selectedProject) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <AlertCircle className="w-12 h-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Nenhum projeto selecionado</h2>
          <p className="text-muted-foreground text-center max-w-md">
            Selecione um projeto na barra lateral para acessar o hub financeiro.
          </p>
          <Button onClick={() => navigate('/projects')}>
            Ir para Projetos
          </Button>
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
            O hub financeiro está disponível apenas para projetos com modelo de negócio 
            <strong> Inside Sales</strong>, <strong>E-commerce</strong> ou <strong>PDV</strong>.
          </p>
          <Badge variant="outline" className="text-base px-4 py-2">
            Modelo atual: {String(businessModel)}
          </Badge>
        </div>
      </DashboardLayout>
    );
  }

  const handleConnectCRM = async (crmId: string) => {
    setIsConnecting(crmId);
    setSyncStatus('syncing');
    
    // Simula progresso de conexão
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 200));
      setSyncProgress(i);
    }
    
    setConnectedCRM(crmId);
    setIsConnecting(null);
    setSyncStatus('synced');
    setSyncProgress(100);
  };

  const handleDisconnect = () => {
    setConnectedCRM(null);
    setSyncStatus('pending');
    setSyncProgress(0);
  };

  const BusinessModelIcon = businessModelInfo?.icon || Users;

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-8">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6 md:p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-primary/5 to-transparent rounded-full blur-2xl" />
          
          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20">
                  <Wallet className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                    Central Financeira de Vendas
                  </h1>
                  <p className="text-muted-foreground mt-2 max-w-xl">
                    Acompanhe faturamento, ticket médio, conversão e ROI real do seu projeto.
                    Conecte seu CRM para unificar marketing, vendas e receita.
                  </p>
                  
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <Badge className="gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border-primary/20">
                      <BusinessModelIcon className="w-3.5 h-3.5" />
                      {businessModelInfo?.label}
                    </Badge>
                    <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
                      {selectedProject.name}
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

              {connectedCRM && (
                <div className="flex items-center gap-4 p-4 rounded-xl bg-card/50 border">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-primary">
                      R$ {(mockCRMMetrics.revenue / 1000).toFixed(0)}k
                    </p>
                    <p className="text-xs text-muted-foreground">Faturamento</p>
                  </div>
                  <div className="w-px h-12 bg-border" />
                  <div className="text-center">
                    <p className="text-3xl font-bold text-metric-positive">
                      {((mockCRMMetrics.revenue / (totalAdSpend || 1))).toFixed(1)}x
                    </p>
                    <p className="text-xs text-muted-foreground">ROAS Real</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        {connectedCRM ? (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
              <TabsTrigger value="overview" className="gap-2">
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">Visão Geral</span>
              </TabsTrigger>
              <TabsTrigger value="funnel" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Funil</span>
              </TabsTrigger>
              <TabsTrigger value="roas" className="gap-2">
                <TrendingUp className="w-4 h-4" />
                <span className="hidden sm:inline">ROAS</span>
              </TabsTrigger>
              <TabsTrigger value="dre" className="gap-2">
                <PieChart className="w-4 h-4" />
                <span className="hidden sm:inline">DRE</span>
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* CRM Connection Status */}
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <CRMConnectionCard
                    projectName={selectedProject.name}
                    onConnect={handleConnectCRM}
                    connectedCRM={connectedCRM}
                    onDisconnect={handleDisconnect}
                    isConnecting={isConnecting}
                  />
                </div>
                <SyncStatusCard
                  status={syncStatus}
                  lastSyncAt={new Date()}
                  nextSyncAt={new Date(Date.now() + 5 * 60 * 1000)}
                  progress={syncProgress}
                  recordsSynced={1247}
                  onForceSync={() => {
                    setSyncStatus('syncing');
                    setTimeout(() => setSyncStatus('synced'), 2000);
                  }}
                />
              </div>

              {/* Metrics Grid */}
              <FinancialMetricsGrid
                businessModel={businessModel!}
                metrics={mockCRMMetrics}
              />

              {/* ROI Overview */}
              <div className="grid gap-6 lg:grid-cols-2">
                <ROASRealCard
                  adSpend={totalAdSpend || 15890}
                  crmRevenue={mockCRMMetrics.revenue}
                  periodLabel="Últimos 30 dias"
                />
                {businessModel === 'inside_sales' && (
                  <InsideSalesFunnel
                    leadsReceived={mockCRMMetrics.leadsReceived}
                    leadsContacted={mockCRMMetrics.leadsContacted}
                    meetingsScheduled={mockCRMMetrics.meetingsScheduled}
                    proposalsSent={mockCRMMetrics.proposalsSent}
                    dealsClosed={mockCRMMetrics.dealsClosed}
                  />
                )}
                {businessModel !== 'inside_sales' && (
                  <FinancialDRECard {...mockDRE} />
                )}
              </div>
            </TabsContent>

            {/* Funnel Tab */}
            <TabsContent value="funnel" className="space-y-6">
              {businessModel === 'inside_sales' ? (
                <>
                  <InsideSalesFunnel
                    leadsReceived={mockCRMMetrics.leadsReceived}
                    leadsContacted={mockCRMMetrics.leadsContacted}
                    meetingsScheduled={mockCRMMetrics.meetingsScheduled}
                    proposalsSent={mockCRMMetrics.proposalsSent}
                    dealsClosed={mockCRMMetrics.dealsClosed}
                  />
                  <FinancialMetricsGrid
                    businessModel={businessModel}
                    metrics={mockCRMMetrics}
                  />
                </>
              ) : (
                <Card className="py-12">
                  <CardContent className="flex flex-col items-center justify-center gap-4">
                    <BarChart3 className="w-12 h-12 text-muted-foreground" />
                    <h3 className="text-lg font-semibold">Funil de vendas</h3>
                    <p className="text-muted-foreground text-center max-w-md">
                      O funil detalhado está disponível para projetos Inside Sales.
                      Para {businessModelInfo?.label}, acompanhe as métricas na aba Visão Geral.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ROAS Tab */}
            <TabsContent value="roas" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <ROASRealCard
                  adSpend={totalAdSpend || 15890}
                  crmRevenue={mockCRMMetrics.revenue}
                  periodLabel="Últimos 30 dias"
                />
                <Card>
                  <CardHeader>
                    <CardTitle>Sobre o ROAS Real</CardTitle>
                    <CardDescription>
                      Entenda a diferença entre ROAS de plataforma e ROAS Real
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted/30">
                      <h4 className="font-medium mb-2">ROAS de Plataforma (Meta/Google)</h4>
                      <p className="text-sm text-muted-foreground">
                        Calculado com base em conversões rastreadas pelo pixel/tag.
                        Pode não refletir vendas reais do CRM.
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                      <h4 className="font-medium mb-2 text-primary">ROAS Real (CRM)</h4>
                      <p className="text-sm text-muted-foreground">
                        Calculado com receita real registrada no CRM dividida pelo 
                        investimento em anúncios. Reflete o retorno verdadeiro.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ArrowRight className="w-4 h-4" />
                      <span>Fórmula: Receita CRM ÷ Investimento em Ads</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* DRE Tab */}
            <TabsContent value="dre" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <FinancialDRECard {...mockDRE} />
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle>Indicadores</CardTitle>
                    <CardDescription>Métricas financeiras chave</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <span className="text-sm">Margem Bruta</span>
                      <span className="font-bold text-lg">
                        {mockDRE.grossRevenue > 0 
                          ? ((mockDRE.netRevenue / mockDRE.grossRevenue) * 100).toFixed(1)
                          : 0}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <span className="text-sm">Margem de Contribuição</span>
                      <span className="font-bold text-lg">
                        {mockDRE.grossRevenue > 0 
                          ? ((mockDRE.contributionMargin / mockDRE.grossRevenue) * 100).toFixed(1)
                          : 0}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <span className="text-sm font-medium">Margem EBITDA</span>
                      <span className="font-bold text-lg text-primary">
                        {mockDRE.grossRevenue > 0 
                          ? ((mockDRE.ebitda / mockDRE.grossRevenue) * 100).toFixed(1)
                          : 0}%
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          /* CRM Connection Flow */
          <div className="space-y-8">
            {/* Value Proposition */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="group hover:border-primary/30 transition-colors">
                <CardHeader>
                  <div className="p-3 rounded-xl bg-primary/10 w-fit group-hover:scale-110 transition-transform">
                    <TrendingUp className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg mt-4">ROAS Real</CardTitle>
                  <CardDescription>
                    Descubra o retorno verdadeiro sobre seu investimento em anúncios, 
                    baseado em vendas reais do CRM.
                  </CardDescription>
                </CardHeader>
              </Card>
              
              <Card className="group hover:border-primary/30 transition-colors">
                <CardHeader>
                  <div className="p-3 rounded-xl bg-primary/10 w-fit group-hover:scale-110 transition-transform">
                    <BarChart3 className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg mt-4">Funil Completo</CardTitle>
                  <CardDescription>
                    Visualize cada etapa do processo comercial, de leads a vendas, 
                    com taxas de conversão detalhadas.
                  </CardDescription>
                </CardHeader>
              </Card>
              
              <Card className="group hover:border-primary/30 transition-colors">
                <CardHeader>
                  <div className="p-3 rounded-xl bg-primary/10 w-fit group-hover:scale-110 transition-transform">
                    <DollarSign className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg mt-4">DRE Automatizado</CardTitle>
                  <CardDescription>
                    Demonstração de resultado gerada automaticamente com receita, 
                    custos e margem de contribuição.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>

            {/* CRM Connection */}
            <CRMConnectionCard
              projectName={selectedProject.name}
              onConnect={handleConnectCRM}
              connectedCRM={connectedCRM}
              onDisconnect={handleDisconnect}
              isConnecting={isConnecting}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
