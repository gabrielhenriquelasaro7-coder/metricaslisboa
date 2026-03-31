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
import googleAdsIcon from '@/assets/google-ads-icon.png';
import metaIcon from '@/assets/meta-icon.png';
import ga4Icon from '@/assets/ga4-icon.png';
import clarityIcon from '@/assets/clarity-icon.png';
import instagramIcon from '@/assets/instagram-icon.png';
import {
  Home,
  ImageIcon,
  History,
  DollarSign,
  Settings,
  LogOut,
  Lightbulb,
  Sun,
  Moon,
  KeyRound,
  Shield,
  Share2,
  FileText,
  Search,
  Activity,
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
import { Separator } from '@/components/ui/separator';
import { AdminAccessRequestModal } from '@/components/admin/AdminAccessRequestModal';
import { InviteGuestDialog } from '@/components/guests/InviteGuestDialog';

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
  const { needsAdminApproval, isTech, isMaster, loading: cargoLoading } = useCargo();
  const canSeeAnalytics = isTech || isMaster;
  const { theme, toggleTheme } = useTheme();
  const { isTabHidden } = useTabVisibility();
  const [adminAccessModalOpen, setAdminAccessModalOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

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

  const isActive = (match: string) => location.pathname === match || location.pathname.startsWith(match + '/');
  const isActiveExact = (match: string) => location.pathname === match;

  const showWhatsApp = !roleLoading && !isGuest;
  const showShare = !roleLoading && !isGuest;
  const showClarity = !roleLoading && !isGuest;
  const showDiagnostico = !roleLoading && !cargoLoading && (isTech || isMaster);

  return (
    <>
      <nav className="flex flex-col h-full w-full bg-sidebar items-center">
        {/* Logo */}
        <div className="flex items-center justify-center h-14 w-full flex-shrink-0">
          <button onClick={() => handleNavClick('/dashboard')} className="p-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors">
            <img src={v4LogoIcon} alt="V4" className="h-7 w-7 object-contain dark:brightness-0 dark:invert" />
          </button>
        </div>

        <Separator className="w-8 bg-sidebar-border" />

        {/* Main Nav Icons */}
        <div className="flex-1 py-3 w-full overflow-y-auto">
          <div className="flex flex-col items-center gap-1.5 px-2">
            <TooltipProvider delayDuration={0}>
              {/* Diagnóstico TOC + LTP */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleNavClick('/diagnostico')}
                    className={cn('sidebar-icon-btn', isActive('/diagnostico') && 'active')}
                  >
                    <Activity className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-popover border-border z-[60]">
                  <p>Diagnóstico</p>
                </TooltipContent>
              </Tooltip>

              {/* Home */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleNavClick('/dashboard')}
                    className={cn('sidebar-icon-btn', isActiveExact('/dashboard') && 'active')}
                  >
                    <Home className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-popover border-border z-[60]">
                  <p>Home</p>
                </TooltipContent>
              </Tooltip>

              {/* Meta Ads */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleNavClick('/meta-ads')}
                    className={cn('sidebar-icon-btn', (isActive('/meta-ads') || isActive('/campaign') || isActive('/adset') || isActive('/ad')) && 'active')}
                  >
                    <img src={metaIcon} alt="Meta Ads" className="w-5 h-5 object-contain" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-popover border-border z-[60]">
                  <p>Meta Ads</p>
                </TooltipContent>
              </Tooltip>

              {/* Google Ads */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleNavClick('/google-campaigns')}
                    className={cn('sidebar-icon-btn', isActive('/google-campaigns') && 'active')}
                  >
                    <img src={googleAdsIcon} alt="Google Ads" className="w-5 h-5 object-contain" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-popover border-border z-[60]">
                  <p>Google Ads</p>
                </TooltipContent>
              </Tooltip>

              {/* GA4 */}
              {!isTabHidden('analytics') && canSeeAnalytics && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleNavClick('/analytics')}
                      className={cn('sidebar-icon-btn', isActive('/analytics') && 'active')}
                    >
                      <img src={ga4Icon} alt="GA4" className="w-5 h-5 object-contain" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-popover border-border z-[60]">
                    <p>Google Analytics</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Instagram */}
              {!isTabHidden('instagram') && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleNavClick('/instagram')}
                      className={cn('sidebar-icon-btn', isActive('/instagram') && 'active')}
                    >
                      <img src={instagramIcon} alt="Instagram" className="w-5 h-5 object-contain" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-popover border-border z-[60]">
                    <p>Instagram</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Creatives */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleNavClick('/creatives')}
                    className={cn('sidebar-icon-btn', isActive('/creatives') && 'active')}
                  >
                    <ImageIcon className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-popover border-border z-[60]">
                  <p>{t('sidebar.creatives')}</p>
                </TooltipContent>
              </Tooltip>

              {/* Financial */}
              {!roleLoading && !cargoLoading && !isGuest && !isTabHidden('financial') && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleNavClick('/financeiro')}
                      className={cn('sidebar-icon-btn', isActive('/financeiro') && 'active')}
                    >
                      <DollarSign className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-popover border-border z-[60]">
                    <p>{t('sidebar.financial')}</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* History */}
              {selectedProject && !isTabHidden('suggestions') && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleNavClick('/optimization-history')}
                      className={cn('sidebar-icon-btn', isActive('/optimization-history') && 'active')}
                    >
                      <History className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-popover border-border z-[60]">
                    <p>{t('sidebar.history')}</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Separator before tools */}
              <div className="w-8 mx-auto my-1">
                <Separator className="bg-sidebar-border" />
              </div>

              {/* Share - Compartilhamento */}
              {showShare && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShareDialogOpen(true)}
                      className={cn('sidebar-icon-btn')}
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-popover border-border z-[60]">
                    <p>Compartilhar</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Clarity - LP Analysis */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleNavClick('/clarity')}
                    className={cn('sidebar-icon-btn', isActive('/clarity') && 'active')}
                  >
                    <img src={clarityIcon} alt="Clarity" className="w-5 h-5 object-contain" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-popover border-border z-[60]">
                  <p>Clarity</p>
                </TooltipContent>
              </Tooltip>

              {/* Separator before WhatsApp */}
              {showWhatsApp && (
                <div className="w-8 mx-auto my-1">
                  <Separator className="bg-sidebar-border" />
                </div>
              )}

              {/* WhatsApp */}
              {showWhatsApp && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleNavClick('/whatsapp')}
                      className={cn('sidebar-icon-btn', isActive('/whatsapp') && 'active')}
                    >
                      <img src={whatsappIcon} alt="WhatsApp" className="w-5 h-5 object-contain" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-popover border-border z-[60]">
                    <p>WhatsApp</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="py-2 w-full flex-shrink-0">
          <Separator className="w-8 mx-auto bg-sidebar-border mb-2" />
          <div className="flex flex-col items-center gap-1.5 px-2">
            <TooltipProvider delayDuration={0}>
              {/* Suggestions */}
              {!roleLoading && !cargoLoading && !isGuest && !isTabHidden('suggestions') && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleNavClick('/suggestions')}
                      className={cn('sidebar-icon-btn', isActive('/suggestions') && 'active')}
                    >
                      <Lightbulb className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-popover border-border z-[60]">
                    <p>{t('sidebar.suggestions')}</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Admin */}
              {!roleLoading && !cargoLoading && !isGuest && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => needsAdminApproval ? setAdminAccessModalOpen(true) : handleNavClick('/admin')}
                      className={cn('sidebar-icon-btn', (isActive('/admin') || location.pathname.includes('/admin')) && 'active')}
                    >
                      <Shield className="w-5 h-5" />
                      {needsAdminApproval && (
                        <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-popover border-border z-[60]">
                    <p>{t('sidebar.administration')}</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Settings */}
              {!roleLoading && !cargoLoading && !isGuest && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleNavClick('/settings')}
                      className={cn('sidebar-icon-btn', isActive('/settings') && 'active')}
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-popover border-border z-[60]">
                    <p>{t('sidebar.settings')}</p>
                  </TooltipContent>
                </Tooltip>
              )}

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

      <InviteGuestDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
      />
    </>
  );
}
