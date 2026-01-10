import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';

interface GuestAccessGuardProps {
  children: React.ReactNode;
}

// Pages that guests CAN access (projects is NOT included - guests go straight to dashboard)
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
  '/onboarding',
  '/',
  '/optimization-history',
];

// Pages that require password change for guests
const REQUIRES_PASSWORD_CHANGE = [
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

  useEffect(() => {
    // Wait for both auth and role to load
    if (authLoading || roleLoading) return;
    
    // Not logged in - let normal auth flow handle it
    if (!user) return;

    const currentPath = location.pathname;

    // If guest needs to change password, redirect to change-password page
    if (isGuest && needsPasswordChange) {
      const requiresChange = REQUIRES_PASSWORD_CHANGE.some(route => 
        currentPath === route || currentPath.startsWith(route)
      );
      
      if (requiresChange && currentPath !== '/change-password') {
        navigate('/change-password', { replace: true });
        return;
      }
    }

    // If guest tries to access /projects, redirect to dashboard immediately
    if (isGuest && currentPath === '/projects') {
      navigate('/dashboard', { replace: true });
      return;
    }

    // If guest tries to access any other restricted page, redirect to dashboard
    if (isGuest) {
      const isAllowed = GUEST_ALLOWED_ROUTES.some(route => 
        currentPath === route || currentPath.startsWith(route)
      );
      
      if (!isAllowed) {
        navigate('/dashboard', { replace: true });
        return;
      }
    }
  }, [user, isGuest, needsPasswordChange, authLoading, roleLoading, location.pathname, navigate]);

  return <>{children}</>;
}
