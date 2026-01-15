import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Try to get cached session immediately to avoid flash
  const [user, setUser] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem('sb-chxetrmrupvxqbuyjvph-auth-token');
      if (cached) {
        const parsed = JSON.parse(cached);
        return parsed?.user ?? null;
      }
    } catch {
      // Ignore parsing errors
    }
    return null;
  });
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    // Prevent re-initialization on hot reload
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;

    // Safety timeout - force loading to false after 1.5 seconds
    const timeoutId = setTimeout(() => {
      console.warn('[useAuth] Auth check timeout - forcing loading to false');
      // Clear potentially corrupted cache on timeout
      localStorage.removeItem('sb-chxetrmrupvxqbuyjvph-auth-token');
      localStorage.removeItem('user-role-cache');
      setUser(null);
      setSession(null);
      setLoading(false);
    }, 1500);

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        clearTimeout(timeoutId);
        
        // Handle token refresh errors - clear invalid tokens
        if (event === 'TOKEN_REFRESHED' && !currentSession) {
          console.warn('[useAuth] Token refresh failed, clearing session');
          localStorage.removeItem('sb-chxetrmrupvxqbuyjvph-auth-token');
          localStorage.removeItem('user-role-cache');
          setUser(null);
          setSession(null);
          setLoading(false);
          return;
        }
        
        // Handle sign out event
        if (event === 'SIGNED_OUT') {
          localStorage.removeItem('sb-chxetrmrupvxqbuyjvph-auth-token');
          localStorage.removeItem('user-role-cache');
          setUser(null);
          setSession(null);
          setLoading(false);
          return;
        }
        
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession }, error }) => {
      clearTimeout(timeoutId);
      
      // If there's an error or no session, clear cache and set null
      if (error || !existingSession) {
        console.warn('[useAuth] No valid session found, clearing cache');
        localStorage.removeItem('sb-chxetrmrupvxqbuyjvph-auth-token');
        localStorage.removeItem('user-role-cache');
        setUser(null);
        setSession(null);
        setLoading(false);
        return;
      }
      
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setLoading(false);
    }).catch((error) => {
      console.error('[useAuth] Error getting session:', error);
      clearTimeout(timeoutId);
      // Clear corrupted cache on error
      localStorage.removeItem('sb-chxetrmrupvxqbuyjvph-auth-token');
      localStorage.removeItem('user-role-cache');
      setUser(null);
      setSession(null);
      setLoading(false);
    });

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    // Clear all cached data
    localStorage.removeItem('user-role-cache');
    localStorage.removeItem('sb-chxetrmrupvxqbuyjvph-auth-token');
    
    await supabase.auth.signOut();
    
    // Force redirect to auth page
    window.location.href = '/auth';
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
