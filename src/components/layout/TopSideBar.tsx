import { useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
}

export default function TopSideBar({ onNavigate }: TopSideBarProps) {
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

  // Conditional nav items
  const conditionalItems = [];
  if (!roleLoading && !cargoLoading && !isGuest && !isTabHidden('financial')) {
    conditionalItems.push({ to: '/financeiro', label: t('sidebar.financial'), icon: DollarSign, match: '/financeiro' });
  }
  if (selectedProject && !isTabHidden('suggestions')) {
    conditionalItems.push({ to: '/optimization-history', label: t('sidebar.history'), icon: History, match: '/optimization-history' });
  }

  const isActive = (match: string) => location.pathname.includes(match) || location.pathname === match;

  return (
    <>
      <nav className="flex flex-col h-full sidebar-container">
        {/* Logo */}
        <div className="flex items-center h-14 px-4 border-b border-sidebar-border flex-shrink-0">
          <Link to={isGuest ? '/dashboard' : '/projects'} className="flex items-center" onClick={() => onNavigate?.()}>
            <img
              src={v4LogoFull}
              alt="V4 Company"
              className="h-8 w-auto dark:brightness-0 dark:invert transition-all duration-300"
            />
          </Link>
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

        <div className="sidebar-divider mx-3" />

        {/* Navigation Links */}
        <div className="flex-1 px-3 py-2 overflow-y-auto">
          <div className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.to}
                onClick={() => handleNavClick(item.to)}
                className={cn(
                  'sidebar-item w-full',
                  isActive(item.match) && 'active'
                )}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
              </button>
            ))}

            {/* AI Agent - disabled */}
            {!roleLoading && !isGuest && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="sidebar-item opacity-50 cursor-not-allowed">
                      <Bot className="w-5 h-5 flex-shrink-0" />
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
                    <div className="sidebar-item opacity-50 cursor-not-allowed">
                      <TrendingUp className="w-5 h-5 flex-shrink-0" />
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
                  'sidebar-item w-full',
                  isActive(item.match) && 'active'
                )}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
              </button>
            ))}

            {/* Tour for guests */}
            {!roleLoading && isGuest && (
              <button
                onClick={() => {
                  navigate('/dashboard');
                  onNavigate?.();
                }}
                className="sidebar-item w-full"
              >
                <Compass className="w-5 h-5 flex-shrink-0" />
                <span>{t('sidebar.viewTour')}</span>
              </button>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />
        </div>

        {/* Bottom Section */}
        {!roleLoading && !cargoLoading && !isGuest && (
          <div className="px-3 py-2 border-t border-sidebar-border flex-shrink-0">
            <div className="space-y-1">
              {/* Admin */}
              {!isTabHidden('admin') && (
                needsAdminApproval ? (
                  <button
                    onClick={() => setAdminAccessModalOpen(true)}
                    className={cn('sidebar-item w-full', isActive('/admin') && 'active')}
                  >
                    <Database className="w-5 h-5 flex-shrink-0" />
                    <div className="flex items-center gap-2">
                      <span>{t('sidebar.administration')}</span>
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                    </div>
                  </button>
                ) : (
                  <button
                    onClick={() => handleNavClick(selectedProject ? `/project/${selectedProject.id}/admin` : '/admin')}
                    className={cn('sidebar-item w-full', isActive('/admin') && 'active')}
                  >
                    <Database className="w-5 h-5 flex-shrink-0" />
                    <span>{t('sidebar.administration')}</span>
                  </button>
                )
              )}

              {/* Suggestions */}
              {!isTabHidden('suggestions') && (
                <button
                  onClick={() => handleNavClick('/suggestions')}
                  className={cn('sidebar-item w-full', isActive('/suggestions') && 'active')}
                >
                  <Lightbulb className="w-5 h-5 flex-shrink-0" />
                  <span>{t('sidebar.suggestions')}</span>
                </button>
              )}

              {/* Settings */}
              {!isTabHidden('settings') && (
                <button
                  onClick={() => handleNavClick('/settings')}
                  className={cn('sidebar-item w-full', isActive('/settings') && 'active')}
                >
                  <Settings className="w-5 h-5 flex-shrink-0" />
                  <span>{t('sidebar.settings')}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Guest settings */}
        {!roleLoading && isGuest && (
          <div className="px-3 py-2 border-t border-sidebar-border flex-shrink-0 space-y-1">
            <button onClick={toggleTheme} className="sidebar-item w-full">
              {theme === 'dark' ? <Sun className="w-5 h-5 flex-shrink-0" /> : <Moon className="w-5 h-5 flex-shrink-0" />}
              <span>{theme === 'dark' ? t('settings.lightTheme') : t('settings.darkTheme')}</span>
            </button>
            <button onClick={() => handleNavClick('/settings')} className="sidebar-item w-full">
              <User className="w-5 h-5 flex-shrink-0" />
              <span>{t('projectSelector.editProfile')}</span>
            </button>
            <button onClick={() => handleNavClick('/change-password')} className="sidebar-item w-full">
              <KeyRound className="w-5 h-5 flex-shrink-0" />
              <span>{t('projectSelector.changePassword')}</span>
            </button>
            <button onClick={handleSignOut} className="sidebar-item w-full text-destructive hover:bg-destructive/10">
              <LogOut className="w-5 h-5 flex-shrink-0" />
              <span>{t('navigation.logout')}</span>
            </button>
          </div>
        )}

        {/* User Profile */}
        <div className="p-4 border-t border-sidebar-border bg-sidebar-accent/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Avatar className="w-9 h-9 ring-2 ring-primary/20">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-sm">
                {profile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-foreground">
                {profile?.full_name || 'Usuário'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
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
