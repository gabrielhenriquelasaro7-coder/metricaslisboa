import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Download, Loader2, CheckCircle2 } from 'lucide-react';

interface ExportProgress {
  current: number;
  total: number;
  currentTable: string;
}

// TODAS as tabelas do banco para exportação completa
const TABLES_TO_EXPORT = [
  // Projetos e configurações
  'projects',
  'profiles',
  'user_roles',
  'project_metric_config',
  'project_import_months',
  
  // Meta Ads
  'campaigns',
  'ad_sets',
  'ads',
  'ads_daily_metrics',
  
  // Google Ads
  'google_campaigns',
  'google_ad_groups',
  'google_ads',
  'google_ads_daily_metrics',
  
  // Leads e Formulários
  'leads',
  'leadgen_forms',
  
  // CRM
  'crm_connections',
  'crm_pipelines',
  'crm_deals',
  'crm_sync_logs',
  
  // Metas e Objetivos
  'account_goals',
  'campaign_goals',
  
  // Insights e Demografia
  'demographic_insights',
  
  // Financeiro / DRE
  'dre_history',
  
  // Otimizações e Histórico
  'optimization_history',
  'period_metrics',
  
  // Alertas e Anomalias
  'anomaly_alerts',
  'anomaly_alert_config',
  
  // Cache de IA
  'ai_analysis_cache',
  
  // Preferências
  'chart_preferences',
  
  // Convidados
  'guest_invitations',
  'guest_project_access',
  
  // Sugestões
  'suggestion_actions',
  
  // WhatsApp
  'whatsapp_instances',
  'whatsapp_report_config',
  
  // Sync Logs
  'sync_logs',
];

export function ExportDataButton() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);

  const exportAllData = async () => {
    setIsExporting(true);
    setProgress({ current: 0, total: TABLES_TO_EXPORT.length, currentTable: '' });

    const exportData: Record<string, any[]> = {};
    const errors: string[] = [];

    try {
      for (let i = 0; i < TABLES_TO_EXPORT.length; i++) {
        const tableName = TABLES_TO_EXPORT[i];
        setProgress({ current: i + 1, total: TABLES_TO_EXPORT.length, currentTable: tableName });

        try {
          // Fetch all records from table (with pagination for large tables)
          let allRecords: any[] = [];
          let hasMore = true;
          let offset = 0;
          const limit = 1000;

          while (hasMore) {
            const { data, error } = await supabase
              .from(tableName as any)
              .select('*')
              .range(offset, offset + limit - 1);

            if (error) {
              errors.push(`${tableName}: ${error.message}`);
              hasMore = false;
            } else if (data && data.length > 0) {
              allRecords = [...allRecords, ...data];
              offset += limit;
              hasMore = data.length === limit;
            } else {
              hasMore = false;
            }
          }

          exportData[tableName] = allRecords;
        } catch (err) {
          errors.push(`${tableName}: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
        }
      }

      // Create and download JSON file
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `v4-company-export-${timestamp}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Calculate totals
      const totalRecords = Object.values(exportData).reduce((sum, arr) => sum + arr.length, 0);
      const tablesWithData = Object.entries(exportData).filter(([_, arr]) => arr.length > 0).length;

      if (errors.length > 0) {
        toast.warning(`Exportação concluída com ${errors.length} avisos. ${totalRecords} registros de ${tablesWithData} tabelas.`);
        console.warn('Export errors:', errors);
      } else {
        toast.success(`Exportação concluída! ${totalRecords} registros de ${tablesWithData} tabelas.`);
      }

    } catch (error) {
      toast.error(`Erro na exportação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsExporting(false);
      setProgress(null);
    }
  };

  const progressPercent = progress ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="space-y-4">
      {progress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Exportando: <span className="font-medium text-foreground">{progress.currentTable}</span>
            </span>
            <span className="text-muted-foreground">
              {progress.current}/{progress.total}
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      )}
      
      <Button
        onClick={exportAllData}
        disabled={isExporting}
        className="w-full gap-2"
        size="lg"
        variant="default"
      >
        {isExporting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Exportando dados...
          </>
        ) : (
          <>
            <Download className="w-5 h-5" />
            Exportar Todos os Dados (JSON)
          </>
        )}
      </Button>
    </div>
  );
}
