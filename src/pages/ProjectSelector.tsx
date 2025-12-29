import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProjects, Project, CreateProjectData, HealthScore } from '@/hooks/useProjects';
import { useProjectHealth } from '@/hooks/useProjectHealth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  FolderKanban, 
  TrendingUp, 
  TrendingDown,
  Users, 
  Store,
  Loader2,
  LogOut,
  ChevronRight,
  Archive,
  Trash2,
  RotateCcw,
  User,
  Mail,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Zap,
  Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const businessModels = [
  { value: 'inside_sales' as const, label: 'Inside Sales', description: 'Geração de leads e vendas internas', icon: Users },
  { value: 'ecommerce' as const, label: 'E-commerce', description: 'Vendas online com foco em ROAS', icon: TrendingUp },
  { value: 'pdv' as const, label: 'PDV', description: 'Tráfego para loja física', icon: Store },
];

const healthScoreOptions: { value: HealthScore; label: string; color: string; icon: any }[] = [
  { value: 'safe', label: 'Safe', color: 'bg-emerald-500', icon: ShieldCheck },
  { value: 'care', label: 'Care', color: 'bg-amber-500', icon: AlertTriangle },
  { value: 'danger', label: 'Danger', color: 'bg-red-500', icon: AlertCircle },
];

function HealthBadge({ score, size = 'sm' }: { score: HealthScore | undefined; size?: 'sm' | 'lg' }) {
  const option = healthScoreOptions.find(o => o.value === score);
  if (!option) return null;
  
  const Icon = option.icon;
  
  if (size === 'lg') {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${option.color} text-white`}>
        <Icon className="w-4 h-4" />
        <span className="text-sm font-medium">{option.label}</span>
      </div>
    );
  }
  
  return (
    <div className={`w-3 h-3 rounded-full ${option.color}`} title={option.label} />
  );
}

function SyncProgressBar({ project }: { project: Project }) {
  const syncProgress = project.sync_progress;
  const webhookStatus = project.webhook_status;
  
  const isSyncing = webhookStatus === 'syncing' || 
                    webhookStatus === 'importing_history' || 
                    syncProgress?.status === 'syncing' || 
                    syncProgress?.status === 'importing';
  
  if (!isSyncing) return null;
  
  const progress = syncProgress?.progress || 0;
  const message = syncProgress?.message || 'Sincronizando...';
  
  return (
    <div className="mt-3 space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          {message}
        </span>
        <span className="text-muted-foreground">{Math.round(progress)}%</span>
      </div>
      <Progress value={progress} className="h-1.5" />
    </div>
  );
}

export default function ProjectSelector() {
  const { user, loading: authLoading } = useAuth();
  const { projects, loading: projectsLoading, createProject, deleteProject, archiveProject, unarchiveProject, resyncProject, refetch } = useProjects();
  const { healthData, loading: healthLoading } = useProjectHealth(projects.filter(p => !p.archived));
  const navigate = useNavigate();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState('projects');
  const [showArchived, setShowArchived] = useState(false);
  const [formData, setFormData] = useState<CreateProjectData>({
    name: '',
    ad_account_id: '',
    business_model: 'ecommerce',
    timezone: 'America/Sao_Paulo',
    currency: 'BRL',
    health_score: null,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const activeProjects = projects.filter(p => !p.archived);
  const archivedProjects = projects.filter(p => p.archived);

  const handleSelectProject = (project: Project) => {
    localStorage.setItem('selectedProjectId', project.id);
    navigate('/campaigns');
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.ad_account_id) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setIsCreating(true);
    try {
      const adAccountId = formData.ad_account_id.startsWith('act_') 
        ? formData.ad_account_id 
        : `act_${formData.ad_account_id}`;

      const project = await createProject({
        ...formData,
        ad_account_id: adAccountId,
      });
      
      if (project) {
        setCreateDialogOpen(false);
        setFormData({
          name: '',
          ad_account_id: '',
          business_model: 'ecommerce',
          timezone: 'America/Sao_Paulo',
          currency: 'BRL',
          health_score: null,
        });
      }
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleResync = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    await resyncProject(project);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  if (authLoading || projectsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">MetaAds Manager</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => refetch()} title="Atualizar">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between mb-6">
              <TabsList className="grid w-fit grid-cols-2">
                <TabsTrigger value="projects" className="gap-2">
                  <FolderKanban className="w-4 h-4" />
                  Projetos
                </TabsTrigger>
                <TabsTrigger value="profile" className="gap-2">
                  <User className="w-4 h-4" />
                  Perfil
                </TabsTrigger>
              </TabsList>

              {activeTab === 'projects' && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowArchived(!showArchived)}
                    className={showArchived ? 'bg-secondary' : ''}
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    {showArchived ? 'Ver Ativos' : 'Arquivados'}
                    {archivedProjects.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {archivedProjects.length}
                      </Badge>
                    )}
                  </Button>
                  
                  <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="gradient" className="gap-2">
                        <Plus className="w-4 h-4" />
                        Novo Projeto
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-xl">
                      <DialogHeader>
                        <DialogTitle className="text-xl">Criar novo projeto</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleCreateProject} className="space-y-5 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="name">Nome do projeto *</Label>
                            <Input
                              id="name"
                              placeholder="Ex: Minha Loja"
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="ad_account_id">ID da Conta Meta *</Label>
                            <Input
                              id="ad_account_id"
                              placeholder="123456789"
                              value={formData.ad_account_id}
                              onChange={(e) => setFormData({ ...formData, ad_account_id: e.target.value.replace('act_', '') })}
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Modelo de negócio</Label>
                          <div className="grid grid-cols-3 gap-3">
                            {businessModels.map((model) => {
                              const Icon = model.icon;
                              return (
                                <button
                                  key={model.value}
                                  type="button"
                                  onClick={() => setFormData({ ...formData, business_model: model.value })}
                                  className={`p-3 rounded-lg border text-center transition-all ${
                                    formData.business_model === model.value
                                      ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                                      : 'border-border hover:border-primary/50'
                                  }`}
                                >
                                  <Icon className="w-5 h-5 mx-auto mb-1 text-primary" />
                                  <p className="font-medium text-sm">{model.label}</p>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Health Score do Cliente</Label>
                          <div className="grid grid-cols-3 gap-3">
                            {healthScoreOptions.map((option) => {
                              const Icon = option.icon;
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => setFormData({ ...formData, health_score: formData.health_score === option.value ? null : option.value })}
                                  className={`p-3 rounded-lg border text-center transition-all ${
                                    formData.health_score === option.value
                                      ? `border-transparent ${option.color} text-white`
                                      : 'border-border hover:border-primary/50'
                                  }`}
                                >
                                  <Icon className="w-5 h-5 mx-auto mb-1" />
                                  <p className="font-medium text-sm">{option.label}</p>
                                </button>
                              );
                            })}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Opcional: defina o status de saúde do cliente para priorização
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
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
                                <SelectItem value="BRL">Real (R$)</SelectItem>
                                <SelectItem value="USD">Dólar (US$)</SelectItem>
                                <SelectItem value="EUR">Euro (€)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
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
                                <SelectItem value="America/Sao_Paulo">São Paulo</SelectItem>
                                <SelectItem value="America/New_York">New York</SelectItem>
                                <SelectItem value="Europe/London">Londres</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t">
                          <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                            Cancelar
                          </Button>
                          <Button type="submit" variant="gradient" disabled={isCreating}>
                            {isCreating ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Criando...
                              </>
                            ) : (
                              <>
                                <Plus className="w-4 h-4 mr-2" />
                                Criar Projeto
                              </>
                            )}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>

            {/* Projects Tab */}
            <TabsContent value="projects" className="mt-0">
              <div className="mb-6">
                <h1 className="text-2xl font-bold">
                  {showArchived ? 'Projetos Arquivados' : 'Seus Projetos'}
                </h1>
                <p className="text-muted-foreground">
                  {showArchived 
                    ? 'Projetos arquivados podem ser restaurados ou excluídos permanentemente.'
                    : `${activeProjects.length} projeto${activeProjects.length !== 1 ? 's' : ''} ativo${activeProjects.length !== 1 ? 's' : ''}`}
                </p>
              </div>

              {/* Projects Grid - New Layout */}
              {(showArchived ? archivedProjects : activeProjects).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(showArchived ? archivedProjects : activeProjects).map((project) => {
                    const model = businessModels.find(m => m.value === project.business_model);
                    const Icon = model?.icon || TrendingUp;
                    const health = healthData.get(project.id);
                    const displayHealthScore = project.health_score || health?.status;
                    const isSyncing = project.webhook_status === 'syncing' || 
                                      project.webhook_status === 'importing_history' ||
                                      project.sync_progress?.status === 'syncing' ||
                                      project.sync_progress?.status === 'importing';
                    
                    return (
                      <div
                        key={project.id}
                        className={`group relative rounded-xl border bg-card p-5 transition-all hover:shadow-lg hover:border-primary/50 ${
                          showArchived ? 'opacity-75' : ''
                        }`}
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                          <button
                            onClick={() => !showArchived && handleSelectProject(project)}
                            className="flex items-center gap-3 text-left flex-1"
                            disabled={showArchived}
                          >
                            <div className="relative">
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                                <Icon className="w-6 h-6 text-primary" />
                              </div>
                              {displayHealthScore && (
                                <div className="absolute -top-1 -right-1">
                                  <HealthBadge score={displayHealthScore} />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-lg truncate group-hover:text-primary transition-colors">
                                {project.name}
                              </h3>
                              <p className="text-xs text-muted-foreground">{model?.label}</p>
                            </div>
                          </button>
                          
                          {!showArchived && (
                            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                          )}
                        </div>

                        {/* Metrics Preview */}
                        {!showArchived && health && (
                          <div className="grid grid-cols-2 gap-2 mb-4">
                            <div className="bg-secondary/30 rounded-lg p-2 text-center">
                              <p className="text-xs text-muted-foreground">Gasto 30d</p>
                              <p className="text-sm font-semibold">
                                R$ {health.spend.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                              </p>
                            </div>
                            <div className="bg-secondary/30 rounded-lg p-2 text-center">
                              <p className="text-xs text-muted-foreground">Leads 30d</p>
                              <p className="text-sm font-semibold">{health.conversions}</p>
                            </div>
                          </div>
                        )}

                        {/* Sync Progress */}
                        <SyncProgressBar project={project} />

                        {/* Footer */}
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {project.last_sync_at ? (
                              formatDistanceToNow(new Date(project.last_sync_at), { addSuffix: true, locale: ptBR })
                            ) : (
                              'Nunca sincronizado'
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1">
                            {showArchived ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => unarchiveProject(project.id)}
                                  title="Restaurar"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                      title="Excluir"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Excluir projeto permanentemente?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esta ação não pode ser desfeita. Todos os dados de "{project.name}" serão excluídos.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteProject(project.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Excluir
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => handleResync(project, e)}
                                  disabled={isSyncing}
                                  title="Re-sincronizar"
                                >
                                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Arquivar"
                                    >
                                      <Archive className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Arquivar projeto?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        O projeto "{project.name}" será arquivado. Você pode restaurá-lo depois.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => archiveProject(project.id)}>
                                        Arquivar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Excluir"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Todos os dados de "{project.name}" serão excluídos permanentemente.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteProject(project.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Excluir
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed bg-card/50 p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    {showArchived ? (
                      <Archive className="w-8 h-8 text-muted-foreground" />
                    ) : (
                      <FolderKanban className="w-8 h-8 text-primary" />
                    )}
                  </div>
                  <h2 className="text-xl font-semibold mb-2">
                    {showArchived ? 'Nenhum projeto arquivado' : 'Nenhum projeto ainda'}
                  </h2>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    {showArchived 
                      ? 'Você não tem projetos arquivados.'
                      : 'Crie seu primeiro projeto para começar a analisar campanhas do Meta Ads.'}
                  </p>
                  {!showArchived && (
                    <Button variant="gradient" onClick={() => setCreateDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Primeiro Projeto
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Profile Tab */}
            <TabsContent value="profile">
              <div className="max-w-xl mx-auto">
                <div className="text-center mb-8">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4">
                    <span className="text-4xl font-bold text-primary-foreground">
                      {user?.email?.[0].toUpperCase()}
                    </span>
                  </div>
                  <h1 className="text-2xl font-bold mb-1">Meu Perfil</h1>
                  <p className="text-muted-foreground">Gerencie suas informações de conta</p>
                </div>

                <div className="rounded-xl border bg-card p-6 space-y-6">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Email</Label>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                      <Mail className="w-5 h-5 text-muted-foreground" />
                      <span className="font-medium">{user?.email}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">ID do Usuário</Label>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                      <User className="w-5 h-5 text-muted-foreground" />
                      <span className="font-mono text-sm">{user?.id}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Estatísticas</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-secondary/50 text-center">
                        <p className="text-2xl font-bold text-primary">{activeProjects.length}</p>
                        <p className="text-sm text-muted-foreground">Projetos Ativos</p>
                      </div>
                      <div className="p-4 rounded-lg bg-secondary/50 text-center">
                        <p className="text-2xl font-bold text-muted-foreground">{archivedProjects.length}</p>
                        <p className="text-sm text-muted-foreground">Arquivados</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <Button variant="outline" onClick={handleLogout} className="w-full">
                      <LogOut className="w-4 h-4 mr-2" />
                      Sair da Conta
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
