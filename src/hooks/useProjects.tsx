import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type BusinessModel = 'inside_sales' | 'ecommerce' | 'pdv' | 'custom';
export type HealthScore = 'safe' | 'care' | 'danger' | null;

export interface SyncProgress {
  status: 'idle' | 'syncing' | 'importing' | 'success' | 'error';
  progress: number;
  message: string;
  started_at: string | null;
}

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
  health_score: HealthScore;
  sync_progress: SyncProgress | null;
  avatar_url: string | null;
}

export interface CreateProjectData {
  name: string;
  ad_account_id: string;
  business_model: BusinessModel;
  timezone: string;
  currency: string;
  health_score?: HealthScore;
  avatar_url?: string | null;
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
      
      // Parse sync_progress from JSON
      const parsedProjects = (data || []).map((p: any) => ({
        ...p,
        sync_progress: p.sync_progress ? (typeof p.sync_progress === 'string' ? JSON.parse(p.sync_progress) : p.sync_progress) : null,
      })) as Project[];
      
      setProjects(parsedProjects);
    } catch (error) {
      toast.error('Erro ao carregar projetos');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Subscribe to realtime updates for sync progress
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('projects-sync-progress')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
        },
        (payload) => {
          const updated = payload.new as any;
          setProjects(prev => prev.map(p => 
            p.id === updated.id 
              ? { 
                  ...p, 
                  ...updated,
                  sync_progress: updated.sync_progress 
                    ? (typeof updated.sync_progress === 'string' 
                        ? JSON.parse(updated.sync_progress) 
                        : updated.sync_progress) 
                    : null 
                }
              : p
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const createProject = async (data: CreateProjectData) => {
    if (!user) throw new Error('Usuário não autenticado');

    try {
      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          ...data,
          sync_progress: { status: 'importing', progress: 0, message: 'Iniciando importação...', started_at: new Date().toISOString() },
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

      // Create month records and start chained import
      try {
        console.log('[PROJECT] Setting up month-by-month import for new project:', project.id);
        
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        const startYear = 2025; // Start from 2025
        
        // Create month records for all months from start to current
        const monthRecords: Array<{ project_id: string; year: number; month: number; status: string }> = [];
        
        for (let year = startYear; year <= currentYear; year++) {
          const endMonth = year === currentYear ? currentMonth : 12;
          for (let month = 1; month <= endMonth; month++) {
            monthRecords.push({
              project_id: project.id,
              year,
              month,
              status: 'pending',
            });
          }
        }
        
        // Insert all month records
        if (monthRecords.length > 0) {
          const { error: monthsError } = await supabase
            .from('project_import_months')
            .insert(monthRecords);
          
          if (monthsError) {
            console.error('[PROJECT] Error creating month records:', monthsError);
          } else {
            console.log(`[PROJECT] Created ${monthRecords.length} month records`);
            
            // Start chained import from January
            supabase.functions.invoke('import-month-by-month', {
              body: {
                project_id: project.id,
                year: startYear,
                month: 1,
                continue_chain: true,
                safe_mode: true,
              },
            }).then(result => {
              if (result.error) {
                console.error('[PROJECT] Month import error:', result.error);
              } else {
                console.log('[PROJECT] Month-by-month import started:', result.data);
              }
            }).catch(err => {
              console.error('[PROJECT] Month import invoke error:', err);
            });
          }
        }
        
        // Also trigger demographic sync
        supabase.functions.invoke('sync-demographics', {
          body: {
            project_id: project.id,
            ad_account_id: data.ad_account_id,
          },
        }).catch(err => {
          console.error('[PROJECT] Demographics sync error:', err);
        });
      } catch (importError) {
        console.error('Month import setup error:', importError);
      }

      await fetchProjects();
      toast.success('Projeto criado! Importação mês a mês iniciada.');
      return project as unknown as Project;
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

      // Atualização otimista - atualiza estado local sem refetch
      setProjects(prev => prev.map(p => 
        p.id === id ? { ...p, ...data } as Project : p
      ));
      toast.success('Projeto atualizado!');
    } catch (error) {
      toast.error('Erro ao atualizar projeto');
      throw error;
    }
  };

  const deleteProject = async (id: string) => {
    try {
      // Delete related data first
      await supabase.from('project_import_months').delete().eq('project_id', id);
      await supabase.from('ads_daily_metrics').delete().eq('project_id', id);
      await supabase.from('demographic_insights').delete().eq('project_id', id);
      await supabase.from('period_metrics').delete().eq('project_id', id);
      await supabase.from('sync_logs').delete().eq('project_id', id);
      await supabase.from('ads').delete().eq('project_id', id);
      await supabase.from('ad_sets').delete().eq('project_id', id);
      await supabase.from('campaigns').delete().eq('project_id', id);
      
      // Then delete the project
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

  const resyncProject = async (project: Project) => {
    try {
      // Update status to syncing
      await supabase
        .from('projects')
        .update({ 
          sync_progress: { status: 'syncing', progress: 0, message: 'Iniciando sincronização...', started_at: new Date().toISOString() },
          webhook_status: 'syncing'
        })
        .eq('id', project.id);

      // Trigger sync
      const { data, error } = await supabase.functions.invoke('meta-ads-sync', {
        body: {
          project_id: project.id,
          ad_account_id: project.ad_account_id,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Sincronização concluída!');
      } else {
        toast.error(data?.error || 'Erro na sincronização');
      }

      await fetchProjects();
    } catch (error) {
      toast.error('Erro ao sincronizar');
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
    resyncProject,
    refetch: fetchProjects,
  };
}
