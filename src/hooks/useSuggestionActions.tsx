import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SuggestionAction {
  id: string;
  project_id: string;
  user_id: string;
  suggestion_title: string;
  suggestion_hash: string;
  action_type: 'applied' | 'ignored';
  reason: string | null;
  created_at: string;
}

// Generate a simple hash from suggestion title
const generateHash = (title: string): string => {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    const char = title.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
};

export function useSuggestionActions(projectId: string | null) {
  const [actions, setActions] = useState<SuggestionAction[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchActions = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('suggestion_actions')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActions((data || []) as SuggestionAction[]);
    } catch (err) {
      console.error('Error fetching suggestion actions:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const markSuggestion = async (
    suggestionTitle: string,
    actionType: 'applied' | 'ignored',
    reason?: string
  ) => {
    if (!projectId) return false;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Você precisa estar logado');
      return false;
    }

    const hash = generateHash(suggestionTitle);

    try {
      // Check if already exists
      const existing = actions.find(a => a.suggestion_hash === hash);
      
      if (existing) {
        // Delete existing and insert new
        await supabase
          .from('suggestion_actions')
          .delete()
          .eq('id', existing.id);
      }

      const { error } = await supabase
        .from('suggestion_actions')
        .insert({
          project_id: projectId,
          user_id: user.id,
          suggestion_title: suggestionTitle,
          suggestion_hash: hash,
          action_type: actionType,
          reason: reason || null,
        });

      if (error) throw error;

      toast.success(
        actionType === 'applied' 
          ? 'Sugestão marcada como aplicada' 
          : 'Sugestão marcada como ignorada'
      );
      
      fetchActions();
      return true;
    } catch (err) {
      console.error('Error marking suggestion:', err);
      toast.error('Erro ao marcar sugestão');
      return false;
    }
  };

  const removeMark = async (suggestionTitle: string) => {
    const hash = generateHash(suggestionTitle);
    const action = actions.find(a => a.suggestion_hash === hash);
    
    if (!action) return false;

    try {
      const { error } = await supabase
        .from('suggestion_actions')
        .delete()
        .eq('id', action.id);

      if (error) throw error;

      toast.success('Marcação removida');
      fetchActions();
      return true;
    } catch (err) {
      console.error('Error removing mark:', err);
      toast.error('Erro ao remover marcação');
      return false;
    }
  };

  const getActionForSuggestion = (suggestionTitle: string): SuggestionAction | null => {
    const hash = generateHash(suggestionTitle);
    return actions.find(a => a.suggestion_hash === hash) || null;
  };

  return {
    actions,
    loading,
    markSuggestion,
    removeMark,
    getActionForSuggestion,
    refetch: fetchActions,
  };
}
