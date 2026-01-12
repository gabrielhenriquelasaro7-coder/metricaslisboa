import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjects, BusinessModel, CreateProjectData } from '@/hooks/useProjects';
import { Plus, Loader2, Users, ShoppingCart, Store, GraduationCap, Settings2, X, Copy, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { METRIC_TEMPLATES } from '@/hooks/useProjectMetricConfig';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

const projectSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  ad_account_id: z.string().min(1, 'ID da conta Meta Ads é obrigatório'),
  business_model: z.enum(['inside_sales', 'ecommerce', 'pdv', 'custom', 'infoproduto']),
  timezone: z.string().min(1),
  currency: z.string().min(1),
  google_customer_id: z.string().optional(),
});

const businessModels: { value: BusinessModel; label: string; icon: React.ReactNode }[] = [
  { value: 'inside_sales', label: 'Inside Sales', icon: <Users className="w-3 h-3" /> },
  { value: 'ecommerce', label: 'E-commerce', icon: <ShoppingCart className="w-3 h-3" /> },
  { value: 'pdv', label: 'PDV', icon: <Store className="w-3 h-3" /> },
  { value: 'infoproduto', label: 'Infoproduto', icon: <GraduationCap className="w-3 h-3" /> },
  { value: 'custom', label: 'Personalizado', icon: <Settings2 className="w-3 h-3" /> },
];

const timezones = [
  { value: 'America/Sao_Paulo', label: 'São Paulo' },
  { value: 'America/New_York', label: 'New York' },
  { value: 'Europe/London', label: 'Londres' },
  { value: 'Europe/Lisbon', label: 'Lisboa' },
];

const currencies = [
  { value: 'BRL', label: 'R$' },
  { value: 'USD', label: 'US$' },
  { value: 'EUR', label: '€' },
];

interface ProjectFormData extends CreateProjectData {
  google_customer_id?: string;
  id?: string; // temporary ID for tracking
  status?: 'pending' | 'creating' | 'importing' | 'success' | 'error';
  error?: string;
}

const createEmptyProject = (): ProjectFormData => ({
  id: crypto.randomUUID(),
  name: '',
  ad_account_id: '',
  business_model: 'ecommerce',
  timezone: 'America/Sao_Paulo',
  currency: 'BRL',
  google_customer_id: '',
  status: 'pending',
});

interface BatchCreateProjectDialogProps {
  onSuccess?: () => void;
}

export default function BatchCreateProjectDialog({ onSuccess }: BatchCreateProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [projects, setProjects] = useState<ProjectFormData[]>([createEmptyProject()]);
  const [currentStep, setCurrentStep] = useState<'form' | 'processing'>('form');
  const [processedCount, setProcessedCount] = useState(0);
  const { createProject } = useProjects();

  const addProject = () => {
    setProjects([...projects, createEmptyProject()]);
  };

  const removeProject = (id: string) => {
    if (projects.length > 1) {
      setProjects(projects.filter(p => p.id !== id));
    }
  };

  const duplicateProject = (index: number) => {
    const projectToCopy = projects[index];
    const newProject: ProjectFormData = {
      ...projectToCopy,
      id: crypto.randomUUID(),
      name: `${projectToCopy.name} (cópia)`,
      ad_account_id: '', // Don't copy the ad account ID
      status: 'pending',
    };
    const newProjects = [...projects];
    newProjects.splice(index + 1, 0, newProject);
    setProjects(newProjects);
  };

  const updateProject = (id: string, updates: Partial<ProjectFormData>) => {
    setProjects(projects.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const validateAll = (): boolean => {
    let allValid = true;
    const updatedProjects = projects.map(project => {
      try {
        projectSchema.parse(project);
        return { ...project, error: undefined };
      } catch (error) {
        allValid = false;
        if (error instanceof z.ZodError) {
          return { ...project, error: error.errors[0]?.message || 'Erro de validação' };
        }
        return project;
      }
    });
    setProjects(updatedProjects);
    return allValid;
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleSubmit = async () => {
    if (!validateAll()) {
      toast.error('Corrija os erros antes de continuar');
      return;
    }

    setIsProcessing(true);
    setCurrentStep('processing');
    setProcessedCount(0);

    // Process projects with 30-second delay between each to avoid rate limits
    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];
      
      // Update status to creating
      setProjects(prev => prev.map(p => 
        p.id === project.id ? { ...p, status: 'creating' } : p
      ));

      try {
        // Create the project
        const createdProject = await createProject({
          name: project.name,
          ad_account_id: project.ad_account_id,
          business_model: project.business_model,
          timezone: project.timezone,
          currency: project.currency,
          google_customer_id: project.google_customer_id,
        });

        // Insert metric config if custom
        if (project.business_model === 'custom') {
          const template = METRIC_TEMPLATES.custom;
          await supabase.from('project_metric_config').insert({
            project_id: createdProject.id,
            primary_metrics: template.primary_metrics,
            result_metric: 'leads',
            result_metric_label: 'Leads',
            result_metrics: ['leads'],
            result_metrics_labels: { leads: 'Leads' },
            cost_metrics: ['cpl', 'cpa'],
            efficiency_metrics: ['ctr', 'roas'],
            show_comparison: true,
            chart_primary_metric: template.chart_primary_metric,
            chart_secondary_metric: 'leads',
          });
        }

        // Update status to importing
        setProjects(prev => prev.map(p => 
          p.id === project.id ? { ...p, status: 'importing' } : p
        ));

        // Start the import process (non-blocking)
        supabase.functions.invoke('import-month-by-month', {
          body: {
            project_id: createdProject.id,
            year: new Date().getFullYear(),
            month: 1,
            continue_chain: true,
            safe_mode: true,
          },
        }).catch(err => {
          console.error('Import error for project:', project.name, err);
        });

        // Mark as success
        setProjects(prev => prev.map(p => 
          p.id === project.id ? { ...p, status: 'success' } : p
        ));
        setProcessedCount(i + 1);

        // Wait 30 seconds before next project to avoid rate limits
        // (except for the last one)
        if (i < projects.length - 1) {
          await sleep(30000);
        }

      } catch (error) {
        console.error('Error creating project:', project.name, error);
        setProjects(prev => prev.map(p => 
          p.id === project.id ? { 
            ...p, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Erro ao criar projeto' 
          } : p
        ));
        setProcessedCount(i + 1);
        
        // Still wait before next to not overwhelm the API
        if (i < projects.length - 1) {
          await sleep(5000);
        }
      }
    }

    setIsProcessing(false);
    toast.success(`${projects.filter(p => p.status === 'success').length} projetos criados com sucesso!`);
  };

  const handleClose = () => {
    if (isProcessing) {
      toast.warning('Aguarde o processamento terminar');
      return;
    }
    setOpen(false);
    setProjects([createEmptyProject()]);
    setCurrentStep('form');
    setProcessedCount(0);
    onSuccess?.();
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'creating':
      case 'importing':
        return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'creating':
        return 'Criando...';
      case 'importing':
        return 'Importando...';
      case 'success':
        return 'Concluído';
      case 'error':
        return 'Erro';
      default:
        return 'Aguardando';
    }
  };

  const progress = projects.length > 0 ? (processedCount / projects.length) * 100 : 0;

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setOpen(true);
    } else {
      handleClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Criar em Lote
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            Criar Projetos em Lote
            <Badge variant="secondary">{projects.length} projeto(s)</Badge>
          </DialogTitle>
        </DialogHeader>

        {currentStep === 'form' ? (
          <>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4">
                {projects.map((project, index) => (
                  <div 
                    key={project.id} 
                    className={`p-4 border rounded-lg space-y-3 ${project.error ? 'border-destructive' : 'border-border'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        Projeto {index + 1}
                      </span>
                      <div className="flex gap-1">
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7"
                          onClick={() => duplicateProject(index)}
                          title="Duplicar"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        {projects.length > 1 && (
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => removeProject(project.id!)}
                            title="Remover"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="col-span-2 md:col-span-1">
                        <Label className="text-xs">Nome</Label>
                        <Input
                          placeholder="Nome do projeto"
                          value={project.name}
                          onChange={(e) => updateProject(project.id!, { name: e.target.value })}
                          className="h-9"
                        />
                      </div>

                      <div className="col-span-2 md:col-span-1">
                        <Label className="text-xs">Meta Ads ID</Label>
                        <Input
                          placeholder="act_123456789"
                          value={project.ad_account_id}
                          onChange={(e) => updateProject(project.id!, { ad_account_id: e.target.value })}
                          className="h-9"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Modelo</Label>
                        <Select
                          value={project.business_model}
                          onValueChange={(value: BusinessModel) => updateProject(project.id!, { business_model: value })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {businessModels.map((model) => (
                              <SelectItem key={model.value} value={model.value}>
                                <div className="flex items-center gap-2">
                                  {model.icon}
                                  <span>{model.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Fuso</Label>
                          <Select
                            value={project.timezone}
                            onValueChange={(value) => updateProject(project.id!, { timezone: value })}
                          >
                            <SelectTrigger className="h-9">
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
                        <div>
                          <Label className="text-xs">Moeda</Label>
                          <Select
                            value={project.currency}
                            onValueChange={(value) => updateProject(project.id!, { currency: value })}
                          >
                            <SelectTrigger className="h-9">
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
                    </div>

                    <div>
                      <Label className="text-xs">Google Ads ID (opcional)</Label>
                      <Input
                        placeholder="123-456-7890"
                        value={project.google_customer_id || ''}
                        onChange={(e) => updateProject(project.id!, { google_customer_id: e.target.value })}
                        className="h-9"
                      />
                    </div>

                    {project.error && (
                      <p className="text-xs text-destructive">{project.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex items-center justify-between pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={addProject}
                disabled={isProcessing}
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Projeto
              </Button>

              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button 
                  variant="gradient" 
                  onClick={handleSubmit}
                  disabled={isProcessing}
                >
                  Criar {projects.length} Projeto(s)
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progresso geral</span>
                <span className="text-muted-foreground">
                  {processedCount} de {projects.length}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <div className="bg-muted/30 p-3 rounded-lg">
              <p className="text-sm text-muted-foreground text-center">
                ⏱️ Delay de 30 segundos entre projetos para evitar rate limit da API Meta
              </p>
            </div>

            <ScrollArea className="max-h-[40vh]">
              <div className="space-y-2">
                {projects.map((project, index) => (
                  <div 
                    key={project.id}
                    className="flex items-center justify-between p-3 bg-card border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground w-6">
                        {index + 1}.
                      </span>
                      <div>
                        <p className="font-medium text-sm">{project.name || 'Sem nome'}</p>
                        <p className="text-xs text-muted-foreground">{project.ad_account_id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(project.status)}
                      <span className={`text-xs ${project.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {getStatusLabel(project.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {!isProcessing && (
              <div className="flex justify-end">
                <Button onClick={handleClose}>
                  Fechar
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
