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
  Compass
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
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
  const [campaignsOpen, setCampaignsOpen] = useState(true);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Record<string, boolean>>({});
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { projects } = useProjects();
  const { profile } = useProfile();
  const { isGuest, loading: roleLoading } = useUserRole();
  const { triggerTour } = useTour();
  
  const selectedProjectId = localStorage.getItem('selectedProjectId');
  const selectedProject = useMemo(() => 
    projects.find(p => p.id === selectedProjectId) || projects[0],
    [projects, selectedProjectId]
  );

  // Use lightweight hook for sidebar campaigns instead of full useMetaAdsData
  const { campaigns: sortedCampaigns, getCampaignAdSets, loading: campaignsLoading } = useSidebarCampaigns(selectedProject?.id || null);


  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleChangeProject = (projectId: string) => {
    localStorage.setItem('selectedProjectId', projectId);
    window.location.reload();
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

  return (
    <aside
      className={cn(
        'h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300',
        onNavigate ? 'relative w-full' : 'fixed left-0 top-0 z-40',
        !onNavigate && (collapsed ? 'w-20' : 'w-72')
      )}
    >
      {/* Subtle red texture overlay */}
      <div className="absolute inset-0 red-texture-bg opacity-30 pointer-events-none" />
      
      <div className="relative flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
          {!isGuest ? (
            <Link to="/projects" className="flex items-center gap-3">
              <img 
                src={v4LogoFull} 
                alt="V4 Company" 
                className={cn(
                  "transition-all",
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
                  "transition-all",
                  collapsed ? "h-8 w-auto" : "h-10 w-auto"
                )}
              />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="flex-shrink-0 hover:bg-primary/10"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>

        {/* Project Selector */}
        {selectedProject && !collapsed && (
          <div className="px-3 py-3 border-b border-sidebar-border" data-tour="project-selector">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center justify-between p-3 rounded-lg bg-sidebar-accent hover:bg-sidebar-accent/80 transition-colors">
                  <div className="text-left">
                    <p className="text-xs text-muted-foreground">Projeto</p>
                    <p className="font-medium truncate">{selectedProject.name}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 bg-popover">
                {projects.filter(p => !p.archived).map((project) => (
                  <DropdownMenuItem 
                    key={project.id}
                    onClick={() => handleChangeProject(project.id)}
                    className={project.id === selectedProject.id ? 'bg-primary/10' : ''}
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
                  <DropdownMenuItem onClick={() => navigate('/projects')} className="border-t mt-1 pt-2">
                    <FolderKanban className="w-4 h-4 mr-2" />
                    Gerenciar Projetos
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Sync Status Badge */}
            <div className="mt-2 px-1">
              <SyncStatusBadge projectId={selectedProject.id} />
            </div>
          </div>
        )}

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
                          <div key={campaign.id}>
                            <button
                              onClick={() => toggleCampaignExpand(campaign.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 pl-8 text-sm hover:bg-sidebar-accent rounded-lg transition-colors"
                            >
                              <span className={cn('w-2 h-2 rounded-full flex-shrink-0', getStatusColor(campaign.status))} />
                              <span className="truncate flex-1 text-left">{campaign.name}</span>
                              {campaignAdSets.length > 0 && (
                                isExpanded ? (
                                  <ChevronUp className="w-3 h-3 flex-shrink-0" />
                                ) : (
                                  <ChevronDown className="w-3 h-3 flex-shrink-0" />
                                )
                              )}
                            </button>
                            
                            {/* Ad Sets */}
                            {isExpanded && campaignAdSets.length > 0 && (
                              <div className="ml-6 border-l border-sidebar-border">
                                {campaignAdSets.map((adSet) => (
                                  <Link
                                    key={adSet.id}
                                    to={`/adset/${adSet.id}`}
                                    className="flex items-center gap-2 px-3 py-1.5 pl-4 text-xs hover:bg-sidebar-accent rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                                  >
                                    <Layers className="w-3 h-3 flex-shrink-0" />
                                    <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', getStatusColor(adSet.status))} />
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

            {/* Google Ads Campaigns */}
            <Link
              to="/google-campaigns"
              className={cn(
                'sidebar-item',
                location.pathname === '/google-campaigns' && 'active'
              )}
            >
              <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </div>
              {!collapsed && <span>Google Ads</span>}
            </Link>

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

            {/* Agente Lisboa - Hidden for guests, hidden while loading */}
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
                <Compass className="w-5 h-5 flex-shrink-0 transition-transform duration-300 group-hover:rotate-45" />
                {!collapsed && <span>Ver Tour</span>}
              </button>
            )}
          </div>

          {/* Spacer to push admin/settings to bottom */}
          <div className="flex-1" />

          {/* Admin & Settings at bottom - Hidden for guests, hidden while loading role */}
          {!roleLoading && !isGuest && (
            <div className="space-y-1 mt-4">
              {/* Invite Guest Button */}
              <button
                onClick={() => setInviteDialogOpen(true)}
                className="sidebar-item w-full"
              >
                <UserPlus className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>Convidar Cliente</span>}
              </button>

              {/* WhatsApp */}
              <Link
                to="/whatsapp"
                className={cn(
                  'sidebar-item',
                  location.pathname === '/whatsapp' && 'active'
                )}
              >
                <MessageSquare className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>WhatsApp</span>}
              </Link>

              {/* Admin */}
              <Link
                to="/admin"
                className={cn(
                  'sidebar-item',
                  location.pathname === '/admin' && 'active'
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
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-sidebar-border">
          <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
            <Avatar className="w-10 h-10 ring-2 ring-primary/20 shadow-lg shadow-primary/30">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground font-bold">
                {profile?.full_name?.[0]?.toUpperCase() || user?.email?.[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {profile?.full_name || 'Investidor'}
                </p>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className={cn('mt-4 w-full hover:bg-primary/10 hover:text-primary transition-colors', collapsed ? 'px-0' : '')}
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span className="ml-2">Sair</span>}
          </Button>
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