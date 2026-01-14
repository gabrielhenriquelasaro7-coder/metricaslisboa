import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCargo } from './useCargo';
import { toast } from 'sonner';

export interface AdminAccessRequest {
  id: string;
  user_id: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
}

export function useAdminAccessRequests() {
  const { user } = useAuth();
  const { isTech, needsAdminApproval } = useCargo();
  const [requests, setRequests] = useState<AdminAccessRequest[]>([]);
  const [myPendingRequest, setMyPendingRequest] = useState<AdminAccessRequest | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    if (!user) {
      setRequests([]);
      setMyPendingRequest(null);
      setLoading(false);
      return;
    }

    try {
      // If Tech, fetch all pending requests
      if (isTech) {
        const { data, error } = await supabase
          .from('admin_access_requests')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Fetch user names
        if (data && data.length > 0) {
          const userIds = data.map(r => r.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', userIds);

          const enrichedRequests = data.map(req => ({
            ...req,
            status: req.status as 'pending' | 'approved' | 'rejected',
            user_name: profiles?.find(p => p.user_id === req.user_id)?.full_name || 'Sem nome',
          }));

          setRequests(enrichedRequests);
        } else {
          setRequests([]);
        }
      }

      // Check if current user has a pending request
      if (needsAdminApproval) {
        const { data: myRequest, error: myError } = await supabase
          .from('admin_access_requests')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .maybeSingle();

        if (!myError && myRequest) {
          setMyPendingRequest({
            ...myRequest,
            status: myRequest.status as 'pending' | 'approved' | 'rejected',
          });
        } else {
          setMyPendingRequest(null);
        }
      }
    } catch (error) {
      console.error('Error fetching admin access requests:', error);
    } finally {
      setLoading(false);
    }
  }, [user, isTech, needsAdminApproval]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const createRequest = async (reason: string) => {
    if (!user) throw new Error('Usuário não autenticado');

    try {
      const { data, error } = await supabase
        .from('admin_access_requests')
        .insert({
          user_id: user.id,
          reason,
        })
        .select()
        .single();

      if (error) throw error;

      setMyPendingRequest({
        ...data,
        status: data.status as 'pending' | 'approved' | 'rejected',
      });
      toast.success('Solicitação enviada! Aguarde aprovação do Tech.');
      return data;
    } catch (error) {
      console.error('Error creating request:', error);
      toast.error('Erro ao enviar solicitação');
      throw error;
    }
  };

  const approveRequest = async (requestId: string) => {
    if (!user || !isTech) throw new Error('Sem permissão');

    try {
      const { error } = await supabase
        .from('admin_access_requests')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;

      setRequests(prev => prev.filter(r => r.id !== requestId));
      toast.success('Solicitação aprovada!');
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Erro ao aprovar solicitação');
      throw error;
    }
  };

  const rejectRequest = async (requestId: string, reason?: string) => {
    if (!user || !isTech) throw new Error('Sem permissão');

    try {
      const { error } = await supabase
        .from('admin_access_requests')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason || null,
        })
        .eq('id', requestId);

      if (error) throw error;

      setRequests(prev => prev.filter(r => r.id !== requestId));
      toast.success('Solicitação rejeitada');
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Erro ao rejeitar solicitação');
      throw error;
    }
  };

  return {
    requests,
    myPendingRequest,
    loading,
    createRequest,
    approveRequest,
    rejectRequest,
    refetch: fetchRequests,
  };
}
