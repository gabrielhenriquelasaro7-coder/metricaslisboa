import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import Sidebar from './Sidebar';
import { ImportLoadingScreen } from './ImportLoadingScreen';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, loading } = useAuth();
  const { isGuest, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [hasProject, setHasProject] = useState<boolean | null>(null);
  const [isImporting, setIsImporting] = useState<boolean | null>(null);
  const [projectInfo, setProjectInfo] = useState<{ id: string; name: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  const checkImportStatus = useCallback(async (projectId: string) => {
    const { data: months } = await supabase
      .from('project_import_months')
      .select('status')
      .eq('project_id', projectId);

    if (!months || months.length === 0) {
      return false;
    }

    const hasActiveImport = months.some(
      (m: any) => m.status === 'importing' || m.status === 'pending'
    );

    return hasActiveImport;
  }, []);

  useEffect(() => {
    const init = async () => {
      if (loading || roleLoading) return;
      
      if (!user) {
        navigate('/auth');
        return;
      }

      let selectedProjectId = localStorage.getItem('selectedProjectId');
      
      if (!selectedProjectId) {
        const { data: projects } = await supabase
          .from('projects')
          .select('id, name')
          .limit(1);
        
        if (projects && projects.length > 0) {
          selectedProjectId = projects[0].id;
          localStorage.setItem('selectedProjectId', selectedProjectId);
        } else if (!isGuest) {
          navigate('/projects');
          return;
        } else {
          setHasProject(false);
          setIsImporting(false);
          return;
        }
      }
      
      if (selectedProjectId) {
        const { data: project } = await supabase
          .from('projects')
          .select('id, name')
          .eq('id', selectedProjectId)
          .single();

        if (project) {
          setProjectInfo({ id: project.id, name: project.name });
          
          const importing = await checkImportStatus(selectedProjectId);
          setIsImporting(importing);
          setHasProject(true);
        } else {
          localStorage.removeItem('selectedProjectId');
          setHasProject(false);
          setIsImporting(false);
        }
      }
    };

    init();
  }, [user, loading, roleLoading, isGuest, navigate, checkImportStatus]);

  const handleImportComplete = useCallback(() => {
    setIsImporting(false);
  }, []);

  if (loading || hasProject === null || isImporting === null) {
    return <LoadingScreen message="Carregando dashboard..." />;
  }

  if (!user || !hasProject) return null;

  if (isImporting && projectInfo) {
    return (
      <ImportLoadingScreen
        projectId={projectInfo.id}
        projectName={projectInfo.name}
        onComplete={handleImportComplete}
      />
    );
  }

  // Mobile layout with Sheet
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background red-texture-bg">
        {/* Mobile Header */}
        <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-sidebar border-b border-sidebar-border flex items-center px-4">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="mr-3">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-sidebar border-sidebar-border">
              <Sidebar onNavigate={() => setSidebarOpen(false)} />
            </SheetContent>
          </Sheet>
          <span className="font-semibold text-foreground">MetaAds Manager</span>
        </header>
        <main className="pt-14 min-h-screen">
          {children}
        </main>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="min-h-screen bg-background red-texture-bg">
      <Sidebar />
      <main className={cn('ml-72 min-h-screen transition-all duration-300')}>
        {children}
      </main>
    </div>
  );
}