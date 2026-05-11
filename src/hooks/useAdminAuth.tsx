import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface AdminAuthContextType {
  isAdminAuthenticated: boolean;
  hasApprovedAccess: boolean;
  isLoading: boolean;
  verifyPassword: (password: string) => Promise<boolean>;
  logout: () => void;
  checkApprovedAccess: () => Promise<boolean>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const ADMIN_AUTH_KEY = 'admin_authenticated_session';
const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [hasApprovedAccess, setHasApprovedAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user has an approved admin access grant (valid for today)
  const checkApprovedAccess = useCallback(async (): Promise<boolean> => {
    if (!user) {
      setHasApprovedAccess(false);
      return false;
    }

    try {
      const { data, error } = await supabase
        .from('admin_access_grants')
        .select('id, expires_at, project_id')
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .limit(1);

      if (error) {
        console.error('Error checking admin access grant:', error);
        setHasApprovedAccess(false);
        return false;
      }

      // Check if grant exists and not expired
      if (data && data.length > 0) {
        setHasApprovedAccess(true);
        // Auto-authenticate users with approved access
        setIsAdminAuthenticated(true);
        localStorage.setItem(ADMIN_AUTH_KEY, JSON.stringify({ timestamp: Date.now(), grantAccess: true }));
        return true;
      }

      setHasApprovedAccess(false);
      return false;
    } catch (error) {
      console.error('Error in checkApprovedAccess:', error);
      setHasApprovedAccess(false);
      return false;
    }
  }, [user]);

  // Subscribe to realtime changes for admin_access_grants
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('admin-access-grants')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_access_grants',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Admin access granted!', payload);
          // Show notification
          toast.success('🎉 Seu acesso foi aprovado!', {
            description: 'Você agora tem acesso ao Admin do projeto.',
            duration: 5000,
          });
          // Update state
          setHasApprovedAccess(true);
          setIsAdminAuthenticated(true);
          localStorage.setItem(ADMIN_AUTH_KEY, JSON.stringify({ timestamp: Date.now(), grantAccess: true }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    const checkAuth = async () => {
      setIsLoading(true);
      
      // First check for approved access (permanent grant)
      if (user) {
        const hasGrant = await checkApprovedAccess();
        if (hasGrant) {
          setIsLoading(false);
          return;
        }
      }

      // Then check for password-based session
      const sessionData = localStorage.getItem(ADMIN_AUTH_KEY);
      if (sessionData) {
        try {
          const { timestamp, grantAccess } = JSON.parse(sessionData);
          const now = Date.now();
          
          // If it was a grant-based access, re-verify from database
          if (grantAccess && user) {
            const hasGrant = await checkApprovedAccess();
            if (hasGrant) {
              setIsLoading(false);
              return;
            }
            // Grant expired, remove session
            localStorage.removeItem(ADMIN_AUTH_KEY);
          } else if (now - timestamp < SESSION_DURATION) {
            // Password-based session still valid
            setIsAdminAuthenticated(true);
          } else {
            localStorage.removeItem(ADMIN_AUTH_KEY);
          }
        } catch {
          localStorage.removeItem(ADMIN_AUTH_KEY);
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, [user, checkApprovedAccess]);

  const verifyPassword = async (password: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('system_settings' as any)
        .select('value')
        .eq('key', 'admin_password')
        .maybeSingle();

      if (error) {
        console.error('[AdminAuth] Error querying admin_password:', error);
        return false;
      }

      if (!data) {
        console.warn('[AdminAuth] admin_password not found in system_settings');
        return false;
      }

      const stored = String((data as any).value ?? '').trim();
      const provided = String(password ?? '').trim();

      if (stored && stored === provided) {
        setIsAdminAuthenticated(true);
        localStorage.setItem(ADMIN_AUTH_KEY, JSON.stringify({ timestamp: Date.now() }));
        return true;
      }

      console.warn('[AdminAuth] Password mismatch');
      return false;
    } catch (error) {
      console.error('[AdminAuth] Unexpected error verifying admin password:', error);
      return false;
    }
  };

  const logout = () => {
    setIsAdminAuthenticated(false);
    setHasApprovedAccess(false);
    localStorage.removeItem(ADMIN_AUTH_KEY);
  };

  return (
    <AdminAuthContext.Provider value={{ 
      isAdminAuthenticated, 
      hasApprovedAccess,
      isLoading, 
      verifyPassword, 
      logout,
      checkApprovedAccess 
    }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}