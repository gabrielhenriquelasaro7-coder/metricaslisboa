import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

// New cargo system types
export type UserCargo = 'tech' | 'gerente' | 'coordenador' | 'investidor' | 'membro';

export interface Squad {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface SquadMember {
  id: string;
  user_id: string;
  squad_id: string;
  created_at: string;
  squad?: Squad;
}

export interface AdminAccessRequest {
  id: string;
  user_id: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface CargoData {
  cargo: UserCargo;
  loading: boolean;
  userSquads: Squad[];
  
  // Computed permissions
  isTech: boolean;
  isGerente: boolean;
  isCoordenador: boolean;
  isInvestidor: boolean;
  isMembro: boolean;
  
  // Visibility helpers
  canSeeAllProjects: boolean; // Tech e Gerente
  canManageSquads: boolean;   // Tech e Gerente
  canManageUsers: boolean;    // Gerente only
  canAccessFullAdmin: boolean; // Tech only
  needsAdminApproval: boolean; // Investidor e Coordenador
  
  // Actions
  refetch: () => Promise<void>;
}

export function useCargo(): CargoData {
  const { user, loading: authLoading } = useAuth();
  
  // Try to get cached cargo to avoid flash
  const [cargo, setCargo] = useState<UserCargo>(() => {
    try {
      const cached = localStorage.getItem('user-cargo-cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.userId === user?.id) {
          return parsed.cargo as UserCargo;
        }
      }
    } catch {
      // Ignore
    }
    return 'membro';
  });
  
  const [loading, setLoading] = useState(true);
  const [userSquads, setUserSquads] = useState<Squad[]>([]);
  const fetchedRef = useRef(false);

  const fetchCargoData = useCallback(async () => {
    if (authLoading) return;
    
    if (!user) {
      localStorage.removeItem('user-cargo-cache');
      setCargo('membro');
      setUserSquads([]);
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
      // Fetch user cargo from user_roles
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('cargo')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleError) {
        console.error('Error fetching user cargo:', roleError);
        setCargo('membro');
      } else if (roleData?.cargo) {
        setCargo(roleData.cargo as UserCargo);
        localStorage.setItem('user-cargo-cache', JSON.stringify({
          userId: user.id,
          cargo: roleData.cargo
        }));
      } else {
        setCargo('membro');
        localStorage.setItem('user-cargo-cache', JSON.stringify({
          userId: user.id,
          cargo: 'membro'
        }));
      }

      // Fetch user squads
      const { data: squadData, error: squadError } = await supabase
        .from('squad_members')
        .select(`
          id,
          user_id,
          squad_id,
          created_at,
          squads:squad_id (
            id,
            name,
            description,
            color,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', user.id);

      if (squadError) {
        console.error('Error fetching user squads:', squadError);
      } else if (squadData) {
        const squads = squadData
          .map((sm: any) => sm.squads)
          .filter(Boolean) as Squad[];
        setUserSquads(squads);
      }
    } catch (error) {
      console.error('Error in useCargo:', error);
    } finally {
      setLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    // Safety timeout
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('[useCargo] Timeout - forcing loading to false');
        setLoading(false);
      }
    }, 3000);

    fetchCargoData();

    return () => clearTimeout(timeoutId);
  }, [fetchCargoData]);

  // Reset fetch ref when user changes
  useEffect(() => {
    fetchedRef.current = false;
  }, [user?.id]);

  // Computed permissions based on cargo
  const isTech = cargo === 'tech';
  const isGerente = cargo === 'gerente';
  const isCoordenador = cargo === 'coordenador';
  const isInvestidor = cargo === 'investidor';
  const isMembro = cargo === 'membro';

  const canSeeAllProjects = isTech || isGerente;
  const canManageSquads = isTech || isGerente;
  const canManageUsers = isGerente; // Only Gerente can change user squads and delete investors
  const canAccessFullAdmin = isTech;
  const needsAdminApproval = isInvestidor || isCoordenador;

  return {
    cargo,
    loading,
    userSquads,
    
    isTech,
    isGerente,
    isCoordenador,
    isInvestidor,
    isMembro,
    
    canSeeAllProjects,
    canManageSquads,
    canManageUsers,
    canAccessFullAdmin,
    needsAdminApproval,
    
    refetch: async () => {
      fetchedRef.current = false;
      await fetchCargoData();
    },
  };
}
