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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  UserPlus,
  Shield,
  GraduationCap
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
  { value: 'infoproduto', label: 'Infoproduto', description: 'Cursos e mentorias', icon: GraduationCap },
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
  infoproduto: { bgColor: 'bg-orange-500/15', textColor: 'text-orange-400', iconColor: 'text-orange-400' },
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
  const modelColors = businessModelColors[project.business_model];
  
  const displayHealthScore: ExtendedHealthScore = project.health_score || 'undefined';
  const healthOption = healthScoreOptions.find(h => h.value === displayHealthScore) || healthScoreOptions[3];
  
  const lastSyncDate = project.last_sync_at ? new Date(project.last_sync_at) : null;

  // Health indicator colors (small dot only)
  const healthDotColor = {
    safe: 'bg-emerald-500',
    care: 'bg-amber-500',
    danger: 'bg-red-500',
    undefined: 'bg-slate-500',
  }[displayHealthScore];

  return (
    <div 
      className={cn(
        "v4-cockpit-card group p-5 cursor-pointer",
        project.archived && 'opacity-50'
      )}
      onClick={() => onSelect(project)}
    >
      {/* Header Row */}
      <div className="flex items-start gap-4 mb-4">
        {/* Avatar */}
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden",
          "bg-white/5 border border-white/10"
        )}>
          {project.avatar_url ? (
            <img src={project.avatar_url} alt={project.name} className="w-full h-full object-cover" />
          ) : (
            <Icon className="w-6 h-6 text-white/40" />
          )}
        </div>
        
        {/* Title & Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="font-semibold text-white truncate" title={project.name}>
              {project.name}
            </h3>
            {/* Health indicator dot */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0",
                    healthDotColor
                  )} />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs bg-[#0f0f0f] border-white/10">
                  Health: {healthOption.label}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-white/5 text-white/50 border border-white/10">
              <Icon className="w-3 h-3" />
              {model?.label}
            </span>
            <span className="text-[10px] text-white/30 font-mono">
              {project.ad_account_id.replace('act_', '')}
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        {/* Sync Status */}
        <div className={cn(
          "flex items-center gap-1.5 text-xs",
          lastSyncDate && (Date.now() - lastSyncDate.getTime() < 24 * 60 * 60 * 1000) 
            ? "text-emerald-400" 
            : "text-white/30"
        )}>
          <RefreshCw className="w-3 h-3" />
          <span>{lastSyncDate ? formatDistanceToNow(lastSyncDate, { addSuffix: true, locale: ptBR }) : 'Nunca'}</span>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(project);
            }}
            className="v4-ghost-btn text-xs py-1.5 px-3 flex items-center gap-1"
          >
            Acessar
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-red-400 hover:bg-white/5 transition-colors duration-300">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 bg-black/90 border-white/10 backdrop-blur-xl" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => onEdit(project)} className="gap-2 cursor-pointer text-white/80 hover:text-red-400 focus:text-red-400 focus:bg-red-600/10">
                  <Pencil className="w-4 h-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onResync(project)} className="gap-2 cursor-pointer text-white/80 hover:text-red-400 focus:text-red-400 focus:bg-red-600/10">
                  <RefreshCw className="w-4 h-4" />
                  Re-sincronizar
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                {project.archived ? (
                  <DropdownMenuItem onClick={() => onUnarchive(project)} className="gap-2 cursor-pointer text-white/80 hover:text-red-400 focus:text-red-400 focus:bg-red-600/10">
                    <ArchiveRestore className="w-4 h-4" />
                    Restaurar
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onArchive(project)} className="gap-2 cursor-pointer text-white/80 hover:text-red-400 focus:text-red-400 focus:bg-red-600/10">
                    <Archive className="w-4 h-4" />
                    Arquivar
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onClick={() => onDelete(project)} className="gap-2 cursor-pointer text-red-400 focus:text-red-500 focus:bg-red-600/10">
                  <Trash2 className="w-4 h-4" />
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

  // Health indicator colors (small dot only)
  const healthDotColor = {
    safe: 'bg-emerald-500',
    care: 'bg-amber-500',
    danger: 'bg-red-500',
    undefined: 'bg-slate-500',
  }[displayHealthScore];

  return (
    <div 
      className={cn(
        "group relative flex items-center gap-4 overflow-hidden rounded-lg transition-all duration-400 cursor-pointer p-4",
        "bg-black/40 backdrop-blur-xl",
        "border border-white/10 hover:border-red-600/50",
        "hover:shadow-[0_0_30px_rgba(220,38,38,0.15)]",
        project.archived && 'opacity-50'
      )}
      onClick={() => onSelect(project)}
    >
      {/* Left red accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-red-600/60 via-red-600 to-red-600/60 group-hover:shadow-[0_0_10px_rgba(220,38,38,0.5)] transition-all duration-500" />

      {/* Avatar */}
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden ml-2",
        "bg-black/40 border border-white/10",
        "transition-all duration-500 group-hover:border-red-600/40 group-hover:shadow-[0_0_15px_rgba(220,38,38,0.3)]"
      )}>
        {project.avatar_url ? (
          <img src={project.avatar_url} alt={project.name} className="w-full h-full object-cover" />
        ) : (
          <Icon className="w-5 h-5 text-white/60 group-hover:text-red-500 transition-colors duration-300" />
        )}
      </div>
      
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-white group-hover:text-red-400 transition-colors duration-300 truncate">
            {project.name}
          </h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0 transition-all duration-300",
                  healthDotColor,
                  "shadow-[0_0_4px_currentColor] group-hover:scale-125"
                )} />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs bg-black/90 border-white/10">
                Health: {healthOption.label}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1 bg-red-600/10 text-red-400 px-2 py-0.5 rounded border border-red-600/20">
            <Icon className="w-3 h-3" />
            {model?.label}
          </span>
          <span className="font-mono text-white/30">{project.ad_account_id.replace('act_', '')}</span>
          <div className={cn(
            "flex items-center gap-1 transition-colors duration-300",
            lastSyncDate && (Date.now() - lastSyncDate.getTime() < 24 * 60 * 60 * 1000) 
              ? "text-emerald-500" 
              : "text-white/40"
          )}>
            <RefreshCw className="w-3 h-3" />
            <span>{lastSyncDate ? formatDistanceToNow(lastSyncDate, { addSuffix: true, locale: ptBR }) : 'Nunca'}</span>
          </div>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(project);
          }}
          className="v4-btn h-8 px-3 text-xs"
        >
          ACESSAR
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-red-400 hover:bg-white/5">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 bg-black/90 border-white/10 backdrop-blur-xl" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => onEdit(project)} className="gap-2 cursor-pointer text-white/80 hover:text-red-400 focus:text-red-400 focus:bg-red-600/10">
              <Pencil className="w-4 h-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onResync(project)} className="gap-2 cursor-pointer text-white/80 hover:text-red-400 focus:text-red-400 focus:bg-red-600/10">
              <RefreshCw className="w-4 h-4" />
              Re-sincronizar
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            {project.archived ? (
              <DropdownMenuItem onClick={() => onUnarchive(project)} className="gap-2 cursor-pointer text-white/80 hover:text-red-400 focus:text-red-400 focus:bg-red-600/10">
                <ArchiveRestore className="w-4 h-4" />
                Restaurar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onArchive(project)} className="gap-2 cursor-pointer text-white/80 hover:text-red-400 focus:text-red-400 focus:bg-red-600/10">
                <Archive className="w-4 h-4" />
                Arquivar
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem onClick={() => onDelete(project)} className="gap-2 cursor-pointer text-red-400 focus:text-red-500 focus:bg-red-600/10">
              <Trash2 className="w-4 h-4" />
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
  const [activeTab, setActiveTab] = useState('meta-ads');
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

  const activeProjects = projects.filter(p => !p.archived);
  const archivedProjects = projects.filter(p => p.archived);
  
  // Filter projects by platform: Meta Ads (has ad_account_id), Google Ads (has google_customer_id)
  const metaAdsProjects = activeProjects.filter(p => p.ad_account_id && !p.google_customer_id);
  const googleAdsProjects = activeProjects.filter(p => p.google_customer_id);
  const archivedMetaProjects = archivedProjects.filter(p => p.ad_account_id && !p.google_customer_id);
  const archivedGoogleProjects = archivedProjects.filter(p => p.google_customer_id);
  
  // Filtered projects based on health score filter and search query
  const filteredMetaProjects = (showArchived ? archivedMetaProjects : metaAdsProjects)
    .filter(p => healthFilter === 'all' || (p.health_score || 'undefined') === healthFilter)
    .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredGoogleProjects = (showArchived ? archivedGoogleProjects : googleAdsProjects)
    .filter(p => healthFilter === 'all' || (p.health_score || 'undefined') === healthFilter)
    .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredActiveProjects = activeProjects
    .filter(p => healthFilter === 'all' || (p.health_score || 'undefined') === healthFilter)
    .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredArchivedProjects = archivedProjects

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

  // Floating Particle Component - subtle, same as Auth
  const Particle = ({ delay, duration, size, x, y }: { delay: number; duration: number; size: number; x: number; y: number }) => (
    <div
      className="absolute rounded-full bg-white/8 animate-float"
      style={{
        width: size,
        height: size,
        left: `${x}%`,
        top: `${y}%`,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
        filter: 'blur(0.5px)',
      }}
    />
  );

  // Generate particles
  const particles = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    delay: Math.random() * 5,
    duration: 4 + Math.random() * 4,
    size: 4 + Math.random() * 6,
    x: Math.random() * 100,
    y: Math.random() * 100,
  }));

  if (authLoading || projectsLoading) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] animate-pulse-slow" />
        </div>
        
        {/* Loading skeleton */}
        <div className="relative z-10 container mx-auto px-6 pt-12">
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 rounded-2xl bg-muted/20 animate-pulse mb-4" />
            <div className="h-6 w-48 bg-muted/20 rounded animate-pulse mb-2" />
            <div className="h-4 w-32 bg-muted/10 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
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
    <div className="min-h-screen v4-cockpit-bg">
      {/* V4 Ambient Light Effects */}
      <div className="v4-ambient-light top-left" />
      <div className="v4-ambient-light bottom-right" />
      <div className="v4-ambient-light center" />

      {/* Main Content */}
      <div className="relative" style={{ zIndex: 10 }}>
        {/* Header */}
        <header className="w-full px-8 pt-6 pb-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <img 
                src={v4LogoIcon} 
                alt="V4 Company" 
                className="h-10 w-auto"
              />
              <div className="flex flex-col">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  MetaAds <span className="text-white/60 font-normal">Manager</span>
                </h1>
                <span className="text-[10px] text-white/30 tracking-widest uppercase">by V4 Company</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigate('/admin')}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all"
              >
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">Admin</span>
              </button>
              <button 
                onClick={handleLogout} 
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>
        </header>

        {/* Section Title */}
        <div className="w-full px-8 py-6">
          <div className="max-w-7xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-2">
              Seus Projetos
            </h2>
            <p className="text-white/40 text-sm">
              Gerencie e monitore suas campanhas de anúncios
            </p>
          </div>
        </div>

        {/* Summary Cards - Cockpit Stats */}
        <div className="w-full px-8 py-4">
          <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total */}
            <div className="v4-cockpit-stat group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-white/40 font-medium uppercase tracking-wider mb-1">Total de Clientes</p>
                  <p className="text-3xl font-bold text-white">{healthCounts.total}</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center">
                  <FolderKanban className="w-5 h-5 text-white/40" />
                </div>
              </div>
            </div>
            
            {/* Safe */}
            <div className="v4-cockpit-stat">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-white/40 font-medium uppercase tracking-wider mb-1">Safe</p>
                  <p className="text-3xl font-bold text-emerald-400">{healthCounts.safe}</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </div>
              </div>
            </div>
            
            {/* Care */}
            <div className="v4-cockpit-stat">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-white/40 font-medium uppercase tracking-wider mb-1">Care</p>
                  <p className="text-3xl font-bold text-amber-400">{healthCounts.care}</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
              </div>
            </div>
            
            {/* Danger */}
            <div className="v4-cockpit-stat">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-white/40 font-medium uppercase tracking-wider mb-1">Danger</p>
                  <p className="text-3xl font-bold text-red-400">{healthCounts.danger}</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="w-full px-8 pb-8">
          <div className="max-w-7xl mx-auto">
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {/* Controls Bar - Cockpit Glass */}
              <div className="v4-cockpit-card p-4 mb-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  {/* Left side - Search and filters */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Search Input */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <Input
                        placeholder="Buscar por nome ou account..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="v4-cockpit-input pl-10 w-64 h-10"
                      />
                    </div>
                    
                    {/* Status Filter */}
                    <Select value={healthFilter} onValueChange={(val) => setHealthFilter(val as any)}>
                      <SelectTrigger className="w-40 h-10 v4-cockpit-select text-white/70">
                        <SelectValue placeholder="Todos os Status" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0f0f0f] border-white/10">
                        <SelectItem value="all" className="text-white/70 focus:bg-white/5 focus:text-white">Todos os Status</SelectItem>
                        <SelectItem value="safe" className="text-white/70 focus:bg-white/5 focus:text-white">Safe</SelectItem>
                        <SelectItem value="care" className="text-white/70 focus:bg-white/5 focus:text-white">Care</SelectItem>
                        <SelectItem value="danger" className="text-white/70 focus:bg-white/5 focus:text-white">Danger</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Right side - Tabs */}
                  <div className="flex items-center gap-2 bg-black/30 rounded-lg p-1">
                    <button 
                      onClick={() => setActiveTab('meta-ads')}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                        activeTab === 'meta-ads' 
                          ? 'bg-blue-600/20 text-blue-400' 
                          : 'text-white/50 hover:text-white/80'
                      )}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"/>
                      </svg>
                      Meta Ads
                    </button>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white/25 cursor-not-allowed">
                            <Lock className="w-4 h-4" />
                            Google Ads
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="bg-[#0f0f0f] border-white/10">
                          <p>Em breve</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <button 
                      onClick={() => setActiveTab('profile')}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                        activeTab === 'profile' 
                          ? 'bg-white/10 text-white' 
                          : 'text-white/50 hover:text-white/80'
                      )}
                    >
                      <User className="w-4 h-4" />
                      Perfil
                    </button>
                  </div>
                </div>
              </div>

            {/* Meta Ads Section Header */}
            {activeTab === 'meta-ads' && (
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"/>
                    </svg>
                    {showArchived ? 'Meta Ads - Arquivados' : 'Meta Ads - Clientes'}
                  </h2>
                  <p className="text-sm text-white/40">
                    Total de {showArchived ? archivedMetaProjects.length : metaAdsProjects.length} clientes Meta Ads
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-black/30 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={cn(
                        "p-2 rounded-md transition-all",
                        viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
                      )}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={cn(
                        "p-2 rounded-md transition-all",
                        viewMode === 'list' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
                      )}
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>

                  {!isGuest && (
                    <button
                      onClick={() => {
                        setInviteProjectId(undefined);
                        setInviteProjectName(undefined);
                        setInviteDialogOpen(true);
                      }}
                      className="v4-ghost-btn flex items-center gap-2"
                    >
                      <UserPlus className="w-4 h-4" />
                      Convidar Cliente
                    </button>
                  )}

                  <button
                    onClick={() => setShowArchived(!showArchived)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition-all",
                      showArchived && 'bg-white/5 border-white/20'
                    )}
                  >
                    <Archive className="w-4 h-4" />
                    {showArchived ? 'Ativos' : 'Arquivados'}
                  </button>
                  
                  <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <button className="v4-primary-btn flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Novo Cliente Meta
                      </button>
                    </DialogTrigger>
                      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
                        <DialogHeader>
                          <DialogTitle className="text-xl gradient-text flex items-center gap-2">
                            <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"/>
                            </svg>
                            Criar projeto Meta Ads
                          </DialogTitle>
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
                            <Button type="submit" disabled={isCreating} className="bg-gradient-to-r from-blue-600 to-blue-700">
                              {isCreating ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Criando...
                                </>
                              ) : (
                                <>
                                  <Plus className="w-4 h-4 mr-2" />
                                  Criar Projeto Meta
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


            {/* Meta Ads Tab Content */}
            <TabsContent value="meta-ads" className="mt-0">
              {filteredMetaProjects.length > 0 ? (
                viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 stagger-fade-in">
                    {filteredMetaProjects.map((project) => (
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
                    {filteredMetaProjects.map((project) => (
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
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500/20 to-blue-700/20 flex items-center justify-center mx-auto mb-6 animate-float">
                      <svg className="w-12 h-12 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"/>
                      </svg>
                    </div>
                    <div className="absolute inset-0 bg-blue-500/10 rounded-3xl blur-xl -z-10" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-blue-400">
                    {healthFilter !== 'all' 
                      ? `Nenhum projeto ${healthFilter === 'safe' ? 'Safe' : healthFilter === 'care' ? 'Care' : 'Danger'}` 
                      : showArchived 
                        ? 'Nenhum projeto Meta Ads arquivado' 
                        : 'Nenhum cliente Meta Ads ainda'}
                  </h3>
                  <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                    {healthFilter !== 'all'
                      ? 'Tente remover o filtro para ver todos os projetos.'
                      : showArchived 
                        ? 'Projetos Meta Ads arquivados aparecerão aqui.' 
                        : 'Adicione seu primeiro cliente Meta Ads para começar.'}
                  </p>
                  {!showArchived && (
                    <Button onClick={() => setCreateDialogOpen(true)} className="bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 transition-all duration-300 hover:scale-105 px-8 py-6 text-lg">
                      <Plus className="w-5 h-5 mr-2" />
                      Criar Cliente Meta Ads
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
      </div>
      {/* Close div.relative.z-10 */}

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
