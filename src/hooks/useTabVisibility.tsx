import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useCargo } from './useCargo';
import { supabase } from '@/integrations/supabase/client';

export type TabKey = 
  | 'dashboard' 
  | 'campaigns' 
  | 'creatives' 
  | 'ai-assistant' 
  | 'predictive' 
  | 'suggestions' 
  | 'whatsapp' 
  | 'financial' 
  | 'settings'
  | 'admin';

export interface TabVisibility {
  user_id: string;
  hidden_tabs: TabKey[];
}

export const TAB_LABELS: Record<TabKey, string> = {
  'dashboard': 'Dashboard',
  'campaigns': 'Campanhas',
  'creatives': 'Criativos',
  'ai-assistant': 'Agente Lisboa',
  'predictive': 'Análise Preditiva',
  'suggestions': 'Sugestões',
  'whatsapp': 'WhatsApp',
  'financial': 'Financeiro',
  'settings': 'Configurações',
  'admin': 'Administração',
};

interface UseTabVisibilityReturn {
  hiddenTabs: TabKey[];
  loading: boolean;
  isTabHidden: (tab: TabKey) => boolean;
  refetch: () => Promise<void>;
}

interface UseTabVisibilityManagementReturn {
  userVisibilities: Map<string, TabKey[]>;
  loading: boolean;
  getHiddenTabs: (userId: string) => TabKey[];
  setHiddenTabs: (userId: string, hiddenTabs: TabKey[]) => Promise<void>;
  toggleTab: (userId: string, tab: TabKey) => Promise<void>;
  fetchAllVisibilities: () => Promise<void>;
}

// Hook for checking current user's tab visibility
export function useTabVisibility(): UseTabVisibilityReturn {
  const { user } = useAuth();
  const [hiddenTabs, setHiddenTabs] = useState<TabKey[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVisibility = useCallback(async () => {
    if (!user) {
      setHiddenTabs([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_tab_visibility')
        .select('hidden_tabs')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching tab visibility:', error);
        setHiddenTabs([]);
      } else if (data) {
        setHiddenTabs((data.hidden_tabs || []) as TabKey[]);
      } else {
        setHiddenTabs([]);
      }
    } catch (error) {
      console.error('Error in useTabVisibility:', error);
      setHiddenTabs([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchVisibility();
  }, [fetchVisibility]);

  const isTabHidden = useCallback((tab: TabKey) => {
    return hiddenTabs.includes(tab);
  }, [hiddenTabs]);

  return {
    hiddenTabs,
    loading,
    isTabHidden,
    refetch: fetchVisibility,
  };
}

// Hook for Tech to manage user tab visibility
export function useTabVisibilityManagement(): UseTabVisibilityManagementReturn {
  const { user } = useAuth();
  const { isTech } = useCargo();
  const [userVisibilities, setUserVisibilities] = useState<Map<string, TabKey[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const fetchAllVisibilities = useCallback(async () => {
    if (!user || !isTech) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_tab_visibility')
        .select('user_id, hidden_tabs');

      if (error) {
        console.error('Error fetching all tab visibilities:', error);
      } else {
        const visMap = new Map<string, TabKey[]>();
        data?.forEach((item) => {
          visMap.set(item.user_id, (item.hidden_tabs || []) as TabKey[]);
        });
        setUserVisibilities(visMap);
      }
    } catch (error) {
      console.error('Error in useTabVisibilityManagement:', error);
    } finally {
      setLoading(false);
    }
  }, [user, isTech]);

  useEffect(() => {
    fetchAllVisibilities();
  }, [fetchAllVisibilities]);

  const getHiddenTabs = useCallback((userId: string): TabKey[] => {
    return userVisibilities.get(userId) || [];
  }, [userVisibilities]);

  const setHiddenTabs = useCallback(async (userId: string, hiddenTabs: TabKey[]) => {
    if (!user || !isTech) return;

    try {
      const { error } = await supabase
        .from('user_tab_visibility')
        .upsert({
          user_id: userId,
          hidden_tabs: hiddenTabs,
          hidden_by: user.id,
        }, { onConflict: 'user_id' });

      if (error) throw error;

      setUserVisibilities(prev => {
        const newMap = new Map(prev);
        newMap.set(userId, hiddenTabs);
        return newMap;
      });
    } catch (error) {
      console.error('Error setting hidden tabs:', error);
      throw error;
    }
  }, [user, isTech]);

  const toggleTab = useCallback(async (userId: string, tab: TabKey) => {
    const currentHidden = getHiddenTabs(userId);
    const newHidden = currentHidden.includes(tab)
      ? currentHidden.filter(t => t !== tab)
      : [...currentHidden, tab];
    
    await setHiddenTabs(userId, newHidden);
  }, [getHiddenTabs, setHiddenTabs]);

  return {
    userVisibilities,
    loading,
    getHiddenTabs,
    setHiddenTabs,
    toggleTab,
    fetchAllVisibilities,
  };
}
