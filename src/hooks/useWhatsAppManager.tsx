import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ManagerInstance {
  id: string;
  user_id: string;
  instance_name: string;
  display_name: string;
  instance_status: string;
  phone_connected: string | null;
  qr_code: string | null;
  qr_code_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportConfig {
  id: string;
  user_id: string;
  instance_id: string | null;
  project_id: string;
  target_type: string;
  phone_number: string | null;
  group_id: string | null;
  group_name: string | null;
  report_enabled: boolean;
  report_day_of_week: number;
  report_time: string;
  report_period: string;
  message_template: string | null;
  include_spend: boolean;
  include_leads: boolean;
  include_cpl: boolean;
  include_impressions: boolean;
  include_clicks: boolean;
  include_ctr: boolean;
  include_roas: boolean;
  include_reach: boolean;
  include_cpm: boolean;
  include_cpc: boolean;
  include_conversions: boolean;
  include_conversion_value: boolean;
  include_frequency: boolean;
  balance_alert_enabled: boolean;
  balance_alert_threshold: number;
  last_balance_alert_at: string | null;
  last_report_sent_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  project?: {
    id: string;
    name: string;
    business_model: string;
  };
  instance?: ManagerInstance;
}

export interface WhatsAppGroup {
  id: string;
  name: string;
}

const MAX_INSTANCES = 4;

export function useWhatsAppManager() {
  const [instances, setInstances] = useState<ManagerInstance[]>([]);
  const [configs, setConfigs] = useState<ReportConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchInstances = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('whatsapp_manager_instances')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setInstances((data || []) as ManagerInstance[]);
    } catch (error) {
      console.error('Erro ao buscar instâncias:', error);
    }
  }, []);

  const fetchConfigs = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('whatsapp_report_configs')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      setConfigs((data || []) as ReportConfig[]);
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchInstances(), fetchConfigs()]);
    setLoading(false);
  }, [fetchInstances, fetchConfigs]);

  const createInstance = async (displayName: string): Promise<ManagerInstance | null> => {
    if (instances.length >= MAX_INSTANCES) {
      toast.error(`Limite de ${MAX_INSTANCES} conexões atingido`);
      return null;
    }

    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      // Call edge function to create instance
      const { data, error } = await supabase.functions.invoke('whatsapp-manager-instance', {
        body: { action: 'create', displayName, isManager: true }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao criar instância');

      await fetchInstances();
      toast.success('Conexão criada com sucesso!');
      return data.instance;
    } catch (error: any) {
      console.error('Erro ao criar instância:', error);
      toast.error(error.message || 'Erro ao criar conexão');
      return null;
    } finally {
      setCreating(false);
    }
  };

  const connectInstance = async (instanceId: string): Promise<{ qrCode: string | null; expiresAt: string | null }> => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-manager-instance', {
        body: { action: 'connect', instanceId, isManager: true }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao conectar');

      return {
        qrCode: data.qrCode,
        expiresAt: data.expiresAt
      };
    } catch (error: any) {
      console.error('Erro ao conectar:', error);
      toast.error(error.message || 'Erro ao obter QR Code');
      return { qrCode: null, expiresAt: null };
    }
  };

  const checkStatus = async (instanceId: string): Promise<{ status: string; phone: string | null }> => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-manager-instance', {
        body: { action: 'status', instanceId, isManager: true }
      });

      if (error) throw error;

      // Update local state
      setInstances(prev => prev.map(inst => 
        inst.id === instanceId 
          ? { ...inst, instance_status: data.status, phone_connected: data.phone }
          : inst
      ));

      return { status: data.status, phone: data.phone };
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      return { status: 'disconnected', phone: null };
    }
  };

  const disconnectInstance = async (instanceId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-manager-instance', {
        body: { action: 'disconnect', instanceId, isManager: true }
      });

      if (error) throw error;
      
      await fetchInstances();
      toast.success('Desconectado com sucesso');
      return true;
    } catch (error: any) {
      console.error('Erro ao desconectar:', error);
      toast.error(error.message || 'Erro ao desconectar');
      return false;
    }
  };

  const deleteInstance = async (instanceId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-manager-instance', {
        body: { action: 'delete', instanceId, isManager: true }
      });

      if (error) throw error;

      await fetchInstances();
      toast.success('Conexão removida');
      return true;
    } catch (error: any) {
      console.error('Erro ao deletar:', error);
      toast.error(error.message || 'Erro ao remover conexão');
      return false;
    }
  };

  const updateInstanceName = async (instanceId: string, displayName: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('whatsapp_manager_instances')
        .update({ display_name: displayName })
        .eq('id', instanceId);

      if (error) throw error;

      setInstances(prev => prev.map(inst =>
        inst.id === instanceId ? { ...inst, display_name: displayName } : inst
      ));
      
      toast.success('Nome atualizado');
      return true;
    } catch (error) {
      console.error('Erro ao atualizar nome:', error);
      toast.error('Erro ao atualizar nome');
      return false;
    }
  };

  const listGroups = async (instanceId: string): Promise<WhatsAppGroup[]> => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-manager-instance', {
        body: { action: 'list_groups', instanceId, isManager: true }
      });

      if (error) throw error;
      return data.groups || [];
    } catch (error) {
      console.error('Erro ao listar grupos:', error);
      return [];
    }
  };

  const saveConfig = async (config: Partial<ReportConfig> & { project_id: string }): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const existingConfig = configs.find(c => c.project_id === config.project_id);

      if (existingConfig) {
        const { error } = await supabase
          .from('whatsapp_report_configs')
          .update(config)
          .eq('id', existingConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('whatsapp_report_configs')
          .insert({ ...config, user_id: user.id });
        if (error) throw error;
      }

      await fetchConfigs();
      toast.success('Configuração salva');
      return true;
    } catch (error: any) {
      console.error('Erro ao salvar config:', error);
      toast.error(error.message || 'Erro ao salvar configuração');
      return false;
    }
  };

  const deleteConfig = async (projectId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('whatsapp_report_configs')
        .delete()
        .eq('project_id', projectId);

      if (error) throw error;

      await fetchConfigs();
      toast.success('Configuração removida');
      return true;
    } catch (error) {
      console.error('Erro ao remover config:', error);
      toast.error('Erro ao remover configuração');
      return false;
    }
  };

  const getConfigForProject = (projectId: string): ReportConfig | undefined => {
    return configs.find(c => c.project_id === projectId);
  };

  return {
    instances,
    configs,
    loading,
    creating,
    maxInstances: MAX_INSTANCES,
    canCreateInstance: instances.length < MAX_INSTANCES,
    fetchAll,
    fetchInstances,
    fetchConfigs,
    createInstance,
    connectInstance,
    checkStatus,
    disconnectInstance,
    deleteInstance,
    updateInstanceName,
    listGroups,
    saveConfig,
    deleteConfig,
    getConfigForProject,
  };
}
