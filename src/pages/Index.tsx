import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    // Check cached session immediately for instant redirect
    const hasCachedSession = localStorage.getItem('sb-chxetrmrupvxqbuyjvph-auth-token');
    
    if (hasCachedSession && !redirected) {
      // User was logged in before, go straight to projects
      navigate('/projects', { replace: true });
      setRedirected(true);
      return;
    }

    // Force redirect after 800ms even if still loading
    const forceRedirectTimeout = setTimeout(() => {
      if (!redirected) {
        navigate('/auth', { replace: true });
        setRedirected(true);
      }
    }, 800);

    if (!loading && !redirected) {
      if (user) {
        navigate('/projects', { replace: true });
      } else {
        navigate('/auth', { replace: true });
      }
      setRedirected(true);
    }

    return () => clearTimeout(forceRedirectTimeout);
  }, [user, loading, navigate, redirected]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}
