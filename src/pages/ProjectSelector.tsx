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
import { 
  Plus, 
  Users, 
  Store,
  Loader2,
  LogOut,
  Archive,
  Trash2,
  User,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Pencil,
  ArchiveRestore,
  Camera,
  Lock,
  Search,
  Target,
  GraduationCap,
  TrendingUp,
  MessageSquare
} from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import whatsappIcon from '@/assets/whatsapp-icon.png';
import v4Logo from '@/assets/v4-logo-full.png';

const cargoOptions: { value: UserCargo; label: string }[] = [
  { value: 'gestor_trafego', label: 'Gestor de Tráfego' },
  { value: 'account_manager', label: 'Account Manager' },
  { value: 'coordenador', label: 'Coordenador' },
  { value: 'gerente', label: 'Gerente' },
];

const businessModels: { value: BusinessModel; label: string; description: string; icon: typeof Users }[] = [
  { value: 'inside_sales', label: 'Inside Sales', description: 'Leads e vendas internas', icon: Users },
  { value: 'ecommerce', label: 'E-commerce', description: 'Vendas online', icon: TrendingUp },
  { value: 'pdv', label: 'PDV', description: 'Loja física', icon: Store },
  { value: 'infoproduto', label: 'Infoproduto', description: 'Cursos e mentorias', icon: GraduationCap },
  { value: 'custom', label: 'Personalizado', description: 'Configure suas métricas', icon: Target },
];

type ExtendedHealthScore = HealthScore | 'undefined';

// Industrial Client Card - Dense and Solid
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

function ClientCard({ project, showWhatsApp, onSelect, onEdit, onDelete, onArchive, onUnarchive, onResync, onWhatsApp }: ClientCardProps) {
  const model = businessModels.find(m => m.value === project.business_model);
  const displayHealthScore: ExtendedHealthScore = project.health_score || 'undefined';
  const lastSyncDate = project.last_sync_at ? new Date(project.last_sync_at) : null;

  return (
    <div className={cn(
      "group relative bg-black border border-zinc-800 transition-all duration-200",
      "hover:border-red-900/50",
      project.archived && 'opacity-40'
    )}>
      {/* Top red accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-red-600" />
      
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="w-10 h-10 bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {project.avatar_url ? (
                <img src={project.avatar_url} alt={project.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-white">{project.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            
            {/* Name and status */}
            <div>
              <h3 className="font-bold text-white text-sm uppercase tracking-wide">{project.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">{model?.label || 'N/A'}</span>
              </div>
            </div>
          </div>
          
          {/* Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button className="p-1 text-zinc-600 hover:text-white transition-colors">
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 bg-black border-zinc-800" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onEdit(project)} className="gap-2 cursor-pointer text-zinc-400 hover:text-white hover:bg-zinc-900">
                <Pencil className="w-4 h-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onResync(project)} className="gap-2 cursor-pointer text-zinc-400 hover:text-white hover:bg-zinc-900">
                <RefreshCw className="w-4 h-4" />
                Re-sincronizar
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800" />
              {project.archived ? (
                <DropdownMenuItem onClick={() => onUnarchive(project)} className="gap-2 cursor-pointer text-zinc-400 hover:text-white hover:bg-zinc-900">
                  <ArchiveRestore className="w-4 h-4" />
                  Restaurar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => onArchive(project)} className="gap-2 cursor-pointer text-zinc-400 hover:text-white hover:bg-zinc-900">
                  <Archive className="w-4 h-4" />
                  Arquivar
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem onClick={() => onDelete(project)} className="gap-2 cursor-pointer text-red-500 focus:text-red-500 hover:bg-zinc-900">
                <Trash2 className="w-4 h-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* Technical info */}
        <div className="border-t border-zinc-900 pt-3 mb-3">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-zinc-600 uppercase tracking-wider">Account ID</span>
              <p className="font-mono text-zinc-400 mt-0.5">{project.ad_account_id.replace('act_', '')}</p>
            </div>
            <div>
              <span className="text-zinc-600 uppercase tracking-wider">Última Sync</span>
              <p className="text-zinc-400 mt-0.5">
                {lastSyncDate 
                  ? formatDistanceToNow(lastSyncDate, { addSuffix: true, locale: ptBR })
                  : 'Nunca'
                }
              </p>
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(project);
            }}
            className="flex-1 h-8 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1"
          >
            Acessar
            <ChevronRight className="w-3 h-3" />
          </button>
          
          {showWhatsApp && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onWhatsApp(project);
              }}
              className="h-8 px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <img src={whatsappIcon} alt="" className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Status Group with industrial style
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

function StatusGroup({ status, projects, defaultOpen = false, onSelect, onEdit, onDelete, onArchive, onUnarchive, onResync, onWhatsApp }: StatusGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  if (projects.length === 0) return null;

  const config = {
    safe: { label: 'SAFE', color: 'text-white', indicator: 'bg-emerald-500' },
    care: { label: 'CARE', color: 'text-white', indicator: 'bg-amber-500' },
    danger: { label: 'DANGER', color: 'text-white', indicator: 'bg-red-500' },
    undefined: { label: 'SEM STATUS', color: 'text-zinc-500', indicator: 'bg-zinc-600' },
  }[status];

  // Show WhatsApp for care and danger only
  const showWhatsApp = status === 'care' || status === 'danger';

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-4">
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-3 py-3 px-4 bg-zinc-900/50 border border-zinc-800 hover:bg-zinc-900 transition-colors">
          <div className={cn("w-3 h-3 rounded-sm", config.indicator)} />
          <span className={cn("font-bold text-sm uppercase tracking-widest", config.color)}>
            {config.label}
          </span>
          <span className="text-sm font-mono text-zinc-600">
            [{projects.length}]
          </span>
          <div className="flex-1" />
          <ChevronDown className={cn(
            "w-4 h-4 text-zinc-600 transition-transform",
            isOpen && "rotate-180"
          )} />
        </button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="pt-2">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
          {projects.map(project => (
            <ClientCard
              key={project.id}
              project={project}
              showWhatsApp={showWhatsApp}
              onSelect={onSelect}
              onEdit={onEdit}
              onDelete={onDelete}
              onArchive={onArchive}
              onUnarchive={onUnarchive}
              onResync={onResync}
              onWhatsApp={onWhatsApp}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function ProjectSelector() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { projects, loading: projectsLoading, createProject, updateProject, deleteProject, archiveProject, unarchiveProject, resyncProject, refetch } = useProjects();
  const { profile, updateProfile, updatePassword, uploadAvatar: uploadProfileAvatar } = useProfile();
  const { isGuest } = useUserRole();
  const navigate = useNavigate();
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
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
    google_customer_id: '',
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
    avatar_url: null,
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
  
  const filteredProjects = displayProjects
    .filter(p => healthFilter === 'all' || (p.health_score || 'undefined') === healthFilter)
    .filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.ad_account_id.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
    danger: activeProjects.filter(p => p.health_score === 'danger').length,
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
          avatar_url: null,
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
      avatar_url: project.avatar_url,
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

      const { error: uploadError } = await supabase.storage
        .from('project-avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('project-avatars')
        .getPublicUrl(filePath);

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
        setEditFormData(prev => ({ ...prev, avatar_url: url }));
      } else {
        setFormData(prev => ({ ...prev, avatar_url: url }));
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
      await updateProfile({ avatar_url: url });
    }
  };

  const handleUpdateProfile = async () => {
    setIsUpdatingProfile(true);
    try {
      await updateProfile({
        full_name: profileName,
        cargo: profileCargo,
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
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* ==================== HEADER DOMINANTE ==================== */}
      <header className="relative border-b-2 border-red-600">
        {/* Top bar with navigation */}
        <div className="bg-black border-b border-zinc-900">
          <div className="max-w-[1800px] mx-auto px-6 py-2">
            <nav className="flex items-center justify-end gap-1">
              <button className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-white bg-red-600 transition-colors">
                Meta Ads
              </button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-2">
                      <Lock className="w-3 h-3" />
                      Google Ads
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-black border-zinc-800 text-zinc-400">
                    Em breve
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <button 
                onClick={() => navigate('/whatsapp-manager')}
                className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors flex items-center gap-2"
              >
                <MessageSquare className="w-3 h-3" />
                WhatsApp
              </button>
              <button 
                onClick={() => setProfileDialogOpen(true)}
                className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors flex items-center gap-2"
              >
                <User className="w-3 h-3" />
                Perfil
              </button>
            </nav>
          </div>
        </div>
        
        {/* Main header content */}
        <div className="bg-black">
          <div className="max-w-[1800px] mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              {/* Logo and product name */}
              <div className="flex items-center gap-4">
                <img src={v4Logo} alt="V4 Company" className="h-10 w-auto brightness-0 invert" />
                <div className="w-px h-10 bg-red-600" />
                <div>
                  <h1 className="text-2xl font-black uppercase tracking-tight text-white">
                    Ads <span className="text-red-600">Manager</span>
                  </h1>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">
                    Painel de Controle
                  </p>
                </div>
              </div>
              
              {/* Global Metrics */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900/50 border border-zinc-800">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Clientes Ativos</span>
                  <span className="text-xl font-black text-white">{healthCounts.total}</span>
                </div>
                
                <div className="h-10 w-px bg-zinc-800" />
                
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-emerald-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Safe</span>
                    <span className="text-lg font-black text-white">{healthCounts.safe}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-amber-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Care</span>
                    <span className="text-lg font-black text-white">{healthCounts.care}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Danger</span>
                    <span className="text-lg font-black text-white">{healthCounts.danger}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ==================== ACTIONS BAR ==================== */}
      <div className="bg-zinc-950 border-b border-zinc-900">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left - Search & Filter */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <Input
                  placeholder="Buscar cliente ou account ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-80 h-10 bg-black border-zinc-800 text-white placeholder:text-zinc-700 focus:border-red-600 focus:ring-red-600/20"
                />
              </div>
              
              <Select value={healthFilter} onValueChange={(val) => setHealthFilter(val as any)}>
                <SelectTrigger className="w-40 h-10 bg-black border-zinc-800 text-zinc-400 focus:border-red-600">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-black border-zinc-800">
                  <SelectItem value="all" className="text-zinc-400">Todos os status</SelectItem>
                  <SelectItem value="safe" className="text-emerald-500">Safe</SelectItem>
                  <SelectItem value="care" className="text-amber-500">Care</SelectItem>
                  <SelectItem value="danger" className="text-red-500">Danger</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Right - Actions */}
            <div className="flex items-center gap-3">
              {!isGuest && (
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="h-10 px-5 bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-wider text-xs gap-2">
                      <Plus className="w-4 h-4" />
                      Novo Cliente
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg bg-black border-zinc-800">
                    <DialogHeader>
                      <DialogTitle className="text-white font-bold uppercase tracking-wide">Criar novo cliente</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateProject} className="space-y-4 mt-4">
                      {/* Avatar */}
                      <div className="flex justify-center">
                        <div 
                          onClick={() => avatarInputRef.current?.click()}
                          className="w-16 h-16 bg-zinc-900 border-2 border-dashed border-zinc-800 flex items-center justify-center cursor-pointer hover:border-red-600 transition-colors overflow-hidden"
                        >
                          {avatarPreview ? (
                            <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Camera className="w-5 h-5 text-zinc-600" />
                          )}
                        </div>
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleAvatarChange(e)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-zinc-500 text-xs uppercase tracking-wider">Nome do Cliente *</Label>
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Ex: Empresa ABC"
                          className="bg-zinc-900 border-zinc-800 text-white focus:border-red-600"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-zinc-500 text-xs uppercase tracking-wider">Account ID *</Label>
                        <Input
                          value={formData.ad_account_id}
                          onChange={(e) => setFormData(prev => ({ ...prev, ad_account_id: e.target.value }))}
                          placeholder="act_123456789"
                          className="bg-zinc-900 border-zinc-800 text-white font-mono focus:border-red-600"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-zinc-500 text-xs uppercase tracking-wider">Modelo de Negócio</Label>
                        <Select
                          value={formData.business_model}
                          onValueChange={(val) => setFormData(prev => ({ ...prev, business_model: val as BusinessModel }))}
                        >
                          <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white focus:border-red-600">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-black border-zinc-800">
                            {businessModels.map(model => (
                              <SelectItem key={model.value} value={model.value} className="text-white">
                                {model.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex gap-3 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setCreateDialogOpen(false)}
                          className="flex-1 border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-900"
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="submit"
                          disabled={isCreating}
                          className="flex-1 bg-red-600 text-white hover:bg-red-700 font-bold uppercase"
                        >
                          {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Cliente'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
              
              <Button
                variant="outline"
                onClick={() => setShowArchived(!showArchived)}
                className={cn(
                  "h-10 border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-900 font-bold uppercase tracking-wider text-xs",
                  showArchived && 'bg-zinc-900 text-white border-red-600/50'
                )}
              >
                <Archive className="w-4 h-4 mr-2" />
                Arquivados
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== CLIENT LIST ==================== */}
      <main className="max-w-[1800px] mx-auto px-6 py-6">
        {filteredProjects.length === 0 ? (
          <div className="text-center py-24 border border-zinc-900">
            <div className="w-20 h-20 bg-zinc-950 border border-zinc-800 flex items-center justify-center mx-auto mb-4">
              <Users className="w-10 h-10 text-zinc-700" />
            </div>
            <h3 className="text-lg font-bold uppercase tracking-wide text-zinc-500 mb-2">
              {searchQuery ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
            </h3>
            <p className="text-sm text-zinc-700 uppercase tracking-wider">
              {searchQuery ? 'Tente buscar por outro termo' : 'Clique em "Novo Cliente" para começar'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <StatusGroup
              status="safe"
              projects={safeProjects}
              defaultOpen={true}
              onSelect={handleSelectProject}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
              onArchive={(p) => archiveProject(p.id)}
              onUnarchive={(p) => unarchiveProject(p.id)}
              onResync={handleResync}
              onWhatsApp={handleWhatsApp}
            />
            <StatusGroup
              status="care"
              projects={careProjects}
              defaultOpen={true}
              onSelect={handleSelectProject}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
              onArchive={(p) => archiveProject(p.id)}
              onUnarchive={(p) => unarchiveProject(p.id)}
              onResync={handleResync}
              onWhatsApp={handleWhatsApp}
            />
            <StatusGroup
              status="danger"
              projects={dangerProjects}
              defaultOpen={true}
              onSelect={handleSelectProject}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
              onArchive={(p) => archiveProject(p.id)}
              onUnarchive={(p) => unarchiveProject(p.id)}
              onResync={handleResync}
              onWhatsApp={handleWhatsApp}
            />
            <StatusGroup
              status="undefined"
              projects={undefinedProjects}
              defaultOpen={false}
              onSelect={handleSelectProject}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
              onArchive={(p) => archiveProject(p.id)}
              onUnarchive={(p) => unarchiveProject(p.id)}
              onResync={handleResync}
              onWhatsApp={handleWhatsApp}
            />
          </div>
        )}
      </main>

      {/* ==================== DIALOGS ==================== */}
      
      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-black border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white font-bold uppercase tracking-wide">Editar Cliente</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateProject} className="space-y-4 mt-4">
            <div className="flex justify-center">
              <div 
                onClick={() => editAvatarInputRef.current?.click()}
                className="w-16 h-16 bg-zinc-900 border-2 border-dashed border-zinc-800 flex items-center justify-center cursor-pointer hover:border-red-600 transition-colors overflow-hidden"
              >
                {editAvatarPreview ? (
                  <img src={editAvatarPreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-5 h-5 text-zinc-600" />
                )}
              </div>
              <input
                ref={editAvatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleAvatarChange(e, true)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-500 text-xs uppercase tracking-wider">Nome do Cliente</Label>
              <Input
                value={editFormData.name}
                onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                className="bg-zinc-900 border-zinc-800 text-white focus:border-red-600"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-500 text-xs uppercase tracking-wider">Health Score</Label>
              <Select
                value={editFormData.health_score || 'none'}
                onValueChange={(val) => setEditFormData(prev => ({ ...prev, health_score: val === 'none' ? null : val as HealthScore }))}
              >
                <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white focus:border-red-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-black border-zinc-800">
                  <SelectItem value="none" className="text-zinc-500">Sem status</SelectItem>
                  <SelectItem value="safe" className="text-emerald-500">Safe</SelectItem>
                  <SelectItem value="care" className="text-amber-500">Care</SelectItem>
                  <SelectItem value="danger" className="text-red-500">Danger</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                className="flex-1 border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-900"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isUpdating}
                className="flex-1 bg-red-600 text-white hover:bg-red-700 font-bold uppercase"
              >
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-black border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white font-bold uppercase">Excluir Cliente</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-500">
              Tem certeza que deseja excluir "{selectedProject?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-900">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700 font-bold uppercase">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Profile Dialog */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="sm:max-w-md bg-black border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white font-bold uppercase tracking-wide">Meu Perfil</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            {/* Avatar */}
            <div className="flex justify-center">
              <div 
                onClick={() => profileAvatarInputRef.current?.click()}
                className="w-20 h-20 rounded-full bg-zinc-900 border-2 border-dashed border-zinc-800 flex items-center justify-center cursor-pointer hover:border-red-600 transition-colors overflow-hidden"
              >
                {profileAvatarPreview ? (
                  <img src={profileAvatarPreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-8 h-8 text-zinc-600" />
                )}
              </div>
              <input
                ref={profileAvatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleProfileAvatarChange}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-500 text-xs uppercase tracking-wider">Nome</Label>
              <Input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="bg-zinc-900 border-zinc-800 text-white focus:border-red-600"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-500 text-xs uppercase tracking-wider">Cargo</Label>
              <Select
                value={profileCargo || 'none'}
                onValueChange={(val) => setProfileCargo(val === 'none' ? null : val as UserCargo)}
              >
                <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white focus:border-red-600">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="bg-black border-zinc-800">
                  <SelectItem value="none" className="text-zinc-500">Nenhum</SelectItem>
                  {cargoOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-white">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleUpdateProfile}
              disabled={isUpdatingProfile}
              className="w-full bg-red-600 text-white hover:bg-red-700 font-bold uppercase"
            >
              {isUpdatingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Perfil'}
            </Button>

            <div className="border-t border-zinc-800 pt-4">
              <Label className="text-zinc-500 text-xs uppercase tracking-wider">Alterar Senha</Label>
              <div className="space-y-2 mt-2">
                <Input
                  type="password"
                  placeholder="Nova senha"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-700 focus:border-red-600"
                />
                <Input
                  type="password"
                  placeholder="Confirmar senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-700 focus:border-red-600"
                />
                <Button
                  onClick={handleChangePassword}
                  disabled={isChangingPassword || !newPassword}
                  variant="outline"
                  className="w-full border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-900"
                >
                  {isChangingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Alterar Senha'}
                </Button>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleLogout}
              className="w-full border-red-600/50 text-red-500 hover:bg-red-600/10 hover:text-red-400"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
