import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface WhatsAppInstance {
  id: string;
  project_id: string;
  user_id: string;
  instance_name: string;
  display_name: string;
  instance_status: 'disconnected' | 'connecting' | 'connected';
  phone_connected: string | null;
  qr_code: string | null;
  qr_code_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppGroup {
  id: string;
  name: string;
}

export function useWhatsAppInstances(projectId: string | null) {
  const { user } = useAuth();
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchInstances = useCallback(async () => {
    if (!user || !projectId) return;

    setLoading(true);
    try {
      // Explicitly select only non-sensitive fields (exclude 'token' for security)
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('id, project_id, user_id, instance_name, display_name, instance_status, phone_connected, qr_code, qr_code_expires_at, created_at, updated_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setInstances((data as WhatsAppInstance[]) || []);
    } catch (error) {
      console.error('Error fetching instances:', error);
    } finally {
      setLoading(false);
    }
  }, [user, projectId]);

  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  const createInstance = async (displayName: string = 'Nova Conexão') => {
    if (!user || !projectId) return null;

    if (instances.length >= 3) {
      toast.error('Limite de 3 conexões por projeto atingido');
      return null;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instance-manager', {
        body: {
          action: 'create',
          projectId,
          displayName,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success('Conexão criada com sucesso');
      await fetchInstances();
      return data.instance;
    } catch (error) {
      console.error('Error creating instance:', error);
      toast.error('Erro ao criar conexão');
      return null;
    } finally {
      setCreating(false);
    }
  };

  const connectInstance = async (instanceId: string): Promise<{ qrCode: string; expiresAt: string } | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instance-manager', {
        body: {
          action: 'connect',
          instanceId,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return {
        qrCode: data.qrCode,
        expiresAt: data.expiresAt,
      };
    } catch (error) {
      console.error('Error connecting instance:', error);
      toast.error('Erro ao obter QR Code');
      return null;
    }
  };

  const checkStatus = async (instanceId: string): Promise<{ status: string; phoneNumber: string | null } | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instance-manager', {
        body: {
          action: 'status',
          instanceId,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Update local state
      setInstances(prev => prev.map(inst => 
        inst.id === instanceId 
          ? { 
              ...inst, 
              instance_status: data.status as 'connected' | 'disconnected',
              phone_connected: data.phoneNumber,
            }
          : inst
      ));

      return {
        status: data.status,
        phoneNumber: data.phoneNumber,
      };
    } catch (error) {
      console.error('Error checking status:', error);
      return null;
    }
  };

  const disconnectInstance = async (instanceId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instance-manager', {
        body: {
          action: 'disconnect',
          instanceId,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success('WhatsApp desconectado');
      await fetchInstances();
    } catch (error) {
      console.error('Error disconnecting instance:', error);
      toast.error('Erro ao desconectar');
    }
  };

  const deleteInstance = async (instanceId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instance-manager', {
        body: {
          action: 'delete',
          instanceId,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success('Conexão removida');
      await fetchInstances();
    } catch (error) {
      console.error('Error deleting instance:', error);
      toast.error('Erro ao remover conexão');
    }
  };

  const listGroups = async (instanceId: string): Promise<WhatsAppGroup[]> => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-instance-manager', {
        body: {
          action: 'list_groups',
          instanceId,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data.groups || [];
    } catch (error) {
      console.error('Error listing groups:', error);
      toast.error('Erro ao listar grupos');
      return [];
    }
  };

  const updateDisplayName = async (instanceId: string, displayName: string) => {
    try {
      const { error } = await supabase
        .from('whatsapp_instances')
        .update({ display_name: displayName })
        .eq('id', instanceId);

      if (error) throw error;

      setInstances(prev => prev.map(inst =>
        inst.id === instanceId ? { ...inst, display_name: displayName } : inst
      ));

      toast.success('Nome atualizado');
    } catch (error) {
      console.error('Error updating display name:', error);
      toast.error('Erro ao atualizar nome');
    }
  };

  return {
    instances,
    loading,
    creating,
    createInstance,
    connectInstance,
    checkStatus,
    disconnectInstance,
    deleteInstance,
    listGroups,
    updateDisplayName,
    refetch: fetchInstances,
  };
}
