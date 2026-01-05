import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DateRange {
  from: Date;
  to: Date;
}

interface Lead {
  id: string;
  project_id: string;
  form_id: string;
  form_name: string | null;
  ad_id: string | null;
  ad_name: string | null;
  campaign_id: string | null;
  created_time: string;
  lead_name: string | null;
  lead_email: string | null;
  lead_phone: string | null;
  field_data: any;
}

interface LeadgenForm {
  id: string;
  project_id: string;
  page_id: string;
  name: string | null;
  leads_count: number;
  last_synced_at: string | null;
}

interface LeadsSyncResult {
  success: boolean;
  forms_found: number;
  leads_found: number;
  leads_saved: number;
  error?: string;
}

export function useRealLeads(projectId: string | undefined, dateRange?: DateRange) {
  const { data: leads, isLoading, refetch } = useQuery({
    queryKey: ['real-leads', projectId, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      if (!projectId) return [];

      let query = supabase
        .from('leads')
        .select('*')
        .eq('project_id', projectId)
        .order('created_time', { ascending: false });

      if (dateRange?.from) {
        query = query.gte('created_time', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        const endDate = new Date(dateRange.to);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('created_time', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching leads:', error);
        throw error;
      }

      return data as Lead[];
    },
    enabled: !!projectId,
  });

  return {
    leads: leads || [],
    count: leads?.length || 0,
    isLoading,
    refetch,
  };
}

export function useLeadgenForms(projectId: string | undefined) {
  const { data: forms, isLoading, refetch } = useQuery({
    queryKey: ['leadgen-forms', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from('leadgen_forms')
        .select('*')
        .eq('project_id', projectId)
        .order('name');

      if (error) {
        console.error('Error fetching forms:', error);
        throw error;
      }

      return data as LeadgenForm[];
    },
    enabled: !!projectId,
  });

  return {
    forms: forms || [],
    isLoading,
    refetch,
  };
}

export function useSyncLeads(projectId: string | undefined) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ pageId, since, until }: { pageId: string; since?: string; until?: string }) => {
      if (!projectId) throw new Error('Project ID is required');

      const { data, error } = await supabase.functions.invoke('meta-leads-sync', {
        body: {
          project_id: projectId,
          page_id: pageId,
          since,
          until,
        },
      });

      if (error) throw error;
      return data as LeadsSyncResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['real-leads', projectId] });
      queryClient.invalidateQueries({ queryKey: ['leadgen-forms', projectId] });
      
      if (data.success) {
        toast.success(`Sincronização concluída: ${data.leads_saved} leads salvos de ${data.forms_found} formulários`);
      } else {
        toast.error(`Erro na sincronização: ${data.error}`);
      }
    },
    onError: (error: Error) => {
      console.error('Leads sync error:', error);
      toast.error(`Erro ao sincronizar leads: ${error.message}`);
    },
  });

  return {
    syncLeads: mutation.mutate,
    isSyncing: mutation.isPending,
  };
}

export function useLeadsComparison(projectId: string | undefined, dateRange?: DateRange) {
  const { count: realLeadsCount, isLoading: isLoadingLeads } = useRealLeads(projectId, dateRange);

  // Get insights conversions for comparison
  const { data: insightsData, isLoading: isLoadingInsights } = useQuery({
    queryKey: ['insights-conversions', projectId, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      if (!projectId) return { conversions: 0 };

      let query = supabase
        .from('ads_daily_metrics')
        .select('conversions')
        .eq('project_id', projectId);

      if (dateRange?.from) {
        query = query.gte('date', dateRange.from.toISOString().split('T')[0]);
      }
      if (dateRange?.to) {
        query = query.lte('date', dateRange.to.toISOString().split('T')[0]);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching insights:', error);
        return { conversions: 0 };
      }

      const totalConversions = data?.reduce((sum, row) => sum + (row.conversions || 0), 0) || 0;
      return { conversions: totalConversions };
    },
    enabled: !!projectId,
  });

  const insightsConversions = insightsData?.conversions || 0;
  const difference = realLeadsCount - insightsConversions;
  const percentageDiff = insightsConversions > 0 
    ? ((difference / insightsConversions) * 100).toFixed(1) 
    : '0';

  return {
    realLeadsCount,
    insightsConversions,
    difference,
    percentageDiff,
    hasDivergence: Math.abs(difference) > 0,
    isLoading: isLoadingLeads || isLoadingInsights,
  };
}
