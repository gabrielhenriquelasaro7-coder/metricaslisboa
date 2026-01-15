import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  MessageSquare, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Loader2,
  RefreshCw
} from 'lucide-react';

interface Suggestion {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  description: string;
  priority: string | null;
  status: string | null;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  project_name?: string;
  user_name?: string;
}

export function InvestorSuggestionsManagement() {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('investor_suggestions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enrich with project names and user names
      const projectIds = [...new Set(data?.map(s => s.project_id) || [])];
      const userIds = [...new Set(data?.map(s => s.user_id) || [])];

      const [projectsRes, profilesRes] = await Promise.all([
        supabase.from('projects').select('id, name').in('id', projectIds),
        supabase.from('profiles').select('user_id, full_name').in('user_id', userIds)
      ]);

      const projectMap = new Map(projectsRes.data?.map(p => [p.id, p.name]));
      const profileMap = new Map(profilesRes.data?.map(p => [p.user_id, p.full_name]));

      const enriched = data?.map(s => ({
        ...s,
        project_name: projectMap.get(s.project_id) || 'Projeto desconhecido',
        user_name: profileMap.get(s.user_id) || 'Usuário desconhecido'
      })) || [];

      setSuggestions(enriched);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      toast.error('Erro ao carregar sugestões');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const handleReview = async (suggestionId: string, newStatus: 'approved' | 'rejected' | 'in_review') => {
    if (!user) return;
    
    setProcessingId(suggestionId);
    try {
      const { error } = await supabase
        .from('investor_suggestions')
        .update({
          status: newStatus,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes[suggestionId] || null
        })
        .eq('id', suggestionId);

      if (error) throw error;

      toast.success(`Sugestão ${newStatus === 'approved' ? 'aprovada' : newStatus === 'rejected' ? 'rejeitada' : 'em análise'}`);
      fetchSuggestions();
    } catch (error) {
      console.error('Error updating suggestion:', error);
      toast.error('Erro ao atualizar sugestão');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-metric-positive/20 text-metric-positive border-metric-positive/30">Aprovada</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejeitada</Badge>;
      case 'in_review':
        return <Badge className="bg-metric-warning/20 text-metric-warning border-metric-warning/30">Em Análise</Badge>;
      default:
        return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  const getPriorityBadge = (priority: string | null) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive" className="text-xs">Alta</Badge>;
      case 'medium':
        return <Badge className="bg-metric-warning/20 text-metric-warning border-metric-warning/30 text-xs">Média</Badge>;
      case 'low':
        return <Badge variant="outline" className="text-xs">Baixa</Badge>;
      default:
        return null;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending' || !s.status);
  const inReviewSuggestions = suggestions.filter(s => s.status === 'in_review');
  const reviewedSuggestions = suggestions.filter(s => s.status === 'approved' || s.status === 'rejected');

  if (loading) {
    return (
      <Card className="glass-card border-primary/20">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="glass-card border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Sugestões dos Investidores
              </CardTitle>
              <CardDescription>
                Gerencie sugestões, melhorias e correções enviadas pelos investidores
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchSuggestions} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {suggestions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma sugestão recebida ainda</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Pending Suggestions */}
              {pendingSuggestions.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    Pendentes ({pendingSuggestions.length})
                  </h3>
                  <div className="space-y-4">
                    {pendingSuggestions.map(suggestion => (
                      <div key={suggestion.id} className="border rounded-lg p-4 space-y-3 bg-muted/30">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-medium">{suggestion.title}</h4>
                              {getStatusBadge(suggestion.status)}
                              {getPriorityBadge(suggestion.priority)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {suggestion.project_name} • {suggestion.user_name}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(suggestion.created_at)}
                          </span>
                        </div>
                        
                        <p className="text-sm">{suggestion.description}</p>
                        
                        <div className="space-y-2">
                          <Textarea
                            placeholder="Notas de revisão (opcional)"
                            value={reviewNotes[suggestion.id] || ''}
                            onChange={(e) => setReviewNotes(prev => ({ ...prev, [suggestion.id]: e.target.value }))}
                            className="text-sm"
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReview(suggestion.id, 'in_review')}
                              disabled={processingId === suggestion.id}
                              className="gap-1"
                            >
                              <AlertTriangle className="w-4 h-4" />
                              Em Análise
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleReview(suggestion.id, 'approved')}
                              disabled={processingId === suggestion.id}
                              className="gap-1 bg-metric-positive hover:bg-metric-positive/90"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReview(suggestion.id, 'rejected')}
                              disabled={processingId === suggestion.id}
                              className="gap-1"
                            >
                              <XCircle className="w-4 h-4" />
                              Rejeitar
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* In Review Suggestions */}
              {inReviewSuggestions.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-metric-warning" />
                    Em Análise ({inReviewSuggestions.length})
                  </h3>
                  <div className="space-y-4">
                    {inReviewSuggestions.map(suggestion => (
                      <div key={suggestion.id} className="border border-metric-warning/30 rounded-lg p-4 space-y-3 bg-metric-warning/5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-medium">{suggestion.title}</h4>
                              {getStatusBadge(suggestion.status)}
                              {getPriorityBadge(suggestion.priority)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {suggestion.project_name} • {suggestion.user_name}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(suggestion.created_at)}
                          </span>
                        </div>
                        
                        <p className="text-sm">{suggestion.description}</p>
                        
                        <div className="space-y-2">
                          <Textarea
                            placeholder="Notas de revisão (opcional)"
                            value={reviewNotes[suggestion.id] || suggestion.review_notes || ''}
                            onChange={(e) => setReviewNotes(prev => ({ ...prev, [suggestion.id]: e.target.value }))}
                            className="text-sm"
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleReview(suggestion.id, 'approved')}
                              disabled={processingId === suggestion.id}
                              className="gap-1 bg-metric-positive hover:bg-metric-positive/90"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReview(suggestion.id, 'rejected')}
                              disabled={processingId === suggestion.id}
                              className="gap-1"
                            >
                              <XCircle className="w-4 h-4" />
                              Rejeitar
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reviewed Suggestions */}
              {reviewedSuggestions.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-muted-foreground" />
                    Revisadas ({reviewedSuggestions.length})
                  </h3>
                  <div className="space-y-3">
                    {reviewedSuggestions.map(suggestion => (
                      <div key={suggestion.id} className="border rounded-lg p-4 space-y-2 opacity-75">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-medium">{suggestion.title}</h4>
                              {getStatusBadge(suggestion.status)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {suggestion.project_name} • {suggestion.user_name}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(suggestion.created_at)}
                          </span>
                        </div>
                        <p className="text-sm">{suggestion.description}</p>
                        {suggestion.review_notes && (
                          <p className="text-sm text-muted-foreground italic">
                            Notas: {suggestion.review_notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
