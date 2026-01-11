import { useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import { useProfile } from '@/hooks/useProfile';
import { useUserRole } from '@/hooks/useUserRole';
import { useSidebarCampaigns } from '@/hooks/useSidebarCampaigns';
import { useTour } from '@/hooks/useTour';
import v4LogoFull from '@/assets/v4-logo-full.png';
import { 
  LayoutDashboard, 
  FolderKanban, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  ChevronDown,
  Layers,
  ChevronUp,
  Image as ImageIcon,
  Database,
  Bot,
  MessageSquare,
  UserPlus,
  Compass,
  Lock,
  TrendingUp,
  History,
  Sun,
  Moon,
  User,
  KeyRound
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { SyncStatusBadge } from '@/components/sync/SyncStatusBadge';
import { InviteGuestDialog } from '@/components/guests/InviteGuestDialog';
import { LoadingScreen } from '@/components/ui/loading-screen';


// Skeleton component for campaign list items
function CampaignSkeleton() {
  return (
    <div className="space-y-2 px-3 py-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-2 pl-5">
          <Skeleton className="w-2 h-2 rounded-full" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

interface SidebarProps {
  onNavigate?: () => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [campaignsOpen, setCampaignsOpen] = useState(false); // Starts closed
  const [expandedCampaigns, setExpandedCampaigns] = useState<Record<string, boolean>>({});
  const [guestSettingsOpen, setGuestSettingsOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  
  const [isChangingProject, setIsChangingProject] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { projects } = useProjects();
  const { profile } = useProfile();
  const { isGuest, loading: roleLoading } = useUserRole();
  const { triggerTour } = useTour();
  const { theme, toggleTheme } = useTheme();
  const selectedProjectId = localStorage.getItem('selectedProjectId');
  // Only return a project if explicitly selected - never auto-select
  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return projects.find(p => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  // Use lightweight hook for sidebar campaigns instead of full useMetaAdsData
  const { campaigns: sortedCampaigns, getCampaignAdSets, loading: campaignsLoading } = useSidebarCampaigns(selectedProject?.id || null);


  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleChangeProject = (projectId: string) => {
    if (projectId === selectedProjectId) return;
    setIsChangingProject(true);
    localStorage.setItem('selectedProjectId', projectId);
    // Sempre navegar para Dashboard ao trocar de projeto
    window.location.href = '/dashboard';
  };

  const toggleCampaignExpand = (campaignId: string) => {
    setExpandedCampaigns(prev => ({
      ...prev,
      [campaignId]: !prev[campaignId]
    }));
  };

  // getCampaignAdSets is now provided by useSidebarCampaigns hook

  const getStatusColor = (status: string) => {
    if (status === 'ACTIVE') return 'bg-metric-positive';
    if (status === 'PAUSED') return 'bg-metric-warning';
    return 'bg-muted';
  };

  const handleNavClick = (to: string) => {
    navigate(to);
    onNavigate?.();
  };

  // Show loading screen when changing projects
  if (isChangingProject) {
    return <LoadingScreen message="Trocando de projeto..." />;
  }

  return (
    <aside
      className={cn(
        'h-screen border-r border-sidebar-border transition-all duration-300 sidebar-container',
        onNavigate ? 'relative w-full' : 'fixed left-0 top-0 z-40',
        !onNavigate && (collapsed ? 'w-20' : 'w-72')
      )}
    >
      <div className="relative flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
          {!isGuest ? (
            <Link to="/projects" className="flex items-center gap-3">
              <img 
                src={v4LogoFull} 
                alt="V4 Company" 
                className={cn(
                  "transition-all duration-300 dark:brightness-0 dark:invert",
                  collapsed ? "h-8 w-auto" : "h-10 w-auto"
                )}
              />
            </Link>
          ) : (
            <div className="flex items-center gap-3">
              <img 
                src={v4LogoFull} 
                alt="V4 Company" 
                className={cn(
                  "transition-all duration-300 dark:brightness-0 dark:invert",
                  collapsed ? "h-8 w-auto" : "h-10 w-auto"
                )}
              />
            </div>
          )}
          {/* Hide collapse button on mobile (when onNavigate is provided) */}
          {!onNavigate && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="sidebar-collapse-btn flex-shrink-0"
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Project Selector */}
        {selectedProject && !collapsed && (
          <div className="px-3 py-3 border-b border-sidebar-border" data-tour="project-selector">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="sidebar-project-selector w-full flex items-center justify-between group">
                  <div className="text-left">
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-metric-positive" />
                      Projeto Ativo
                    </p>
                    <p className="font-semibold truncate mt-0.5 text-foreground">{selectedProject.name}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 bg-popover border-border">
                {projects.filter(p => !p.archived).map((project) => (
                  <DropdownMenuItem 
                    key={project.id}
                    onClick={() => handleChangeProject(project.id)}
                    className={cn(
                      'transition-colors duration-200',
                      project.id === selectedProject.id && 'bg-primary/15 text-primary'
                    )}
                  >
                    <div>
                      <p className="font-medium">{project.name}</p>
                      {!isGuest && (
                        <p className="text-xs text-muted-foreground">
                          ID: {project.ad_account_id.replace('act_', '')}
                        </p>
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
                {/* Hide "Gerenciar Projetos" for guests */}
                {!isGuest && (
                  <DropdownMenuItem onClick={() => navigate('/projects')} className="border-t border-border mt-1 pt-2">
                    <FolderKanban className="w-4 h-4 mr-2" />
                    Gerenciar Projetos
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Sync Status Badge */}
            <div className="mt-3 px-1">
              <SyncStatusBadge projectId={selectedProject.id} />
            </div>
          </div>
        )}
        
        {/* Divider decorativo */}
        {selectedProject && !collapsed && <div className="sidebar-divider mx-3" />}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto flex flex-col">
          <div className="space-y-1" data-tour="sidebar-nav">
            {/* Dashboard */}
            <Link
              to="/dashboard"
              className={cn(
                'sidebar-item',
                location.pathname === '/dashboard' && 'active'
              )}
            >
              <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>Dashboard</span>}
            </Link>

            {/* Campaigns with hierarchy */}
            {!collapsed ? (
              <Collapsible open={campaignsOpen} onOpenChange={setCampaignsOpen} data-tour="campaigns">
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      'sidebar-item w-full justify-between',
                      (location.pathname.includes('/campaign') || location.pathname.includes('/adset')) && 'active'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Megaphone className="w-5 h-5 flex-shrink-0" />
                      <span>Campanhas</span>
                    </div>
                    {campaignsOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-1 space-y-0.5">
                  <Link
                    to="/campaigns"
                    className={cn(
                      'sidebar-item pl-10 text-sm',
                      location.pathname === '/campaigns' && 'active'
                    )}
                  >
                    Ver Todas
                  </Link>
                  
                  {/* Campaign list with skeleton loader */}
                  <div className="max-h-[300px] overflow-y-auto">
                    {campaignsLoading ? (
                      <CampaignSkeleton />
                    ) : sortedCampaigns.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-3 py-2 pl-10">
                        Nenhuma campanha encontrada
                      </p>
                    ) : (
                      sortedCampaigns.slice(0, 10).map((campaign) => {
                        const campaignAdSets = getCampaignAdSets(campaign.id);
                        const isExpanded = expandedCampaigns[campaign.id];
                        
                        return (
                          <div key={campaign.id} className="group/campaign">
                            <button
                              onClick={() => toggleCampaignExpand(campaign.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 pl-8 text-sm rounded-lg transition-colors duration-200 hover:bg-secondary"
                            >
                              <span className={cn(
                                'w-2 h-2 rounded-full flex-shrink-0',
                                getStatusColor(campaign.status)
                              )} />
                              <span className="truncate flex-1 text-left text-muted-foreground group-hover/campaign:text-foreground transition-colors">{campaign.name}</span>
                              {campaignAdSets.length > 0 && (
                                <span className={cn(
                                  'transition-transform duration-200',
                                  isExpanded && 'rotate-180'
                                )}>
                                  <ChevronDown className="w-3 h-3 flex-shrink-0" />
                                </span>
                              )}
                            </button>
                            
                            {/* Ad Sets */}
                            {isExpanded && campaignAdSets.length > 0 && (
                              <div className="ml-6 border-l border-border animate-fade-in">
                                {campaignAdSets.map((adSet) => (
                                  <Link
                                    key={adSet.id}
                                    to={`/adset/${adSet.id}`}
                                    className="flex items-center gap-2 px-3 py-1.5 pl-4 text-xs rounded-lg transition-colors duration-200 text-muted-foreground hover:text-foreground hover:bg-secondary"
                                  >
                                    <Layers className="w-3 h-3 flex-shrink-0 opacity-50" />
                                    <span className={cn(
                                      'w-1.5 h-1.5 rounded-full flex-shrink-0',
                                      getStatusColor(adSet.status)
                                    )} />
                                    <span className="truncate">{adSet.name}</span>
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                  
                  {sortedCampaigns.length > 10 && (
                    <Link
                      to="/campaigns"
                      className="sidebar-item pl-10 text-sm text-muted-foreground hover:text-foreground"
                    >
                      + {sortedCampaigns.length - 10} mais campanhas
                    </Link>
                  )}
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <Link
                to="/campaigns"
                className={cn(
                  'sidebar-item',
                  location.pathname.includes('/campaign') && 'active'
                )}
              >
                <Megaphone className="w-5 h-5 flex-shrink-0" />
              </Link>
            )}


            {/* Creatives */}
            <Link
              to="/creatives"
              data-tour="creatives"
              className={cn(
                'sidebar-item',
                location.pathname === '/creatives' && 'active'
              )}
            >
              <ImageIcon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>Criativos</span>}
            </Link>

            {/* Agente Lisboa - Hidden for guests */}
            {!roleLoading && !isGuest && (
              <Link
                to="/ai-assistant"
                className={cn(
                  'sidebar-item',
                  location.pathname === '/ai-assistant' && 'active'
                )}
              >
                <Bot className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>Agente Lisboa</span>}
              </Link>
            )}

            {/* Análise Preditiva - Hidden for guests */}
            {!roleLoading && !isGuest && (
              <Link
                to="/predictive-analysis"
                className={cn(
                  'sidebar-item',
                  location.pathname === '/predictive-analysis' && 'active'
                )}
              >
                <TrendingUp className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>Análise Preditiva</span>}
              </Link>
            )}

            {/* Histórico de Otimizações */}
            {selectedProject && (
              <Link
                to="/optimization-history"
                className={cn(
                  'sidebar-item',
                  location.pathname === '/optimization-history' && 'active'
                )}
              >
                <History className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>Histórico</span>}
              </Link>
            )}


            {/* Tour Button - Only for guests */}
            {!roleLoading && isGuest && (
              <button
                onClick={() => {
                  navigate('/dashboard');
                  // Small delay to let navigation complete, then trigger tour
                  setTimeout(() => {
                    triggerTour();
                  }, 300);
                }}
                className="sidebar-item w-full group"
              >
                <Compass className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>Ver Tour</span>}
              </button>
            )}
          </div>

          {/* Spacer to push admin/settings to bottom */}
          <div className="flex-1" />
          
          {/* Divider antes da seção de admin */}
          {!roleLoading && !isGuest && !collapsed && <div className="sidebar-divider mx-3" />}

          {/* Admin & Settings at bottom - Hidden for guests, hidden while loading role */}
          {!roleLoading && !isGuest && (
            <div className="space-y-1 mt-2 mb-2">

              {/* Admin - vai para página dedicada do projeto se houver projeto selecionado */}
              <Link
                to={selectedProject ? `/project/${selectedProject.id}/admin` : '/admin'}
                onClick={onNavigate}
                className={cn(
                  'sidebar-item',
                  (location.pathname === '/admin' || 
                   location.pathname.includes('/admin')) && 'active'
                )}
              >
                <Database className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>Administração</span>}
              </Link>

              {/* Settings */}
              <Link
                to="/settings"
                className={cn(
                  'sidebar-item',
                  location.pathname === '/settings' && 'active'
                )}
              >
                <Settings className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>Configurações</span>}
              </Link>
            </div>
          )}

          {/* Guest Settings Section */}
          {!roleLoading && isGuest && (
            <div className="space-y-1 mt-2 mb-2">
              {!collapsed && <div className="sidebar-divider mx-3 mb-2" />}
              
              {!collapsed ? (
                <Collapsible open={guestSettingsOpen} onOpenChange={setGuestSettingsOpen}>
                  <CollapsibleTrigger asChild>
                    <button className="sidebar-item w-full justify-between">
                      <div className="flex items-center gap-3">
                        <Settings className="w-5 h-5 flex-shrink-0" />
                        <span>Configurações</span>
                      </div>
                      {guestSettingsOpen ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-1 space-y-0.5">
                    {/* Theme Toggle */}
                    <button
                      onClick={toggleTheme}
                      className="sidebar-item pl-10 text-sm w-full"
                    >
                      {theme === 'dark' ? (
                        <>
                          <Sun className="w-4 h-4 mr-2" />
                          Modo Claro
                        </>
                      ) : (
                        <>
                          <Moon className="w-4 h-4 mr-2" />
                          Modo Escuro
                        </>
                      )}
                    </button>
                    
                    {/* Edit Profile */}
                    <Link
                      to="/settings"
                      onClick={onNavigate}
                      className="sidebar-item pl-10 text-sm"
                    >
                      <User className="w-4 h-4 mr-2" />
                      Editar Perfil
                    </Link>
                    
                    {/* Change Password */}
                    <Link
                      to="/change-password"
                      onClick={onNavigate}
                      className="sidebar-item pl-10 text-sm"
                    >
                      <KeyRound className="w-4 h-4 mr-2" />
                      Alterar Senha
                    </Link>
                    
                    {/* Logout */}
                    <button
                      onClick={handleSignOut}
                      className="sidebar-item pl-10 text-sm w-full text-destructive hover:bg-destructive/10"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sair
                    </button>
                  </CollapsibleContent>
                </Collapsible>
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setGuestSettingsOpen(!guestSettingsOpen)}
                        className="sidebar-item w-full justify-center"
                      >
                        <Settings className="w-5 h-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Configurações</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )}
        </nav>

        {/* User section - Different for guests vs regular users */}
        <div className="p-4 border-t border-sidebar-border bg-sidebar-accent/50">
          <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
            <Avatar className="w-10 h-10 ring-2 ring-primary/20">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                {profile?.full_name?.[0]?.toUpperCase() || user?.email?.[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-foreground">
                  {profile?.full_name || 'Investidor'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email}
                </p>
              </div>
            )}
          </div>
          {/* Only show logout button for non-guests (guests have it in their settings menu) */}
          {!isGuest && (
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className={cn(
                'mt-4 w-full transition-colors duration-200 group',
                'hover:bg-destructive/10 hover:text-destructive',
                collapsed ? 'px-0' : ''
              )}
            >
              <LogOut className="w-4 h-4" />
              {!collapsed && <span className="ml-2">Sair</span>}
            </Button>
          )}
        </div>
      </div>

      {/* Invite Guest Dialog */}
      {selectedProject && (
        <InviteGuestDialog
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
          preselectedProjectId={selectedProject.id}
          preselectedProjectName={selectedProject.name}
        />
      )}

    </aside>
  );
}