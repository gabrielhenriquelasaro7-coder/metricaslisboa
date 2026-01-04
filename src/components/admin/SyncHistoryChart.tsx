import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend
} from 'recharts';
import { Activity, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface SyncLog {
  id: string;
  project_id: string;
  status: string;
  message: string | null;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
}

interface SyncHistoryChartProps {
  projectId?: string; // Se passado, mostra apenas do projeto específico
  showProjectSelector?: boolean;
}

interface DayData {
  date: string;
  dateLabel: string;
  success: number;
  error: number;
  total: number;
}

export default function SyncHistoryChart({ projectId, showProjectSelector = true }: SyncHistoryChartProps) {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>(projectId || 'all');
  const [loading, setLoading] = useState(true);
  const [daysRange, setDaysRange] = useState<string>('14');

  useEffect(() => {
    if (projectId) {
      setSelectedProject(projectId);
    }
  }, [projectId]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      const startDate = subDays(new Date(), parseInt(daysRange));
      
      // Fetch projects se não for um projeto específico
      if (!projectId && showProjectSelector) {
        const { data: projectsData } = await supabase
          .from('projects')
          .select('id, name')
          .eq('archived', false)
          .order('name');
        
        if (projectsData) {
          setProjects(projectsData);
        }
      }
      
      // Fetch sync logs
      let query = supabase
        .from('sync_logs')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });
      
      if (projectId || (selectedProject && selectedProject !== 'all')) {
        query = query.eq('project_id', projectId || selectedProject);
      }
      
      const { data: logsData } = await query;
      
      if (logsData) {
        setLogs(logsData);
      }
      
      setLoading(false);
    };
    
    fetchData();
  }, [projectId, selectedProject, daysRange, showProjectSelector]);

  // Agrupar logs por dia
  const chartData: DayData[] = (() => {
    const startDate = subDays(new Date(), parseInt(daysRange));
    const endDate = new Date();
    
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    
    return days.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      
      const dayLogs = logs.filter(log => {
        const logDate = new Date(log.created_at);
        return logDate >= dayStart && logDate <= dayEnd;
      });
      
      const successCount = dayLogs.filter(log => log.status === 'success').length;
      const errorCount = dayLogs.filter(log => log.status === 'error').length;
      
      return {
        date: format(day, 'yyyy-MM-dd'),
        dateLabel: format(day, 'dd/MM', { locale: ptBR }),
        success: successCount,
        error: errorCount,
        total: successCount + errorCount
      };
    });
  })();

  const totalSuccess = logs.filter(l => l.status === 'success').length;
  const totalError = logs.filter(l => l.status === 'error').length;
  const successRate = logs.length > 0 ? ((totalSuccess / logs.length) * 100).toFixed(1) : '0';

  if (loading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Histórico de Sincronizações
            </CardTitle>
            <CardDescription>
              Regularidade das sincronizações nos últimos {daysRange} dias
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-3">
            {showProjectSelector && !projectId && projects.length > 0 && (
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar projeto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os projetos</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            <Select value={daysRange} onValueChange={setDaysRange}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="14">14 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Stats */}
        <div className="flex flex-wrap gap-4 mt-4">
          <Badge variant="outline" className="flex items-center gap-1.5 py-1.5 px-3">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="font-semibold">{totalSuccess}</span>
            <span className="text-muted-foreground">sucesso</span>
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1.5 py-1.5 px-3">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="font-semibold">{totalError}</span>
            <span className="text-muted-foreground">erros</span>
          </Badge>
          <Badge 
            variant="outline" 
            className={`flex items-center gap-1.5 py-1.5 px-3 ${
              parseFloat(successRate) >= 90 
                ? 'border-green-500/50 bg-green-500/10' 
                : parseFloat(successRate) >= 70 
                  ? 'border-yellow-500/50 bg-yellow-500/10'
                  : 'border-red-500/50 bg-red-500/10'
            }`}
          >
            <AlertTriangle className={`w-4 h-4 ${
              parseFloat(successRate) >= 90 
                ? 'text-green-500' 
                : parseFloat(successRate) >= 70 
                  ? 'text-yellow-500'
                  : 'text-red-500'
            }`} />
            <span className="font-semibold">{successRate}%</span>
            <span className="text-muted-foreground">taxa de sucesso</span>
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="dateLabel" 
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (!active || !payload) return null;
                  return (
                    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                      <p className="font-medium mb-2">{label}</p>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded bg-green-500" />
                          <span>Sucesso: {payload[0]?.value}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded bg-red-500" />
                          <span>Erros: {payload[1]?.value}</span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Legend 
                content={() => (
                  <div className="flex justify-center gap-6 mt-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-green-500" />
                      <span className="text-muted-foreground">Sucesso</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-red-500" />
                      <span className="text-muted-foreground">Erros</span>
                    </div>
                  </div>
                )}
              />
              <Bar dataKey="success" stackId="a" fill="hsl(142, 71%, 45%)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="error" stackId="a" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {logs.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
            <p className="text-muted-foreground">Nenhuma sincronização registrada no período</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
