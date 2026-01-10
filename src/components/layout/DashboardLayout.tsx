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

  // Quick timeout to prevent infinite loading - runs immediately
  useEffect(() => {
    const quickTimeout = setTimeout(() => {
      if (hasProject === null) {
        console.warn('Quick timeout - setting hasProject to true');
        setHasProject(true);
      }
      if (isImporting === null) {
        console.warn('Quick timeout - setting isImporting to false');
        setIsImporting(false);
      }
    }, 3000); // 3 second timeout

    return () => clearTimeout(quickTimeout);
  }, []);

  useEffect(() => {
    // Skip if auth is still loading
    if (loading || roleLoading) return;
    
    // If no user, redirect to auth
    if (!user) {
      navigate('/auth');
      return;
    }

    const init = async () => {
      try {
        let selectedProjectId = localStorage.getItem('selectedProjectId');
        
        if (!selectedProjectId) {
          const { data: projects, error } = await supabase
            .from('projects')
            .select('id, name')
            .limit(1);
          
          if (error) {
            console.error('Error fetching projects:', error);
            setHasProject(false);
            setIsImporting(false);
            return;
          }
          
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
          const { data: project, error } = await supabase
            .from('projects')
            .select('id, name')
            .eq('id', selectedProjectId)
            .single();

          if (error || !project) {
            console.error('Error fetching project:', error);
            localStorage.removeItem('selectedProjectId');
            setHasProject(false);
            setIsImporting(false);
            return;
          }

          setProjectInfo({ id: project.id, name: project.name });
          
          const importing = await checkImportStatus(selectedProjectId);
          setIsImporting(importing);
          setHasProject(true);
        } else {
          setHasProject(false);
          setIsImporting(false);
        }
      } catch (error) {
        console.error('Error in dashboard init:', error);
        setHasProject(false);
        setIsImporting(false);
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