import { useState, useEffect } from 'react';
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
import { useSquads } from '@/hooks/useSquads';
import { useCargo } from '@/hooks/useCargo';

interface Coordinator {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  squad_id: string;
}

interface Investor {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  squad_id: string;
}

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
  const { squads } = useSquads();
  const { isTech, isGerente, isCoordenador, isInvestidor } = useCargo();
  const [customConfigOpen, setCustomConfigOpen] = useState(false);

  // Coordenador, Squad e Investidor
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState<string>('');
  const [selectedSquadId, setSelectedSquadId] = useState<string>('');
  const [selectedInvestorId, setSelectedInvestorId] = useState<string>('');

  // Carregar dados iniciais ao abrir
  useEffect(() => {
    if (open) {
      const initializeData = async () => {
        await loadCoordinators();
        
        if (isInvestidor) {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: userData } = await supabase
                .from('user_management')
                .select('id, user_id, squad_id, full_name')
                .eq('user_id', user.id)
                .maybeSingle();

              if (userData) {
                // Auto-preencher dados do investidor logado
                setSelectedInvestorId(userData.user_id);
                if (userData.squad_id) {
                  setSelectedSquadId(userData.squad_id);
                  loadInvestorsBySquad(userData.squad_id);
                  
                  // Tentar encontrar um coordenador para esta squad e pré-selecionar
                  // Buscamos nos coordenadores já carregados
                  // (usando timeout curto para garantir que coordinators já esteja no estado)
                }
              }
            }
          } catch (err) {
            console.error('Erro ao carregar dados do usuário logado:', err);
          }
        }
      };
      
      initializeData();
    }
  }, [open, isInvestidor]);

  // Quando coordenador é selecionado, atribuir squad automaticamente e carregar investidores
  useEffect(() => {
    if (selectedCoordinatorId) {
      const coordinator = coordinators.find(c => c.user_id === selectedCoordinatorId);
      if (coordinator?.squad_id) {
        setSelectedSquadId(coordinator.squad_id);
        loadInvestorsBySquad(coordinator.squad_id);
      }
    } else {
      setSelectedSquadId('');
      setInvestors([]);
      setSelectedInvestorId('');
    }
  }, [selectedCoordinatorId, coordinators]);

  const loadCoordinators = async () => {
    const { data, error } = await supabase
      .from('user_management')
      .select('id, user_id, full_name, email, squad_id')
      .in('cargo', ['coordenador', 'gerente'])
      .not('user_id', 'is', null) // Only active users
      .order('full_name');

    if (!error && data) {
      setCoordinators(data);
    }
  };

  const loadInvestorsBySquad = async (squadId: string) => {
    const { data, error } = await supabase
      .from('user_management')
      .select('id, user_id, full_name, email, squad_id')
      .eq('cargo', 'investidor')
      .eq('squad_id', squadId)
      .not('user_id', 'is', null) // Only active users
      .order('full_name');

    if (!error && data) {
      setInvestors(data);
      // Mantém quem já está selecionado (útil para auto-preenchimento)
      if (!selectedInvestorId) {
        setSelectedInvestorId('');
      }
    }
  };

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

  // Get squad name for display
  const selectedSquadName = squads.find(s => s.id === selectedSquadId)?.name || '';

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

      // Atualizar projeto com squad_id e investidor_id
      const squadIdToUpdate = selectedSquadId || null;
      const investorIdToUpdate = selectedInvestorId || null;

      if (squadIdToUpdate || investorIdToUpdate) {
        await supabase.from('projects').update({
          squad_id: squadIdToUpdate,
          investidor_id: investorIdToUpdate,
        }).eq('id', project.id);
      }

      // Adicionar investidor na tabela project_investidores e guest_project_access
      if (selectedInvestorId) {
        // Find the user_management.id for this investor (selectedInvestorId is user_id/auth id)
        const selectedInvestor = investors.find(inv => inv.user_id === selectedInvestorId);

        if (selectedInvestor) {
          // Insert into project_investidores using user_management.id
          await supabase.from('project_investidores').insert({
            project_id: project.id,
            investidor_id: selectedInvestor.id,
          });
        }

        // CRITICAL: Add investor to guest_project_access so they can see the project
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        await supabase.from('guest_project_access').upsert({
          project_id: project.id,
          user_id: selectedInvestorId, // auth user_id
          granted_by: currentUser?.id || '',
        }, { onConflict: 'user_id,project_id' });
      }

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

      // Reset form
      setFormData({
        name: '',
        ad_account_id: '',
        business_model: 'ecommerce',
        timezone: 'America/Sao_Paulo',
        currency: 'BRL',
        google_customer_id: '',
      });
      setSelectedCoordinatorId('');
      setSelectedSquadId('');
      setSelectedInvestorId('');
      setCustomConfigOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Start import with selected mode - SMART PARALLEL PROCESSING (auto-adjusts based on account size)
  const handleStartImport = async (mode: 'light' | 'full') => {
    if (!pendingProjectId) return;

    setSelectedImportMode(mode);
    setShowImportProgress(true);
    // Persist as selected project immediately
    localStorage.setItem("selectedProjectId", pendingProjectId);

    // Start the import with the selected mode
    const startYear = 2025;
    const lightSync = mode === 'light';

    // Update project sync status
    await supabase.from('projects').update({
      sync_progress: {
        status: 'importing',
        progress: 0,
        message: lightSync ? 'Iniciando Light Sync Inteligente...' : 'Iniciando Importação HD Inteligente...',
        started_at: new Date().toISOString()
      },
    }).eq('id', pendingProjectId);

    try {
      // Build parallel sync promises
      const syncPromises: Promise<any>[] = [];

      // Meta Ads import (always runs)
      syncPromises.push(
        supabase.functions.invoke('import-month-by-month', {
          body: {
            project_id: pendingProjectId,
            year: startYear,
            month: 1,
            continue_chain: true,
            force_light_sync: lightSync,
            safe_mode: true,
          },
        })
      );

      // Google Ads import (runs in parallel if google_customer_id is set)
      if (formData.google_customer_id?.trim()) {
        console.log(`[IMPORT] Starting Google Ads sync in parallel for project ${pendingProjectId}`);
        syncPromises.push(
          supabase.functions.invoke('google-ads-sync', {
            body: {
              projectId: pendingProjectId,
              syncType: 'full',
              days: 90,
            },
          })
        );
      }

      const results = await Promise.all(syncPromises);

      const metaResult = results[0];
      if (metaResult.error) {
        console.error('Error starting Meta import:', metaResult.error);
      } else {
        console.log(`[IMPORT] Started SMART Meta import for project ${pendingProjectId}`, metaResult.data);
      }

      if (results[1]) {
        const googleResult = results[1];
        if (googleResult.error || !googleResult.data?.success) {
          console.error('Error starting Google import:', googleResult.error || googleResult.data?.error);
        } else {
          console.log(`[IMPORT] Google Ads imported: ${googleResult.data?.recordsCount || 0} records`);
        }
      }
    } catch (error) {
      console.error('Error starting import:', error);
    }
  };

  const handleImportModeClose = () => {
    if (pendingProjectId) {
      localStorage.setItem("selectedProjectId", pendingProjectId);
      window.dispatchEvent(new CustomEvent("project-selected", { detail: { projectId: pendingProjectId } }));
      setShowImportModeDialog(false);
      setPendingProjectId(null);
      setPendingProjectName('');
    }
    onSuccess?.();
  };

  const handleImportProgressCloseHandler = (openState: boolean) => {
    setShowImportProgress(openState);
    if (!openState) {
      if (createdProjectId) {
        localStorage.setItem("selectedProjectId", createdProjectId);
        window.dispatchEvent(new CustomEvent("project-selected", { detail: { projectId: createdProjectId } }));
      }
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
        {(isTech || isGerente || isCoordenador || isInvestidor) && (
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Novo
            </Button>
          </DialogTrigger>
        )}
        <DialogContent className="sm:max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-xl">Criar novo projeto</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <form onSubmit={handleSubmit} className="space-y-5 mt-4">
              {/* Coordenador/Gerente -> Squad (auto) -> Investidor */}
              <div className="space-y-2">
                <Label>Coordenador ou Gerente Responsável</Label>
                <Select
                  value={selectedCoordinatorId}
                  onValueChange={setSelectedCoordinatorId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o responsável..." />
                  </SelectTrigger>
                  <SelectContent>
                    {coordinators.map((coord) => {
                      const squadName = squads.find(s => s.id === coord.squad_id)?.name;
                      return (
                        <SelectItem key={coord.user_id} value={coord.user_id}>
                          <div className="flex flex-col">
                            <span>{coord.full_name}</span>
                            {squadName && <span className="text-[10px] text-muted-foreground">Squad: {squadName}</span>}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {selectedSquadName && (
                <div className="space-y-2">
                  <Label>Squad</Label>
                  <div className="px-3 py-2 rounded-md border bg-muted/50 text-sm font-medium">
                    {selectedSquadName}
                  </div>
                  <p className="text-xs text-muted-foreground">Atribuída automaticamente pelo responsável</p>
                </div>
              )}

              {selectedSquadId && investors.length > 0 && (
                <div className="space-y-2">
                  <Label>Investidor</Label>
                  <Select
                    value={selectedInvestorId}
                    onValueChange={setSelectedInvestorId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o investidor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {investors.map((inv) => (
                        <SelectItem key={inv.user_id} value={inv.user_id}>
                          {inv.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Apenas investidores da squad {selectedSquadName}
                  </p>
                </div>
              )}

              {selectedSquadId && investors.length === 0 && (
                <div className="space-y-2">
                  <Label>Investidor</Label>
                  <div className="px-3 py-2 rounded-md border bg-muted/30 text-sm text-muted-foreground italic">
                    Nenhum investidor na squad {selectedSquadName}
                  </div>
                </div>
              )}

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
                <Label htmlFor="facebook_page_id">ID da Página Facebook (opcional)</Label>
                <Input
                  id="facebook_page_id"
                  placeholder="123456789012345"
                  value={formData.facebook_page_id || ''}
                  onChange={(e) => setFormData({ ...formData, facebook_page_id: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Necessário para Instagram e Leads. Encontre em facebook.com/sua-pagina → Sobre</p>
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
                      className={`p-3 rounded-lg border text-left transition-all ${formData.business_model === model.value
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
                    Apenas métricas e estrutura de campanhas
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      ~2-5 min
                    </span>
                    <span>• Métricas completas</span>
                    <span>• Sem criativos</span>
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
                    Importação Completa
                  </h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    Métricas + criativos + imagens HD em background
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      ~5-15 min
                    </span>
                    <span>• HD em background</span>
                    <span>• Não bloqueia UI</span>
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
