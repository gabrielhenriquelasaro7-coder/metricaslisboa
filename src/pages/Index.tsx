import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [hasRedirected, setHasRedirected] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const mountedRef = useRef(true);

  // Safety timeout - show fallback after 3 seconds
  useEffect(() => {
    const fallbackTimeout = setTimeout(() => {
      if (mountedRef.current && !hasRedirected) {
        setShowFallback(true);
      }
    }, 3000);

    return () => {
      clearTimeout(fallbackTimeout);
      mountedRef.current = false;
    };
  }, [hasRedirected]);

  // Handle navigation only after auth is ready
  useEffect(() => {
    // Don't redirect if already redirected or still loading
    if (hasRedirected || loading) return;

    // Only navigate when auth state is determined
    if (!loading) {
      const targetPath = user ? '/projects' : '/auth';
      setHasRedirected(true);
      navigate(targetPath, { replace: true });
    }
  }, [user, loading, navigate, hasRedirected]);

  // Always render immediately - never block UI
  if (showFallback && !hasRedirected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
        <button 
          onClick={() => navigate('/auth', { replace: true })}
          className="text-sm text-primary hover:underline"
        >
          Ir para login
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}
