import { useState, createContext, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProjects, Project, CreateProjectData } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  FolderKanban, 
  TrendingUp, 
  Users, 
  Store,
  Loader2,
  LogOut,
  ChevronRight
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const businessModels = [
  { value: 'inside_sales' as const, label: 'Inside Sales', description: 'Geração de leads e vendas internas', icon: Users },
  { value: 'ecommerce' as const, label: 'E-commerce', description: 'Vendas online com foco em ROAS', icon: TrendingUp },
  { value: 'pdv' as const, label: 'PDV', description: 'Tráfego para loja física', icon: Store },
];

export default function ProjectSelector() {
  const { user, loading: authLoading } = useAuth();
  const { projects, loading: projectsLoading, createProject, refetch } = useProjects();
  const navigate = useNavigate();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<CreateProjectData>({
    name: '',
    ad_account_id: '',
    business_model: 'ecommerce',
    timezone: 'America/Sao_Paulo',
    currency: 'BRL',
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

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
      // Format ad account ID - add act_ prefix if not present
      const adAccountId = formData.ad_account_id.startsWith('act_') 
        ? formData.ad_account_id 
        : `act_${formData.ad_account_id}`;

      const project = await createProject({
        ...formData,
        ad_account_id: adAccountId,
      });
      
      if (project) {
        // Trigger sync immediately
        toast.info('Sincronizando dados do Meta Ads...');
        
        try {
          const { data, error } = await supabase.functions.invoke('meta-ads-sync', {
            body: {
              project_id: project.id,
              ad_account_id: adAccountId,
            },
          });

          if (error) throw error;
          
          if (data?.success) {
            toast.success('Dados sincronizados com sucesso!');
          } else {
            toast.error(data?.error || 'Erro na sincronização');
          }
        } catch (syncError) {
          console.error('Sync error:', syncError);
          toast.error('Erro ao sincronizar. Tente novamente na página de campanhas.');
        }

        localStorage.setItem('selectedProjectId', project.id);
        setCreateDialogOpen(false);
        navigate('/campaigns');
      }
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setIsCreating(false);
    }
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
      <header className="border-b border-border">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">MetaAds Manager</span>
          </div>
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Selecione um Projeto</h1>
            <p className="text-muted-foreground text-lg">
              Escolha um projeto existente ou crie um novo para começar a analisar suas campanhas.
            </p>
          </div>

          {/* Projects Grid */}
          {projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {projects.map((project) => {
                const model = businessModels.find(m => m.value === project.business_model);
                const Icon = model?.icon || TrendingUp;
                
                return (
                  <button
                    key={project.id}
                    onClick={() => handleSelectProject(project)}
                    className="glass-card-hover p-6 text-left group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Icon className="w-7 h-7 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-xl group-hover:text-primary transition-colors">
                            {project.name}
                          </h3>
                          <p className="text-sm text-muted-foreground">{model?.label}</p>
                          <p className="text-xs text-muted-foreground font-mono mt-1">
                            ID: {project.ad_account_id.replace('act_', '')}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="glass-card p-12 text-center mb-8">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <FolderKanban className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold mb-3">Nenhum projeto ainda</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Crie seu primeiro projeto para começar a analisar suas campanhas do Meta Ads.
              </p>
            </div>
          )}

          {/* Create Project Button */}
          <div className="flex justify-center">
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="gradient" size="lg" className="gap-2">
                  <Plus className="w-5 h-5" />
                  Criar Novo Projeto
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-xl">Criar novo projeto</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateProject} className="space-y-5 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome do projeto</Label>
                    <Input
                      id="name"
                      placeholder="Minha loja virtual"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ad_account_id">ID da conta de anúncios</Label>
                    <Input
                      id="ad_account_id"
                      placeholder="123456789 (sem o act_)"
                      value={formData.ad_account_id}
                      onChange={(e) => setFormData({ ...formData, ad_account_id: e.target.value.replace('act_', '') })}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Digite apenas o número do ID da sua conta de anúncios
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Modelo de negócio</Label>
                    <div className="grid grid-cols-1 gap-3">
                      {businessModels.map((model) => {
                        const Icon = model.icon;
                        return (
                          <button
                            key={model.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, business_model: model.value })}
                            className={`p-4 rounded-lg border text-left transition-all flex items-center gap-3 ${
                              formData.business_model === model.value
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <Icon className="w-5 h-5 text-primary" />
                            <div>
                              <p className="font-medium">{model.label}</p>
                              <p className="text-sm text-muted-foreground">{model.description}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
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

                  <div className="flex justify-end gap-3 pt-4">
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
                        'Criar e Sincronizar'
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </main>
    </div>
  );
}
