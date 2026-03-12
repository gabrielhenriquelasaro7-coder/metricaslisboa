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
  | 'admin'
  | 'analytics'
  | 'instagram'
  | 'clarity'
  | 'diagnostico';

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
  'analytics': 'Google Analytics',
  'instagram': 'Instagram',
  'clarity': 'Clarity',
  'diagnostico': 'Diagnóstico',
};

// Tabs that are hidden by default and need to be explicitly enabled
const HIDDEN_BY_DEFAULT_TABS: TabKey[] = ['admin', 'analytics'];

interface UseTabVisibilityReturn {
  hiddenTabs: TabKey[];
  enabledTabs: TabKey[]; // Tabs that are explicitly enabled (for hidden-by-default tabs)
  loading: boolean;
  isTabHidden: (tab: TabKey) => boolean;
  refetch: () => Promise<void>;
}

interface UseTabVisibilityManagementReturn {
  userVisibilities: Map<string, TabKey[]>;
  userEnabledTabs: Map<string, TabKey[]>; // New: tabs explicitly enabled for each user
  loading: boolean;
  getHiddenTabs: (userId: string) => TabKey[];
  getEnabledTabs: (userId: string) => TabKey[];
  setHiddenTabs: (userId: string, hiddenTabs: TabKey[]) => Promise<void>;
  setEnabledTabs: (userId: string, enabledTabs: TabKey[]) => Promise<void>;
  toggleTab: (userId: string, tab: TabKey) => Promise<void>;
  fetchAllVisibilities: () => Promise<void>;
}

// Hook for checking current user's tab visibility
export function useTabVisibility(): UseTabVisibilityReturn {
  const { user } = useAuth();
  const [hiddenTabs, setHiddenTabs] = useState<TabKey[]>([]);
  const [enabledTabs, setEnabledTabs] = useState<TabKey[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVisibility = useCallback(async () => {
    if (!user) {
      setHiddenTabs([]);
      setEnabledTabs([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_tab_visibility')
        .select('hidden_tabs, enabled_tabs')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching tab visibility:', error);
        setHiddenTabs([]);
        setEnabledTabs([]);
      } else if (data) {
        setHiddenTabs((data.hidden_tabs || []) as TabKey[]);
        setEnabledTabs((data.enabled_tabs || []) as TabKey[]);
      } else {
        setHiddenTabs([]);
        setEnabledTabs([]);
      }
    } catch (error) {
      console.error('Error in useTabVisibility:', error);
      setHiddenTabs([]);
      setEnabledTabs([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchVisibility();
  }, [fetchVisibility]);

  const isTabHidden = useCallback((tab: TabKey) => {
    // If it's a hidden-by-default tab, it's hidden UNLESS explicitly enabled
    if (HIDDEN_BY_DEFAULT_TABS.includes(tab)) {
      return !enabledTabs.includes(tab);
    }
    // For normal tabs, it's visible unless explicitly hidden
    return hiddenTabs.includes(tab);
  }, [hiddenTabs, enabledTabs]);

  return {
    hiddenTabs,
    enabledTabs,
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
  const [userEnabledTabs, setUserEnabledTabs] = useState<Map<string, TabKey[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const fetchAllVisibilities = useCallback(async () => {
    if (!user || !isTech) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_tab_visibility')
        .select('user_id, hidden_tabs, enabled_tabs');

      if (error) {
        console.error('Error fetching all tab visibilities:', error);
      } else {
        const visMap = new Map<string, TabKey[]>();
        const enabledMap = new Map<string, TabKey[]>();
        data?.forEach((item) => {
          visMap.set(item.user_id, (item.hidden_tabs || []) as TabKey[]);
          enabledMap.set(item.user_id, (item.enabled_tabs || []) as TabKey[]);
        });
        setUserVisibilities(visMap);
        setUserEnabledTabs(enabledMap);
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

  const getEnabledTabs = useCallback((userId: string): TabKey[] => {
    return userEnabledTabs.get(userId) || [];
  }, [userEnabledTabs]);

  const setHiddenTabs = useCallback(async (userId: string, hiddenTabs: TabKey[]) => {
    if (!user || !isTech) return;

    try {
      const currentEnabled = userEnabledTabs.get(userId) || [];
      const { error } = await supabase
        .from('user_tab_visibility')
        .upsert({
          user_id: userId,
          hidden_tabs: hiddenTabs,
          enabled_tabs: currentEnabled,
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
  }, [user, isTech, userEnabledTabs]);

  const setEnabledTabs = useCallback(async (userId: string, enabledTabs: TabKey[]) => {
    if (!user || !isTech) return;

    try {
      const currentHidden = userVisibilities.get(userId) || [];
      const { error } = await supabase
        .from('user_tab_visibility')
        .upsert({
          user_id: userId,
          hidden_tabs: currentHidden,
          enabled_tabs: enabledTabs,
          hidden_by: user.id,
        }, { onConflict: 'user_id' });

      if (error) throw error;

      setUserEnabledTabs(prev => {
        const newMap = new Map(prev);
        newMap.set(userId, enabledTabs);
        return newMap;
      });
    } catch (error) {
      console.error('Error setting enabled tabs:', error);
      throw error;
    }
  }, [user, isTech, userVisibilities]);

  const toggleTab = useCallback(async (userId: string, tab: TabKey) => {
    // For hidden-by-default tabs, toggle the enabled state
    if (HIDDEN_BY_DEFAULT_TABS.includes(tab)) {
      const currentEnabled = getEnabledTabs(userId);
      const newEnabled = currentEnabled.includes(tab)
        ? currentEnabled.filter(t => t !== tab)
        : [...currentEnabled, tab];
      await setEnabledTabs(userId, newEnabled);
    } else {
      // For normal tabs, toggle the hidden state
      const currentHidden = getHiddenTabs(userId);
      const newHidden = currentHidden.includes(tab)
        ? currentHidden.filter(t => t !== tab)
        : [...currentHidden, tab];
      await setHiddenTabs(userId, newHidden);
    }
  }, [getHiddenTabs, getEnabledTabs, setHiddenTabs, setEnabledTabs]);

  return {
    userVisibilities,
    userEnabledTabs,
    loading,
    getHiddenTabs,
    getEnabledTabs,
    setHiddenTabs,
    setEnabledTabs,
    toggleTab,
    fetchAllVisibilities,
  };
}

// Export the list of hidden-by-default tabs for use in components
export { HIDDEN_BY_DEFAULT_TABS };
