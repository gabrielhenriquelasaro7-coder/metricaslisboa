import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjects, BusinessModel, CreateProjectData } from '@/hooks/useProjects';
import { Plus, Loader2, Settings2, Users, ShoppingCart, Store, GraduationCap } from 'lucide-react';
import { z } from 'zod';
import { ImportProgressDialog } from './ImportProgressDialog';
import { MetricConfigPanel, type MetricConfigData } from './MetricConfigPanel';
import { DashboardPreview } from './DashboardPreview';
import { supabase } from '@/integrations/supabase/client';
import { METRIC_TEMPLATES } from '@/hooks/useProjectMetricConfig';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';

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
      
      setOpen(false);
      setCreatedProjectId(project.id);
      setCreatedProjectName(formData.name);
      setShowImportProgress(true);
      
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

  const handleImportProgressClose = (openState: boolean) => {
    setShowImportProgress(openState);
    if (!openState) {
      setCreatedProjectId(null);
      setCreatedProjectName('');
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

      <ImportProgressDialog
        open={showImportProgress}
        onOpenChange={handleImportProgressClose}
        projectId={createdProjectId}
        projectName={createdProjectName}
      />
    </>
  );
}
