import { useState, useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'gestor' | 'convidado';

interface UserRoleData {
  role: AppRole;
  isGuest: boolean;
  isGestor: boolean;
  isAdmin: boolean;
  loading: boolean;
  needsPasswordChange: boolean;
  guestProjectIds: string[];
}

export function useUserRole(): UserRoleData {
  const { user, loading: authLoading } = useAuth();
  
  // Try to get cached role to avoid flash
  const [role, setRole] = useState<AppRole>(() => {
    try {
      const cached = localStorage.getItem('user-role-cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.userId === user?.id) {
          return parsed.role as AppRole;
        }
      }
    } catch {
      // Ignore
    }
    return 'gestor';
  });
  const [loading, setLoading] = useState(true);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [guestProjectIds, setGuestProjectIds] = useState<string[]>([]);
  const fetchedRef = useRef(false);

  useEffect(() => {
    // Safety timeout - force loading to false after 3 seconds
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('[useUserRole] Timeout - forcing loading to false');
        setLoading(false);
      }
    }, 3000);

    const fetchUserRole = async () => {
      // Wait for auth to load first
      if (authLoading) {
        return;
      }
      
      if (!user) {
        localStorage.removeItem('user-role-cache');
        setLoading(false);
        return;
      }

      // Prevent duplicate fetches
      if (fetchedRef.current) {
        setLoading(false);
        return;
      }
      fetchedRef.current = true;

      try {
        // Fetch user role with timeout
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 5000);

        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        clearTimeout(fetchTimeout);

        if (roleError) {
          console.error('Error fetching user role:', roleError);
          setRole('gestor');
        } else if (roleData) {
          setRole(roleData.role as AppRole);
          localStorage.setItem('user-role-cache', JSON.stringify({
            userId: user.id,
            role: roleData.role
          }));
        } else {
          setRole('gestor');
          localStorage.setItem('user-role-cache', JSON.stringify({
            userId: user.id,
            role: 'gestor'
          }));
        }

        // If guest, check if password needs to be changed
        if (roleData?.role === 'convidado') {
          const { data: invitationData } = await supabase
            .from('guest_invitations')
            .select('password_changed')
            .eq('guest_user_id', user.id)
            .single();

          if (invitationData) {
            setNeedsPasswordChange(!invitationData.password_changed);
          }

          const { data: accessData } = await supabase
            .from('guest_project_access')
            .select('project_id')
            .eq('user_id', user.id);

          if (accessData) {
            setGuestProjectIds(accessData.map(a => a.project_id));
          }
        }
      } catch (error) {
        console.error('Error in useUserRole:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();

    return () => {
      clearTimeout(timeoutId);
    };
  }, [user, authLoading, loading]);

  // Reset fetch ref when user changes
  useEffect(() => {
    fetchedRef.current = false;
  }, [user?.id]);

  return {
    role,
    isGuest: role === 'convidado',
    isGestor: role === 'gestor',
    isAdmin: role === 'admin',
    loading,
    needsPasswordChange,
    guestProjectIds,
  };
}
