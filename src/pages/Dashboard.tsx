import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import MetricCard from '@/components/dashboard/MetricCard';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import PerformanceChart from '@/components/dashboard/PerformanceChart';
import { useProjects } from '@/hooks/useProjects';
import { DateRange } from 'react-day-picker';
import { subDays } from 'date-fns';
import { 
  DollarSign, 
  MousePointerClick, 
  Eye, 
  Target,
  TrendingUp,
  ShoppingCart,
  Users,
  Percent
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

// Mock data for demonstration
const mockChartData = [
  { date: '01/12', value: 12500, value2: 2.4 },
  { date: '05/12', value: 18200, value2: 3.1 },
  { date: '10/12', value: 15800, value2: 2.8 },
  { date: '15/12', value: 22400, value2: 3.5 },
  { date: '20/12', value: 28900, value2: 4.2 },
  { date: '25/12', value: 31200, value2: 4.8 },
  { date: '28/12', value: 35600, value2: 5.1 },
];

export default function Dashboard() {
  const { projects, loading } = useProjects();
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
            <p className="text-muted-foreground">Visão geral das suas campanhas</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {projects.length > 0 && (
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Selecione um projeto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os projetos</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
          </div>
        </div>

        {/* Check if has projects */}
        {projects.length === 0 && !loading ? (
          <div className="glass-card p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Nenhum projeto ainda</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Crie seu primeiro projeto para começar a analisar suas campanhas de Meta Ads.
            </p>
            <Link to="/projects">
              <Button variant="gradient">Criar primeiro projeto</Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Metrics Grid - General Base Metrics */}
            <div>
              <h2 className="text-lg font-semibold mb-4 text-muted-foreground">Métricas Gerais</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <MetricCard
                  title="CTR (Link)"
                  value="2.84%"
                  change={12.5}
                  changeLabel="vs período anterior"
                  icon={MousePointerClick}
                  trend="up"
                />
                <MetricCard
                  title="CPM"
                  value="R$ 18,50"
                  change={-8.2}
                  changeLabel="vs período anterior"
                  icon={Eye}
                  trend="down"
                />
                <MetricCard
                  title="CPC (Link)"
                  value="R$ 0,65"
                  change={-15.3}
                  changeLabel="vs período anterior"
                  icon={MousePointerClick}
                  trend="down"
                />
                <MetricCard
                  title="Cliques no Link"
                  value="45.8K"
                  change={28.4}
                  changeLabel="vs período anterior"
                  icon={Target}
                  trend="up"
                />
                <MetricCard
                  title="Gasto Total"
                  value="R$ 29.850"
                  change={18.7}
                  changeLabel="vs período anterior"
                  icon={DollarSign}
                  trend="neutral"
                />
                <MetricCard
                  title="Impressões"
                  value="1.61M"
                  change={22.1}
                  changeLabel="vs período anterior"
                  icon={Eye}
                  trend="up"
                />
              </div>
            </div>

            {/* Result Metrics - Dynamic based on business model */}
            <div>
              <h2 className="text-lg font-semibold mb-4 text-muted-foreground">Métricas de Resultado</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="ROAS"
                  value="4.82x"
                  change={35.2}
                  changeLabel="vs período anterior"
                  icon={TrendingUp}
                  trend="up"
                  className="border-l-4 border-l-metric-positive"
                />
                <MetricCard
                  title="Compras"
                  value="1,247"
                  change={24.8}
                  changeLabel="vs período anterior"
                  icon={ShoppingCart}
                  trend="up"
                />
                <MetricCard
                  title="Valor de Conversão"
                  value="R$ 143.890"
                  change={42.1}
                  changeLabel="vs período anterior"
                  icon={DollarSign}
                  trend="up"
                />
                <MetricCard
                  title="Ticket Médio"
                  value="R$ 115,38"
                  change={8.5}
                  changeLabel="vs período anterior"
                  icon={Target}
                  trend="up"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <MetricCard
                  title="CPA (Compra)"
                  value="R$ 23,94"
                  change={-12.4}
                  changeLabel="vs período anterior"
                  icon={Users}
                  trend="down"
                />
                <MetricCard
                  title="Taxa de Conversão"
                  value="2.72%"
                  change={5.8}
                  changeLabel="vs período anterior"
                  icon={Percent}
                  trend="up"
                />
                <MetricCard
                  title="Leads"
                  value="3,842"
                  change={31.2}
                  changeLabel="vs período anterior"
                  icon={Users}
                  trend="up"
                />
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PerformanceChart
                data={mockChartData}
                title="Gasto ao longo do tempo"
                dataKey="value"
              />
              <PerformanceChart
                data={mockChartData}
                title="ROAS ao longo do tempo"
                dataKey="value2"
                color="hsl(142, 71%, 45%)"
              />
            </div>

            {/* Top Campaigns */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Top Campanhas por ROAS</h3>
                <Link to="/campaigns">
                  <Button variant="ghost" size="sm">Ver todas</Button>
                </Link>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Campanha</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">ROAS</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Gasto</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Receita</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Compras</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">CPA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: 'Black Friday - Remarketing', roas: 8.42, spend: 4500, revenue: 37890, purchases: 312, cpa: 14.42 },
                      { name: 'Prospecção - Lookalike 1%', roas: 5.21, spend: 8200, revenue: 42722, purchases: 428, cpa: 19.16 },
                      { name: 'Carrinho Abandonado', roas: 6.85, spend: 2100, revenue: 14385, purchases: 145, cpa: 14.48 },
                      { name: 'Coleção Verão 2024', roas: 3.94, spend: 12500, revenue: 49250, purchases: 387, cpa: 32.30 },
                      { name: 'Reengajamento 30 dias', roas: 4.12, spend: 3200, revenue: 13184, purchases: 98, cpa: 32.65 },
                    ].map((campaign, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="py-4 px-4 font-medium">{campaign.name}</td>
                        <td className="py-4 px-4 text-right">
                          <span className="text-metric-positive font-semibold">{campaign.roas}x</span>
                        </td>
                        <td className="py-4 px-4 text-right">R$ {campaign.spend.toLocaleString()}</td>
                        <td className="py-4 px-4 text-right">R$ {campaign.revenue.toLocaleString()}</td>
                        <td className="py-4 px-4 text-right">{campaign.purchases}</td>
                        <td className="py-4 px-4 text-right">R$ {campaign.cpa.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
