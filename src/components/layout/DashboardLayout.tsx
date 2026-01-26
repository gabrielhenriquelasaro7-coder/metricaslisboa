/* src/components/layout/DashboardLayout.tsx */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import Sidebar from "./Sidebar";
import { ImportLoadingScreen } from "./ImportLoadingScreen";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

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
      if (dismissed === "true") {
        return false;
      }

      const { data: months } = await supabase
        .from("project_import_months")
        .select("status")
        .eq("project_id", projectId);

      if (!months || months.length === 0) {
        return false;
      }

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

        if (!selectedProjectId) {
          const { data: projects } = await supabase.from("projects").select("id, name").limit(1);

          if (projects && projects.length > 0) {
            selectedProjectId = projects[0].id;
            localStorage.setItem("selectedProjectId", selectedProjectId);
          } else if (!isGuest) {
            navigate("/projects");
            return;
          }
        }

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
            if (!isGuest) {
              navigate("/projects");
            }
          }
        }
      } catch (error) {
        console.error("Error in dashboard init:", error);
      }
    };

    init();
  }, [user, loading, roleLoading, isGuest, navigate, checkImportStatus]);

  const handleImportComplete = useCallback(() => {
    if (projectInfo) {
      localStorage.setItem(`import_dismissed_${projectInfo.id}`, "true");
    }
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

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background grid-background flex flex-col">
        <header className="fixed top-0 left-0 right-0 z-50 h-12 bg-sidebar/95 backdrop-blur-lg border-b border-sidebar-border flex items-center px-3 safe-area-top">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="mr-2 h-9 w-9 touch-target" data-tour="mobile-menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="p-0 w-[85vw] max-w-[320px] bg-sidebar border-sidebar-border safe-area-left"
            >
              <Sidebar onNavigate={() => setSidebarOpen(false)} />
            </SheetContent>
          </Sheet>
          <span className="font-semibold text-foreground text-sm truncate">MetaAds Manager</span>
        </header>
        {/* Adicionado h-full e removido overflow-x-hidden agressivo */}
        <main className="flex-1 pt-12 min-h-screen relative z-10 safe-area-bottom p-4 overflow-y-auto">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background grid-background flex">
      <Sidebar />
      {/* Removido overflow-x-hidden que travava o scroll vertical */}
      <main className="flex-1 p-4 md:p-6 lg:p-8 md:ml-64 lg:ml-72 w-full">{children}</main>
    </div>
  );
}
