import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const hasNavigatedRef = useRef(false);

  // Navigate as soon as auth state is determined
  useEffect(() => {
    if (hasNavigatedRef.current) return;
    
    // If user exists, navigate immediately (don't wait for loading)
    if (user) {
      hasNavigatedRef.current = true;
      navigate('/projects', { replace: true });
      return;
    }
    
    // If loading finished and no user, go to auth
    if (!loading && !user) {
      hasNavigatedRef.current = true;
      navigate('/auth', { replace: true });
    }
  }, [user, loading, navigate]);

  // Emergency timeout - force navigation after 3s
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!hasNavigatedRef.current) {
        hasNavigatedRef.current = true;
        navigate('/auth', { replace: true });
      }
    }, 3000);
    
    return () => clearTimeout(timeout);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}
