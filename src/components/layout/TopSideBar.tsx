import { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import { useProfile } from '@/hooks/useProfile';
import { useUserRole } from '@/hooks/useUserRole';
import { useCargo } from '@/hooks/useCargo';
import { useTabVisibility } from '@/hooks/useTabVisibility';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import v4LogoFull from '@/assets/v4-logo-full.png';
import v4LogoIcon from '@/assets/v4-logo-icon.png';
import {
  LayoutDashboard,
  Megaphone,
  ImageIcon,
  Bot,
  Lock,
  TrendingUp,
  History,
  DollarSign,
  Settings,
  LogOut,
  Database,
  Lightbulb,
  AlertTriangle,
  Compass,
  Sun,
  Moon,
  User,
  KeyRound,
  ChevronDown,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ClientSelector } from './ClientSelector';
import { SyncStatusBadge } from '@/components/sync/SyncStatusBadge';
import { AdminAccessRequestModal } from '@/components/admin/AdminAccessRequestModal';

interface TopSideBarProps {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function TopSideBar({ onNavigate, collapsed = false, onToggleCollapse }: TopSideBarProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { projects } = useProjects();
  const { profile } = useProfile();
  const { isGuest, loading: roleLoading } = useUserRole();
  const { needsAdminApproval, loading: cargoLoading } = useCargo();
  const { theme, toggleTheme } = useTheme();
  const { isTabHidden, loading: tabVisibilityLoading } = useTabVisibility();
  const [adminAccessModalOpen, setAdminAccessModalOpen] = useState(false);

  const selectedProjectId = localStorage.getItem('selectedProjectId');
  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return projects.find(p => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleNavClick = (to: string) => {
    navigate(to);
    onNavigate?.();
  };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, match: '/dashboard' },
    { to: '/campaigns', label: t('sidebar.campaigns'), icon: Megaphone, match: '/campaign' },
    { to: '/creatives', label: t('sidebar.creatives'), icon: ImageIcon, match: '/creatives' },
  ];

  const conditionalItems: typeof navItems = [];
  if (!roleLoading && !cargoLoading && !isGuest && !isTabHidden('financial')) {
    conditionalItems.push({ to: '/financeiro', label: t('sidebar.financial'), icon: DollarSign, match: '/financeiro' });
  }
  if (selectedProject && !isTabHidden('suggestions')) {
    conditionalItems.push({ to: '/optimization-history', label: t('sidebar.history'), icon: History, match: '/optimization-history' });
  }

  const isActive = (match: string) => location.pathname.includes(match) || location.pathname === match;

  // Collapsed sidebar
  if (collapsed) {
    return (
      <>
        <nav className="flex flex-col h-full sidebar-container items-center">
          {/* Logo */}
          <div className="flex items-center justify-center h-14 border-b border-sidebar-border w-full flex-shrink-0">
            <button onClick={() => handleNavClick(isGuest ? '/dashboard' : '/dashboard')} className="sidebar-logo">
              <img src={v4LogoIcon} alt="V4" className="h-7 w-auto dark:brightness-0 dark:invert" />
            </button>
          </div>

          {/* Client Selector (collapsed) */}
          <div className="py-3 border-b border-sidebar-border w-full flex justify-center flex-shrink-0">
            <ClientSelector collapsed onSelect={onNavigate} />
          </div>

          {/* Nav icons */}
          <div className="flex-1 py-3 overflow-y-auto w-full">
            <div className="flex flex-col items-center gap-1">
              <TooltipProvider delayDuration={0}>
                {navItems.map((item) => (
                  <Tooltip key={item.to}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleNavClick(item.to)}
                        className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground transition-all duration-200',
                          'hover:text-foreground hover:bg-foreground/5',
                          isActive(item.match) && 'text-foreground bg-primary/10 sidebar-collapsed-active'
                        )}
                      >
                        <item.icon className={cn('w-5 h-5', isActive(item.match) && 'text-primary')} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-popover border-border">
                      <p>{item.label}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}

                {/* Disabled items */}
                {!roleLoading && !isGuest && (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground/40 cursor-not-allowed">
                          <Bot className="w-5 h-5" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="bg-popover border-border">
                        <p>{t('sidebar.maintenanceMessage')}</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground/40 cursor-not-allowed">
                          <TrendingUp className="w-5 h-5" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="bg-popover border-border">
                        <p>{t('sidebar.maintenanceMessage')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </>
                )}

                {conditionalItems.map((item) => (
                  <Tooltip key={item.to}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleNavClick(item.to)}
                        className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground transition-all duration-200',
                          'hover:text-foreground hover:bg-foreground/5',
                          isActive(item.match) && 'text-foreground bg-primary/10'
                        )}
                      >
                        <item.icon className={cn('w-5 h-5', isActive(item.match) && 'text-primary')} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-popover border-border">
                      <p>{item.label}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </TooltipProvider>
            </div>
          </div>

          {/* Bottom icons */}
          {!roleLoading && !cargoLoading && !isGuest && (
            <div className="py-2 border-t border-sidebar-border w-full flex-shrink-0">
              <div className="flex flex-col items-center gap-1">
                <TooltipProvider delayDuration={0}>
                  {!isTabHidden('admin') && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => needsAdminApproval ? setAdminAccessModalOpen(true) : handleNavClick(selectedProject ? `/project/${selectedProject.id}/admin` : '/admin')}
                          className={cn(
                            'w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground transition-all',
                            'hover:text-foreground hover:bg-foreground/5',
                            isActive('/admin') && 'text-foreground bg-primary/10'
                          )}
                        >
                          <Database className={cn('w-5 h-5', isActive('/admin') && 'text-primary')} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="bg-popover border-border">
                        <p>{t('sidebar.administration')}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {!isTabHidden('settings') && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleNavClick('/settings')}
                          className={cn(
                            'w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground transition-all',
                            'hover:text-foreground hover:bg-foreground/5',
                            isActive('/settings') && 'text-foreground bg-primary/10'
                          )}
                        >
                          <Settings className={cn('w-5 h-5', isActive('/settings') && 'text-primary')} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="bg-popover border-border">
                        <p>{t('sidebar.settings')}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </TooltipProvider>
              </div>
            </div>
          )}

          {/* Collapse toggle */}
          {onToggleCollapse && (
            <div className="py-2 border-t border-sidebar-border w-full flex justify-center flex-shrink-0">
              <button onClick={onToggleCollapse} className="sidebar-collapse-btn">
                <PanelLeft className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Avatar */}
          <div className="p-3 border-t border-sidebar-border bg-sidebar-accent/50 flex-shrink-0 w-full flex justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="focus:outline-none">
                  <Avatar className="w-9 h-9 ring-2 ring-primary/20 hover:ring-primary/40 transition-all cursor-pointer">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground font-bold text-sm">
                      {profile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="right" className="w-48 bg-popover border-border">
                <DropdownMenuItem onClick={toggleTheme} className="gap-2 cursor-pointer">
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  {theme === 'dark' ? t('settings.lightTheme') : t('settings.darkTheme')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavClick('/change-password')} className="gap-2 cursor-pointer">
                  <KeyRound className="w-4 h-4" />
                  {t('projectSelector.changePassword')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4" />
                  {t('navigation.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>

        <AdminAccessRequestModal
          open={adminAccessModalOpen}
          onOpenChange={setAdminAccessModalOpen}
          projectId={selectedProject?.id}
          projectName={selectedProject?.name}
        />
      </>
    );
  }

  // Expanded sidebar
  return (
    <>
      <nav className="flex flex-col h-full sidebar-container">
        {/* Logo + Collapse */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-sidebar-border flex-shrink-0">
          <button onClick={() => handleNavClick(isGuest ? '/dashboard' : '/dashboard')} className="flex items-center sidebar-logo">
            <img
              src={v4LogoFull}
              alt="V4 Company"
              className="h-7 w-auto dark:brightness-0 dark:invert transition-all duration-300"
            />
          </button>
          {onToggleCollapse && (
            <button onClick={onToggleCollapse} className="sidebar-collapse-btn">
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Client Selector */}
        <div className="px-3 py-3 border-b border-sidebar-border flex-shrink-0">
          <ClientSelector onSelect={onNavigate} />
          {selectedProject && (
            <div className="mt-2 px-1">
              <SyncStatusBadge projectId={selectedProject.id} />
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <div className="flex-1 px-3 py-3 overflow-y-auto">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-4 mb-2">
            {t('sidebar.campaigns') ? 'Menu' : 'Menu'}
          </p>
          <div className="space-y-0.5">
            {navItems.map((item) => (
              <button
                key={item.to}
                onClick={() => handleNavClick(item.to)}
                className={cn(
                  'sidebar-item w-full text-sm',
                  isActive(item.match) && 'active'
                )}
              >
                <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                <span>{item.label}</span>
              </button>
            ))}

            {/* AI Agent - disabled */}
            {!roleLoading && !isGuest && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="sidebar-item opacity-40 cursor-not-allowed text-sm">
                      <Bot className="w-[18px] h-[18px] flex-shrink-0" />
                      <div className="flex items-center gap-2">
                        <span>{t('sidebar.aiAgent')}</span>
                        <Lock className="w-3 h-3 text-muted-foreground" />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-popover border-border">
                    <p>{t('sidebar.maintenanceMessage')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Predictive - disabled */}
            {!roleLoading && !isGuest && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="sidebar-item opacity-40 cursor-not-allowed text-sm">
                      <TrendingUp className="w-[18px] h-[18px] flex-shrink-0" />
                      <div className="flex items-center gap-2">
                        <span>{t('sidebar.predictiveAnalysis')}</span>
                        <Lock className="w-3 h-3 text-muted-foreground" />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-popover border-border">
                    <p>{t('sidebar.maintenanceMessage')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {conditionalItems.map((item) => (
              <button
                key={item.to}
                onClick={() => handleNavClick(item.to)}
                className={cn(
                  'sidebar-item w-full text-sm',
                  isActive(item.match) && 'active'
                )}
              >
                <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                <span>{item.label}</span>
              </button>
            ))}

            {/* Tour for guests */}
            {!roleLoading && isGuest && (
              <button
                onClick={() => { navigate('/dashboard'); onNavigate?.(); }}
                className="sidebar-item w-full text-sm"
              >
                <Compass className="w-[18px] h-[18px] flex-shrink-0" />
                <span>{t('sidebar.viewTour')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Bottom Section */}
        {!roleLoading && !cargoLoading && !isGuest && (
          <div className="px-3 py-2 border-t border-sidebar-border flex-shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-4 mb-2">
              Sistema
            </p>
            <div className="space-y-0.5">
              {!isTabHidden('admin') && (
                needsAdminApproval ? (
                  <button
                    onClick={() => setAdminAccessModalOpen(true)}
                    className={cn('sidebar-item w-full text-sm', isActive('/admin') && 'active')}
                  >
                    <Database className="w-[18px] h-[18px] flex-shrink-0" />
                    <div className="flex items-center gap-2">
                      <span>{t('sidebar.administration')}</span>
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                    </div>
                  </button>
                ) : (
                  <button
                    onClick={() => handleNavClick(selectedProject ? `/project/${selectedProject.id}/admin` : '/admin')}
                    className={cn('sidebar-item w-full text-sm', isActive('/admin') && 'active')}
                  >
                    <Database className="w-[18px] h-[18px] flex-shrink-0" />
                    <span>{t('sidebar.administration')}</span>
                  </button>
                )
              )}

              {!isTabHidden('suggestions') && (
                <button
                  onClick={() => handleNavClick('/suggestions')}
                  className={cn('sidebar-item w-full text-sm', isActive('/suggestions') && 'active')}
                >
                  <Lightbulb className="w-[18px] h-[18px] flex-shrink-0" />
                  <span>{t('sidebar.suggestions')}</span>
                </button>
              )}

              {!isTabHidden('settings') && (
                <button
                  onClick={() => handleNavClick('/settings')}
                  className={cn('sidebar-item w-full text-sm', isActive('/settings') && 'active')}
                >
                  <Settings className="w-[18px] h-[18px] flex-shrink-0" />
                  <span>{t('sidebar.settings')}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Guest settings */}
        {!roleLoading && isGuest && (
          <div className="px-3 py-2 border-t border-sidebar-border flex-shrink-0 space-y-0.5">
            <button onClick={toggleTheme} className="sidebar-item w-full text-sm">
              {theme === 'dark' ? <Sun className="w-[18px] h-[18px] flex-shrink-0" /> : <Moon className="w-[18px] h-[18px] flex-shrink-0" />}
              <span>{theme === 'dark' ? t('settings.lightTheme') : t('settings.darkTheme')}</span>
            </button>
            <button onClick={() => handleNavClick('/settings')} className="sidebar-item w-full text-sm">
              <User className="w-[18px] h-[18px] flex-shrink-0" />
              <span>{t('projectSelector.editProfile')}</span>
            </button>
            <button onClick={() => handleNavClick('/change-password')} className="sidebar-item w-full text-sm">
              <KeyRound className="w-[18px] h-[18px] flex-shrink-0" />
              <span>{t('projectSelector.changePassword')}</span>
            </button>
            <button onClick={handleSignOut} className="sidebar-item w-full text-sm text-destructive hover:bg-destructive/10">
              <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
              <span>{t('navigation.logout')}</span>
            </button>
          </div>
        )}

        {/* User Profile */}
        <div className="p-3 border-t border-sidebar-border bg-sidebar-accent/30 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8 ring-2 ring-primary/20">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs">
                {profile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-foreground leading-tight">
                {profile?.full_name || 'Usuário'}
              </p>
              <p className="text-[11px] text-muted-foreground truncate leading-tight">
                {user?.email}
              </p>
            </div>
            {!isGuest && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="w-48 bg-popover border-border">
                  <DropdownMenuItem onClick={toggleTheme} className="gap-2 cursor-pointer">
                    {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    {theme === 'dark' ? t('settings.lightTheme') : t('settings.darkTheme')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleNavClick('/change-password')} className="gap-2 cursor-pointer">
                    <KeyRound className="w-4 h-4" />
                    {t('projectSelector.changePassword')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="w-4 h-4" />
                    {t('navigation.logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </nav>

      {/* Admin Access Modal */}
      <AdminAccessRequestModal
        open={adminAccessModalOpen}
        onOpenChange={setAdminAccessModalOpen}
        projectId={selectedProject?.id}
        projectName={selectedProject?.name}
      />
    </>
  );
}
