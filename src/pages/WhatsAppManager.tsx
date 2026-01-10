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
  ArrowLeft,
  Send,
  Power,
  PowerOff
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
    toggleConfigEnabled,
    resendReport,
  } = useWhatsAppManager();

  // Loading states for actions
  const [resendingProjectId, setResendingProjectId] = useState<string | null>(null);
  const [togglingProjectId, setTogglingProjectId] = useState<string | null>(null);

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

  const handleResendReport = async (projectId: string) => {
    setResendingProjectId(projectId);
    await resendReport(projectId);
    setResendingProjectId(null);
  };

  const handleToggleConfig = async (projectId: string, currentEnabled: boolean) => {
    setTogglingProjectId(projectId);
    await toggleConfigEnabled(projectId, !currentEnabled);
    setTogglingProjectId(null);
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
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Link 
              to="/projects"
              className="flex items-center gap-2 sm:gap-3 group transition-all duration-300 hover:opacity-80 flex-shrink-0"
            >
              <img 
                src={whatsappIcon} 
                alt="WhatsApp" 
                className="w-7 h-7 sm:w-8 sm:h-8"
              />
              <span className="text-base sm:text-lg font-semibold text-foreground whitespace-nowrap">
                WhatsApp Manager
              </span>
            </Link>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/projects')}
            className="gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm flex-shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">Voltar para</span> Projetos
          </Button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-8">
        {/* Page Header */}
        <div>
          <p className="text-sm sm:text-base text-muted-foreground">
            Conecte seu WhatsApp e configure envios automáticos de relatórios para todos os seus projetos
          </p>
        </div>

        {/* Connections Section */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Smartphone className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span className="truncate">Suas Conexões WhatsApp</span>
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm mt-1">
                  Conecte até {maxInstances} números de WhatsApp
                </CardDescription>
              </div>
              <Button
                onClick={() => setNewInstanceDialogOpen(true)}
                disabled={!canCreateInstance || creating}
                size="sm"
                className="bg-[#25D366] hover:bg-[#20BD5A] text-white h-8 sm:h-9 text-xs sm:text-sm w-full sm:w-auto flex-shrink-0"
              >
                {creating ? (
                  <><Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 animate-spin" /> Criando...</>
                ) : (
                  <><Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" /> Nova Conexão</>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            {instances.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                <Smartphone className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 opacity-30" />
                <p className="text-sm sm:text-base">Nenhuma conexão configurada</p>
                <p className="text-xs sm:text-sm">Clique em "Nova Conexão" para começar</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
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
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Settings2 className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              Configurações por Projeto
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">
              Configure o envio automático de relatórios para cada projeto
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            {activeProjects.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                <p className="text-sm sm:text-base">Nenhum projeto encontrado</p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {activeProjects.map(project => {
                  const { status, config } = getProjectConfigStatus(project.id);
                  const instance = config ? instances.find(i => i.id === config.instance_id) : null;

                  return (
                    <div
                      key={project.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 p-3 sm:p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate text-sm sm:text-base">{project.name}</h4>
                        {config && (
                          <div className="flex items-center gap-1.5 sm:gap-2 mt-1 text-xs sm:text-sm text-muted-foreground flex-wrap">
                            <Smartphone className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{instance?.display_name || 'Sem conexão'}</span>
                            {config.report_enabled && (
                              <>
                                <span>•</span>
                                <Calendar className="w-3 h-3 flex-shrink-0" />
                                <span>
                                  {DAYS_OF_WEEK[config.report_day_of_week]} {config.report_time}
                                </span>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 flex-wrap">
                        <Badge 
                          variant={status === 'active' ? 'default' : 'secondary'}
                          className={`text-[10px] sm:text-xs ${
                            status === 'active' ? 'bg-[#25D366]/20 text-[#25D366] border-[#25D366]/30' :
                            status === 'disconnected' ? 'bg-metric-warning/20 text-metric-warning border-metric-warning/30' :
                            status === 'disabled' ? 'bg-muted text-muted-foreground' :
                            ''
                          }`}
                        >
                          {status === 'active' && <><CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" /> Ativo</>}
                          {status === 'disconnected' && <><AlertTriangle className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" /> Desconectado</>}
                          {status === 'disabled' && <><XCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" /> Desativado</>}
                          {status === 'not_configured' && <><Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" /> <span className="hidden xs:inline">Não </span>config.</>}
                        </Badge>

                        {/* Toggle Enable/Disable Button */}
                        {config && status !== 'not_configured' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleConfig(project.id, config.report_enabled)}
                            disabled={togglingProjectId === project.id}
                            className={`h-7 sm:h-8 w-7 sm:w-8 p-0 ${config.report_enabled 
                              ? 'text-metric-warning hover:bg-metric-warning/10' 
                              : 'text-[#25D366] hover:bg-[#25D366]/10'
                            }`}
                            title={config.report_enabled ? 'Desativar relatório' : 'Ativar relatório'}
                          >
                            {togglingProjectId === project.id ? (
                              <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                            ) : config.report_enabled ? (
                              <PowerOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            ) : (
                              <Power className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            )}
                          </Button>
                        )}

                        {/* Resend Report Button */}
                        {config && status === 'active' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResendReport(project.id)}
                            disabled={resendingProjectId === project.id}
                            className="h-7 sm:h-8 w-7 sm:w-8 p-0 text-[#25D366] hover:bg-[#25D366]/10"
                            title="Reenviar relatório agora"
                          >
                            {resendingProjectId === project.id ? (
                              <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            )}
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenConfig(project)}
                          disabled={instances.filter(i => i.instance_status === 'connected').length === 0}
                          className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
                        >
                          <Settings2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                          <span className="hidden xs:inline">Configurar</span>
                          <span className="xs:hidden">Config</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {instances.filter(i => i.instance_status === 'connected').length === 0 && activeProjects.length > 0 && (
              <div className="mt-3 sm:mt-4 p-3 sm:p-4 rounded-lg bg-metric-warning/10 border border-metric-warning/30 text-xs sm:text-sm">
                <div className="flex items-center gap-2 text-metric-warning">
                  <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
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
