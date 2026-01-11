import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type CRMProvider = 'kommo' | 'hubspot' | 'gohighlevel' | 'bitrix24' | 'rdstation' | 'outros';

export interface CRMPipeline {
  id: string;
  name: string;
  is_main: boolean;
  deals_count: number;
}

export interface CRMStage {
  id: string;
  name: string;
  color: string;
  sort: number;
  type: number;
  leads_count: number;
  total_value: number;
}

export interface CRMDeal {
  id: string;
  title: string;
  contact_name?: string;
  contact_phone?: string;
  value?: number;
  stage_id: string;
  created_date?: string;
  utm_source?: string;
}

export interface CRMConnectionStatus {
  connected: boolean;
  connection_id?: string;
  provider?: CRMProvider;
  display_name?: string;
  status?: string;
  connected_at?: string;
  last_error?: string;
  api_url?: string;
  selected_pipeline_id?: string | null;
  pipelines?: CRMPipeline[];
  stages?: CRMStage[];
  deals?: CRMDeal[];
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
  funnel?: {
    leads: number;
    mql: number;
    sql: number;
    sales: number;
    revenue: number;
  };
}

export function useCRMConnection(projectId: string | undefined) {
  const [status, setStatus] = useState<CRMConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState<CRMProvider | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!projectId) return;
    
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus(null);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-status?project_id=${projectId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('CRM status error:', errorData);
        setStatus({ connected: false });
        return;
      }

      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Failed to fetch CRM status:', error);
      setStatus({ connected: false });
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Fetch status on mount and when projectId changes
  useEffect(() => {
    if (projectId) {
      fetchStatus();
    }
  }, [projectId, fetchStatus]);

  const connect = useCallback(async (
    provider: CRMProvider,
    options?: { api_key?: string; api_url?: string; config?: Record<string, unknown> }
  ) => {
    if (!projectId) {
      throw new Error('Project ID is required');
    }
    
    setIsConnecting(provider);
    setConnectionError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-connect`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            project_id: projectId,
            provider,
            api_key: options?.api_key,
            api_url: options?.api_url,
            config: options?.config,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || 'Erro ao conectar CRM';
        setConnectionError(errorMsg);
        throw new Error(errorMsg);
      }

      if (data.oauth_url) {
        // Redirect to OAuth
        window.location.href = data.oauth_url;
        return data;
      }

      if (data.success) {
        toast.success(data.message || 'CRM conectado com sucesso!');
        await fetchStatus();
      }

      return data;
    } catch (error) {
      console.error('Failed to connect CRM:', error);
      const errorMsg = error instanceof Error ? error.message : 'Erro ao conectar CRM';
      setConnectionError(errorMsg);
      toast.error(errorMsg);
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
      setStatus({ connected: false });
    } catch (error) {
      console.error('Failed to disconnect CRM:', error);
      toast.error('Erro ao desconectar CRM');
    }
  }, [projectId, status?.connection_id]);

  const triggerSync = useCallback(async (syncType: 'full' | 'incremental' = 'incremental') => {
    if (!projectId || !status?.connection_id) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-sync`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            connection_id: status.connection_id,
            project_id: projectId,
            sync_type: syncType,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao sincronizar');
      }

      toast.success('Sincronização iniciada');
      
      // Refresh status after a delay to get updated sync info
      setTimeout(() => fetchStatus(), 2000);
      
      return data;
    } catch (error) {
      console.error('Failed to trigger sync:', error);
      toast.error('Erro ao sincronizar');
      throw error;
    }
  }, [projectId, status?.connection_id, fetchStatus]);

  const selectPipeline = useCallback(async (pipelineId: string) => {
    if (!projectId || !status?.connection_id) return;

    try {
      // Update the connection config with selected pipeline
      const { error } = await supabase
        .from('crm_connections')
        .update({ 
          config: { 
            ...(typeof status === 'object' ? {} : {}),
            selected_pipeline_id: pipelineId 
          } 
        })
        .eq('id', status.connection_id);

      if (error) throw error;

      toast.success('Funil selecionado com sucesso');
      await fetchStatus();
    } catch (error) {
      console.error('Failed to select pipeline:', error);
      toast.error('Erro ao selecionar funil');
      throw error;
    }
  }, [projectId, status?.connection_id, fetchStatus]);

  return {
    status,
    isLoading,
    isConnecting,
    connectionError,
    fetchStatus,
    connect,
    disconnect,
    triggerSync,
    selectPipeline,
  };
}
