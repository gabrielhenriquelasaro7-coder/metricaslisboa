import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, Clock, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import v4LogoFull from '@/assets/v4-logo-full.png';

interface MonthImportRecord {
  id: string;
  project_id: string;
  year: number;
  month: number;
  status: 'pending' | 'importing' | 'success' | 'error' | 'skipped';
  records_count: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
}

interface ImportLoadingScreenProps {
  projectId: string;
  projectName: string;
  onComplete: () => void;
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function ImportLoadingScreen({ projectId, projectName, onComplete }: ImportLoadingScreenProps) {
  const [months, setMonths] = useState<MonthImportRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch initial state
  useEffect(() => {
    const fetchMonths = async () => {
      const { data, error } = await supabase
        .from('project_import_months')
        .select('*')
        .eq('project_id', projectId)
        .order('year', { ascending: true })
        .order('month', { ascending: true });

      if (!error && data) {
        setMonths(data as MonthImportRecord[]);
      }
      setLoading(false);
    };

    fetchMonths();
  }, [projectId]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`import-loading-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_import_months',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMonths(prev => [...prev, payload.new as MonthImportRecord].sort((a, b) => 
              a.year === b.year ? a.month - b.month : a.year - b.year
            ));
          } else if (payload.eventType === 'UPDATE') {
            setMonths(prev => prev.map(m => 
              m.id === (payload.new as MonthImportRecord).id 
                ? payload.new as MonthImportRecord 
                : m
            ));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  // Check if import is complete
  useEffect(() => {
    if (months.length === 0) return;

    const hasImporting = months.some(m => m.status === 'importing' || m.status === 'pending');
    
    if (!hasImporting) {
      // All done - wait a moment then complete
      const timer = setTimeout(() => {
        onComplete();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [months, onComplete]);

  const stats = {
    total: months.length,
    pending: months.filter(m => m.status === 'pending').length,
    importing: months.filter(m => m.status === 'importing').length,
    success: months.filter(m => m.status === 'success').length,
    error: months.filter(m => m.status === 'error').length,
    skipped: months.filter(m => m.status === 'skipped').length,
    totalRecords: months.reduce((sum, m) => sum + (m.records_count || 0), 0),
  };

  const progress = stats.total > 0 
    ? ((stats.success + stats.skipped + stats.error) / stats.total) * 100 
    : 0;

  const currentlyImporting = months.find(m => m.status === 'importing');

  // Organize months by year
  const monthsByYear = months.reduce((acc, month) => {
    if (!acc[month.year]) {
      acc[month.year] = [];
    }
    acc[month.year].push(month);
    return acc;
  }, {} as Record<number, MonthImportRecord[]>);

  const years = Object.keys(monthsByYear).map(Number).sort((a, b) => b - a); // Descending order

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-metric-positive" />;
      case 'importing':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-metric-negative" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getMonthForYear = (year: number, monthNum: number): MonthImportRecord | null => {
    return monthsByYear[year]?.find(m => m.month === monthNum) || null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background red-texture-bg p-8 relative">
      {/* Exit Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onComplete}
        className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
        title="Sair da importação"
      >
        <X className="w-5 h-5" />
      </Button>

      <div className="max-w-3xl w-full space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <img src={v4LogoFull} alt="V4 Company" className="h-16" />
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Importando Dados</h1>
          <p className="text-muted-foreground">
            Aguarde enquanto importamos os dados históricos de <span className="text-primary font-medium">{projectName}</span>
          </p>
        </div>

        {/* Progress */}
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-3" />
          
          {currentlyImporting && (
            <p className="text-center text-sm text-primary animate-pulse">
              Importando {MONTH_NAMES[currentlyImporting.month - 1]} {currentlyImporting.year}...
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-metric-positive">{stats.success}</p>
            <p className="text-xs text-muted-foreground">Concluídos</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-primary">{stats.importing}</p>
            <p className="text-xs text-muted-foreground">Importando</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold">{stats.totalRecords.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-muted-foreground">Registros</p>
          </div>
        </div>

        {/* Month Grid by Year */}
        <div className="glass-card p-6 space-y-6 max-h-[400px] overflow-y-auto">
          {years.map((year) => (
            <div key={year} className="space-y-3">
              <h3 className="font-semibold text-sm text-primary">{year}</h3>
              <div className="grid grid-cols-12 gap-2">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((monthNum) => {
                  const month = getMonthForYear(year, monthNum);
                  
                  if (!month) {
                    return (
                      <div
                        key={`${year}-${monthNum}`}
                        className="flex flex-col items-center justify-center p-2 rounded-lg border border-border/30 bg-muted/10 opacity-40"
                        title={`${MONTH_NAMES[monthNum - 1]} ${year}: Não disponível`}
                      >
                        <div className="w-4 h-4" />
                        <span className="text-[10px] mt-1 text-muted-foreground">
                          {MONTH_NAMES[monthNum - 1].substring(0, 3)}
                        </span>
                      </div>
                    );
                  }
                  
                  return (
                    <div
                      key={month.id}
                      className={cn(
                        "flex flex-col items-center justify-center p-2 rounded-lg border transition-all",
                        month.status === 'success' && "bg-metric-positive/10 border-metric-positive/30",
                        month.status === 'importing' && "bg-primary/10 border-primary/30 animate-pulse",
                        month.status === 'error' && "bg-metric-negative/10 border-metric-negative/30",
                        month.status === 'pending' && "bg-muted/30 border-border",
                        month.status === 'skipped' && "bg-muted/20 border-border/50"
                      )}
                      title={`${MONTH_NAMES[month.month - 1]} ${month.year}: ${month.records_count || 0} registros`}
                    >
                      {getStatusIcon(month.status)}
                      <span className="text-[10px] mt-1 text-muted-foreground">
                        {MONTH_NAMES[month.month - 1].substring(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Info & Exit Button */}
        <div className="text-center space-y-4">
          <p className="text-xs text-muted-foreground">
            Este processo pode levar alguns minutos dependendo da quantidade de dados.
          </p>
          <Button
            variant="outline"
            onClick={onComplete}
            className="text-sm"
          >
            Continuar em segundo plano
          </Button>
        </div>
      </div>
    </div>
  );
}