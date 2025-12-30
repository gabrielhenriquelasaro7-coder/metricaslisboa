import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import Sidebar from './Sidebar';
import { ImportLoadingScreen } from './ImportLoadingScreen';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, loading } = useAuth();
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
      if (!loading && !user) {
        navigate('/auth');
        return;
      }

      // Check if a project is selected
      const selectedProjectId = localStorage.getItem('selectedProjectId');
      if (!selectedProjectId && !loading && user) {
        navigate('/projects');
        return;
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
        }
      }
      
      setHasProject(!!selectedProjectId);
    };

    init();
  }, [user, loading, navigate, checkImportStatus]);

  const handleImportComplete = useCallback(() => {
    setIsImporting(false);
  }, []);

  if (loading || hasProject === null || isImporting === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
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
