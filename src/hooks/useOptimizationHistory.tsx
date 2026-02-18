import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OptimizationRecord {
  id: string;
  project_id: string;
  entity_type: 'campaign' | 'ad_set' | 'ad';
  entity_id: string;
  entity_name: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  change_type: string;
  change_percentage: number | null;
  detected_at: string;
  created_at: string;
  changed_by: string | null;
  platform: 'meta'; // optimization_history is always Meta Ads
}

export function useOptimizationHistory(projectId: string | null) {
  const [history, setHistory] = useState<OptimizationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch with a focused set of fields - exclude redundant creative sub-fields
      // when multiple fields changed at same time for same entity, prioritize meaningful ones
      const { data, error: fetchError } = await supabase
        .from('optimization_history')
        .select('*')
        .eq('project_id', projectId)
        .order('detected_at', { ascending: false })
        .limit(1000);
      
      if (fetchError) throw fetchError;

      // Deduplicate: for ad entities with creative changes (headline/primary_text/cta)
      // group by entity_id + date-hour and keep only one creative change entry
      const seen = new Map<string, boolean>();
      const deduped: OptimizationRecord[] = [];

      for (const row of (data || []) as OptimizationRecord[]) {
        const isCreativeField = ['headline', 'primary_text', 'cta', 'creative_image_url', 'creative_video_url'].includes(row.field_changed);

        if (isCreativeField && row.entity_type === 'ad') {
          // Key: entity + hour bucket
          const hour = row.detected_at.substring(0, 13);
          const key = `creative_${row.entity_id}_${hour}`;
          if (seen.has(key)) continue; // skip duplicates
          seen.set(key, true);
        }

        // Skip pure "created" entries for ads (they bloat the list heavily)
        if (row.field_changed === 'created' && row.entity_type === 'ad') continue;

        deduped.push({ ...row, platform: 'meta' });
      }

      setHistory(deduped);
    } catch (err) {
      console.error('Error fetching optimization history:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { history, loading, error, refetch: fetchHistory };
}

