import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

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

  // Check if user has an approved admin access grant
  const checkApprovedAccess = useCallback(async (): Promise<boolean> => {
    if (!user) {
      setHasApprovedAccess(false);
      return false;
    }

    try {
      const { data, error } = await supabase
        .from('admin_access_grants')
        .select('id, expires_at, revoked_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking admin access grant:', error);
        setHasApprovedAccess(false);
        return false;
      }

      // Check if grant exists, is not revoked, and not expired
      if (data && !data.revoked_at) {
        const isExpired = data.expires_at ? new Date(data.expires_at) < new Date() : false;
        if (!isExpired) {
          setHasApprovedAccess(true);
          // Auto-authenticate users with approved access
          setIsAdminAuthenticated(true);
          localStorage.setItem(ADMIN_AUTH_KEY, JSON.stringify({ timestamp: Date.now(), grantAccess: true }));
          return true;
        }
      }

      setHasApprovedAccess(false);
      return false;
    } catch (error) {
      console.error('Error in checkApprovedAccess:', error);
      setHasApprovedAccess(false);
      return false;
    }
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
          const { timestamp } = JSON.parse(sessionData);
          const now = Date.now();
          if (now - timestamp < SESSION_DURATION) {
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
      // Use rpc or raw query since system_settings might not be in types yet
      const { data, error } = await supabase
        .from('system_settings' as any)
        .select('value')
        .eq('key', 'admin_password')
        .single();

      if (error) throw error;

      if (data && (data as any).value === password) {
        setIsAdminAuthenticated(true);
        localStorage.setItem(ADMIN_AUTH_KEY, JSON.stringify({ timestamp: Date.now() }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error verifying admin password:', error);
      return false;
    }
  };

  const logout = () => {
    setIsAdminAuthenticated(false);
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
