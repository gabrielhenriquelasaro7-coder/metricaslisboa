import { useState, useEffect } from 'react';
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

  useEffect(() => {
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

      try {
        // Fetch user role
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (roleError) {
          console.error('Error fetching user role:', roleError);
          setRole('gestor');
        } else if (roleData) {
          setRole(roleData.role as AppRole);
          // Cache the role for faster reloads
          localStorage.setItem('user-role-cache', JSON.stringify({
            userId: user.id,
            role: roleData.role
          }));
        } else {
          // No role found, default to gestor
          setRole('gestor');
          localStorage.setItem('user-role-cache', JSON.stringify({
            userId: user.id,
            role: 'gestor'
          }));
        }

        // If guest, check if password needs to be changed and fetch accessible projects
        if (roleData?.role === 'convidado') {
          const { data: invitationData } = await supabase
            .from('guest_invitations')
            .select('password_changed')
            .eq('guest_user_id', user.id)
            .single();

          if (invitationData) {
            setNeedsPasswordChange(!invitationData.password_changed);
          }

          // Fetch guest project access
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
  }, [user, authLoading]);

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
