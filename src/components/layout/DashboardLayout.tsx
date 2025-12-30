import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Sidebar from './Sidebar';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [hasProject, setHasProject] = useState<boolean | null>(null);

  useEffect(() => {
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
    
    setHasProject(!!selectedProjectId);
  }, [user, loading, navigate]);

  if (loading || hasProject === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !hasProject) return null;

  return (
    <div className="min-h-screen bg-background red-texture-bg">
      <Sidebar />
      <main className={cn('ml-64 min-h-screen transition-all duration-300 pl-4')}>
        {children}
      </main>
    </div>
  );
}
