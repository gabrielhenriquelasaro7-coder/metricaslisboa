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
  const [hasProject, setHasProject] = useState<boolean>(true); // Default to true to prevent blocking
  const [isImporting, setIsImporting] = useState<boolean>(false); // Default to false
  const [projectInfo, setProjectInfo] = useState<{ id: string; name: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const isMobile = useIsMobile();

  const checkImportStatus = useCallback(async (projectId: string) => {
    try {
      const { data: months } = await supabase
        .from('project_import_months')
        .select('status')
        .eq('project_id', projectId);

      if (!months || months.length === 0) {
        return false;
      }

      return months.some((m: any) => m.status === 'importing' || m.status === 'pending');
    } catch {
      return false;
    }
  }, []);

  // Force initialization after 1.5 seconds regardless of state
  useEffect(() => {
    const forceInit = setTimeout(() => {
      setIsInitialized(true);
    }, 1500);

    return () => clearTimeout(forceInit);
  }, []);

  useEffect(() => {
    // Skip if auth is still loading (but respect timeout)
    if ((loading || roleLoading) && !isInitialized) return;
    
    // If no user after loading completes, redirect to auth
    if (!loading && !user) {
      navigate('/auth');
      return;
    }

    const init = async () => {
      try {
        let selectedProjectId = localStorage.getItem('selectedProjectId');
        
        if (!selectedProjectId) {
          const { data: projects } = await supabase
            .from('projects')
            .select('id, name')
            .limit(1);
          
          if (projects && projects.length > 0) {
            selectedProjectId = projects[0].id;
            localStorage.setItem('selectedProjectId', selectedProjectId);
          } else if (!isGuest && !loading) {
            navigate('/projects');
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
          }
        }
      } catch (error) {
        console.error('Error in dashboard init:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    init();
  }, [user, loading, roleLoading, isGuest, navigate, checkImportStatus, isInitialized]);

  const handleImportComplete = useCallback(() => {
    setIsImporting(false);
  }, []);

  // Show loading only briefly - max 1.5 seconds
  if (!isInitialized) {
    return <LoadingScreen message="Carregando dashboard..." />;
  }

  // After initialization, if no user, they should have been redirected
  if (!user) {
    // Force redirect if not already navigating
    navigate('/auth');
    return <LoadingScreen message="Redirecionando..." />;
  }

  if (!hasProject) return null;

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
      <div className="min-h-screen bg-background red-texture-bg grid-background overflow-x-hidden">
        {/* Mobile Header - Compact & Touch-friendly */}
        <header className="fixed top-0 left-0 right-0 z-50 h-12 bg-sidebar/95 backdrop-blur-lg border-b border-sidebar-border flex items-center px-3 safe-area-top">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="mr-2 h-9 w-9 touch-target">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[85vw] max-w-[320px] bg-sidebar border-sidebar-border safe-area-left">
              <Sidebar onNavigate={() => setSidebarOpen(false)} />
            </SheetContent>
          </Sheet>
          <span className="font-semibold text-foreground text-sm truncate">MetaAds Manager</span>
        </header>
        <main className="pt-12 min-h-screen relative z-10 overflow-x-hidden safe-area-bottom">
          {children}
        </main>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="min-h-screen bg-background red-texture-bg grid-background">
      <Sidebar />
      <main className={cn('ml-72 min-h-screen transition-all duration-300 relative z-10')}>
        {children}
      </main>
    </div>
  );
}