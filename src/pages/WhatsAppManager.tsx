import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import { useWhatsAppManager } from '@/hooks/useWhatsAppManager';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Plus, 
  Smartphone, 
  Settings2, 
  CheckCircle2, 
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  Calendar,
  ArrowLeft
} from 'lucide-react';
import { ManagerInstanceCard } from '@/components/whatsapp/ManagerInstanceCard';
import { WhatsAppQRModal } from '@/components/whatsapp/WhatsAppQRModal';
import { ProjectReportConfigDialog } from '@/components/whatsapp/ProjectReportConfigDialog';
import whatsappIcon from '@/assets/whatsapp-icon.png';
import v4Logo from '@/assets/v4-logo-full.png';

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function WhatsAppManager() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { projects } = useProjects();
  const {
    instances,
    configs,
    loading,
    creating,
    maxInstances,
    canCreateInstance,
    fetchAll,
    createInstance,
    connectInstance,
    checkStatus,
    disconnectInstance,
    deleteInstance,
    updateInstanceName,
    listGroups,
    saveConfig,
    deleteConfig,
    getConfigForProject,
  } = useWhatsAppManager();

  // QR Modal state
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrModalData, setQrModalData] = useState<{ instanceId: string; qrCode: string | null; expiresAt: string | null }>({
    instanceId: '',
    qrCode: null,
    expiresAt: null,
  });
  const [connectingInstanceId, setConnectingInstanceId] = useState<string | null>(null);

  // New instance dialog
  const [newInstanceDialogOpen, setNewInstanceDialogOpen] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');

  // Project config dialog
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<{ id: string; name: string; business_model: string } | null>(null);

  // Filter only non-archived projects
  const activeProjects = projects.filter(p => !p.archived);

  // Load data on mount
  useEffect(() => {
    if (user) {
      fetchAll();
    }
  }, [user, fetchAll]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const handleCreateInstance = async () => {
    if (!newInstanceName.trim()) {
      toast.error('Digite um nome para a conexão');
      return;
    }

    const instance = await createInstance(newInstanceName.trim());
    if (instance) {
      setNewInstanceDialogOpen(false);
      setNewInstanceName('');
      // Auto-connect
      handleConnect(instance.id);
    }
  };

  const handleConnect = async (instanceId: string) => {
    setConnectingInstanceId(instanceId);
    const { qrCode, expiresAt } = await connectInstance(instanceId);
    
    if (qrCode) {
      setQrModalData({ instanceId, qrCode, expiresAt });
      setQrModalOpen(true);
    }
    setConnectingInstanceId(null);
  };

  const handleRefreshQR = async () => {
    if (!qrModalData.instanceId) return;
    const { qrCode, expiresAt } = await connectInstance(qrModalData.instanceId);
    setQrModalData(prev => ({ ...prev, qrCode, expiresAt }));
  };

  const handleCheckStatus = async (): Promise<boolean> => {
    if (!qrModalData.instanceId) return false;
    const { status } = await checkStatus(qrModalData.instanceId);
    return status === 'connected';
  };

  const handleOpenConfig = (project: { id: string; name: string; business_model: string }) => {
    setSelectedProject(project);
    setConfigDialogOpen(true);
  };

  const getProjectConfigStatus = (projectId: string) => {
    const config = getConfigForProject(projectId);
    if (!config) return { status: 'not_configured', config: null };
    
    const instance = instances.find(i => i.id === config.instance_id);
    const isInstanceConnected = instance?.instance_status === 'connected';
    
    if (!isInstanceConnected) return { status: 'disconnected', config };
    if (!config.report_enabled) return { status: 'disabled', config };
    
    return { status: 'active', config };
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header fixo */}
        <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header fixo com logo V4 */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              to="/projects"
              className="flex items-center gap-3 group transition-all duration-300 hover:opacity-80"
            >
              <img 
                src={v4Logo} 
                alt="V4 Company" 
                className="h-10 w-auto"
              />
            </Link>
            <div className="w-px h-8 bg-border/50" />
            <div className="flex items-center gap-3">
              <img src={whatsappIcon} alt="WhatsApp" className="w-8 h-8" />
              <span className="text-lg font-semibold text-foreground">WhatsApp Manager</span>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/projects')}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Projetos
          </Button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6 space-y-8">
        {/* Page Header */}
        <div>
          <p className="text-muted-foreground">
            Conecte seu WhatsApp e configure envios automáticos de relatórios para todos os seus projetos
          </p>
        </div>

        {/* Connections Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5" />
                  Suas Conexões WhatsApp
                </CardTitle>
                <CardDescription>
                  Conecte até {maxInstances} números de WhatsApp
                </CardDescription>
              </div>
              <Button
                onClick={() => setNewInstanceDialogOpen(true)}
                disabled={!canCreateInstance || creating}
                size="sm"
                className="bg-[#25D366] hover:bg-[#20BD5A] text-white"
              >
                {creating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando...</>
                ) : (
                  <><Plus className="w-4 h-4 mr-2" /> Nova Conexão</>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {instances.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma conexão configurada</p>
                <p className="text-sm">Clique em "Nova Conexão" para começar</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {instances.map(instance => (
                  <ManagerInstanceCard
                    key={instance.id}
                    instance={instance}
                    onConnect={handleConnect}
                    onDisconnect={disconnectInstance}
                    onDelete={deleteInstance}
                    onUpdateName={updateInstanceName}
                    isConnecting={connectingInstanceId === instance.id}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Projects Configuration Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              Configurações por Projeto
            </CardTitle>
            <CardDescription>
              Configure o envio automático de relatórios para cada projeto
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeProjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhum projeto encontrado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeProjects.map(project => {
                  const { status, config } = getProjectConfigStatus(project.id);
                  const instance = config ? instances.find(i => i.id === config.instance_id) : null;

                  return (
                    <div
                      key={project.id}
                      className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{project.name}</h4>
                        {config && (
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <Smartphone className="w-3 h-3" />
                            <span>{instance?.display_name || 'Sem conexão'}</span>
                            {config.report_enabled && (
                              <>
                                <span>•</span>
                                <Calendar className="w-3 h-3" />
                                <span>
                                  {DAYS_OF_WEEK[config.report_day_of_week]} {config.report_time}
                                </span>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <Badge 
                          variant={status === 'active' ? 'default' : 'secondary'}
                          className={
                            status === 'active' ? 'bg-[#25D366]/20 text-[#25D366] border-[#25D366]/30' :
                            status === 'disconnected' ? 'bg-metric-warning/20 text-metric-warning border-metric-warning/30' :
                            status === 'disabled' ? 'bg-muted text-muted-foreground' :
                            ''
                          }
                        >
                          {status === 'active' && <><CheckCircle2 className="w-3 h-3 mr-1" /> Ativo</>}
                          {status === 'disconnected' && <><AlertTriangle className="w-3 h-3 mr-1" /> Desconectado</>}
                          {status === 'disabled' && <><XCircle className="w-3 h-3 mr-1" /> Desativado</>}
                          {status === 'not_configured' && <><Clock className="w-3 h-3 mr-1" /> Não configurado</>}
                        </Badge>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenConfig(project)}
                          disabled={instances.filter(i => i.instance_status === 'connected').length === 0}
                        >
                          <Settings2 className="w-4 h-4 mr-2" />
                          Configurar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {instances.filter(i => i.instance_status === 'connected').length === 0 && activeProjects.length > 0 && (
              <div className="mt-4 p-4 rounded-lg bg-metric-warning/10 border border-metric-warning/30 text-sm">
                <div className="flex items-center gap-2 text-metric-warning">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Conecte um WhatsApp para configurar os projetos</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New Instance Dialog */}
      <Dialog open={newInstanceDialogOpen} onOpenChange={setNewInstanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <img src={whatsappIcon} alt="WhatsApp" className="w-6 h-6" />
              Nova Conexão WhatsApp
            </DialogTitle>
            <DialogDescription>
              Digite um nome para identificar esta conexão
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Ex: Meu WhatsApp Principal"
            value={newInstanceName}
            onChange={(e) => setNewInstanceName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateInstance();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewInstanceDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateInstance} 
              disabled={creating}
              className="bg-[#25D366] hover:bg-[#20BD5A] text-white"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Modal */}
      <WhatsAppQRModal
        open={qrModalOpen}
        onOpenChange={setQrModalOpen}
        qrCode={qrModalData.qrCode}
        expiresAt={qrModalData.expiresAt}
        onRefreshQR={handleRefreshQR}
        onCheckStatus={async () => {
          const connected = await handleCheckStatus();
          return { status: connected ? 'connected' : 'disconnected', phoneNumber: '' };
        }}
      />

      {/* Project Config Dialog */}
      {selectedProject && (
        <ProjectReportConfigDialog
          open={configDialogOpen}
          onOpenChange={setConfigDialogOpen}
          project={selectedProject}
          instances={instances}
          existingConfig={getConfigForProject(selectedProject.id)}
          onSave={saveConfig}
          onListGroups={listGroups}
        />
      )}
    </div>
  );
}
