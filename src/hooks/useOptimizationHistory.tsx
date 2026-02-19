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
  platform: 'meta' | 'google';
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
      // Fetch Meta Ads optimization history
      const { data: metaData, error: metaError } = await supabase
        .from('optimization_history')
        .select('*')
        .eq('project_id', projectId)
        .order('detected_at', { ascending: false })
        .limit(500);
      
      if (metaError) throw metaError;

      // Deduplicate Meta creative changes
      const seen = new Map<string, boolean>();
      const metaDeduped: OptimizationRecord[] = [];

      for (const row of (metaData || []) as OptimizationRecord[]) {
        const isCreativeField = ['headline', 'primary_text', 'cta', 'creative_image_url', 'creative_video_url'].includes(row.field_changed);

        if (isCreativeField && row.entity_type === 'ad') {
          const hour = row.detected_at.substring(0, 13);
          const key = `creative_${row.entity_id}_${hour}`;
          if (seen.has(key)) continue;
          seen.set(key, true);
        }

        // Skip pure "created" entries for ads (they bloat the list heavily)
        if (row.field_changed === 'created' && row.entity_type === 'ad') continue;

        metaDeduped.push({ ...row, platform: 'meta' });
      }

      // Fetch Google Ads changes (from google_campaigns status changes)
      // We detect changes by looking at google_campaigns that have been modified
      let googleRecords: OptimizationRecord[] = [];
      try {
        const { data: googleCampaigns } = await supabase
          .from('google_campaigns')
          .select('id, name, status, spend, impressions, clicks, conversions, synced_at, created_at')
          .eq('project_id', projectId)
          .order('synced_at', { ascending: false })
          .limit(100);

        if (googleCampaigns && googleCampaigns.length > 0) {
          // Create synthetic records for recent Google campaign syncs
          googleRecords = googleCampaigns
            .filter(c => c.synced_at)
            .map(c => ({
              id: `google_${c.id}`,
              project_id: projectId,
              entity_type: 'campaign' as const,
              entity_id: c.id,
              entity_name: c.name,
              field_changed: 'status',
              old_value: null,
              new_value: c.status,
              change_type: c.status === 'PAUSED' ? 'paused' : c.status === 'ENABLED' ? 'activated' : 'status_change',
              change_percentage: null,
              detected_at: c.synced_at || c.created_at,
              created_at: c.created_at,
              changed_by: null,
              platform: 'google' as const,
            }));
        }
      } catch (googleErr) {
        console.warn('Could not fetch Google history:', googleErr);
      }

      // Combine and sort by date
      const combined = [...metaDeduped, ...googleRecords]
        .sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime());

      setHistory(combined);
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
