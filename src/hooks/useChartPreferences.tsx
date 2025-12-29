import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export interface ChartPreference {
  id?: string;
  chart_key: string;
  custom_name: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  chart_type: string;
  primary_metric: string;
  secondary_metric: string;
}

export function useChartPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<Map<string, ChartPreference>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences from database
  useEffect(() => {
    const loadPreferences = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('chart_preferences')
          .select('*')
          .eq('user_id', user.id);

        if (error) throw error;

        const prefsMap = new Map<string, ChartPreference>();
        data?.forEach((pref: any) => {
          prefsMap.set(pref.chart_key, {
            id: pref.id,
            chart_key: pref.chart_key,
            custom_name: pref.custom_name,
            primary_color: pref.primary_color,
            secondary_color: pref.secondary_color,
            chart_type: pref.chart_type,
            primary_metric: pref.primary_metric,
            secondary_metric: pref.secondary_metric,
          });
        });
        setPreferences(prefsMap);
      } catch (error) {
        console.error('Error loading chart preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, [user?.id]);

  // Save preference to database
  const savePreference = useCallback(async (chartKey: string, pref: Partial<ChartPreference>) => {
    if (!user?.id) return;

    const existing = preferences.get(chartKey);
    
    try {
      if (existing?.id) {
        // Update existing
        const { error } = await supabase
          .from('chart_preferences')
          .update({
            custom_name: pref.custom_name,
            primary_color: pref.primary_color,
            secondary_color: pref.secondary_color,
            chart_type: pref.chart_type,
            primary_metric: pref.primary_metric,
            secondary_metric: pref.secondary_metric,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('chart_preferences')
          .insert({
            user_id: user.id,
            chart_key: chartKey,
            custom_name: pref.custom_name || null,
            primary_color: pref.primary_color || null,
            secondary_color: pref.secondary_color || null,
            chart_type: pref.chart_type || 'composed',
            primary_metric: pref.primary_metric || 'spend',
            secondary_metric: pref.secondary_metric || 'conversions',
          })
          .select()
          .single();

        if (error) throw error;
        
        if (data) {
          pref.id = data.id;
        }
      }

      // Update local state
      setPreferences(prev => {
        const newMap = new Map(prev);
        newMap.set(chartKey, {
          ...existing,
          ...pref,
          chart_key: chartKey,
        } as ChartPreference);
        return newMap;
      });

      toast({
        title: "Preferências salvas",
        description: "As configurações do gráfico foram salvas.",
      });
    } catch (error) {
      console.error('Error saving chart preference:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as preferências do gráfico.",
        variant: "destructive",
      });
    }
  }, [user?.id, preferences]);

  const getPreference = useCallback((chartKey: string): ChartPreference | undefined => {
    return preferences.get(chartKey);
  }, [preferences]);

  return {
    preferences,
    isLoading,
    savePreference,
    getPreference,
  };
}
