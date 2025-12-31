import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProjects, Project, CreateProjectData, HealthScore, BusinessModel } from '@/hooks/useProjects';
import { useProjectHealth, ProjectHealth } from '@/hooks/useProjectHealth';
import { useProfile, UserCargo } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { SkeletonCard, SkeletonProfileCard } from '@/components/ui/skeleton-card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plus, 
  FolderKanban, 
  Users, 
  Store,
  Loader2,
  LogOut,
  Archive,
  Trash2,
  User,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Zap,
  Clock,
  TrendingUp,
  ChevronRight,
  MoreVertical,
  Pencil,
  ArchiveRestore,
  Timer,
  CheckCircle2,
  Camera,
  ImagePlus,
  Lock,
  Mail,
  Briefcase,
  Save,
  Sparkles,
  LayoutGrid,
  List,
  Search,
  Settings2,
  Target,
  UserPlus
} from 'lucide-react';
import { InviteGuestDialog } from '@/components/guests/InviteGuestDialog';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow, addHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import v4LogoFull from '@/assets/v4-logo-full.png';
import v4LogoIcon from '@/assets/v4-logo-icon.png';

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
  { value: 'custom', label: 'Personalizado', description: 'Configure suas métricas', icon: Target },
];

type ExtendedHealthScore = HealthScore | 'undefined';

const healthScoreOptions: { value: ExtendedHealthScore; label: string; bgColor: string; textColor: string; borderColor: string; gradientFrom: string; gradientTo: string; glowColor: string; icon: typeof ShieldCheck }[] = [
  { value: 'safe', label: 'Safe', bgColor: 'bg-emerald-500/20', textColor: 'text-emerald-400', borderColor: 'border-emerald-500/60', gradientFrom: 'from-emerald-500/10', gradientTo: 'to-teal-500/5', glowColor: 'shadow-emerald-500/20', icon: ShieldCheck },
  { value: 'care', label: 'Care', bgColor: 'bg-amber-500/20', textColor: 'text-amber-400', borderColor: 'border-amber-500/60', gradientFrom: 'from-amber-500/10', gradientTo: 'to-orange-500/5', glowColor: 'shadow-amber-500/20', icon: AlertTriangle },
  { value: 'danger', label: 'Danger', bgColor: 'bg-red-500/20', textColor: 'text-red-400', borderColor: 'border-red-500/60', gradientFrom: 'from-red-500/10', gradientTo: 'to-rose-500/5', glowColor: 'shadow-red-500/20', icon: AlertCircle },
  { value: 'undefined', label: 'Indefinido', bgColor: 'bg-slate-500/20', textColor: 'text-slate-400', borderColor: 'border-slate-500/40', gradientFrom: 'from-slate-500/5', gradientTo: 'to-gray-500/5', glowColor: 'shadow-slate-500/10', icon: AlertCircle },
];

const businessModelColors: Record<BusinessModel, { bgColor: string; textColor: string; iconColor: string }> = {
  inside_sales: { bgColor: 'bg-blue-500/15', textColor: 'text-blue-400', iconColor: 'text-blue-400' },
  ecommerce: { bgColor: 'bg-emerald-500/15', textColor: 'text-emerald-400', iconColor: 'text-emerald-400' },
  pdv: { bgColor: 'bg-purple-500/15', textColor: 'text-purple-400', iconColor: 'text-purple-400' },
  custom: { bgColor: 'bg-primary/15', textColor: 'text-primary', iconColor: 'text-primary' },
};

interface ProjectCardProps {
  project: Project;
  health?: ProjectHealth;
  onSelect: (project: Project) => void;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
  onArchive: (project: Project) => void;
  onUnarchive: (project: Project) => void;
  onResync: (project: Project) => void;
}

function ProjectCard({ project, onSelect, onEdit, onDelete, onArchive, onUnarchive, onResync }: Omit<ProjectCardProps, 'health'>) {
  const model = businessModels.find(m => m.value === project.business_model);
  const Icon = model?.icon || Users;
  
  const displayHealthScore: ExtendedHealthScore = project.health_score || 'undefined';
  const healthOption = healthScoreOptions.find(h => h.value === displayHealthScore) || healthScoreOptions[3];
  
  const lastSyncDate = project.last_sync_at ? new Date(project.last_sync_at) : null;

  return (
    <div 
      className={cn(
        "group relative bg-card rounded-xl border border-border/50 p-5 transition-all duration-300 cursor-pointer",
        "hover:shadow-lg hover:border-border",
        project.archived && 'opacity-50 grayscale-[30%]'
      )}
      onClick={() => onSelect(project)}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden",
            !project.avatar_url && "bg-primary/10"
          )}>
            {project.avatar_url ? (
              <img src={project.avatar_url} alt={project.name} className="w-full h-full object-cover" />
            ) : (
              <Icon className="w-5 h-5 text-primary" />
            )}
          </div>
          
          {/* Title & Assignee */}
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1" title={project.name}>
              {project.name}
            </h3>
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
              <Users className="w-3.5 h-3.5" />
              <span className="line-clamp-1">{project.ad_account_id.replace('act_', '')}</span>
            </div>
          </div>
        </div>

        {/* Health Badge */}
        <div className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
          healthOption.bgColor, healthOption.textColor, healthOption.borderColor
        )}>
          <healthOption.icon className="w-3.5 h-3.5" />
          {healthOption.label}
        </div>
      </div>

      {/* Sync Info */}
      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span>Atualizado em {lastSyncDate ? lastSyncDate.toLocaleDateString('pt-BR') : 'Nunca'}</span>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(project);
            }}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            Ver Detalhes
            <ChevronRight className="w-4 h-4" />
          </button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onEdit(project)}>
                <Pencil className="w-4 h-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onResync(project)}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Re-sincronizar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {project.archived ? (
                <DropdownMenuItem onClick={() => onUnarchive(project)}>
                  <ArchiveRestore className="w-4 h-4 mr-2" />
                  Restaurar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => onArchive(project)}>
                  <Archive className="w-4 h-4 mr-2" />
                  Arquivar
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDelete(project)} className="text-red-400 focus:text-red-400">
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

function ProjectListItem({ project, onSelect, onEdit, onDelete, onArchive, onUnarchive, onResync }: Omit<ProjectCardProps, 'health'>) {
  const model = businessModels.find(m => m.value === project.business_model);
  const Icon = model?.icon || Users;
  
  const displayHealthScore: ExtendedHealthScore = project.health_score || 'undefined';
  const healthOption = healthScoreOptions.find(h => h.value === displayHealthScore) || healthScoreOptions[3];
  
  const lastSyncDate = project.last_sync_at ? new Date(project.last_sync_at) : null;

  return (
    <div 
      className={cn(
        "group flex items-center gap-4 bg-card rounded-xl border border-border/50 p-4 transition-all duration-200 cursor-pointer",
        "hover:shadow-md hover:border-border",
        project.archived && 'opacity-50'
      )}
      onClick={() => onSelect(project)}
    >
      {/* Avatar */}
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden",
        !project.avatar_url && "bg-primary/10"
      )}>
        {project.avatar_url ? (
          <img src={project.avatar_url} alt={project.name} className="w-full h-full object-cover" />
        ) : (
          <Icon className="w-5 h-5 text-primary" />
        )}
      </div>
      
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
            {project.name}
          </h3>
          <div className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
            healthOption.bgColor, healthOption.textColor, healthOption.borderColor
          )}>
            <healthOption.icon className="w-3 h-3" />
            {healthOption.label}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="w-3 h-3" />
          <span>{project.ad_account_id.replace('act_', '')}</span>
          <span className="text-muted-foreground/50">•</span>
          <Clock className="w-3 h-3" />
          <span>{lastSyncDate ? lastSyncDate.toLocaleDateString('pt-BR') : 'Nunca'}</span>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(project);
          }}
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          Ver Detalhes
          <ChevronRight className="w-4 h-4" />
        </button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => onEdit(project)}>
              <Pencil className="w-4 h-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onResync(project)}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Re-sincronizar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {project.archived ? (
              <DropdownMenuItem onClick={() => onUnarchive(project)}>
                <ArchiveRestore className="w-4 h-4 mr-2" />
                Restaurar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onArchive(project)}>
                <Archive className="w-4 h-4 mr-2" />
                Arquivar
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(project)} className="text-red-400 focus:text-red-400">
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default function ProjectSelector() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { projects, loading: projectsLoading, createProject, updateProject, deleteProject, archiveProject, unarchiveProject, resyncProject, refetch } = useProjects();
  const { healthData, loading: healthLoading } = useProjectHealth(projects.filter(p => !p.archived));
  const { profile, updateProfile, updatePassword, uploadAvatar: uploadProfileAvatar } = useProfile();
  const { isGuest } = useUserRole();
  const navigate = useNavigate();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState('projects');
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [healthFilter, setHealthFilter] = useState<ExtendedHealthScore | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const editAvatarInputRef = useRef<HTMLInputElement>(null);
  const profileAvatarInputRef = useRef<HTMLInputElement>(null);
  
  // Guest invite dialog state
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteProjectId, setInviteProjectId] = useState<string | undefined>();
  const [inviteProjectName, setInviteProjectName] = useState<string | undefined>();
  
  // Profile editing state
  const [profileName, setProfileName] = useState('');
  const [profileCargo, setProfileCargo] = useState<UserCargo>(null);
  const [profileAvatarPreview, setProfileAvatarPreview] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Initialize profile form data
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

  const activeProjects = projects.filter(p => !p.archived);
  const archivedProjects = projects.filter(p => p.archived);
  
  // Filtered projects based on health score filter and search query
  const filteredActiveProjects = activeProjects
    .filter(p => healthFilter === 'all' || (p.health_score || 'undefined') === healthFilter)
    .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredArchivedProjects = archivedProjects
    .filter(p => healthFilter === 'all' || (p.health_score || 'undefined') === healthFilter)
    .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

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
          avatar_url: null,
        });
        setAvatarPreview(null);
        
        // If custom project, redirect to setup page
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

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      if (isEdit) {
        setEditAvatarPreview(reader.result as string);
      } else {
        setAvatarPreview(reader.result as string);
      }
    };
    reader.readAsDataURL(file);

    // Upload
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
      <div className="min-h-screen bg-background red-texture-bg">
        {/* Header skeleton */}
        <header className="border-b border-border bg-card/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="container mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted animate-pulse" />
              <div className="h-6 w-40 bg-muted rounded animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-md bg-muted/40 animate-pulse" />
              <div className="w-20 h-9 rounded-md bg-muted/40 animate-pulse" />
            </div>
          </div>
        </header>
        
        {/* Main content skeleton */}
        <main className="container mx-auto px-6 py-8">
          <div className="max-w-7xl mx-auto">
            {/* Header skeleton */}
            <div className="flex justify-between items-center mb-8">
              <div>
                <div className="h-8 w-48 bg-muted rounded mb-2 animate-pulse" />
                <div className="h-4 w-32 bg-muted/60 rounded animate-pulse" />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-24 bg-muted/40 rounded-lg animate-pulse" />
                <div className="h-10 w-32 bg-primary/30 rounded-lg animate-pulse" />
              </div>
            </div>
            
            {/* Grid skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Count projects by health score
  const healthCounts = {
    total: activeProjects.length,
    safe: activeProjects.filter(p => p.health_score === 'safe').length,
    care: activeProjects.filter(p => p.health_score === 'care').length,
    danger: activeProjects.filter(p => p.health_score === 'danger').length,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header with Gradient */}
      <div className="relative overflow-hidden">
        {/* Background gradient - matching reference style */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-600 via-red-700 to-red-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/30 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
        
        {/* Header Content */}
        <header className="relative z-10 container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 overflow-hidden">
              <img 
                src={v4LogoIcon} 
                alt="V4 Company" 
                className="h-8 w-auto brightness-0 invert"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-white">
                Meta Ads Manager
              </span>
              <span className="text-xs text-white/70 flex items-center gap-1.5">
                Sistema de Gerenciamento de Contas - V4 Company
              </span>
            </div>
          </div>
          <Button 
            variant="ghost" 
            onClick={handleLogout} 
            className="text-white/80 hover:text-white hover:bg-white/10 gap-2 rounded-xl transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </header>

        {/* Summary Cards */}
        <div className="relative z-10 container mx-auto px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl">
            {/* Total */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/70">Total de Clientes</p>
                  <p className="text-3xl font-bold text-white mt-1">{healthCounts.total}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                  <FolderKanban className="w-5 h-5 text-white/80" />
                </div>
              </div>
            </div>
            
            {/* Safe */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/70">Safe</p>
                  <p className="text-3xl font-bold text-white mt-1">{healthCounts.safe}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-500/30 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-emerald-300" />
                </div>
              </div>
            </div>
            
            {/* Care */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/70">Care</p>
                  <p className="text-3xl font-bold text-white mt-1">{healthCounts.care}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-amber-500/30 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-300" />
                </div>
              </div>
            </div>
            
            {/* Danger */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/70">Danger</p>
                  <p className="text-3xl font-bold text-white mt-1">{healthCounts.danger}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-red-400/30 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-300" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8 relative -mt-4">
        <div className="max-w-7xl mx-auto">
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Controls Bar - Clean white card */}
            <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-4 mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                {/* Left side - Search and filters */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou account..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 w-64 h-10 bg-background border-border/50 rounded-lg"
                    />
                  </div>
                  
                  {/* Status Filter */}
                  <Select value={healthFilter} onValueChange={(val) => setHealthFilter(val as any)}>
                    <SelectTrigger className="w-40 h-10 bg-background border-border/50">
                      <SelectValue placeholder="Todos os Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Status</SelectItem>
                      <SelectItem value="safe">Safe</SelectItem>
                      <SelectItem value="care">Care</SelectItem>
                      <SelectItem value="danger">Danger</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Right side - Tabs and actions */}
                <div className="flex items-center gap-3">
                  <TabsList className="rounded-xl h-10 bg-secondary/50 p-1">
                    <TabsTrigger 
                      value="projects" 
                      className="gap-2 px-4 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
                    >
                      <FolderKanban className="w-4 h-4" />
                      Projetos
                    </TabsTrigger>
                    <TabsTrigger 
                      value="profile" 
                      className="gap-2 px-4 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
                    >
                      <User className="w-4 h-4" />
                      Perfil
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>
            </div>

            {/* Projects Section Header */}
            {activeTab === 'projects' && (
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {showArchived ? 'Projetos Arquivados' : 'Meus Clientes'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Total de {showArchived ? archivedProjects.length : activeProjects.length} clientes cadastrados
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* View Mode Toggle */}
                  <div className="flex items-center border border-border/50 rounded-lg p-1 bg-card/50">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={cn(
                        "p-1.5 rounded-md transition-all",
                        viewMode === 'grid' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={cn(
                        "p-1.5 rounded-md transition-all",
                        viewMode === 'list' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>

                  {!isGuest && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setInviteProjectId(undefined);
                        setInviteProjectName(undefined);
                        setInviteDialogOpen(true);
                      }}
                      className="border-border/50 hover:border-primary/50 hover:bg-primary/10 transition-all gap-2"
                    >
                      <UserPlus className="w-4 h-4" />
                      Convidar Cliente
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowArchived(!showArchived)}
                    className={cn(
                      "border-border/50 hover:border-primary/50 hover:bg-primary/10 transition-all",
                      showArchived && 'bg-primary/10 border-primary/50'
                    )}
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    {showArchived ? 'Ativos' : 'Arquivados'}
                  </Button>
                  
                  <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="gap-2 bg-gradient-to-r from-primary to-red-700 hover:from-red-600 hover:to-red-800 shadow-lg shadow-primary/30">
                        <Plus className="w-4 h-4" />
                        Novo Cliente
                      </Button>
                    </DialogTrigger>
                      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
                        <DialogHeader>
                          <DialogTitle className="text-xl gradient-text">Criar novo projeto</DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="max-h-[70vh] pr-4">
                        <form onSubmit={handleCreateProject} className="space-y-5 mt-4">
                          {/* Avatar Upload */}
                          <div className="flex justify-center">
                            <div className="relative">
                              <div 
                                onClick={() => avatarInputRef.current?.click()}
                                className={cn(
                                  "w-24 h-24 rounded-2xl border-2 border-dashed border-border flex items-center justify-center cursor-pointer transition-all",
                                  "hover:border-primary hover:bg-primary/5",
                                  avatarPreview && "border-solid border-primary"
                                )}
                              >
                                {avatarPreview ? (
                                  <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover rounded-2xl" />
                                ) : isUploadingAvatar ? (
                                  <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                                ) : (
                                  <div className="text-center">
                                    <ImagePlus className="w-8 h-8 text-muted-foreground mx-auto" />
                                    <span className="text-xs text-muted-foreground mt-1">Avatar</span>
                                  </div>
                                )}
                              </div>
                              <input
                                ref={avatarInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleAvatarChange(e, false)}
                              />
                              {avatarPreview && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAvatarPreview(null);
                                    setFormData(prev => ({ ...prev, avatar_url: null }));
                                  }}
                                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          </div>

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
                            <div className="grid grid-cols-2 gap-3">
                              {businessModels.map((model) => {
                                const ModelIcon = model.icon;
                                return (
                                  <button
                                    key={model.value}
                                    type="button"
                                    onClick={() => {
                                      setFormData({ ...formData, business_model: model.value });
                                    }}
                                    className={cn(
                                      "p-3 rounded-xl border-2 text-left transition-all",
                                      formData.business_model === model.value
                                        ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                                        : 'border-border hover:border-primary/50'
                                    )}
                                  >
                                    <div className="flex items-center gap-2">
                                      <ModelIcon className="w-5 h-5 text-primary" />
                                      <p className="font-medium text-sm">{model.label}</p>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">{model.description}</p>
                                  </button>
                                );
                              })}
                            </div>
                            {formData.business_model === 'custom' && (
                              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                                <p className="text-sm text-muted-foreground flex items-center gap-2">
                                  <Sparkles className="w-4 h-4 text-primary" />
                                  Após criar o projeto, você será redirecionado para configurar suas métricas personalizadas.
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label>Health Score do Cliente</Label>
                            <div className="grid grid-cols-3 gap-3">
                              {healthScoreOptions.filter(opt => opt.value !== 'undefined').map((option) => {
                                const OptionIcon = option.icon;
                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, health_score: formData.health_score === option.value ? null : option.value as HealthScore })}
                                    className={cn(
                                      "p-3 rounded-xl border-2 text-center transition-all",
                                      formData.health_score === option.value
                                        ? `${option.borderColor} ${option.bgColor}`
                                        : 'border-border hover:border-primary/50'
                                    )}
                                  >
                                    <OptionIcon className={cn("w-5 h-5 mx-auto mb-1", option.textColor)} />
                                    <p className={cn("font-medium text-sm", formData.health_score === option.value ? option.textColor : '')}>{option.label}</p>
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

                          <div className="flex justify-end gap-3 pt-4 border-t border-border">
                            <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                              Cancelar
                            </Button>
                            <Button type="submit" disabled={isCreating} className="bg-gradient-to-r from-primary to-red-700">
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
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                </div>
              </div>
            )}

            <TabsContent value="projects" className="mt-0">
              {(showArchived ? filteredArchivedProjects : filteredActiveProjects).length > 0 ? (
                viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 stagger-fade-in">
                    {(showArchived ? filteredArchivedProjects : filteredActiveProjects).map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        onSelect={handleSelectProject}
                        onEdit={handleEditClick}
                        onDelete={handleDeleteClick}
                        onArchive={(p) => archiveProject(p.id)}
                        onUnarchive={(p) => unarchiveProject(p.id)}
                        onResync={handleResync}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 stagger-fade-in">
                    {(showArchived ? filteredArchivedProjects : filteredActiveProjects).map((project) => (
                      <ProjectListItem
                        key={project.id}
                        project={project}
                        onSelect={handleSelectProject}
                        onEdit={handleEditClick}
                        onDelete={handleDeleteClick}
                        onArchive={(p) => archiveProject(p.id)}
                        onUnarchive={(p) => unarchiveProject(p.id)}
                        onResync={handleResync}
                      />
                    ))}
                  </div>
                )
              ) : (
                <div className="text-center py-20 animate-fade-in">
                  <div className="relative inline-block">
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/20 to-red-700/20 flex items-center justify-center mx-auto mb-6 animate-float">
                      <FolderKanban className="w-12 h-12 text-primary" />
                    </div>
                    <div className="absolute inset-0 bg-primary/10 rounded-3xl blur-xl -z-10" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3 gradient-text">
                    {healthFilter !== 'all' 
                      ? `Nenhum projeto ${healthFilter === 'safe' ? 'Safe' : healthFilter === 'care' ? 'Care' : 'Danger'}` 
                      : showArchived 
                        ? 'Nenhum projeto arquivado' 
                        : 'Nenhum projeto ainda'}
                  </h3>
                  <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                    {healthFilter !== 'all'
                      ? 'Tente remover o filtro para ver todos os projetos.'
                      : showArchived 
                        ? 'Projetos arquivados aparecerão aqui.' 
                        : 'Crie seu primeiro projeto para começar a monitorar suas campanhas.'}
                  </p>
                  {!showArchived && (
                    <Button onClick={() => setCreateDialogOpen(true)} className="bg-gradient-to-r from-primary via-red-600 to-red-700 shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all duration-300 hover:scale-105 px-8 py-6 text-lg">
                      <Plus className="w-5 h-5 mr-2" />
                      Criar Primeiro Projeto
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Profile Tab */}
            <TabsContent value="profile" className="mt-0">
              <div className="max-w-3xl mx-auto space-y-6">
                {/* Profile Header with Avatar */}
                <div className="glass-card p-8">
                  <div className="flex items-start gap-6">
                    {/* Avatar Upload */}
                    <div className="relative">
                      <div 
                        onClick={() => profileAvatarInputRef.current?.click()}
                        className={cn(
                          "w-24 h-24 rounded-2xl border-2 border-dashed border-border flex items-center justify-center cursor-pointer transition-all overflow-hidden",
                          "hover:border-primary hover:bg-primary/5",
                          profileAvatarPreview && "border-solid border-primary"
                        )}
                      >
                        {profileAvatarPreview ? (
                          <img src={profileAvatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-center">
                            <Camera className="w-8 h-8 text-muted-foreground mx-auto" />
                            <span className="text-xs text-muted-foreground">Foto</span>
                          </div>
                        )}
                      </div>
                      <input
                        ref={profileAvatarInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleProfileAvatarChange}
                      />
                      <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center cursor-pointer hover:bg-primary/80 transition-colors" onClick={() => profileAvatarInputRef.current?.click()}>
                        <Pencil className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>

                    <div className="flex-1">
                      <h2 className="text-2xl font-bold mb-1">{profileName || user?.email?.split('@')[0] || 'Usuário'}</h2>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-4 h-4" />
                        <span>{user?.email}</span>
                      </div>
                      {profileCargo && (
                        <div className="flex items-center gap-2 text-primary mt-1">
                          <Briefcase className="w-4 h-4" />
                          <span className="font-medium">{cargoOptions.find(c => c.value === profileCargo)?.label}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Profile Edit Form */}
                <div className="glass-card p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" />
                    Informações do Perfil
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label>Nome Completo</Label>
                      <Input
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        placeholder="Seu nome"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        value={user?.email || ''}
                        disabled
                        className="opacity-50"
                      />
                      <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-6">
                    <Label>Cargo</Label>
                    <div className="grid grid-cols-4 gap-3">
                      {cargoOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setProfileCargo(option.value)}
                          className={cn(
                            "p-3 rounded-xl border-2 text-center transition-all",
                            profileCargo === option.value
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border hover:border-primary/50'
                          )}
                        >
                          <Briefcase className={cn("w-5 h-5 mx-auto mb-1", profileCargo === option.value ? 'text-primary' : 'text-muted-foreground')} />
                          <p className="font-medium text-xs">{option.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button 
                    onClick={handleUpdateProfile} 
                    disabled={isUpdatingProfile}
                    className="bg-gradient-to-r from-primary to-red-700"
                  >
                    {isUpdatingProfile ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Salvar Alterações
                      </>
                    )}
                  </Button>
                </div>

                {/* Change Password */}
                <div className="glass-card p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-primary" />
                    Alterar Senha
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label>Nova Senha</Label>
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Confirmar Senha</Label>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <Button 
                    onClick={handleChangePassword} 
                    disabled={isChangingPassword || !newPassword}
                    variant="outline"
                  >
                    {isChangingPassword ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Alterando...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        Alterar Senha
                      </>
                    )}
                  </Button>
                </div>

                {/* Stats */}
                <div className="glass-card p-6">
                  <h3 className="text-lg font-semibold mb-4">Resumo</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-secondary/50 text-center">
                      <p className="text-3xl font-bold text-primary">{activeProjects.length}</p>
                      <p className="text-sm text-muted-foreground">Projetos Ativos</p>
                    </div>
                    <div className="p-4 rounded-xl bg-secondary/50 text-center">
                      <p className="text-3xl font-bold text-emerald-400">{activeProjects.filter(p => p.health_score === 'safe').length}</p>
                      <p className="text-sm text-muted-foreground">Projetos Safe</p>
                    </div>
                    <div className="p-4 rounded-xl bg-secondary/50 text-center">
                      <p className="text-3xl font-bold text-red-400">{activeProjects.filter(p => p.health_score === 'danger').length}</p>
                      <p className="text-sm text-muted-foreground">Projetos Danger</p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Editar Projeto</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateProject} className="space-y-5 mt-4">
            {/* Avatar Upload */}
            <div className="flex justify-center">
              <div className="relative">
                <div 
                  onClick={() => editAvatarInputRef.current?.click()}
                  className={cn(
                    "w-24 h-24 rounded-2xl border-2 border-dashed border-border flex items-center justify-center cursor-pointer transition-all",
                    "hover:border-primary hover:bg-primary/5",
                    editAvatarPreview && "border-solid border-primary"
                  )}
                >
                  {editAvatarPreview ? (
                    <img src={editAvatarPreview} alt="Avatar" className="w-full h-full object-cover rounded-2xl" />
                  ) : isUploadingAvatar ? (
                    <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                  ) : (
                    <div className="text-center">
                      <Camera className="w-8 h-8 text-muted-foreground mx-auto" />
                      <span className="text-xs text-muted-foreground mt-1">Avatar</span>
                    </div>
                  )}
                </div>
                <input
                  ref={editAvatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleAvatarChange(e, true)}
                />
                {editAvatarPreview && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditAvatarPreview(null);
                      setEditFormData(prev => ({ ...prev, avatar_url: null }));
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do projeto *</Label>
                <Input
                  placeholder="Ex: Minha Loja"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>ID da Conta Meta</Label>
                <Input
                  value={editFormData.ad_account_id}
                  onChange={(e) => setEditFormData({ ...editFormData, ad_account_id: e.target.value })}
                  disabled
                  className="opacity-50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Health Score do Cliente</Label>
              <div className="grid grid-cols-3 gap-3">
                {healthScoreOptions.filter(opt => opt.value !== 'undefined').map((option) => {
                  const OptionIcon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setEditFormData({ ...editFormData, health_score: editFormData.health_score === option.value ? null : option.value as HealthScore })}
                      className={cn(
                        "p-3 rounded-xl border-2 text-center transition-all",
                        editFormData.health_score === option.value
                          ? `${option.borderColor} ${option.bgColor}`
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <OptionIcon className={cn("w-5 h-5 mx-auto mb-1", option.textColor)} />
                      <p className={cn("font-medium text-sm", editFormData.health_score === option.value ? option.textColor : '')}>{option.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Modelo de negócio</Label>
              <div className="grid grid-cols-3 gap-3">
                {businessModels.map((model) => {
                  const ModelIcon = model.icon;
                  return (
                    <button
                      key={model.value}
                      type="button"
                      onClick={() => setEditFormData({ ...editFormData, business_model: model.value })}
                      className={cn(
                        "p-3 rounded-xl border-2 text-center transition-all",
                        editFormData.business_model === model.value
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <ModelIcon className="w-5 h-5 mx-auto mb-1 text-primary" />
                      <p className="font-medium text-sm">{model.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Moeda</Label>
                <Select
                  value={editFormData.currency}
                  onValueChange={(value) => setEditFormData({ ...editFormData, currency: value })}
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
                  value={editFormData.timezone}
                  onValueChange={(value) => setEditFormData({ ...editFormData, timezone: value })}
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

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isUpdating} className="bg-gradient-to-r from-primary to-red-700">
                {isUpdating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Salvar
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os dados do projeto "{selectedProject?.name}" serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invite Guest Dialog */}
      <InviteGuestDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        preselectedProjectId={inviteProjectId}
        preselectedProjectName={inviteProjectName}
      />
    </div>
  );
}
