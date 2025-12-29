import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import { useMetaAdsData } from '@/hooks/useMetaAdsData';
import { 
  BarChart3, 
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
  History,
  Database
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [campaignsOpen, setCampaignsOpen] = useState(true);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Record<string, boolean>>({});
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { projects } = useProjects();
  const { campaigns, adSets } = useMetaAdsData();
  
  const selectedProjectId = localStorage.getItem('selectedProjectId');
  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0];

  // Sort campaigns: active first, then by spend
  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => {
      const statusOrder: Record<string, number> = { 'ACTIVE': 0, 'PAUSED': 1 };
      const orderA = statusOrder[a.status] ?? 2;
      const orderB = statusOrder[b.status] ?? 2;
      if (orderA !== orderB) return orderA - orderB;
      return (b.spend || 0) - (a.spend || 0);
    });
  }, [campaigns]);

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

  const getCampaignAdSets = (campaignId: string) => {
    return adSets
      .filter(a => a.campaign_id === campaignId)
      .sort((a, b) => {
        const statusOrder: Record<string, number> = { 'ACTIVE': 0, 'PAUSED': 1 };
        const orderA = statusOrder[a.status] ?? 2;
        const orderB = statusOrder[b.status] ?? 2;
        if (orderA !== orderB) return orderA - orderB;
        return (b.spend || 0) - (a.spend || 0);
      });
  };

  const getStatusColor = (status: string) => {
    if (status === 'ACTIVE') return 'bg-metric-positive';
    if (status === 'PAUSED') return 'bg-metric-warning';
    return 'bg-muted';
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300',
        collapsed ? 'w-20' : 'w-72'
      )}
    >
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
          <Link to="/projects" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20">
              <span className="text-lg font-black text-primary-foreground">V4</span>
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-bold leading-tight">V4 Company</span>
                <span className="text-xs text-muted-foreground leading-tight">Lisboa & Co</span>
              </div>
            )}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="flex-shrink-0"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>

        {/* Project Selector */}
        {selectedProject && !collapsed && (
          <div className="px-3 py-3 border-b border-sidebar-border">
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
                      <p className="text-xs text-muted-foreground">
                        ID: {project.ad_account_id.replace('act_', '')}
                      </p>
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem onClick={() => navigate('/projects')} className="border-t mt-1 pt-2">
                  <FolderKanban className="w-4 h-4 mr-2" />
                  Gerenciar Projetos
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Sync Status Badge */}
            <div className="mt-2 px-1">
              <SyncStatusBadge projectId={selectedProject.id} />
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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
            <Collapsible open={campaignsOpen} onOpenChange={setCampaignsOpen}>
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
                
                {/* Campaign list */}
                <div className="max-h-[300px] overflow-y-auto">
                  {sortedCampaigns.slice(0, 10).map((campaign) => {
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
                  })}
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
            className={cn(
              'sidebar-item',
              location.pathname === '/creatives' && 'active'
            )}
          >
            <ImageIcon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Criativos</span>}
          </Link>

          {/* Sync History */}
          <Link
            to="/sync-history"
            className={cn(
              'sidebar-item',
              location.pathname === '/sync-history' && 'active'
            )}
          >
            <History className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Histórico Sync</span>}
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
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-sidebar-border">
          <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/20">
              <span className="text-sm font-bold text-primary-foreground">
                {user?.email?.[0].toUpperCase()}
              </span>
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.email}</p>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className={cn('mt-4 w-full', collapsed ? 'px-0' : '')}
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span className="ml-2">Sair</span>}
          </Button>
        </div>
      </div>
    </aside>
  );
}