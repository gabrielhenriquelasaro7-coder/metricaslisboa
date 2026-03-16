import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
<<<<<<< HEAD
  isMaster: boolean;
  
=======

>>>>>>> e31e31f (fix(google-ads): paginacao nas dailymetrics para evitar limite supabase de 1000 items)
  // Computed permissions
  isTech: boolean;
  isGerente: boolean;
  isCoordenador: boolean;
  isInvestidor: boolean;
  isMembro: boolean;
  isMaster: boolean;

  // Visibility helpers
  canSeeAllProjects: boolean;
  canManageSquads: boolean;
  canManageUsers: boolean;
  canAccessFullAdmin: boolean;
  canImportProject: boolean;
  canSeeAnalytics: boolean;
  canSeeDiagnostics: boolean;
  needsAdminApproval: boolean;

  // Actions
  refetch: () => Promise<void>;
}

// ---- Global singleton cache to prevent duplicate fetches across components ----
let globalCargoCache: {
  userId: string | null;
  cargo: UserCargo;
  isMaster: boolean;
  squads: Squad[];
  loaded: boolean;
  fetchPromise: Promise<void> | null;
} = {
  userId: null,
  cargo: 'membro',
  isMaster: false,
  squads: [],
  loaded: false,
  fetchPromise: null,
};

let globalListeners: Set<() => void> = new Set();

function notifyListeners() {
  globalListeners.forEach(fn => fn());
}

async function fetchCargoGlobal(userId: string) {
  // If already fetching for same user, reuse the promise
  if (globalCargoCache.fetchPromise && globalCargoCache.userId === userId) {
    return globalCargoCache.fetchPromise;
  }

  // If already loaded for same user, skip
  if (globalCargoCache.loaded && globalCargoCache.userId === userId) {
    return;
  }

  globalCargoCache.userId = userId;

  const promise = (async () => {
    try {
      const [roleRes, squadRes] = await Promise.all([
        supabase
          .from('user_roles')
          .select('cargo, is_master')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('squad_members')
          .select(`
            id, user_id, squad_id, created_at,
            squads:squad_id (id, name, description, color, created_at, updated_at)
          `)
          .eq('user_id', userId),
      ]);

      if (roleRes.error) {
        console.error('Error fetching user cargo:', roleRes.error);
        globalCargoCache.cargo = 'membro';
        globalCargoCache.isMaster = false;
      } else if (roleRes.data?.cargo) {
        globalCargoCache.cargo = roleRes.data.cargo as UserCargo;
        globalCargoCache.isMaster = roleRes.data.is_master === true;
      } else {
        globalCargoCache.cargo = 'membro';
        globalCargoCache.isMaster = false;
      }

      // Cache to localStorage
      localStorage.setItem('user-cargo-cache', JSON.stringify({
        userId,
        cargo: globalCargoCache.cargo,
      }));

      if (squadRes.error) {
        console.error('Error fetching user squads:', squadRes.error);
        globalCargoCache.squads = [];
      } else {
        globalCargoCache.squads = (squadRes.data || [])
          .map((sm: any) => sm.squads)
          .filter(Boolean) as Squad[];
      }

      globalCargoCache.loaded = true;
    } catch (error) {
      console.error('Error in fetchCargoGlobal:', error);
      globalCargoCache.cargo = 'membro';
      globalCargoCache.squads = [];
      globalCargoCache.loaded = true;
    } finally {
      globalCargoCache.fetchPromise = null;
      notifyListeners();
    }
  })();

  globalCargoCache.fetchPromise = promise;
  return promise;
}

export function useCargo(): CargoData {
  const { user, loading: authLoading } = useAuth();
  const [, forceUpdate] = useState(0);
  const mountedRef = useRef(true);

  // Subscribe to global cache changes
  useEffect(() => {
    mountedRef.current = true;
    const listener = () => {
      if (mountedRef.current) forceUpdate(c => c + 1);
    };
    globalListeners.add(listener);
    return () => {
      mountedRef.current = false;
      globalListeners.delete(listener);
    };
  }, []);

  // Reset cache when user changes
  useEffect(() => {
    if (!authLoading && user && globalCargoCache.userId !== user.id) {
      globalCargoCache.loaded = false;
      globalCargoCache.fetchPromise = null;
    }
    if (!authLoading && !user) {
      globalCargoCache = { userId: null, cargo: 'membro', isMaster: false, squads: [], loaded: false, fetchPromise: null };
      localStorage.removeItem('user-cargo-cache');
      notifyListeners();
    }
  }, [user?.id, authLoading]);

  // Trigger fetch
  useEffect(() => {
    if (authLoading || !user) return;
    fetchCargoGlobal(user.id);
  }, [user?.id, authLoading]);

  const cargo = globalCargoCache.userId === user?.id ? globalCargoCache.cargo : (() => {
    try {
      const cached = localStorage.getItem('user-cargo-cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.userId === user?.id) return parsed.cargo as UserCargo;
      }
    } catch { /* ignore */ }
    return 'membro' as UserCargo;
  })();

  const loading = authLoading || (!!user && !globalCargoCache.loaded && globalCargoCache.userId === user?.id);
  const userSquads = globalCargoCache.userId === user?.id ? globalCargoCache.squads : [];

  // Computed permissions
  const isTech = cargo === 'tech';
  const isGerente = cargo === 'gerente';
  const isCoordenador = cargo === 'coordenador';
  const isInvestidor = cargo === 'investidor';
  const isMembro = cargo === 'membro';
  const isMaster = globalCargoCache.userId === user?.id ? globalCargoCache.isMaster : false;

  return {
    cargo,
    loading,
    userSquads,
    isMaster,
    isTech,
    isGerente,
    isCoordenador,
    isInvestidor,
    isMembro,
    isMaster,
    canSeeAllProjects: isTech || isGerente,
    canManageSquads: isTech || isGerente,
    canManageUsers: isGerente,
    canAccessFullAdmin: isTech,
    canImportProject: isTech || isGerente || isCoordenador,
    canSeeAnalytics: isTech || isMaster,
    canSeeDiagnostics: isTech || isMaster,
    needsAdminApproval: isInvestidor || isCoordenador,
    refetch: async () => {
      if (!user) return;
      globalCargoCache.loaded = false;
      globalCargoCache.fetchPromise = null;
      await fetchCargoGlobal(user.id);
    },
  };
}
