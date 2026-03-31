import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCargo } from './useCargo';
import { toast } from 'sonner';

export type BusinessModel = 'inside_sales' | 'ecommerce' | 'pdv' | 'custom' | 'infoproduto';
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
  google_customer_id: string | null;
  facebook_page_id: string | null;
  investidor_id: string | null;
  squad_id: string | null;
}

export interface CreateProjectData {
  name: string;
  ad_account_id: string;
  business_model: BusinessModel;
  timezone: string;
  currency: string;
  health_score?: HealthScore;
  avatar_url?: string | null;
  google_customer_id?: string | null;
  facebook_page_id?: string | null;
  investidor_ids?: string[];
  squad_id?: string | null;
}

// ---- Global singleton to prevent duplicate project fetches ----
let globalProjectsCache: {
  userId: string | null;
  projects: Project[];
  loaded: boolean;
  fetchPromise: Promise<void> | null;
} = {
  userId: null,
  projects: [],
  loaded: false,
  fetchPromise: null,
};

let projectListeners: Set<(projects: Project[]) => void> = new Set();

function notifyProjectListeners() {
  projectListeners.forEach(fn => fn([...globalProjectsCache.projects]));
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>(globalProjectsCache.projects);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const { loading: cargoLoading } = useCargo();

  // Subscribe to global project changes
  useEffect(() => {
    const listener = (p: Project[]) => setProjects(p);
    projectListeners.add(listener);
    return () => { projectListeners.delete(listener); };
  }, []);

  const fetchProjects = useCallback(async (force = false) => {
    // Wait for auth and cargo to finish before deciding
    if (authLoading || cargoLoading) {
      return;
    }

    if (!user) {
      setProjects([]);
      globalProjectsCache = { userId: null, projects: [], loaded: false, fetchPromise: null };
      setLoading(false);
      return;
    }

    // Reuse existing fetch if in progress for same user
    if (globalProjectsCache.fetchPromise && globalProjectsCache.userId === user.id && !force) {
      await globalProjectsCache.fetchPromise;
      setProjects([...globalProjectsCache.projects]);
      setLoading(false);
      return;
    }

    // Already loaded for this user, skip
    if (globalProjectsCache.loaded && globalProjectsCache.userId === user.id && !force) {
      setProjects([...globalProjectsCache.projects]);
      setLoading(false);
      return;
    }

    // Safety timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.warn('[useProjects] Fetch timeout - forcing loading to false');
      setLoading(false);
    }, 5000);

    try {
      setLoading(true);

      let query = supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      clearTimeout(timeoutId);

      if (error) {
        console.error('Error fetching projects:', error);
        toast.error('Erro ao carregar projetos');
        setProjects([]);
        return;
      }

      // Parse sync_progress from JSON
      const parsedProjects = (data || []).map((p: any) => ({
        ...p,
        sync_progress: p.sync_progress ? (typeof p.sync_progress === 'string' ? JSON.parse(p.sync_progress) : p.sync_progress) : null,
      })) as Project[];

      globalProjectsCache.projects = parsedProjects;
      globalProjectsCache.loaded = true;
      globalProjectsCache.userId = user.id;
      setProjects(parsedProjects);
      notifyProjectListeners();
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Error fetching projects:', error);
      toast.error('Erro ao carregar projetos');
      setProjects([]);
    } finally {
      globalProjectsCache.fetchPromise = null;
      setLoading(false);
    }
  }, [user, authLoading, cargoLoading]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Reset cache when user or cargo changes
  useEffect(() => {
    globalProjectsCache.loaded = false;
    globalProjectsCache.fetchPromise = null;
  }, [user?.id]);

  const resolveInvestidorUsers = useCallback(async (investidorIds: string[]) => {
    const uniqueIds = [...new Set(investidorIds.filter(Boolean))];

    if (uniqueIds.length === 0) {
      return [] as Array<{ id: string; user_id: string }>;
    }

    const joinedIds = uniqueIds.join(',');
    const { data, error } = await supabase
      .from('user_management')
      .select('id, user_id')
      .or(`user_id.in.(${joinedIds}),id.in.(${joinedIds})`)
      .not('user_id', 'is', null);

    if (error) throw error;

    const deduped = new Map<string, { id: string; user_id: string }>();
    for (const investor of data || []) {
      deduped.set(investor.user_id, investor as { id: string; user_id: string });
    }

    return Array.from(deduped.values());
  }, []);

  // Subscribe to realtime updates for sync progress AND new projects
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('projects-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'projects',
        },
        (payload) => {
          const newProject = payload.new as any;
          // Add new project to the list (RLS already filters access)
          setProjects(prev => {
            // Check if already exists (avoid duplicates)
            if (prev.some(p => p.id === newProject.id)) {
              return prev;
            }
            const parsedProject = {
              ...newProject,
              sync_progress: newProject.sync_progress
                ? (typeof newProject.sync_progress === 'string'
                  ? JSON.parse(newProject.sync_progress)
                  : newProject.sync_progress)
                : null
            } as Project;
            // Add at the beginning (newest first)
            return [parsedProject, ...prev];
          });
        }
      )
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
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'projects',
        },
        (payload) => {
          const deleted = payload.old as any;
          setProjects(prev => prev.filter(p => p.id !== deleted.id));
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
      // Extract investidor_ids before creating project
      const { investidor_ids, ...projectData } = data;

      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          ...projectData,
          sync_progress: { status: 'idle', progress: 0, message: 'Aguardando seleção do tipo de importação...', started_at: null },
        })
        .select()
        .single();

      if (error) throw error;

      // Atualização otimista imediata - adiciona projeto à lista sem esperar realtime
      const newProject = {
        ...project,
        sync_progress: project.sync_progress
          ? (typeof project.sync_progress === 'string'
            ? JSON.parse(project.sync_progress)
            : project.sync_progress)
          : null
      } as Project;

      setProjects(prev => {
        // Verifica se já existe para evitar duplicatas
        if (prev.some(p => p.id === newProject.id)) {
          return prev;
        }
        return [newProject, ...prev];
      });

      // Insert investidores if provided
      if (investidor_ids && investidor_ids.length > 0) {
        const investidorUsers = await resolveInvestidorUsers(investidor_ids);

        const investidorRecords = investidorUsers.map(({ id }) => ({
          project_id: project.id,
          investidor_id: id,
        }));

        if (investidorRecords.length > 0) {
          await supabase
            .from('project_investidores')
            .insert(investidorRecords);
        }

        // CRITICAL: Also insert into guest_project_access so investors can see the project
        if (investidorUsers && investidorUsers.length > 0) {
          const accessRecords = investidorUsers.map(inv => ({
            project_id: project.id,
            user_id: inv.user_id,
            granted_by: user.id,
          }));

          await supabase
            .from('guest_project_access')
            .upsert(accessRecords, { onConflict: 'user_id,project_id' });
        }
      }

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

      // Create month records but DO NOT start import - wait for user to choose import mode
      try {
        console.log('[PROJECT] Setting up month records for new project:', project.id);

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
            console.log(`[PROJECT] Created ${monthRecords.length} month records - waiting for import mode selection`);
          }
        }

        // Trigger demographic sync
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

      // Não chama fetchProjects pois já fizemos atualização otimista acima
      // Don't show toast here - let the dialog handle it after import mode selection
      return project as unknown as Project;
    } catch (error) {
      toast.error('Erro ao criar projeto');
      throw error;
    }
  };

  const updateProject = async (id: string, data: Partial<CreateProjectData> & { investidor_ids?: string[] }) => {
    try {
      // Extract investidor_ids before updating
      const { investidor_ids, ...projectData } = data;

      const { error } = await supabase
        .from('projects')
        .update(projectData)
        .eq('id', id);

      if (error) throw error;

      // Update investidores if provided
      if (investidor_ids !== undefined) {
        // Get current user for granted_by
        const { data: { user: currentUser } } = await supabase.auth.getUser();

        // Delete existing investidores
        await supabase
          .from('project_investidores')
          .delete()
          .eq('project_id', id);

          // Delete existing guest_project_access for investors of this project
        // First get all investor user_ids that had access
        const { data: oldInvestors } = await supabase
          .from('guest_project_access')
          .select('user_id')
          .eq('project_id', id);

        // Insert new investidores
        if (investidor_ids.length > 0) {
            const investidorUsers = await resolveInvestidorUsers(investidor_ids);
            const investidorRecords = investidorUsers.map(({ id: managementId }) => ({
              project_id: id,
              investidor_id: managementId,
            }));

            if (investidorRecords.length > 0) {
              await supabase
                .from('project_investidores')
                .insert(investidorRecords);
            }

            if (investidorUsers.length > 0) {
              const accessRecords = investidorUsers.map(inv => ({
                project_id: id,
                user_id: inv.user_id,
                granted_by: currentUser?.id || '',
              }));

              await supabase
                .from('guest_project_access')
                .upsert(accessRecords, { onConflict: 'user_id,project_id' });
            }

            // Remove access for investors that were removed
            if (oldInvestors && investidorUsers) {
              const newUserIds = investidorUsers.map(u => u.user_id);
              const toRemove = oldInvestors
                .filter(old => !newUserIds.includes(old.user_id))
                .map(old => old.user_id);

              if (toRemove.length > 0) {
                await supabase
                  .from('guest_project_access')
                  .delete()
                  .eq('project_id', id)
                  .in('user_id', toRemove);
              }
            }
          }
        } else {
          // No investors selected - remove all guest access for this project's investors
          if (oldInvestors && oldInvestors.length > 0) {
            await supabase
              .from('guest_project_access')
              .delete()
              .eq('project_id', id)
              .in('user_id', oldInvestors.map(o => o.user_id));
          }
        }
      }

      // Atualização otimista - atualiza estado local sem refetch
      setProjects(prev => prev.map(p =>
        p.id === id ? { ...p, ...projectData } as Project : p
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

      await fetchProjects(true);
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

      // Atualização otimista
      setProjects(prev => prev.map(p =>
        p.id === id ? { ...p, archived: true, archived_at: new Date().toISOString() } : p
      ));

      await fetchProjects(true);
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

      // Atualização otimista
      setProjects(prev => prev.map(p =>
        p.id === id ? { ...p, archived: false, archived_at: null } : p
      ));

      await fetchProjects(true);
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
