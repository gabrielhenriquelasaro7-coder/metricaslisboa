import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type BusinessModel = 'inside_sales' | 'ecommerce' | 'pdv';

export interface Project {
  id: string;
  name: string;
  ad_account_id: string;
  business_model: BusinessModel;
  timezone: string;
  currency: string;
  webhook_status: string;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
  archived: boolean;
  archived_at: string | null;
}

export interface CreateProjectData {
  name: string;
  ad_account_id: string;
  business_model: BusinessModel;
  timezone: string;
  currency: string;
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data as Project[] || []);
    } catch (error) {
      toast.error('Erro ao carregar projetos');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = async (data: CreateProjectData) => {
    if (!user) throw new Error('Usuário não autenticado');

    try {
      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          ...data,
        })
        .select()
        .single();

      if (error) throw error;

      // Trigger webhook for synchronization
      try {
        await supabase.functions.invoke('sync-webhook', {
          body: {
            user_id: user.id,
            project_id: project.id,
            ad_account_id: data.ad_account_id,
            business_model: data.business_model,
          },
        });
      } catch (webhookError) {
        console.error('Webhook error:', webhookError);
      }

      // ALWAYS trigger historical import for new projects
      try {
        console.log('[PROJECT] Starting historical import for new project:', project.id);
        supabase.functions.invoke('import-historical-data', {
          body: {
            project_id: project.id,
            since: '2025-01-01',
          },
        }).then(result => {
          if (result.error) {
            console.error('[PROJECT] Historical import error:', result.error);
          } else {
            console.log('[PROJECT] Historical import started:', result.data);
            toast.success('Importação histórica iniciada em background!');
          }
        }).catch(err => {
          console.error('[PROJECT] Historical import invoke error:', err);
        });
      } catch (importError) {
        console.error('Historical import trigger error:', importError);
      }

      await fetchProjects();
      toast.success('Projeto criado com sucesso!');
      return project as Project;
    } catch (error) {
      toast.error('Erro ao criar projeto');
      throw error;
    }
  };

  const updateProject = async (id: string, data: Partial<CreateProjectData>) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update(data)
        .eq('id', id);

      if (error) throw error;

      await fetchProjects();
      toast.success('Projeto atualizado!');
    } catch (error) {
      toast.error('Erro ao atualizar projeto');
      throw error;
    }
  };

  const deleteProject = async (id: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchProjects();
      toast.success('Projeto excluído!');
    } catch (error) {
      toast.error('Erro ao excluir projeto');
      throw error;
    }
  };

  const archiveProject = async (id: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ 
          archived: true, 
          archived_at: new Date().toISOString() 
        })
        .eq('id', id);

      if (error) throw error;

      await fetchProjects();
      toast.success('Projeto arquivado!');
    } catch (error) {
      toast.error('Erro ao arquivar projeto');
      throw error;
    }
  };

  const unarchiveProject = async (id: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ 
          archived: false, 
          archived_at: null 
        })
        .eq('id', id);

      if (error) throw error;

      await fetchProjects();
      toast.success('Projeto restaurado!');
    } catch (error) {
      toast.error('Erro ao restaurar projeto');
      throw error;
    }
  };

  return {
    projects,
    loading,
    createProject,
    updateProject,
    deleteProject,
    archiveProject,
    unarchiveProject,
    refetch: fetchProjects,
  };
}
