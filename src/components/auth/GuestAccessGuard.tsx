import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';

interface GuestAccessGuardProps {
  children: React.ReactNode;
}

// Pages that guests CAN access
const GUEST_ALLOWED_ROUTES = [
  '/dashboard',
  '/campaigns',
  '/campaign/',
  '/adset/',
  '/ad/',
  '/creatives',
  '/creative/',
  '/change-password',
  '/guest-onboarding',
  '/auth',
  '/optimization-history',
  '/settings',
];

// Pages that require password change before access
const REQUIRES_PASSWORD_CHANGE = [
  '/projects',
  '/dashboard',
  '/campaigns',
  '/campaign/',
  '/adset/',
  '/ad/',
  '/creatives',
  '/creative/',
];

export function GuestAccessGuard({ children }: GuestAccessGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const { isGuest, needsPasswordChange, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();
  const hasNavigatedRef = useRef(false);
  const lastPathRef = useRef(location.pathname);

  // Reset navigation flag when path changes
  useEffect(() => {
    if (lastPathRef.current !== location.pathname) {
      hasNavigatedRef.current = false;
      lastPathRef.current = location.pathname;
    }
  }, [location.pathname]);

  useEffect(() => {
    // Prevent multiple navigations
    if (hasNavigatedRef.current) return;
    
    // Wait for both auth and role to load
    if (authLoading || roleLoading) return;
    
    // Not logged in - let normal auth flow handle it
    if (!user) return;

    const currentPath = location.pathname;

    // ANY user who needs password change should be redirected (not just guests)
    if (needsPasswordChange) {
      const requiresChange = REQUIRES_PASSWORD_CHANGE.some(route => 
        currentPath === route || currentPath.startsWith(route)
      );
      
      if (requiresChange && currentPath !== '/change-password') {
        console.log('[GuestAccessGuard] User needs password change, redirecting...');
        hasNavigatedRef.current = true;
        navigate('/change-password', { replace: true });
        return;
      }
    }

    // Guest-specific restrictions below
    if (!isGuest) return;

    // If guest tries to access /projects, redirect to dashboard
    if (currentPath === '/projects') {
      hasNavigatedRef.current = true;
      navigate('/dashboard', { replace: true });
      return;
    }

    // If guest tries to access any other restricted page, redirect to dashboard
    const isAllowed = GUEST_ALLOWED_ROUTES.some(route => 
      currentPath === route || currentPath.startsWith(route)
    );
    
    if (!isAllowed) {
      hasNavigatedRef.current = true;
      navigate('/dashboard', { replace: true });
    }
  }, [user, isGuest, needsPasswordChange, authLoading, roleLoading, location.pathname, navigate]);

  // Always render children immediately - never block
  return <>{children}</>;
}
