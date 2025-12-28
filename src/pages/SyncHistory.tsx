import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useProjects } from '@/hooks/useProjects';
import { 
  History, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  Filter,
  Clock
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface SyncLog {
  id: string;
  project_id: string;
  status: string;
  message: string | null;
  created_at: string;
}

export default function SyncHistory() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { projects } = useProjects();

  const selectedProjectId = localStorage.getItem('selectedProjectId');
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const fetchLogs = async () => {
    if (!selectedProjectId) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('sync_logs')
        .select('*')
        .eq('project_id', selectedProjectId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching sync logs:', error);
        return;
      }

      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching sync logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedProjectId, statusFilter]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-metric-positive" />;
      case 'partial':
        return <AlertCircle className="w-4 h-4 text-metric-warning" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-metric-negative" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      success: 'bg-metric-positive/10 text-metric-positive border-metric-positive/20',
      partial: 'bg-metric-warning/10 text-metric-warning border-metric-warning/20',
      error: 'bg-metric-negative/10 text-metric-negative border-metric-negative/20',
      running: 'bg-primary/10 text-primary border-primary/20',
    };

    const labels: Record<string, string> = {
      success: 'Sucesso',
      partial: 'Parcial',
      error: 'Erro',
      running: 'Em execução',
    };

    return (
      <Badge variant="outline" className={cn('font-medium', variants[status] || '')}>
        {labels[status] || status}
      </Badge>
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });
  };

  const parseMessage = (message: string | null) => {
    if (!message) return { text: 'Sem detalhes', periods: [] };
    
    try {
      // Try to parse JSON message
      const parsed = JSON.parse(message);
      if (parsed.periods) {
        return {
          text: parsed.summary || message,
          periods: parsed.periods || [],
        };
      }
    } catch {
      // Not JSON, return as text
    }
    
    return { text: message, periods: [] };
  };

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <History className="w-8 h-8" />
              Histórico de Sincronização
            </h1>
            <p className="text-muted-foreground">
              {selectedProject ? `Projeto: ${selectedProject.name}` : 'Selecione um projeto'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="success">Sucesso</SelectItem>
                <SelectItem value="partial">Parcial</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Logs Table */}
        <div className="glass-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center">
              <History className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nenhum registro encontrado</h3>
              <p className="text-muted-foreground">
                Os logs de sincronização aparecerão aqui após as sincronizações.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left py-4 px-4 text-xs font-semibold text-foreground uppercase tracking-wide">
                      Data/Hora
                    </th>
                    <th className="text-center py-4 px-4 text-xs font-semibold text-foreground uppercase tracking-wide">
                      Status
                    </th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-foreground uppercase tracking-wide">
                      Detalhes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((log) => {
                    const { text, periods } = parseMessage(log.message);
                    
                    return (
                      <tr key={log.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(log.status)}
                            <div>
                              <p className="font-medium">{formatDate(log.created_at)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          {getStatusBadge(log.status)}
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-sm">{text}</p>
                          {periods.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {periods.map((period: string) => (
                                <Badge key={period} variant="secondary" className="text-xs">
                                  {period}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary */}
        {!loading && logs.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card p-4 text-center">
              <p className="text-2xl font-bold">{logs.length}</p>
              <p className="text-sm text-muted-foreground">Total de syncs</p>
            </div>
            <div className="glass-card p-4 text-center">
              <p className="text-2xl font-bold text-metric-positive">
                {logs.filter(l => l.status === 'success').length}
              </p>
              <p className="text-sm text-muted-foreground">Sucesso</p>
            </div>
            <div className="glass-card p-4 text-center">
              <p className="text-2xl font-bold text-metric-warning">
                {logs.filter(l => l.status === 'partial').length}
              </p>
              <p className="text-sm text-muted-foreground">Parcial</p>
            </div>
            <div className="glass-card p-4 text-center">
              <p className="text-2xl font-bold text-metric-negative">
                {logs.filter(l => l.status === 'error').length}
              </p>
              <p className="text-sm text-muted-foreground">Erros</p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
