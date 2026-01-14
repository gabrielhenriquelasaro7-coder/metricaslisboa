import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Squad {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
  updated_at: string;
  member_count?: number;
}

export interface SquadMemberWithProfile {
  id: string;
  user_id: string;
  squad_id: string;
  created_at: string;
  user_email?: string;
  user_name?: string;
  cargo?: string;
}

export function useSquads() {
  const { user } = useAuth();
  const [squads, setSquads] = useState<Squad[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSquads = useCallback(async () => {
    if (!user) {
      setSquads([]);
      setLoading(false);
      return;
    }

    try {
      // Fetch squads
      const { data: squadsData, error: squadsError } = await supabase
        .from('squads')
        .select('*')
        .order('name');

      if (squadsError) throw squadsError;

      // Fetch member counts from user_management
      const { data: memberCounts, error: countError } = await supabase
        .from('user_management')
        .select('squad_id');

      if (countError) throw countError;

      // Count members per squad
      const countMap = (memberCounts || []).reduce((acc, row) => {
        if (row.squad_id) {
          acc[row.squad_id] = (acc[row.squad_id] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      // Enrich squads with member counts
      const enrichedSquads = (squadsData || []).map(squad => ({
        ...squad,
        member_count: countMap[squad.id] || 0,
      }));

      setSquads(enrichedSquads);
    } catch (error) {
      console.error('Error fetching squads:', error);
      toast.error('Erro ao carregar squads');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSquads();
  }, [fetchSquads]);

  const createSquad = async (name: string, description?: string, color?: string) => {
    try {
      const { data, error } = await supabase
        .from('squads')
        .insert({
          name,
          description: description || null,
          color: color || '#3B82F6',
        })
        .select()
        .single();

      if (error) throw error;

      setSquads(prev => [...prev, { ...data, member_count: 0 }]);
      toast.success('Squad criada!');
      return data;
    } catch (error: any) {
      console.error('Error creating squad:', error);
      if (error.code === '23505') {
        toast.error('Já existe uma squad com este nome');
      } else {
        toast.error('Erro ao criar squad');
      }
      throw error;
    }
  };

  const updateSquad = async (id: string, updates: Partial<Pick<Squad, 'name' | 'description' | 'color'>>) => {
    try {
      const { error } = await supabase
        .from('squads')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setSquads(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
      toast.success('Squad atualizada!');
    } catch (error) {
      console.error('Error updating squad:', error);
      toast.error('Erro ao atualizar squad');
      throw error;
    }
  };

  const deleteSquad = async (id: string) => {
    try {
      const { error } = await supabase
        .from('squads')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSquads(prev => prev.filter(s => s.id !== id));
      toast.success('Squad excluída!');
    } catch (error) {
      console.error('Error deleting squad:', error);
      toast.error('Erro ao excluir squad');
      throw error;
    }
  };

  const addUserToSquad = async (userId: string, squadId: string) => {
    try {
      const { error } = await supabase
        .from('squad_members')
        .insert({
          user_id: userId,
          squad_id: squadId,
        });

      if (error) throw error;
      toast.success('Usuário adicionado à squad!');
    } catch (error: any) {
      console.error('Error adding user to squad:', error);
      if (error.code === '23505') {
        toast.error('Usuário já está nesta squad');
      } else {
        toast.error('Erro ao adicionar usuário');
      }
      throw error;
    }
  };

  const removeUserFromSquad = async (userId: string, squadId: string) => {
    try {
      const { error } = await supabase
        .from('squad_members')
        .delete()
        .eq('user_id', userId)
        .eq('squad_id', squadId);

      if (error) throw error;
      toast.success('Usuário removido da squad!');
    } catch (error) {
      console.error('Error removing user from squad:', error);
      toast.error('Erro ao remover usuário');
      throw error;
    }
  };

  // Get squad members from user_management table
  const getSquadMembers = async (squadId: string): Promise<SquadMemberWithProfile[]> => {
    try {
      const { data, error } = await supabase
        .from('user_management')
        .select('id, user_id, full_name, email, cargo, squad_id, created_at')
        .eq('squad_id', squadId);

      if (error) throw error;

      return (data || []).map(member => ({
        id: member.id,
        user_id: member.user_id,
        squad_id: member.squad_id,
        created_at: member.created_at,
        user_name: member.full_name || 'Sem nome',
        user_email: member.email,
        cargo: member.cargo,
      }));
    } catch (error) {
      console.error('Error fetching squad members:', error);
      return [];
    }
  };

  return {
    squads,
    loading,
    createSquad,
    updateSquad,
    deleteSquad,
    addUserToSquad,
    removeUserFromSquad,
    getSquadMembers,
    refetch: fetchSquads,
  };
}
