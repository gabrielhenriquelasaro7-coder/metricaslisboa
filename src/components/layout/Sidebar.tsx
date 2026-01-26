import { useState, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { useProfile } from "@/hooks/useProfile";
import { useUserRole } from "@/hooks/useUserRole";
import { useCargo } from "@/hooks/useCargo";
import { useSidebarCampaigns } from "@/hooks/useSidebarCampaigns";
import { useTour } from "@/hooks/useTour";
import { useTabVisibility } from "@/hooks/useTabVisibility";
import { useTranslation } from "react-i18next";
import v4LogoFull from "@/assets/v4-logo-full.png";
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
  Bot,
  Lock,
  TrendingUp,
  History,
  Sun,
  Moon,
  User,
  KeyRound,
  Lightbulb,
  DollarSign,
  AlertTriangle,
  Compass,
  Database,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SyncStatusBadge } from "@/components/sync/SyncStatusBadge";
import { InviteGuestDialog } from "@/components/guests/InviteGuestDialog";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { AdminAccessRequestModal } from "@/components/admin/AdminAccessRequestModal";
import LanguageSelector from "../LanguageSelector";

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
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [campaignsOpen, setCampaignsOpen] = useState(false);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Record<string, boolean>>({});
  const [guestSettingsOpen, setGuestSettingsOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [adminAccessModalOpen, setAdminAccessModalOpen] = useState(false);
  const [isChangingProject, setIsChangingProject] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { projects } = useProjects();
  const { profile } = useProfile();
  const { isGuest, loading: roleLoading } = useUserRole();
  const { isInvestidor, needsAdminApproval, loading: cargoLoading } = useCargo();
  const { triggerTour } = useTour();
  const { theme, toggleTheme } = useTheme();
  const { isTabHidden, loading: tabVisibilityLoading } = useTabVisibility();

  const selectedProjectId = localStorage.getItem("selectedProjectId");
  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  const {
    campaigns: sortedCampaigns,
    getCampaignAdSets,
    loading: campaignsLoading,
  } = useSidebarCampaigns(selectedProject?.id || null);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleChangeProject = (projectId: string) => {
    if (projectId === selectedProjectId) return;
    setIsChangingProject(true);
    localStorage.setItem("selectedProjectId", projectId);
    navigate("/dashboard");
    setTimeout(() => setIsChangingProject(false), 100);
  };

  const toggleCampaignExpand = (campaignId: string) => {
    setExpandedCampaigns((prev) => ({ ...prev, [campaignId]: !prev[campaignId] }));
  };

  const getStatusColor = (status: string) => {
    if (status === "ACTIVE") return "bg-metric-positive";
    if (status === "PAUSED") return "bg-metric-warning";
    return "bg-muted";
  };

  if (isChangingProject) {
    return <LoadingScreen message={t("sidebar.changingProject")} />;
  }

  return (
    <aside
      className={cn(
        "h-screen border-r border-sidebar-border transition-all duration-300 sidebar-container",
        onNavigate ? "relative w-full" : "fixed left-0 top-0 z-40",
        !onNavigate && (collapsed ? "w-20" : "w-64 lg:w-72"),
      )}
    >
      <div className="relative flex flex-col h-full">
        <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
          <Link to={!isGuest ? "/projects" : "#"} className="flex items-center gap-3">
            <img
              src={v4LogoFull}
              alt="V4 Company"
              className={cn(
                "transition-all duration-300 dark:brightness-0 dark:invert",
                collapsed ? "h-8 w-auto" : "h-10 w-auto",
              )}
            />
          </Link>
          {!onNavigate && (
            <button onClick={() => setCollapsed(!collapsed)} className="sidebar-collapse-btn flex-shrink-0">
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          )}
        </div>

        {selectedProject && !collapsed && (
          <div className="px-3 py-3 border-b border-sidebar-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="sidebar-project-selector w-full flex items-center justify-between group">
                  <div className="text-left">
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-metric-positive" />
                      {t("sidebar.activeProject")}
                    </p>
                    <p className="font-semibold truncate mt-0.5 text-foreground">{selectedProject.name}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-56 bg-popover border-border max-h-[400px] overflow-y-auto"
              >
                {projects
                  .filter((p) => !p.archived)
                  .map((project) => (
                    <DropdownMenuItem
                      key={project.id}
                      onClick={() => handleChangeProject(project.id)}
                      className={cn(
                        "transition-colors",
                        project.id === selectedProject.id && "bg-primary/15 text-primary",
                      )}
                    >
                      <p className="font-medium">{project.name}</p>
                    </DropdownMenuItem>
                  ))}
                {!isGuest && (
                  <DropdownMenuItem onClick={() => navigate("/projects")} className="border-t border-border mt-1 pt-2">
                    <FolderKanban className="w-4 h-4 mr-2" /> {t("sidebar.manageProjects")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="mt-3 px-1">
              <SyncStatusBadge projectId={selectedProject.id} />
            </div>
          </div>
        )}

        {selectedProject && !collapsed && <div className="sidebar-divider mx-3" />}

        <nav className="flex-1 px-3 py-4 overflow-y-auto flex flex-col">
          <div className="space-y-1">
            <Link to="/dashboard" className={cn("sidebar-item", location.pathname === "/dashboard" && "active")}>
              <LayoutDashboard className="w-5 h-5 flex-shrink-0" /> {!collapsed && <span>Dashboard</span>}
            </Link>

            {!collapsed ? (
              <Collapsible open={campaignsOpen} onOpenChange={setCampaignsOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "sidebar-item w-full justify-between",
                      location.pathname.includes("/campaign") && "active",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Megaphone className="w-5 h-5 flex-shrink-0" /> <span>{t("sidebar.campaigns")}</span>
                    </div>
                    {campaignsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-1 space-y-0.5">
                  <Link
                    to="/campaigns"
                    className={cn("sidebar-item pl-10 text-sm", location.pathname === "/campaigns" && "active")}
                  >
                    {t("sidebar.viewAll")}
                  </Link>
                  <div className="max-h-[300px] overflow-y-auto">
                    {campaignsLoading ? (
                      <CampaignSkeleton />
                    ) : (
                      sortedCampaigns.slice(0, 10).map((campaign) => (
                        <button
                          key={campaign.id}
                          onClick={() => toggleCampaignExpand(campaign.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 pl-8 text-sm rounded-lg hover:bg-secondary"
                        >
                          <span className={cn("w-2 h-2 rounded-full", getStatusColor(campaign.status))} />
                          <span className="truncate flex-1 text-left">{campaign.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <Link to="/campaigns" className="sidebar-item">
                {" "}
                <Megaphone className="w-5 h-5" />{" "}
              </Link>
            )}

            <Link to="/creatives" className={cn("sidebar-item", location.pathname === "/creatives" && "active")}>
              <ImageIcon className="w-5 h-5 flex-shrink-0" /> {!collapsed && <span>{t("sidebar.creatives")}</span>}
            </Link>

            {selectedProject && !isTabHidden("suggestions") && (
              <Link
                to="/optimization-history"
                className={cn("sidebar-item", location.pathname === "/optimization-history" && "active")}
              >
                <History className="w-5 h-5 flex-shrink-0" /> {!collapsed && <span>{t("sidebar.history")}</span>}
              </Link>
            )}

            {!isGuest && !isTabHidden("financial") && (
              <Link to="/financeiro" className={cn("sidebar-item", location.pathname === "/financeiro" && "active")}>
                <DollarSign className="w-5 h-5 flex-shrink-0" /> {!collapsed && <span>{t("sidebar.financial")}</span>}
              </Link>
            )}
          </div>

          <div className="flex-1" />

          {/* NOVO: Seletor de Idioma dentro da Sidebar para facilitar */}
          {!collapsed && (
            <div className="px-3 mb-4">
              <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2 px-3">{t("common.language")}</p>
              <LanguageSelector />
            </div>
          )}

          <div className="space-y-1 mt-2">
            {!isGuest && !isTabHidden("admin") && (
              <button
                onClick={() => (needsAdminApproval ? setAdminAccessModalOpen(true) : navigate("/admin"))}
                className="sidebar-item w-full"
              >
                <Database className="w-5 h-5" /> {!collapsed && <span>{t("sidebar.administration")}</span>}
              </button>
            )}
            {!isTabHidden("settings") && (
              <Link to="/settings" className="sidebar-item">
                <Settings className="w-5 h-5" /> {!collapsed && <span>{t("sidebar.settings")}</span>}
              </Link>
            )}
          </div>
        </nav>

        <div className="p-4 border-t border-sidebar-border bg-sidebar-accent/50">
          <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
            <Avatar className="w-10 h-10">
              <AvatarFallback>{profile?.full_name?.[0] || "U"}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{profile?.full_name || "Usuário"}</p>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="mt-4 w-full text-destructive hover:bg-destructive/10"
          >
            <LogOut className="w-4 h-4" /> {!collapsed && <span className="ml-2">{t("sidebar.logout")}</span>}
          </Button>
        </div>
      </div>

      <AdminAccessRequestModal
        open={adminAccessModalOpen}
        onOpenChange={setAdminAccessModalOpen}
        projectId={selectedProject?.id}
      />
    </aside>
  );
}
