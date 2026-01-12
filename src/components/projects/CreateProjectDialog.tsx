import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjects, BusinessModel, CreateProjectData } from '@/hooks/useProjects';
import { Plus, Loader2, Settings2, Users, ShoppingCart, Store, GraduationCap, Zap, Image, Clock, Sparkles } from 'lucide-react';
import { z } from 'zod';
import { ImportProgressDialog } from './ImportProgressDialog';
import { MetricConfigPanel, type MetricConfigData } from './MetricConfigPanel';
import { DashboardPreview } from './DashboardPreview';
import { supabase } from '@/integrations/supabase/client';
import { METRIC_TEMPLATES } from '@/hooks/useProjectMetricConfig';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const projectSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  ad_account_id: z.string().min(1, 'ID da conta Meta Ads é obrigatório'),
  business_model: z.enum(['inside_sales', 'ecommerce', 'pdv', 'custom', 'infoproduto']),
  timezone: z.string().min(1),
  currency: z.string().min(1),
  google_customer_id: z.string().optional(),
});

const businessModels: { value: BusinessModel; label: string; description: string; icon?: React.ReactNode }[] = [
  { value: 'inside_sales', label: 'Inside Sales', description: 'Leads e vendas internas', icon: <Users className="w-4 h-4" /> },
  { value: 'ecommerce', label: 'E-commerce', description: 'Vendas online', icon: <ShoppingCart className="w-4 h-4" /> },
  { value: 'pdv', label: 'PDV', description: 'Loja física', icon: <Store className="w-4 h-4" /> },
  { value: 'infoproduto', label: 'Infoproduto', description: 'Cursos e mentorias', icon: <GraduationCap className="w-4 h-4" /> },
  { value: 'custom', label: 'Personalizado', description: 'Configure suas métricas', icon: <Settings2 className="w-4 h-4" /> },
];

const timezones = [
  { value: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)' },
  { value: 'America/New_York', label: 'New York (GMT-5)' },
  { value: 'Europe/London', label: 'Londres (GMT+0)' },
  { value: 'Europe/Lisbon', label: 'Lisboa (GMT+0)' },
];

const currencies = [
  { value: 'BRL', label: 'Real (R$)' },
  { value: 'USD', label: 'Dólar (US$)' },
  { value: 'EUR', label: 'Euro (€)' },
];

interface CreateProjectDialogProps {
  onSuccess?: () => void;
}

export default function CreateProjectDialog({ onSuccess }: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { createProject } = useProjects();
  const [customConfigOpen, setCustomConfigOpen] = useState(false);

  // Import mode selection step
  const [showImportModeDialog, setShowImportModeDialog] = useState(false);
  const [selectedImportMode, setSelectedImportMode] = useState<'light' | 'full' | null>(null);
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const [pendingProjectName, setPendingProjectName] = useState('');

  const [showImportProgress, setShowImportProgress] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [createdProjectName, setCreatedProjectName] = useState('');

  const [formData, setFormData] = useState<CreateProjectData & { google_customer_id?: string }>({
    name: '',
    ad_account_id: '',
    business_model: 'ecommerce',
    timezone: 'America/Sao_Paulo',
    currency: 'BRL',
    google_customer_id: '',
  });

  const [metricConfig, setMetricConfig] = useState<MetricConfigData>({
    result_metric: 'leads',
    result_metric_label: 'Leads',
    result_metrics: ['leads'],
    result_metrics_labels: { leads: 'Leads' },
    cost_metrics: ['cpl', 'cpa'],
    efficiency_metrics: ['ctr', 'roas'],
  });

  const handleBusinessModelChange = (value: BusinessModel) => {
    setFormData({ ...formData, business_model: value });
    setCustomConfigOpen(value === 'custom');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      projectSchema.parse(formData);
      setErrors({});
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
        return;
      }
    }

    setIsLoading(true);
    try {
      const project = await createProject(formData);
      
      if (formData.business_model === 'custom') {
        const template = METRIC_TEMPLATES.custom;
        await supabase.from('project_metric_config').insert({
          project_id: project.id,
          primary_metrics: template.primary_metrics,
          result_metric: metricConfig.result_metric,
          result_metric_label: metricConfig.result_metric_label,
          result_metrics: metricConfig.result_metrics,
          result_metrics_labels: metricConfig.result_metrics_labels,
          cost_metrics: metricConfig.cost_metrics,
          efficiency_metrics: metricConfig.efficiency_metrics,
          show_comparison: true,
          chart_primary_metric: template.chart_primary_metric,
          chart_secondary_metric: metricConfig.result_metrics[0] || metricConfig.result_metric,
        });
      }
      
      // Close the create dialog and show import mode selection
      setOpen(false);
      setPendingProjectId(project.id);
      setPendingProjectName(formData.name);
      setShowImportModeDialog(true);
      
      setFormData({
        name: '',
        ad_account_id: '',
        business_model: 'ecommerce',
        timezone: 'America/Sao_Paulo',
        currency: 'BRL',
        google_customer_id: '',
      });
      setCustomConfigOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Start import with selected mode - PARALLEL PROCESSING (3 months at a time)
  const handleStartImport = async (mode: 'light' | 'full') => {
    if (!pendingProjectId) return;

    setSelectedImportMode(mode);
    setShowImportModeDialog(false);
    setCreatedProjectId(pendingProjectId);
    setCreatedProjectName(pendingProjectName);
    setShowImportProgress(true);

    // Start the import with the selected mode
    const startYear = 2025;
    const lightSync = mode === 'light';

    // Update project sync status
    await supabase.from('projects').update({
      sync_progress: { 
        status: 'importing', 
        progress: 0, 
        message: lightSync ? 'Iniciando Light Sync Paralelo (3x)...' : 'Iniciando Importação Total HD Paralela (3x)...', 
        started_at: new Date().toISOString() 
      },
    }).eq('id', pendingProjectId);

    try {
      // Use parallel_batch_size: 3 to process 3 months simultaneously
      const { error } = await supabase.functions.invoke('import-month-by-month', {
        body: {
          project_id: pendingProjectId,
          year: startYear,
          month: 1,
          continue_chain: true,
          parallel_batch_size: 3, // Process 3 months in parallel!
          force_light_sync: lightSync,
          safe_mode: true,
        },
      });
      
      if (error) {
        console.error('Error starting import:', error);
      } else {
        console.log(`[IMPORT] Started PARALLEL ${mode} import (3 months at a time) for project ${pendingProjectId}`);
      }
    } catch (error) {
      console.error('Error starting import:', error);
    }
  };

  const handleImportModeClose = () => {
    setShowImportModeDialog(false);
    setPendingProjectId(null);
    setPendingProjectName('');
    onSuccess?.();
  };

  const handleImportProgressCloseHandler = (openState: boolean) => {
    setShowImportProgress(openState);
    if (!openState) {
      setCreatedProjectId(null);
      setCreatedProjectName('');
      setPendingProjectId(null);
      setPendingProjectName('');
      setSelectedImportMode(null);
      onSuccess?.();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="gradient">
            <Plus className="w-4 h-4 mr-2" />
            Novo Projeto
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-xl">Criar novo projeto</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <form onSubmit={handleSubmit} className="space-y-5 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do projeto</Label>
                <Input
                  id="name"
                  placeholder="Minha loja virtual"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="ad_account_id">ID da conta Meta Ads</Label>
                <Input
                  id="ad_account_id"
                  placeholder="act_123456789"
                  value={formData.ad_account_id}
                  onChange={(e) => setFormData({ ...formData, ad_account_id: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Encontre no Gerenciador de Anúncios do Facebook</p>
                {errors.ad_account_id && <p className="text-sm text-destructive">{errors.ad_account_id}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="google_customer_id">ID do cliente Google Ads (opcional)</Label>
                <Input
                  id="google_customer_id"
                  placeholder="123-456-7890"
                  value={formData.google_customer_id || ''}
                  onChange={(e) => setFormData({ ...formData, google_customer_id: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Encontre no canto superior direito do Google Ads</p>
              </div>

              <div className="space-y-2">
                <Label>Modelo de negócio</Label>
                <div className="grid grid-cols-2 gap-3">
                  {businessModels.map((model) => (
                    <button
                      key={model.value}
                      type="button"
                      onClick={() => handleBusinessModelChange(model.value)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        formData.business_model === model.value
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {model.icon}
                        <p className="font-medium text-sm">{model.label}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{model.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Metric Config Panel */}
              <Collapsible open={customConfigOpen} onOpenChange={setCustomConfigOpen}>
                <CollapsibleContent className="animate-accordion-down space-y-4">
                  <MetricConfigPanel value={metricConfig} onChange={setMetricConfig} />
                  <DashboardPreview config={{
                    resultMetric: metricConfig.result_metric,
                    resultMetricLabel: metricConfig.result_metric_label,
                    resultMetrics: metricConfig.result_metrics,
                    resultMetricsLabels: metricConfig.result_metrics_labels,
                    costMetrics: metricConfig.cost_metrics,
                    efficiencyMetrics: metricConfig.efficiency_metrics,
                  }} />
                </CollapsibleContent>
              </Collapsible>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fuso horário</Label>
                  <Select
                    value={formData.timezone}
                    onValueChange={(value) => setFormData({ ...formData, timezone: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Moeda</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData({ ...formData, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((curr) => (
                        <SelectItem key={curr.value} value={curr.value}>
                          {curr.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="gradient" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    'Criar projeto'
                  )}
                </Button>
              </div>
            </form>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Import Mode Selection Dialog */}
      <Dialog open={showImportModeDialog} onOpenChange={(open) => !open && handleImportModeClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Escolha o tipo de importação
            </DialogTitle>
            <DialogDescription>
              Projeto <strong>{pendingProjectName}</strong> criado com sucesso! Escolha como deseja importar os dados.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 py-4">
            {/* Light Sync Option */}
            <button
              onClick={() => handleStartImport('light')}
              className={cn(
                "p-6 rounded-xl border-2 text-left transition-all hover:scale-[1.02]",
                "bg-gradient-to-br from-yellow-500/10 to-amber-500/5",
                "border-yellow-500/30 hover:border-yellow-500/60",
                "hover:shadow-lg hover:shadow-yellow-500/10"
              )}
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-yellow-500/20">
                  <Zap className="w-6 h-6 text-yellow-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    Light Sync
                    <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500">
                      Recomendado
                    </span>
                  </h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    Importação rápida com dados básicos de métricas
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      ~5-10 min
                    </span>
                    <span>• Sem criativos HD</span>
                    <span>• Todas as métricas</span>
                  </div>
                </div>
              </div>
            </button>

            {/* HD Total Option */}
            <button
              onClick={() => handleStartImport('full')}
              className={cn(
                "p-6 rounded-xl border-2 text-left transition-all hover:scale-[1.02]",
                "bg-gradient-to-br from-primary/10 to-violet-500/5",
                "border-primary/30 hover:border-primary/60",
                "hover:shadow-lg hover:shadow-primary/10"
              )}
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/20">
                  <Image className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">
                    Importação Total (HD)
                  </h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    Importação completa com criativos em alta definição
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      ~20-60 min
                    </span>
                    <span>• Criativos HD</span>
                    <span>• Dados completos</span>
                  </div>
                </div>
              </div>
            </button>
          </div>

          <div className="flex justify-center pt-2">
            <Button variant="ghost" size="sm" onClick={handleImportModeClose}>
              Pular importação por agora
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ImportProgressDialog
        open={showImportProgress}
        onOpenChange={handleImportProgressCloseHandler}
        projectId={createdProjectId}
        projectName={createdProjectName}
      />
    </>
  );
}
