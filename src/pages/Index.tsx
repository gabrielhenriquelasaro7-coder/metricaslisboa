import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    // Force redirect after 1.5 seconds even if still loading
    const forceRedirectTimeout = setTimeout(() => {
      if (!redirected) {
        console.warn('[Index] Force redirect to /auth after timeout');
        navigate('/auth', { replace: true });
        setRedirected(true);
      }
    }, 1500);

    if (!loading && !redirected) {
      if (user) {
        console.log('[Index] User found, redirecting to /projects');
        navigate('/projects', { replace: true });
      } else {
        console.log('[Index] No user, redirecting to /auth');
        navigate('/auth', { replace: true });
      }
      setRedirected(true);
    }

    return () => clearTimeout(forceRedirectTimeout);
  }, [user, loading, navigate, redirected]);

  // Simple spinner without external dependencies
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}
