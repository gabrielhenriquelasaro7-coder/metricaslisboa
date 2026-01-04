import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import MetricCard from '@/components/dashboard/MetricCard';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import PerformanceChart from '@/components/dashboard/PerformanceChart';

import { supabase } from '@/integrations/supabase/client';
import { Project, BusinessModel } from '@/hooks/useProjects';
import { DateRange } from 'react-day-picker';
import { subDays } from 'date-fns';
import { 
  ArrowLeft,
  DollarSign, 
  MousePointerClick, 
  Eye, 
  Target,
  TrendingUp,
  ShoppingCart,
  Users,
  Percent,
  Store,
  Megaphone,
  
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Mock data
const mockChartData = [
  { date: '01/12', value: 12500, value2: 2.4 },
  { date: '05/12', value: 18200, value2: 3.1 },
  { date: '10/12', value: 15800, value2: 2.8 },
  { date: '15/12', value: 22400, value2: 3.5 },
  { date: '20/12', value: 28900, value2: 4.2 },
  { date: '25/12', value: 31200, value2: 4.8 },
  { date: '28/12', value: 35600, value2: 5.1 },
];

const mockCampaigns = [
  { 
    id: '1', 
    name: 'Black Friday - Remarketing', 
    objective: 'CONVERSIONS',
    status: 'ACTIVE',
    budget: 150,
    budgetType: 'daily',
    roas: 8.42, 
    spend: 4500, 
    revenue: 37890, 
    purchases: 312, 
    cpa: 14.42,
    ctr: 3.2,
    cpm: 18.50,
    impressions: 243000,
    clicks: 7776
  },
  { 
    id: '2', 
    name: 'Prospecção - Lookalike 1%', 
    objective: 'CONVERSIONS',
    status: 'ACTIVE',
    budget: 300,
    budgetType: 'daily',
    roas: 5.21, 
    spend: 8200, 
    revenue: 42722, 
    purchases: 428, 
    cpa: 19.16,
    ctr: 2.8,
    cpm: 22.30,
    impressions: 367700,
    clicks: 10295
  },
];

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') || 'overview';
  
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  useEffect(() => {
    const fetchProject = async () => {
      if (!id) return;
      
      // Salvar o projeto selecionado no localStorage para a Sidebar
      localStorage.setItem('selectedProjectId', id);
      
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();
      
      if (!error && data) {
        setProject(data as unknown as Project);
      }
      setLoading(false);
    };

    fetchProject();
  }, [id]);

  const renderBusinessMetrics = () => {
    if (!project) return null;

    switch (project.business_model) {
      case 'ecommerce':
        return (
          <>
            <MetricCard
              title="ROAS"
              value="4.82x"
              change={35.2}
              icon={TrendingUp}
              trend="up"
              className="border-l-4 border-l-metric-positive"
            />
            <MetricCard
              title="Compras"
              value="1,247"
              change={24.8}
              icon={ShoppingCart}
              trend="up"
            />
            <MetricCard
              title="Valor de Conversão"
              value="R$ 143.890"
              change={42.1}
              icon={DollarSign}
              trend="up"
            />
            <MetricCard
              title="Ticket Médio"
              value="R$ 115,38"
              change={8.5}
              icon={Target}
              trend="up"
            />
          </>
        );
      case 'inside_sales':
        return (
          <>
            <MetricCard
              title="Leads"
              value="3,842"
              change={31.2}
              icon={Users}
              trend="up"
            />
            <MetricCard
              title="CPL"
              value="R$ 7,77"
              change={-12.4}
              icon={DollarSign}
              trend="down"
            />
            <MetricCard
              title="Taxa de Conversão"
              value="8.4%"
              change={15.8}
              icon={Percent}
              trend="up"
            />
            <MetricCard
              title="Eventos Personalizados"
              value="12,456"
              change={28.3}
              icon={Target}
              trend="up"
            />
          </>
        );
      case 'pdv':
        return (
          <>
            <MetricCard
              title="Alcance Local"
              value="458K"
              change={22.4}
              icon={Store}
              trend="up"
            />
            <MetricCard
              title="Frequência"
              value="2.8"
              change={-5.2}
              icon={Eye}
              trend="neutral"
            />
            <MetricCard
              title="Engajamento"
              value="12.4K"
              change={18.7}
              icon={MousePointerClick}
              trend="up"
            />
            <MetricCard
              title="Check-ins"
              value="847"
              change={45.2}
              icon={Target}
              trend="up"
            />
          </>
        );
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center min-h-[60vh]">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!project) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Projeto não encontrado</h1>
          <Link to="/projects">
            <Button variant="outline">Voltar aos projetos</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/projects">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold mb-1">{project.name}</h1>
              <p className="text-muted-foreground">
                {project.business_model === 'ecommerce' && 'E-commerce'}
                {project.business_model === 'inside_sales' && 'Inside Sales'}
                {project.business_model === 'pdv' && 'PDV'}
                {' • '}
                <span className="font-mono text-sm">{project.ad_account_id}</span>
              </p>
            </div>
          </div>
          
          <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
        </div>

        {/* Tabs for different levels */}
        <Tabs defaultValue={tabFromUrl} className="space-y-6">
          <TabsList className="bg-secondary">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
            <TabsTrigger value="adsets">Conjuntos</TabsTrigger>
            <TabsTrigger value="ads">Anúncios</TabsTrigger>
            <TabsTrigger value="creatives">Criativos</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* General Metrics */}
            <div>
              <h2 className="text-lg font-semibold mb-4 text-muted-foreground">Métricas Gerais</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <MetricCard title="CTR (Link)" value="2.84%" change={12.5} icon={MousePointerClick} trend="up" />
                <MetricCard title="CPM" value="R$ 18,50" change={-8.2} icon={Eye} trend="down" />
                <MetricCard title="CPC (Link)" value="R$ 0,65" change={-15.3} icon={MousePointerClick} trend="down" />
                <MetricCard title="Cliques" value="45.8K" change={28.4} icon={Target} trend="up" />
                <MetricCard title="Gasto" value="R$ 29.850" change={18.7} icon={DollarSign} trend="neutral" />
                <MetricCard title="Impressões" value="1.61M" change={22.1} icon={Eye} trend="up" />
              </div>
            </div>

            {/* Business Model Specific Metrics */}
            <div>
              <h2 className="text-lg font-semibold mb-4 text-muted-foreground">Métricas de Resultado</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {renderBusinessMetrics()}
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PerformanceChart data={mockChartData} title="Gasto ao longo do tempo" dataKey="value" />
              <PerformanceChart 
                data={mockChartData} 
                title={project.business_model === 'ecommerce' ? 'ROAS ao longo do tempo' : 'Resultados ao longo do tempo'} 
                dataKey="value2" 
                color="hsl(142, 71%, 45%)" 
              />
            </div>
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-6">
            <div className="glass-card overflow-hidden">
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold">Campanhas</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Campanha</th>
                      <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Objetivo</th>
                      <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">Orçamento</th>
                      <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">ROAS</th>
                      <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">Gasto</th>
                      <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">Receita</th>
                      <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">CTR</th>
                      <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">CPA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockCampaigns.map((campaign) => (
                      <tr key={campaign.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Megaphone className="w-5 h-5 text-primary" />
                            </div>
                            <span className="font-medium">{campaign.name}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-muted-foreground">{campaign.objective}</td>
                        <td className="py-4 px-6">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-metric-positive/10 text-metric-positive">
                            {campaign.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">R$ {campaign.budget}/{campaign.budgetType === 'daily' ? 'dia' : 'total'}</td>
                        <td className="py-4 px-6 text-right">
                          <span className="text-metric-positive font-semibold">{campaign.roas}x</span>
                        </td>
                        <td className="py-4 px-6 text-right">R$ {campaign.spend.toLocaleString()}</td>
                        <td className="py-4 px-6 text-right">R$ {campaign.revenue.toLocaleString()}</td>
                        <td className="py-4 px-6 text-right">{campaign.ctr}%</td>
                        <td className="py-4 px-6 text-right">R$ {campaign.cpa.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="adsets" className="space-y-6">
            <div className="glass-card p-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Análise por Conjunto</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Selecione uma campanha para visualizar os conjuntos de anúncios com segmentação detalhada.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="ads" className="space-y-6">
            <div className="glass-card p-12 text-center">
              <Eye className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Análise por Anúncio</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Selecione um conjunto para visualizar os anúncios com métricas detalhadas.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="creatives" className="space-y-6">
            <div className="glass-card p-12 text-center">
              <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Galeria de Criativos</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Visualize e analise o desempenho dos seus criativos.
              </p>
            </div>
          </TabsContent>

        </Tabs>
      </div>
    </DashboardLayout>
  );
}
