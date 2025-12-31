import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import Sidebar from './Sidebar';
import { ImportLoadingScreen } from './ImportLoadingScreen';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { cn } from '@/lib/utils';

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

  const checkImportStatus = useCallback(async (projectId: string) => {
    const { data: months } = await supabase
      .from('project_import_months')
      .select('status')
      .eq('project_id', projectId);

    if (!months || months.length === 0) {
      // No import records - project is ready
      return false;
    }

    // Check if any months are still importing or pending
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

      // Check if a project is selected
      let selectedProjectId = localStorage.getItem('selectedProjectId');
      
      // If no project selected, try to get first available project
      if (!selectedProjectId) {
        const { data: projects } = await supabase
          .from('projects')
          .select('id, name')
          .limit(1);
        
        if (projects && projects.length > 0) {
          selectedProjectId = projects[0].id;
          localStorage.setItem('selectedProjectId', selectedProjectId);
        } else if (!isGuest) {
          // Only redirect non-guests to /projects if no projects available
          navigate('/projects');
          return;
        } else {
          // Guest with no projects - show empty state
          setHasProject(false);
          setIsImporting(false);
          return;
        }
      }
      
      if (selectedProjectId) {
        // Get project info
        const { data: project } = await supabase
          .from('projects')
          .select('id, name')
          .eq('id', selectedProjectId)
          .single();

        if (project) {
          setProjectInfo({ id: project.id, name: project.name });
          
          // Check if import is in progress
          const importing = await checkImportStatus(selectedProjectId);
          setIsImporting(importing);
          setHasProject(true);
        } else {
          // Project not found (maybe deleted or no access) - clear localStorage and retry
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

  // Show import loading screen if importing
  if (isImporting && projectInfo) {
    return (
      <ImportLoadingScreen
        projectId={projectInfo.id}
        projectName={projectInfo.name}
        onComplete={handleImportComplete}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background red-texture-bg">
      <Sidebar />
      <main className={cn('ml-64 min-h-screen transition-all duration-300 pl-4')}>
        {children}
      </main>
    </div>
  );
}
