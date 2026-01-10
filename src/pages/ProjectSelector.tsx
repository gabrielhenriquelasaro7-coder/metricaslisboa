import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProjects, Project, CreateProjectData, HealthScore, BusinessModel } from '@/hooks/useProjects';
import { useProfile, UserCargo } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Users, Store, Loader2, LogOut, Archive, Trash2, User, RefreshCw, ChevronRight, ChevronDown, MoreVertical, Pencil, ArchiveRestore, Camera, Lock, Search, Target, GraduationCap, TrendingUp, MessageSquare, ExternalLink, UserPlus, Settings, Sun, Moon } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import whatsappIcon from '@/assets/whatsapp-icon.png';
import v4Logo from '@/assets/v4-logo-full.png';
import metaIcon from '@/assets/meta-icon.png';
import googleAdsIcon from '@/assets/google-ads-icon.png';
import { InviteGuestDialog } from '@/components/guests/InviteGuestDialog';
const cargoOptions: {
  value: UserCargo;
  label: string;
}[] = [{
  value: 'gestor_trafego',
  label: 'Gestor de Tráfego'
}, {
  value: 'account_manager',
  label: 'Account Manager'
}, {
  value: 'coordenador',
  label: 'Coordenador'
}, {
  value: 'gerente',
  label: 'Gerente'
}];
const businessModels: {
  value: BusinessModel;
  label: string;
  description: string;
  icon: typeof Users;
}[] = [{
  value: 'inside_sales',
  label: 'Inside Sales',
  description: 'Leads e vendas internas',
  icon: Users
}, {
  value: 'ecommerce',
  label: 'E-commerce',
  description: 'Vendas online',
  icon: TrendingUp
}, {
  value: 'pdv',
  label: 'PDV',
  description: 'Loja física',
  icon: Store
}, {
  value: 'infoproduto',
  label: 'Infoproduto',
  description: 'Cursos e mentorias',
  icon: GraduationCap
}, {
  value: 'custom',
  label: 'Personalizado',
  description: 'Configure suas métricas',
  icon: Target
}];
type ExtendedHealthScore = HealthScore | 'undefined';

// Refined Client Card
interface ClientCardProps {
  project: Project;
  showWhatsApp: boolean;
  onSelect: (project: Project) => void;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
  onArchive: (project: Project) => void;
  onUnarchive: (project: Project) => void;
  onResync: (project: Project) => void;
  onWhatsApp: (project: Project) => void;
}
function ClientCard({
  project,
  showWhatsApp,
  onSelect,
  onEdit,
  onDelete,
  onArchive,
  onUnarchive,
  onResync,
  onWhatsApp
}: ClientCardProps) {
  const model = businessModels.find(m => m.value === project.business_model);
  const displayHealthScore: ExtendedHealthScore = project.health_score || 'undefined';
  const lastSyncDate = project.last_sync_at ? new Date(project.last_sync_at) : null;
  const statusColors = {
    safe: 'bg-card border-emerald-500/20 dark:from-zinc-500/10 dark:to-zinc-500/5 dark:border-zinc-700/50',
    care: 'bg-card border-amber-500/30 dark:from-amber-500/20 dark:to-amber-500/5',
    danger: 'bg-card border-red-500/30 dark:from-red-500/20 dark:to-red-500/5',
    undefined: 'bg-card border-border dark:from-zinc-500/10 dark:to-zinc-500/5 dark:border-zinc-700/50'
  }[displayHealthScore];
  const dotColor = {
    safe: 'bg-emerald-500',
    care: 'bg-amber-500',
    danger: 'bg-red-500',
    undefined: 'bg-zinc-500 dark:bg-zinc-600'
  }[displayHealthScore];
  return <div className={cn("group relative overflow-hidden rounded-xl transition-all duration-300", "border backdrop-blur-sm", "hover:scale-[1.02] hover:border-primary/40", statusColors, project.archived && 'opacity-40')}>
      {/* Subtle glow effect - dark mode only */}
      <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.02] to-transparent pointer-events-none dark:block hidden" />
      
      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="w-11 h-11 rounded-xl bg-secondary border border-border flex items-center justify-center overflow-hidden shadow-lg">
              {project.avatar_url ? <img src={project.avatar_url} alt={project.name} className="w-full h-full object-cover" /> : <span className="text-base font-semibold text-foreground" style={{
              fontFamily: 'Space Grotesk, sans-serif'
            }}>
                  {project.name.charAt(0).toUpperCase()}
                </span>}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground truncate" style={{
                fontFamily: 'Space Grotesk, sans-serif'
              }}>
                  {project.name}
                </h3>
                <div className={cn("w-2 h-2 rounded-full flex-shrink-0 shadow-lg", dotColor)} />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5" style={{
              fontFamily: 'Inter, sans-serif'
            }}>
                {model?.label || 'Sem categoria'}
              </p>
            </div>
          </div>
          
          {/* Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
              <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-popover backdrop-blur-xl border-border rounded-xl shadow-2xl" onClick={e => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onEdit(project)} className="gap-2 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg">
                <Pencil className="w-4 h-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onResync(project)} className="gap-2 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg">
                <RefreshCw className="w-4 h-4" />
                Sincronizar
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              {project.archived ? <DropdownMenuItem onClick={() => onUnarchive(project)} className="gap-2 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg">
                  <ArchiveRestore className="w-4 h-4" />
                  Restaurar
                </DropdownMenuItem> : <DropdownMenuItem onClick={() => onArchive(project)} className="gap-2 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg">
                  <Archive className="w-4 h-4" />
                  Arquivar
                </DropdownMenuItem>}
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem onClick={() => onDelete(project)} className="gap-2 cursor-pointer text-destructive focus:text-destructive hover:bg-destructive/10 rounded-lg">
                <Trash2 className="w-4 h-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* Info */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Account ID</span>
            <span className="font-mono text-foreground/70">{project.ad_account_id.replace('act_', '')}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Última sync</span>
            <span className="text-foreground/70">
              {lastSyncDate ? formatDistanceToNow(lastSyncDate, {
              addSuffix: true,
              locale: ptBR
            }) : 'Nunca'}
            </span>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          <button onClick={e => {
          e.stopPropagation();
          onSelect(project);
        }} className="flex-1 h-9 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20" style={{
          fontFamily: 'Space Grotesk, sans-serif'
        }}>
            Acessar
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          
          {showWhatsApp && <button onClick={e => {
          e.stopPropagation();
          onWhatsApp(project);
        }} className="h-9 px-3 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-muted-foreground hover:text-foreground text-sm transition-all flex items-center gap-2">
              <img src={whatsappIcon} alt="" className="w-4 h-4" />
            </button>}
        </div>
      </div>
    </div>;
}

// Status Group
interface StatusGroupProps {
  status: ExtendedHealthScore;
  projects: Project[];
  defaultOpen?: boolean;
  onSelect: (project: Project) => void;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
  onArchive: (project: Project) => void;
  onUnarchive: (project: Project) => void;
  onResync: (project: Project) => void;
  onWhatsApp: (project: Project) => void;
}
function StatusGroup({
  status,
  projects,
  defaultOpen = false,
  onSelect,
  onEdit,
  onDelete,
  onArchive,
  onUnarchive,
  onResync,
  onWhatsApp
}: StatusGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  if (projects.length === 0) return null;
  const config = {
    safe: {
      label: 'Safe',
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/10',
      indicator: 'bg-emerald-500'
    },
    care: {
      label: 'Care',
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/10',
      indicator: 'bg-amber-500'
    },
    danger: {
      label: 'Danger',
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-500/10',
      indicator: 'bg-red-500'
    },
    undefined: {
      label: 'Sem Status',
      color: 'text-muted-foreground',
      bg: 'bg-muted/50',
      indicator: 'bg-muted-foreground'
    }
  }[status];
  const showWhatsApp = status === 'care' || status === 'danger';
  return <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-6">
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-3 py-3 px-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 border border-border transition-all group">
          <div className={cn("w-2.5 h-2.5 rounded-full", config.indicator)} />
          <span className={cn("font-medium text-sm", config.color)} style={{
          fontFamily: 'Space Grotesk, sans-serif'
        }}>
            {config.label}
          </span>
          <span className="text-sm text-muted-foreground font-medium">
            {projects.length} {projects.length === 1 ? 'cliente' : 'clientes'}
          </span>
          <div className="flex-1" />
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
        </button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="pt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {projects.map(project => <ClientCard key={project.id} project={project} showWhatsApp={showWhatsApp} onSelect={onSelect} onEdit={onEdit} onDelete={onDelete} onArchive={onArchive} onUnarchive={onUnarchive} onResync={onResync} onWhatsApp={onWhatsApp} />)}
        </div>
      </CollapsibleContent>
    </Collapsible>;
}
export default function ProjectSelector() {
  const {
    user,
    loading: authLoading,
    signOut
  } = useAuth();
  const {
    projects,
    loading: projectsLoading,
    createProject,
    updateProject,
    deleteProject,
    archiveProject,
    unarchiveProject,
    resyncProject,
    refetch
  } = useProjects();
  const {
    profile,
    updateProfile,
    updatePassword,
    uploadAvatar: uploadProfileAvatar
  } = useProfile();
  const {
    isGuest
  } = useUserRole();
  const navigate = useNavigate();

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Filters
  const [showArchived, setShowArchived] = useState(false);
  const [healthFilter, setHealthFilter] = useState<ExtendedHealthScore | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Avatar states
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const editAvatarInputRef = useRef<HTMLInputElement>(null);

  // Profile editing
  const [profileName, setProfileName] = useState('');
  const [profileCargo, setProfileCargo] = useState<UserCargo>(null);
  const [profileAvatarPreview, setProfileAvatarPreview] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const profileAvatarInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (profile) {
      setProfileName(profile.full_name || '');
      setProfileCargo(profile.cargo);
      setProfileAvatarPreview(profile.avatar_url);
    }
  }, [profile]);
  const [formData, setFormData] = useState<CreateProjectData>({
    name: '',
    ad_account_id: '',
    business_model: 'ecommerce',
    timezone: 'America/Sao_Paulo',
    currency: 'BRL',
    health_score: null,
    avatar_url: null,
    google_customer_id: ''
  });
  const [editFormData, setEditFormData] = useState<{
    name: string;
    ad_account_id: string;
    business_model: BusinessModel;
    timezone: string;
    currency: string;
    health_score: HealthScore | null;
    avatar_url: string | null;
  }>({
    name: '',
    ad_account_id: '',
    business_model: 'ecommerce',
    timezone: 'America/Sao_Paulo',
    currency: 'BRL',
    health_score: null,
    avatar_url: null
  });
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Filter projects
  const activeProjects = projects.filter(p => !p.archived);
  const archivedProjects = projects.filter(p => p.archived);
  const displayProjects = showArchived ? archivedProjects : activeProjects;
  const filteredProjects = displayProjects.filter(p => healthFilter === 'all' || (p.health_score || 'undefined') === healthFilter).filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.ad_account_id.toLowerCase().includes(searchQuery.toLowerCase()));

  // Group by status
  const safeProjects = filteredProjects.filter(p => p.health_score === 'safe');
  const careProjects = filteredProjects.filter(p => p.health_score === 'care');
  const dangerProjects = filteredProjects.filter(p => p.health_score === 'danger');
  const undefinedProjects = filteredProjects.filter(p => !p.health_score);

  // Health counts
  const healthCounts = {
    total: activeProjects.length,
    safe: activeProjects.filter(p => p.health_score === 'safe').length,
    care: activeProjects.filter(p => p.health_score === 'care').length,
    danger: activeProjects.filter(p => p.health_score === 'danger').length
  };
  const handleSelectProject = (project: Project) => {
    localStorage.setItem('selectedProjectId', project.id);
    navigate('/dashboard');
  };
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.ad_account_id) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    setIsCreating(true);
    try {
      const adAccountId = formData.ad_account_id.startsWith('act_') ? formData.ad_account_id : `act_${formData.ad_account_id}`;
      const project = await createProject({
        ...formData,
        ad_account_id: adAccountId
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
          avatar_url: null
        });
        setAvatarPreview(null);
        if (formData.business_model === 'custom') {
          navigate(`/project-setup/${project.id}`);
        }
      }
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setIsCreating(false);
    }
  };
  const handleEditClick = (project: Project) => {
    setSelectedProject(project);
    setEditFormData({
      name: project.name,
      ad_account_id: project.ad_account_id,
      business_model: project.business_model,
      timezone: project.timezone,
      currency: project.currency,
      health_score: project.health_score,
      avatar_url: project.avatar_url
    });
    setEditAvatarPreview(project.avatar_url);
    setEditDialogOpen(true);
  };
  const uploadAvatar = async (file: File, projectId?: string): Promise<string | null> => {
    try {
      setIsUploadingAvatar(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${projectId || 'temp'}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;
      const {
        error: uploadError
      } = await supabase.storage.from('project-avatars').upload(filePath, file, {
        upsert: true
      });
      if (uploadError) throw uploadError;
      const {
        data: {
          publicUrl
        }
      } = supabase.storage.from('project-avatars').getPublicUrl(filePath);
      return publicUrl;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Erro ao fazer upload da imagem');
      return null;
    } finally {
      setIsUploadingAvatar(false);
    }
  };
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (isEdit) {
        setEditAvatarPreview(reader.result as string);
      } else {
        setAvatarPreview(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
    const url = await uploadAvatar(file, isEdit && selectedProject ? selectedProject.id : undefined);
    if (url) {
      if (isEdit) {
        setEditFormData(prev => ({
          ...prev,
          avatar_url: url
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          avatar_url: url
        }));
      }
    }
  };
  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !editFormData.name) {
      toast.error('Nome é obrigatório');
      return;
    }
    setIsUpdating(true);
    try {
      await updateProject(selectedProject.id, editFormData);
      setEditDialogOpen(false);
      setSelectedProject(null);
      toast.success('Projeto atualizado!');
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error('Erro ao atualizar projeto');
    } finally {
      setIsUpdating(false);
    }
  };
  const handleDeleteClick = (project: Project) => {
    setSelectedProject(project);
    setDeleteDialogOpen(true);
  };
  const handleConfirmDelete = async () => {
    if (!selectedProject) return;
    try {
      await deleteProject(selectedProject.id);
      toast.success('Projeto excluído!');
    } catch (error) {
      toast.error('Erro ao excluir projeto');
    } finally {
      setDeleteDialogOpen(false);
      setSelectedProject(null);
    }
  };
  const handleResync = async (project: Project) => {
    await resyncProject(project);
  };
  const handleWhatsApp = (project: Project) => {
    navigate('/whatsapp-manager');
  };
  const handleProfileAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    const url = await uploadProfileAvatar(file);
    if (url) {
      await updateProfile({
        avatar_url: url
      });
    }
  };
  const handleUpdateProfile = async () => {
    setIsUpdatingProfile(true);
    try {
      await updateProfile({
        full_name: profileName,
        cargo: profileCargo
      });
      toast.success('Perfil atualizado!');
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setIsUpdatingProfile(false);
    }
  };
  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    setIsChangingPassword(true);
    try {
      await updatePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Senha alterada com sucesso!');
    } catch (error) {
      console.error('Error changing password:', error);
    } finally {
      setIsChangingPassword(false);
    }
  };
  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Erro ao sair');
    }
  };
  if (authLoading || projectsLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>;
  }
  return <div className="min-h-screen bg-background">
      {/* ==================== HEADER - Mobile-first ==================== */}
      <header className="relative bg-card border-b border-border">
        {/* Gradient overlay - only in dark mode */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none dark:block hidden" />
        
        {/* Top nav - Responsive */}
        <div className="relative border-b border-border">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-5">
            <nav className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:justify-between">
              {/* Logo Section */}
              <div className="flex items-center gap-3 sm:gap-6">
                <img src={v4Logo} alt="V4 Company" className="h-8 sm:h-12 w-auto dark:brightness-0 dark:invert dark:opacity-95" />
                <div className="hidden sm:block w-px h-12 bg-gradient-to-b from-transparent via-primary/60 to-transparent" />
                <div className="flex flex-col">
                  <span className="text-lg sm:text-2xl font-bold tracking-tight text-foreground leading-tight" style={{
                  fontFamily: 'Space Grotesk, sans-serif'
                }}>
                    ADS<span className="font-light text-foreground/70">MANAGER</span>
                  </span>
                  <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-muted-foreground hidden sm:block" style={{
                  fontFamily: 'Inter, sans-serif'
                }}>
                    Painel de Controle
                  </span>
                </div>
              </div>
              
              {/* Nav items - Horizontal scroll on mobile */}
              {/* Nav items - Icon only on mobile, full label on desktop */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 -mx-1 px-1 sm:mx-0 sm:px-0 scrollbar-hide">
                <button className="h-9 sm:h-11 px-3 sm:px-5 rounded-lg text-xs sm:text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-all flex items-center gap-1.5 sm:gap-2.5 whitespace-nowrap touch-target">
                  <img src={metaIcon} alt="" className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">META ADS</span>
                </button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="h-9 sm:h-11 px-3 sm:px-5 rounded-lg text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all flex items-center gap-1.5 sm:gap-2.5 border border-border whitespace-nowrap touch-target">
                        <img src={googleAdsIcon} alt="" className="w-4 h-4 sm:w-5 sm:h-5 opacity-50" />
                        <span className="hidden sm:inline">GOOGLE</span>
                        <Lock className="w-3 h-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-popover border-border z-50">
                      <p className="text-sm">Em breve</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <button onClick={() => navigate('/whatsapp-manager')} className="h-9 sm:h-11 px-3 sm:px-5 rounded-lg text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all flex items-center gap-1.5 sm:gap-2.5 border border-border whitespace-nowrap touch-target">
                  <img src={whatsappIcon} alt="" className="w-4 h-4 sm:w-5 sm:h-5 opacity-70" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </button>
                <button onClick={() => setSettingsDialogOpen(true)} className="h-9 sm:h-11 px-3 sm:px-5 rounded-lg text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all flex items-center gap-1.5 sm:gap-2.5 border border-border whitespace-nowrap touch-target">
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">Configurações</span>
                </button>
              </div>
            </nav>
          </div>
        </div>
        
        {/* Stats bar - Compact on mobile */}
        <div className="relative border-b border-border bg-card/50 backdrop-blur-xl">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
              {/* Stats */}
              <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-secondary/30 border border-border">
                <span className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wider" style={{
                fontFamily: 'Inter, sans-serif'
              }}>Clientes</span>
                <span className="text-xl sm:text-2xl font-bold text-foreground" style={{
                fontFamily: 'Space Grotesk, sans-serif'
              }}>
                  {healthCounts.total}
                </span>
              </div>
              
              {/* Health indicators - Horizontal scroll on mobile */}
              <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto pb-1 sm:pb-0">
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] sm:text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase" style={{
                  fontFamily: 'Inter, sans-serif'
                }}>Safe</span>
                  <span className="text-sm font-bold text-foreground" style={{
                  fontFamily: 'Space Grotesk, sans-serif'
                }}>{healthCounts.safe}</span>
                </div>
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-[10px] sm:text-xs font-medium text-amber-600 dark:text-amber-400 uppercase" style={{
                  fontFamily: 'Inter, sans-serif'
                }}>Care</span>
                  <span className="text-sm font-bold text-foreground" style={{
                  fontFamily: 'Space Grotesk, sans-serif'
                }}>{healthCounts.care}</span>
                </div>
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-[10px] sm:text-xs font-medium text-red-600 dark:text-red-400 uppercase" style={{
                  fontFamily: 'Inter, sans-serif'
                }}>Danger</span>
                  <span className="text-sm font-bold text-foreground" style={{
                  fontFamily: 'Space Grotesk, sans-serif'
                }}>{healthCounts.danger}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ==================== ACTIONS BAR - Mobile-first ==================== */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border safe-area-top">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            {/* Search & Filter - Full width on mobile */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar cliente..." 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                  className="pl-10 h-10 sm:h-10 w-full sm:w-56 lg:w-72 bg-secondary border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-primary/20 rounded-xl touch-target" 
                  style={{ fontFamily: 'Inter, sans-serif' }} 
                />
              </div>
              
              <Select value={healthFilter} onValueChange={val => setHealthFilter(val as any)}>
                <SelectTrigger className="w-full sm:w-32 h-10 bg-secondary border-border text-muted-foreground rounded-xl focus:border-primary/50 touch-target">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-popover backdrop-blur-xl border-border rounded-xl z-50">
                  <SelectItem value="all" className="text-foreground rounded-lg">Todos</SelectItem>
                  <SelectItem value="safe" className="text-emerald-600 dark:text-emerald-400 rounded-lg">Safe</SelectItem>
                  <SelectItem value="care" className="text-amber-600 dark:text-amber-400 rounded-lg">Care</SelectItem>
                  <SelectItem value="danger" className="text-red-600 dark:text-red-400 rounded-lg">Danger</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Actions - Scrollable on mobile */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 -mx-1 px-1 sm:mx-0 sm:px-0">
              {!isGuest && <>
                  <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="h-10 px-3 sm:px-5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl shadow-lg shadow-primary/20 gap-1.5 sm:gap-2 transition-all whitespace-nowrap touch-target" style={{
                    fontFamily: 'Space Grotesk, sans-serif'
                  }}>
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Novo Cliente</span>
                        <span className="sm:hidden">Novo</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[95vw] max-w-md mx-auto bg-popover backdrop-blur-xl border-border rounded-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-foreground font-semibold" style={{
                      fontFamily: 'Space Grotesk, sans-serif'
                    }}>
                          Novo Cliente
                        </DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleCreateProject} className="space-y-4 mt-4">
                        {/* Avatar */}
                        <div className="flex justify-center">
                          <div onClick={() => avatarInputRef.current?.click()} className="w-16 h-16 rounded-xl bg-secondary border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 transition-all overflow-hidden touch-target">
                            {avatarPreview ? <img src={avatarPreview} alt="" className="w-full h-full object-cover" /> : <Camera className="w-5 h-5 text-muted-foreground" />}
                          </div>
                          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleAvatarChange(e)} />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-muted-foreground text-xs">Nome do Cliente</Label>
                          <Input value={formData.name} onChange={e => setFormData(prev => ({
                        ...prev,
                        name: e.target.value
                      }))} placeholder="Ex: Empresa ABC" className="bg-secondary border-border text-foreground rounded-xl focus:border-primary/50 h-10 touch-target" />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-muted-foreground text-xs">Account ID</Label>
                          <Input value={formData.ad_account_id} onChange={e => setFormData(prev => ({
                        ...prev,
                        ad_account_id: e.target.value
                      }))} placeholder="act_123456789" className="bg-secondary border-border text-foreground font-mono rounded-xl focus:border-primary/50 h-10 touch-target" />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-muted-foreground text-xs">Modelo de Negócio</Label>
                          <Select value={formData.business_model} onValueChange={val => setFormData(prev => ({
                        ...prev,
                        business_model: val as BusinessModel
                      }))}>
                            <SelectTrigger className="bg-secondary border-border text-foreground rounded-xl focus:border-primary/50 h-10 touch-target">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover backdrop-blur-xl border-border rounded-xl z-50">
                              {businessModels.map(model => <SelectItem key={model.value} value={model.value} className="text-foreground rounded-lg">
                                  {model.label}
                                </SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs">Fuso Horário</Label>
                            <Select value={formData.timezone} onValueChange={val => setFormData(prev => ({
                          ...prev,
                          timezone: val
                        }))}>
                              <SelectTrigger className="bg-secondary border-border text-foreground rounded-xl focus:border-primary/50 h-10 text-xs sm:text-sm touch-target">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-popover backdrop-blur-xl border-border rounded-xl z-50">
                                <SelectItem value="America/Sao_Paulo" className="text-foreground rounded-lg">São Paulo</SelectItem>
                                <SelectItem value="America/New_York" className="text-foreground rounded-lg">New York</SelectItem>
                                <SelectItem value="Europe/London" className="text-foreground rounded-lg">Londres</SelectItem>
                                <SelectItem value="Europe/Lisbon" className="text-foreground rounded-lg">Lisboa</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs">Moeda</Label>
                            <Select value={formData.currency} onValueChange={val => setFormData(prev => ({
                          ...prev,
                          currency: val
                        }))}>
                              <SelectTrigger className="bg-secondary border-border text-foreground rounded-xl focus:border-primary/50 h-10 text-xs sm:text-sm touch-target">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-popover backdrop-blur-xl border-border rounded-xl z-50">
                                <SelectItem value="BRL" className="text-foreground rounded-lg">R$</SelectItem>
                                <SelectItem value="USD" className="text-foreground rounded-lg">US$</SelectItem>
                                <SelectItem value="EUR" className="text-foreground rounded-lg">€</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                          <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)} className="flex-1 border-border text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl h-10 touch-target">
                            Cancelar
                          </Button>
                          <Button type="submit" disabled={isCreating} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-medium h-10 touch-target">
                            {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar'}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                  
                  <Button onClick={() => setInviteDialogOpen(true)} variant="outline" className="h-10 px-3 sm:px-4 border-border text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl transition-all gap-1.5 sm:gap-2 whitespace-nowrap touch-target" style={{
                fontFamily: 'Space Grotesk, sans-serif'
              }}>
                    <UserPlus className="w-4 h-4" />
                    <span className="hidden sm:inline">Convidar Cliente</span>
                  </Button>
                </>}
              
              <Button variant="outline" onClick={() => setShowArchived(!showArchived)} className={cn("h-10 px-3 sm:px-4 border-border text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl transition-all whitespace-nowrap touch-target gap-1.5 sm:gap-2", showArchived && 'bg-secondary text-foreground border-primary/30')}>
                <Archive className="w-4 h-4" />
                <span className="hidden sm:inline">Arquivados</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== CLIENT LIST - Mobile-first ==================== */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-8 safe-area-bottom">
        {filteredProjects.length === 0 ? <div className="text-center py-12 sm:py-24">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
              <Users className="w-10 h-10 text-white/20" />
            </div>
            <h3 className="text-lg font-medium text-white/60 mb-2" style={{
          fontFamily: 'Space Grotesk, sans-serif'
        }}>
              {searchQuery ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
            </h3>
            <p className="text-sm text-white/30">
              {searchQuery ? 'Tente buscar por outro termo' : 'Clique em "Novo Cliente" para começar'}
            </p>
          </div> : <div>
            <StatusGroup status="safe" projects={safeProjects} defaultOpen={true} onSelect={handleSelectProject} onEdit={handleEditClick} onDelete={handleDeleteClick} onArchive={p => archiveProject(p.id)} onUnarchive={p => unarchiveProject(p.id)} onResync={handleResync} onWhatsApp={handleWhatsApp} />
            <StatusGroup status="care" projects={careProjects} defaultOpen={true} onSelect={handleSelectProject} onEdit={handleEditClick} onDelete={handleDeleteClick} onArchive={p => archiveProject(p.id)} onUnarchive={p => unarchiveProject(p.id)} onResync={handleResync} onWhatsApp={handleWhatsApp} />
            <StatusGroup status="danger" projects={dangerProjects} defaultOpen={true} onSelect={handleSelectProject} onEdit={handleEditClick} onDelete={handleDeleteClick} onArchive={p => archiveProject(p.id)} onUnarchive={p => unarchiveProject(p.id)} onResync={handleResync} onWhatsApp={handleWhatsApp} />
            <StatusGroup status="undefined" projects={undefinedProjects} defaultOpen={false} onSelect={handleSelectProject} onEdit={handleEditClick} onDelete={handleDeleteClick} onArchive={p => archiveProject(p.id)} onUnarchive={p => unarchiveProject(p.id)} onResync={handleResync} onWhatsApp={handleWhatsApp} />
          </div>}
      </main>

      {/* ==================== DIALOGS ==================== */}
      
      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground font-semibold" style={{
            fontFamily: 'Space Grotesk, sans-serif'
          }}>
              Editar Cliente
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateProject} className="space-y-4 mt-4">
            <div className="flex justify-center">
              <div onClick={() => editAvatarInputRef.current?.click()} className="w-16 h-16 rounded-xl bg-secondary border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 transition-all overflow-hidden">
                {editAvatarPreview ? <img src={editAvatarPreview} alt="" className="w-full h-full object-cover" /> : <Camera className="w-5 h-5 text-muted-foreground" />}
              </div>
              <input ref={editAvatarInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleAvatarChange(e, true)} />
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Nome do Cliente</Label>
              <Input value={editFormData.name} onChange={e => setEditFormData(prev => ({
              ...prev,
              name: e.target.value
            }))} className="bg-secondary border-border text-foreground rounded-xl focus:border-primary/50" />
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Health Score</Label>
              <Select value={editFormData.health_score || 'none'} onValueChange={val => setEditFormData(prev => ({
              ...prev,
              health_score: val === 'none' ? null : val as HealthScore
            }))}>
                <SelectTrigger className="bg-secondary border-border text-foreground rounded-xl focus:border-primary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border rounded-xl">
                  <SelectItem value="none" className="text-muted-foreground rounded-lg">Sem status</SelectItem>
                  <SelectItem value="safe" className="text-emerald-600 dark:text-emerald-400 rounded-lg">Safe</SelectItem>
                  <SelectItem value="care" className="text-amber-600 dark:text-amber-400 rounded-lg">Care</SelectItem>
                  <SelectItem value="danger" className="text-red-600 dark:text-red-400 rounded-lg">Danger</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)} className="flex-1 border-border text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl">
                Cancelar
              </Button>
              <Button type="submit" disabled={isUpdating} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-medium">
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground font-semibold" style={{
            fontFamily: 'Space Grotesk, sans-serif'
          }}>
              Excluir Cliente
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja excluir "{selectedProject?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-medium">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Profile Dialog */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground font-semibold" style={{
            fontFamily: 'Space Grotesk, sans-serif'
          }}>
              Meu Perfil
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            {/* Avatar */}
            <div className="flex justify-center">
              <div onClick={() => profileAvatarInputRef.current?.click()} className="w-20 h-20 rounded-full bg-secondary border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 transition-all overflow-hidden">
                {profileAvatarPreview ? <img src={profileAvatarPreview} alt="" className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-muted-foreground" />}
              </div>
              <input ref={profileAvatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleProfileAvatarChange} />
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Nome</Label>
              <Input value={profileName} onChange={e => setProfileName(e.target.value)} className="bg-secondary border-border text-foreground rounded-xl focus:border-primary/50" />
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Cargo</Label>
              <Select value={profileCargo || 'none'} onValueChange={val => setProfileCargo(val === 'none' ? null : val as UserCargo)}>
                <SelectTrigger className="bg-secondary border-border text-foreground rounded-xl focus:border-primary/50">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border rounded-xl">
                  <SelectItem value="none" className="text-muted-foreground rounded-lg">Nenhum</SelectItem>
                  {cargoOptions.map(opt => <SelectItem key={opt.value} value={opt.value} className="text-foreground rounded-lg">
                      {opt.label}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleUpdateProfile} disabled={isUpdatingProfile} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-medium">
              {isUpdatingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Perfil'}
            </Button>

            <div className="border-t border-border pt-4">
              <Label className="text-muted-foreground text-xs">Alterar Senha</Label>
              <div className="space-y-2 mt-2">
                <Input type="password" placeholder="Nova senha" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="bg-secondary border-border text-foreground placeholder:text-muted-foreground rounded-xl focus:border-primary/50" />
                <Input type="password" placeholder="Confirmar senha" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="bg-secondary border-border text-foreground placeholder:text-muted-foreground rounded-xl focus:border-primary/50" />
                <Button onClick={handleChangePassword} disabled={isChangingPassword || !newPassword} variant="outline" className="w-full border-border text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl">
                  {isChangingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Alterar Senha'}
                </Button>
              </div>
            </div>

            <Button variant="outline" onClick={handleLogout} className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 rounded-xl">
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground font-semibold" style={{
            fontFamily: 'Space Grotesk, sans-serif'
          }}>
              Configurações
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            {/* Theme Toggle */}
            <div className="space-y-3">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">Aparência</Label>
              <div className="flex gap-3">
                <button onClick={() => {
                document.documentElement.classList.remove('dark');
                document.documentElement.classList.add('light');
                localStorage.setItem('theme', 'light');
                setSettingsDialogOpen(false);
                setTimeout(() => setSettingsDialogOpen(true), 10);
              }} className={cn("flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border transition-all", document.documentElement.classList.contains('light') ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-secondary")}>
                  <Sun className="w-5 h-5" />
                  <span className="font-medium">Claro</span>
                </button>
                <button onClick={() => {
                document.documentElement.classList.remove('light');
                document.documentElement.classList.add('dark');
                localStorage.setItem('theme', 'dark');
                setSettingsDialogOpen(false);
                setTimeout(() => setSettingsDialogOpen(true), 10);
              }} className={cn("flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border transition-all", !document.documentElement.classList.contains('light') ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-secondary")}>
                  <Moon className="w-5 h-5" />
                  <span className="font-medium">Escuro</span>
                </button>
              </div>
            </div>

            {/* Profile shortcut */}
            <div className="space-y-3">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">Conta</Label>
              <button onClick={() => {
              setSettingsDialogOpen(false);
              setProfileDialogOpen(true);
            }} className="w-full flex items-center justify-between p-4 rounded-xl border border-border hover:bg-secondary transition-all">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-muted-foreground" />
                  <span className="text-foreground font-medium">Editar Perfil</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Logout */}
            <Button variant="outline" onClick={handleLogout} className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 rounded-xl">
              <LogOut className="w-4 h-4 mr-2" />
              Sair da conta
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite Guest Dialog */}
      <InviteGuestDialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen} onSuccess={refetch} />
    </div>;
}