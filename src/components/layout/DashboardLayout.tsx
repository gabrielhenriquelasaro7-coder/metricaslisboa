import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import TopSideBar from "./TopSideBar";
import { ImportLoadingScreen } from "./ImportLoadingScreen";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import v4LogoIcon from "@/assets/v4-logo-icon.png";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, loading } = useAuth();
  const { isGuest, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [projectInfo, setProjectInfo] = useState<{ id: string; name: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  const checkImportStatus = useCallback(async (projectId: string) => {
    try {
      const dismissed = localStorage.getItem(`import_dismissed_${projectId}`);
      if (dismissed === "true") return false;

      // 1. Check sync_progress in projects table
      const { data: project } = await supabase
        .from("projects")
        .select("sync_progress")
        .eq("id", projectId)
        .maybeSingle();

      const syncProgress = project?.sync_progress as any;
      const projectMarkedAsImporting = syncProgress?.status === 'importing';

      // 2. Fallback check in project_import_months
      const { data: months } = await supabase
        .from("project_import_months")
        .select("status")
        .eq("project_id", projectId);

      if (!months || months.length === 0) return projectMarkedAsImporting;
      return months.some((m: any) => m.status === "importing" || m.status === "pending");
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }
    if (loading || roleLoading || !user) return;

    const init = async () => {
      try {
        let selectedProjectId = localStorage.getItem("selectedProjectId");

        if (selectedProjectId) {
          const { data: project } = await supabase
            .from("projects")
            .select("id, name")
            .eq("id", selectedProjectId)
            .maybeSingle();

          if (project) {
            setProjectInfo({ id: project.id, name: project.name });
            const importing = await checkImportStatus(selectedProjectId);
            setIsImporting(importing);
          } else {
            localStorage.removeItem("selectedProjectId");
            setProjectInfo(null);
            setIsImporting(false);
          }
        } else {
          setProjectInfo(null);
          setIsImporting(false);
        }
      } catch (error) {
        console.error("Error in dashboard init:", error);
      }
    };

    init();

    // Listen for project selection events for fluid transitions
    const handleProjectSelected = () => {
      init();
    };

    window.addEventListener("project-selected", handleProjectSelected);
    return () => {
      window.removeEventListener("project-selected", handleProjectSelected);
    };
  }, [user, loading, roleLoading, isGuest, navigate, checkImportStatus]);

  const handleImportComplete = useCallback(() => {
    if (projectInfo) localStorage.setItem(`import_dismissed_${projectInfo.id}`, "true");
    setIsImporting(false);
  }, [projectInfo]);

  if (isImporting && projectInfo) {
    return (
      <ImportLoadingScreen
        projectId={projectInfo.id}
        projectName={projectInfo.name}
        onComplete={handleImportComplete}
      />
    );
  }

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen w-full bg-background overflow-hidden">
        <header className="fixed top-0 left-0 right-0 z-50 h-12 bg-sidebar/95 backdrop-blur-lg border-b border-sidebar-border flex items-center px-3 safe-area-top">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="mr-2 h-9 w-9 touch-target">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[60px] bg-sidebar border-sidebar-border">
              <TopSideBar onNavigate={() => setSidebarOpen(false)} />
            </SheetContent>
          </Sheet>
          <img src={v4LogoIcon} alt="V4" className="h-6 w-6 dark:brightness-0 dark:invert mr-2" />
          <span className="font-semibold text-foreground text-sm truncate">V4 Métricas</span>
        </header>
        <main className="flex-1 pt-12 w-full relative p-4 safe-area-bottom overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
    );
  }

  // Desktop Layout - narrow icon sidebar FIXED
  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Fixed sidebar - stays in place while content scrolls */}
      <aside className="hidden md:flex w-[60px] flex-shrink-0 h-screen fixed top-0 left-0 z-40 border-r border-sidebar-border">
        <TopSideBar />
      </aside>
      {/* Content with left margin to account for fixed sidebar */}
      <main className="flex-1 min-h-screen p-4 md:p-5 lg:p-6 w-full md:ml-[60px] overflow-x-hidden">
        <div className="max-w-full mx-auto">{children}</div>
      </main>
    </div>
  );
}
