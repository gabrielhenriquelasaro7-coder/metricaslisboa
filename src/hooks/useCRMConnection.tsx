import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type CRMProvider = 'kommo' | 'hubspot' | 'gohighlevel' | 'bitrix24' | 'rdstation' | 'outros';

export interface CRMConnectionStatus {
  connected: boolean;
  connection_id?: string;
  provider?: CRMProvider;
  display_name?: string;
  status?: string;
  connected_at?: string;
  last_error?: string;
  sync?: {
    id: string;
    type: string;
    status: string;
    started_at: string;
    completed_at?: string;
    records_processed: number;
    records_created: number;
    records_updated: number;
    records_failed: number;
    error_message?: string;
  };
  stats?: {
    total_deals: number;
    won_deals: number;
    lost_deals: number;
    open_deals: number;
    total_revenue: number;
    total_pipeline_value: number;
  };
}

export function useCRMConnection(projectId: string | undefined) {
  const [status, setStatus] = useState<CRMConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState<CRMProvider | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!projectId) return;
    
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await supabase.functions.invoke('crm-status', {
        body: null,
        headers: {},
      });

      // Use query params approach
      const { data, error } = await supabase.functions.invoke('crm-status', {
        method: 'GET',
      });

      if (error) throw error;
      setStatus(data);
    } catch (error) {
      console.error('Failed to fetch CRM status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const connect = useCallback(async (
    provider: CRMProvider,
    options?: { api_key?: string; api_url?: string; config?: Record<string, unknown> }
  ) => {
    if (!projectId) return;
    
    setIsConnecting(provider);
    try {
      const { data, error } = await supabase.functions.invoke('crm-connect', {
        body: {
          project_id: projectId,
          provider,
          ...options,
        },
      });

      if (error) throw error;

      if (data.oauth_url) {
        // Redirect to OAuth
        window.location.href = data.oauth_url;
      } else if (data.success) {
        toast.success('CRM conectado com sucesso!');
        await fetchStatus();
      }

      return data;
    } catch (error) {
      console.error('Failed to connect CRM:', error);
      toast.error('Erro ao conectar CRM');
      throw error;
    } finally {
      setIsConnecting(null);
    }
  }, [projectId, fetchStatus]);

  const disconnect = useCallback(async () => {
    if (!projectId || !status?.connection_id) return;

    try {
      const { error } = await supabase
        .from('crm_connections')
        .update({ status: 'disconnected' })
        .eq('id', status.connection_id);

      if (error) throw error;

      toast.success('CRM desconectado');
      setStatus(null);
    } catch (error) {
      console.error('Failed to disconnect CRM:', error);
      toast.error('Erro ao desconectar CRM');
    }
  }, [projectId, status?.connection_id]);

  const triggerSync = useCallback(async (syncType: 'full' | 'incremental' = 'incremental') => {
    if (!projectId || !status?.connection_id) return;

    try {
      const { data, error } = await supabase.functions.invoke('crm-sync', {
        body: {
          connection_id: status.connection_id,
          project_id: projectId,
          sync_type: syncType,
        },
      });

      if (error) throw error;

      toast.success('Sincronização iniciada');
      return data;
    } catch (error) {
      console.error('Failed to trigger sync:', error);
      toast.error('Erro ao sincronizar');
      throw error;
    }
  }, [projectId, status?.connection_id]);

  return {
    status,
    isLoading,
    isConnecting,
    fetchStatus,
    connect,
    disconnect,
    triggerSync,
  };
}
