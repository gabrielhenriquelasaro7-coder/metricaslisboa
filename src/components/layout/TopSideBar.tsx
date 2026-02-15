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
import v4LogoIcon from '@/assets/v4-logo-icon.png';
import whatsappIcon from '@/assets/whatsapp-icon.png';
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
  KeyRound,
  MessageCircle,
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

  const isActive = (match: string) => location.pathname.includes(match) || location.pathname === match;

  // Build nav items
  const mainNavItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, match: '/dashboard' },
    { to: '/campaigns', label: t('sidebar.campaigns'), icon: Megaphone, match: '/campaign' },
    { to: '/creatives', label: t('sidebar.creatives'), icon: ImageIcon, match: '/creatives' },
  ];

  const conditionalItems: typeof mainNavItems = [];
  if (!roleLoading && !cargoLoading && !isGuest && !isTabHidden('financial')) {
    conditionalItems.push({ to: '/financeiro', label: t('sidebar.financial'), icon: DollarSign, match: '/financeiro' });
  }
  if (selectedProject && !isTabHidden('suggestions')) {
    conditionalItems.push({ to: '/optimization-history', label: t('sidebar.history'), icon: History, match: '/optimization-history' });
  }

  // WhatsApp nav
  const showWhatsApp = !roleLoading && !isGuest;

  // System items
  const systemItems: typeof mainNavItems = [];
  if (!roleLoading && !cargoLoading && !isGuest) {
    if (!isTabHidden('suggestions')) {
      systemItems.push({ to: '/suggestions', label: t('sidebar.suggestions'), icon: Lightbulb, match: '/suggestions' });
    }
    if (!isTabHidden('settings')) {
      systemItems.push({ to: '/settings', label: t('sidebar.settings'), icon: Settings, match: '/settings' });
    }
  }

  return (
    <>
      <nav className="flex flex-col h-full w-full bg-sidebar border-r border-sidebar-border items-center">
        {/* Logo */}
        <div className="flex items-center justify-center h-14 w-full flex-shrink-0 border-b border-sidebar-border">
          <button onClick={() => handleNavClick('/dashboard')} className="p-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors">
            <img src={v4LogoIcon} alt="V4" className="h-7 w-7 object-contain dark:brightness-0 dark:invert" />
          </button>
        </div>

        {/* Main Nav Icons */}
        <div className="flex-1 py-3 w-full overflow-y-auto">
          <div className="flex flex-col items-center gap-1 px-2">
            <TooltipProvider delayDuration={0}>
              {mainNavItems.map((item) => (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleNavClick(item.to)}
                      className={cn(
                        'sidebar-icon-btn',
                        isActive(item.match) && 'active'
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-popover border-border z-[60]">
                    <p>{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              ))}

              {/* Disabled items */}
              {!roleLoading && !isGuest && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="sidebar-icon-btn opacity-30 cursor-not-allowed">
                        <Bot className="w-5 h-5" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-popover border-border z-[60]">
                      <p>{t('sidebar.maintenanceMessage')}</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="sidebar-icon-btn opacity-30 cursor-not-allowed">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-popover border-border z-[60]">
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
                        'sidebar-icon-btn',
                        isActive(item.match) && 'active'
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-popover border-border z-[60]">
                    <p>{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              ))}

              {/* WhatsApp */}
              {showWhatsApp && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleNavClick('/whatsapp')}
                      className={cn(
                        'sidebar-icon-btn',
                        isActive('/whatsapp') && 'active'
                      )}
                    >
                      <img src={whatsappIcon} alt="WhatsApp" className="w-5 h-5 object-contain" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-popover border-border z-[60]">
                    <p>WhatsApp</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Guest tour */}
              {!roleLoading && isGuest && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => { handleNavClick('/dashboard'); }}
                      className="sidebar-icon-btn"
                    >
                      <Compass className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-popover border-border z-[60]">
                    <p>{t('sidebar.viewTour')}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          </div>
        </div>

        {/* Bottom Section - System */}
        <div className="py-2 w-full border-t border-sidebar-border flex-shrink-0">
          <div className="flex flex-col items-center gap-1 px-2">
            <TooltipProvider delayDuration={0}>
              {/* Admin */}
              {!roleLoading && !cargoLoading && !isGuest && !isTabHidden('admin') && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => needsAdminApproval ? setAdminAccessModalOpen(true) : handleNavClick(selectedProject ? `/project/${selectedProject.id}/admin` : '/admin')}
                      className={cn(
                        'sidebar-icon-btn',
                        isActive('/admin') && 'active'
                      )}
                    >
                      <Database className="w-5 h-5" />
                      {needsAdminApproval && (
                        <span className="absolute top-1 right-1 w-2 h-2 bg-warning rounded-full" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-popover border-border z-[60]">
                    <p>{t('sidebar.administration')}</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {systemItems.map((item) => (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleNavClick(item.to)}
                      className={cn(
                        'sidebar-icon-btn',
                        isActive(item.match) && 'active'
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-popover border-border z-[60]">
                    <p>{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              ))}

              {/* Theme toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={toggleTheme} className="sidebar-icon-btn">
                    {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-popover border-border z-[60]">
                  <p>{theme === 'dark' ? t('settings.lightTheme') : t('settings.darkTheme')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Avatar at bottom */}
        <div className="p-2 border-t border-sidebar-border bg-sidebar-accent/30 flex-shrink-0 w-full flex justify-center">
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
            <DropdownMenuContent align="end" side="right" className="w-52 bg-popover border-border z-[60]">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-sm font-medium text-foreground truncate">{profile?.full_name || 'Usuário'}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
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
