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
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole>('gestor');
  const [loading, setLoading] = useState(true);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [guestProjectIds, setGuestProjectIds] = useState<string[]>([]);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
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
        } else {
          // No role found, default to gestor
          setRole('gestor');
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
  }, [user]);

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
