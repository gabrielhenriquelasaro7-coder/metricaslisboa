import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import { useWhatsAppInstances } from '@/hooks/useWhatsAppInstances';
import { useWhatsAppManager, type ManagerInstance, type ReportConfig } from '@/hooks/useWhatsAppManager';
import { useWhatsAppPlannerConfig, type PlannerConfig } from '@/hooks/useWhatsAppPlannerConfig';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Loader2, Plus, Smartphone, CheckCircle2, Calendar,
  BarChart3, FileText, Settings2, Trash2
} from 'lucide-react';
import { WhatsAppInstanceCard } from '@/components/whatsapp/WhatsAppInstanceCard';
import { WhatsAppQRModal } from '@/components/whatsapp/WhatsAppQRModal';
import { AnomalyAlertsCard } from '@/components/alerts/AnomalyAlertsCard';
import { WhatsAppSkeleton } from '@/components/skeletons';
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/layout/PageTransition';
import { ProjectReportConfigDialogNew } from '@/components/whatsapp/ProjectReportConfigDialogNew';
import whatsappIcon from '@/assets/whatsapp-icon.png';

export default function WhatsApp() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { projects } = useProjects();

  const selectedProjectId = localStorage.getItem('selectedProjectId');
  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0];

  // WhatsApp Instances (for connections)
  const {
    instances, loading: instancesLoading, creating: creatingInstance,
    createInstance, connectInstance, checkStatus, disconnectInstance,
    deleteInstance, listGroups: listGroupsInstance, updateDisplayName,
  } = useWhatsAppInstances(selectedProject?.id || null);

  // WhatsApp Manager (for report configs)
  const manager = useWhatsAppManager();

  // Planner configs
  const plannerHook = useWhatsAppPlannerConfig();

  // QR Modal state
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrModalData, setQrModalData] = useState<{ instanceId: string; qrCode: string | null; expiresAt: string | null }>({ instanceId: '', qrCode: null, expiresAt: null });
  const [connectingInstanceId, setConnectingInstanceId] = useState<string | null>(null);

  // New report dialog
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportProjectId, setReportProjectId] = useState<string | null>(null);

  // Project config modal
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configProject, setConfigProject] = useState<{ id: string; name: string; business_model: string } | null>(null);

  const connectedInstances = instances.filter(i => i.instance_status === 'connected');
  const activeProjects = projects.filter(p => !p.archived);

  // Fetch manager configs on load
  useEffect(() => {
    if (user) {
      manager.fetchAll();
      plannerHook.fetchConfigs();
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  const handleCreateInstance = async () => {
    const instance = await createInstance('Nova Conexão');
    if (instance) handleConnectInstance(instance.id);
  };

  const handleConnectInstance = async (instanceId: string) => {
    setConnectingInstanceId(instanceId);
    const result = await connectInstance(instanceId);
    setConnectingInstanceId(null);
    if (result) {
      setQrModalData({ instanceId, qrCode: result.qrCode, expiresAt: result.expiresAt });
      setQrModalOpen(true);
    }
  };

  const handleRefreshQR = async () => {
    if (!qrModalData.instanceId) return;
    const result = await connectInstance(qrModalData.instanceId);
    if (result) setQrModalData({ ...qrModalData, qrCode: result.qrCode, expiresAt: result.expiresAt });
  };

  const handleCheckStatus = async () => {
    if (!qrModalData.instanceId) return null;
    return await checkStatus(qrModalData.instanceId);
  };

  // Handle "Novo Relatório" flow
  const handleCreateReport = () => {
    if (!reportProjectId) { toast.error('Selecione um projeto'); return; }
    const proj = activeProjects.find(p => p.id === reportProjectId);
    if (!proj) return;
    setReportDialogOpen(false);
    setConfigProject({ id: proj.id, name: proj.name, business_model: proj.business_model || 'inside_sales' });
    setConfigModalOpen(true);
  };

  // Open config for existing project card
  const handleOpenProjectConfig = (proj: typeof activeProjects[0]) => {
    setConfigProject({ id: proj.id, name: proj.name, business_model: proj.business_model || 'inside_sales' });
    setConfigModalOpen(true);
  };

  // Adapt instances for the modal (cast to ManagerInstance type)
  const managerInstances: ManagerInstance[] = instances.map(i => ({
    id: i.id,
    user_id: user?.id || '',
    instance_name: i.instance_name,
    display_name: i.display_name,
    instance_status: i.instance_status,
    phone_connected: i.phone_connected,
    qr_code: i.qr_code || null,
    qr_code_expires_at: null,
    created_at: i.created_at,
    updated_at: i.updated_at || i.created_at,
  }));

  // Get projects that have configs
  const projectsWithConfigs = activeProjects.filter(p => {
    const hasReportConfig = manager.configs.some(c => c.project_id === p.id);
    const hasPlannerConfig = plannerHook.configs.some(c => c.project_id === p.id);
    return hasReportConfig || hasPlannerConfig;
  });

  // Projects without configs (for the "create" dialog)
  const projectsWithoutConfigs = activeProjects.filter(p => {
    return !manager.configs.some(c => c.project_id === p.id) && !plannerHook.configs.some(c => c.project_id === p.id);
  });

  const loading = authLoading || instancesLoading;

  if (loading) {
    return <DashboardLayout><div className="p-6 lg:p-8"><WhatsAppSkeleton /></div></DashboardLayout>;
  }

  if (!selectedProject) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8 flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-muted-foreground">Selecione um projeto primeiro</p>
          <Button onClick={() => navigate('/dashboard')}>Ir para Projetos</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 overflow-x-hidden">
        {/* Hero Header */}
        <FadeIn>
          <div className="glass-card overflow-hidden">
            <div className="bg-gradient-to-r from-green-600/20 via-green-500/10 to-transparent p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0">
                    <img src={whatsappIcon} alt="WhatsApp" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <h1 className="text-lg sm:text-xl lg:text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>WhatsApp</h1>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Gerencie conexões e relatórios automáticos</p>
                  </div>
                </div>
                <Button onClick={handleCreateInstance} disabled={creatingInstance || instances.length >= 3} size="sm" variant="outline" className="gap-1.5">
                  {creatingInstance ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Smartphone className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">Conexão</span>
                </Button>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="bg-background/40 backdrop-blur-sm rounded-lg p-2.5 sm:p-3 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <Smartphone className="w-3.5 h-3.5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm sm:text-lg font-bold">{instances.length}</p>
                    <p className="text-[9px] sm:text-[10px] text-muted-foreground">Conexões</p>
                  </div>
                </div>
                <div className="bg-background/40 backdrop-blur-sm rounded-lg p-2.5 sm:p-3 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm sm:text-lg font-bold">{connectedInstances.length > 0 ? 'Conectado' : 'Offline'}</p>
                    <p className="text-[9px] sm:text-[10px] text-muted-foreground">Status</p>
                  </div>
                </div>
                <div className="bg-background/40 backdrop-blur-sm rounded-lg p-2.5 sm:p-3 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm sm:text-lg font-bold">{manager.configs.filter(c => c.report_enabled).length}</p>
                    <p className="text-[9px] sm:text-[10px] text-muted-foreground">Automações</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Instances grid inside card */}
            {instances.length > 0 && (
              <div className="p-3 sm:p-4 border-t border-border/30">
                <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {instances.map((instance) => (
                    <WhatsAppInstanceCard
                      key={instance.id}
                      instance={instance}
                      onConnect={handleConnectInstance}
                      onDisconnect={disconnectInstance}
                      onDelete={deleteInstance}
                      onUpdateName={updateDisplayName}
                      isConnecting={connectingInstanceId === instance.id}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </FadeIn>

        {/* Create Report Button */}
        <FadeIn delay={0.1}>
          <Button onClick={() => setReportDialogOpen(true)} className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white h-12 text-sm font-medium">
            <Plus className="w-4 h-4" />
            Criar Relatório
          </Button>
        </FadeIn>

        {/* Project Report Cards */}
        {projectsWithConfigs.length > 0 && (
          <StaggerContainer staggerDelay={0.05}>
            <StaggerItem>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 bg-gradient-to-b from-green-500 to-green-500/50 rounded-full" />
                <h2 className="text-xs sm:text-sm font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Projetos Configurados</h2>
              </div>
            </StaggerItem>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {projectsWithConfigs.map((proj) => {
                const reportConfig = manager.configs.find(c => c.project_id === proj.id);
                const plannerConfig = plannerHook.configs.find(c => c.project_id === proj.id);
                return (
                  <StaggerItem key={proj.id}>
                    <button
                      onClick={() => handleOpenProjectConfig(proj)}
                      className="glass-card w-full text-left p-4 hover:ring-2 hover:ring-green-500/40 transition-all group cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0">
                          {proj.avatar_url ? (
                            <img src={proj.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs font-bold text-muted-foreground">{proj.name.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{proj.name}</p>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {reportConfig && (
                              <Badge variant="outline" className="text-[9px] gap-1 border-green-500/30 text-green-400 h-5">
                                <BarChart3 className="w-2.5 h-2.5" />
                                GT {reportConfig.report_enabled ? '● Ativo' : '○ Inativo'}
                              </Badge>
                            )}
                            {plannerConfig && (
                              <Badge variant="outline" className="text-[9px] gap-1 border-blue-500/30 text-blue-400 h-5">
                                <FileText className="w-2.5 h-2.5" />
                                Planner {plannerConfig.planner_enabled ? '● Ativo' : '○ Inativo'}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Settings2 className="w-4 h-4 text-muted-foreground group-hover:text-green-400 transition-colors flex-shrink-0 mt-1" />
                      </div>
                    </button>
                  </StaggerItem>
                );
              })}
            </div>
          </StaggerContainer>
        )}

        {/* Also show all projects without config as available */}
        {activeProjects.length > 0 && projectsWithConfigs.length === 0 && (
          <FadeIn delay={0.15}>
            <div className="glass-card p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                <BarChart3 className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-sm font-semibold mb-1">Nenhum relatório configurado</h3>
              <p className="text-[11px] text-muted-foreground mb-4">Clique em "Criar Relatório" para configurar o envio automático para seus projetos.</p>
            </div>
          </FadeIn>
        )}

        {/* Anomaly Alerts */}
        <FadeIn delay={0.2}>
          <AnomalyAlertsCard projectId={selectedProject.id} />
        </FadeIn>

        {/* New Report Dialog - select project */}
        <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
          <DialogContent className="max-w-md bg-background/95 backdrop-blur-xl border-border">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Criar Relatório</DialogTitle>
              <DialogDescription>Selecione o projeto para configurar</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Projeto</Label>
                <Select value={reportProjectId || ''} onValueChange={setReportProjectId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selecione um projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeProjects.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0">
                            {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-[8px] font-bold">{p.name.charAt(0)}</span>}
                          </div>
                          <span className="text-sm">{p.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleCreateReport}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                disabled={!reportProjectId}
              >
                Continuar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Project Config Modal (large) */}
        {configProject && (
          <ProjectReportConfigDialogNew
            open={configModalOpen}
            onOpenChange={setConfigModalOpen}
            project={configProject}
            instances={managerInstances}
            existingConfig={manager.configs.find(c => c.project_id === configProject.id)}
            existingPlannerConfig={plannerHook.configs.find(c => c.project_id === configProject.id)}
            onSave={async (config) => {
              const result = await manager.saveConfig(config);
              if (result) await manager.fetchConfigs();
              return result;
            }}
            onSavePlanner={async (config) => {
              const result = await plannerHook.saveConfig(config);
              if (result) await plannerHook.fetchConfigs();
              return result;
            }}
            onListGroups={async (instanceId) => {
              return await listGroupsInstance(instanceId);
            }}
          />
        )}

        {/* QR Modal */}
        <WhatsAppQRModal
          open={qrModalOpen}
          onOpenChange={setQrModalOpen}
          qrCode={qrModalData.qrCode}
          expiresAt={qrModalData.expiresAt}
          onRefreshQR={handleRefreshQR}
          onCheckStatus={handleCheckStatus}
        />
      </div>
    </DashboardLayout>
  );
}
