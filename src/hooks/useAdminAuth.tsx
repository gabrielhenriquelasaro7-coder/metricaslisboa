import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AdminAuthContextType {
  isAdminAuthenticated: boolean;
  isLoading: boolean;
  verifyPassword: (password: string) => Promise<boolean>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const ADMIN_AUTH_KEY = 'admin_authenticated_session';
const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if there's a valid session
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
  }, []);

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
    <AdminAuthContext.Provider value={{ isAdminAuthenticated, isLoading, verifyPassword, logout }}>
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
