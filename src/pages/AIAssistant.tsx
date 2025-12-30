import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Trash2, Sparkles, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePresetKey, getDateRangeFromPreset } from '@/utils/dateUtils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  cached?: boolean;
}

const datePresets: { value: DatePresetKey; label: string }[] = [
  { value: 'yesterday', label: 'Ontem' },
  { value: 'last_7d', label: 'Últimos 7 dias' },
  { value: 'last_14d', label: 'Últimos 14 dias' },
  { value: 'last_30d', label: 'Últimos 30 dias' },
  { value: 'last_60d', label: 'Últimos 60 dias' },
  { value: 'this_month', label: 'Este mês' },
  { value: 'last_month', label: 'Mês passado' },
];

export default function AIAssistant() {
  const { user, loading: authLoading } = useAuth();
  const { projects, loading: projectsLoading } = useProjects();
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<DatePresetKey>('this_month');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get active projects
  const activeProjects = useMemo(() => 
    projects.filter(p => !p.archived), 
    [projects]
  );

  // Set default project
  useEffect(() => {
    if (!selectedProjectId && activeProjects.length > 0) {
      const savedProject = localStorage.getItem('selectedProjectId');
      if (savedProject && activeProjects.find(p => p.id === savedProject)) {
        setSelectedProjectId(savedProject);
      } else {
        setSelectedProjectId(activeProjects[0].id);
      }
    }
  }, [activeProjects, selectedProjectId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const selectedProject = useMemo(() => 
    activeProjects.find(p => p.id === selectedProjectId),
    [activeProjects, selectedProjectId]
  );

  const dateRange = useMemo(() => {
    const period = getDateRangeFromPreset(selectedPreset, selectedProject?.timezone || 'America/Sao_Paulo');
    if (period) {
      return { startDate: period.since, endDate: period.until };
    }
    return { startDate: '', endDate: '' };
  }, [selectedPreset, selectedProject?.timezone]);

  const sendMessage = async (content: string, skipCache = false) => {
    if (!selectedProjectId || !content.trim()) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-traffic-assistant', {
        body: {
          projectId: selectedProjectId,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          message: content,
          skipCache,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erro desconhecido');
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        cached: data.cached,
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      if (data.cached) {
        toast.info('Resposta recuperada do cache', {
          description: 'Para uma nova análise, clique em "Nova Análise"'
        });
      }
    } catch (error) {
      console.error('AI Assistant error:', error);
      toast.error('Erro ao processar sua solicitação');
      
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: '❌ Desculpe, ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage(input.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  const formatContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      // Headers
      if (line.startsWith('### ')) {
        return <h4 key={i} className="font-semibold text-base mt-4 mb-2 text-foreground">{line.substring(4)}</h4>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={i} className="font-bold text-lg mt-5 mb-2 text-foreground">{line.substring(3)}</h3>;
      }
      if (line.startsWith('# ')) {
        return <h2 key={i} className="font-bold text-xl mt-6 mb-3 text-foreground">{line.substring(2)}</h2>;
      }
      // List items
      if (line.startsWith('- ') || line.startsWith('• ')) {
        return <li key={i} className="ml-4 list-disc text-foreground/90">{formatInlineStyles(line.substring(2))}</li>;
      }
      if (/^\d+\.\s/.test(line)) {
        return <li key={i} className="ml-4 list-decimal text-foreground/90">{formatInlineStyles(line.replace(/^\d+\.\s/, ''))}</li>;
      }
      // Empty lines
      if (line.trim() === '') {
        return <br key={i} />;
      }
      // Regular paragraphs
      return <p key={i} className="mb-2 text-foreground/90 leading-relaxed">{formatInlineStyles(line)}</p>;
    });
  };

  const formatInlineStyles = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('__') && part.endsWith('__')) {
        return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  if (authLoading || projectsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold text-lg">AI Traffic Manager</h1>
                <p className="text-xs text-muted-foreground">Análise de Performance</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={selectedProjectId || ''} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Selecione projeto" />
              </SelectTrigger>
              <SelectContent>
                {activeProjects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedPreset} onValueChange={(v) => setSelectedPreset(v as DatePresetKey)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {datePresets.map(preset => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={clearMessages}
              title="Limpar conversa"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-[calc(100vh-180px)]" ref={scrollRef}>
          <div className="max-w-3xl mx-auto px-4 py-6">
            {messages.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold mb-2">AI Traffic Manager</h2>
                <p className="text-muted-foreground max-w-md mx-auto mb-8">
                  Analista de performance especializado em Meta Ads. 
                  Faça perguntas sobre suas campanhas e receba diagnósticos baseados em dados.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg mx-auto">
                  <Button
                    variant="outline"
                    className="justify-start h-auto py-3 px-4"
                    onClick={() => sendMessage('Faça um diagnóstico completo de performance das campanhas no período selecionado.')}
                    disabled={isLoading || !selectedProjectId}
                  >
                    <span className="text-left">
                      <span className="font-medium block">Diagnóstico Completo</span>
                      <span className="text-xs text-muted-foreground">Análise detalhada de todas as métricas</span>
                    </span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="justify-start h-auto py-3 px-4"
                    onClick={() => sendMessage('Identifique os principais gargalos de performance e oportunidades de melhoria.')}
                    disabled={isLoading || !selectedProjectId}
                  >
                    <span className="text-left">
                      <span className="font-medium block">Gargalos e Oportunidades</span>
                      <span className="text-xs text-muted-foreground">Problemas e áreas de melhoria</span>
                    </span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="justify-start h-auto py-3 px-4"
                    onClick={() => sendMessage('Compare a performance do período atual com o período anterior e identifique tendências.')}
                    disabled={isLoading || !selectedProjectId}
                  >
                    <span className="text-left">
                      <span className="font-medium block">Análise de Tendências</span>
                      <span className="text-xs text-muted-foreground">Comparação temporal</span>
                    </span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="justify-start h-auto py-3 px-4"
                    onClick={() => sendMessage('Gere recomendações acionáveis para otimizar o ROI das campanhas.')}
                    disabled={isLoading || !selectedProjectId}
                  >
                    <span className="text-left">
                      <span className="font-medium block">Recomendações</span>
                      <span className="text-xs text-muted-foreground">Ações práticas para melhorar</span>
                    </span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex',
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[85%] rounded-2xl px-5 py-4',
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/50 border'
                      )}
                    >
                      {message.role === 'assistant' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          {formatContent(message.content)}
                          {message.cached && (
                            <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2 text-xs text-muted-foreground">
                              <RefreshCw className="h-3 w-3" />
                              <span>Resposta do cache</span>
                              <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-xs"
                                onClick={() => {
                                  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
                                  if (lastUserMessage) {
                                    sendMessage(lastUserMessage.content, true);
                                  }
                                }}
                              >
                                Nova análise
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted/50 border rounded-2xl px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                        <span className="text-sm text-muted-foreground">Analisando dados...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="border-t bg-card/50 backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex gap-3">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selectedProjectId ? "Faça uma pergunta sobre suas campanhas..." : "Selecione um projeto para começar"}
              disabled={isLoading || !selectedProjectId}
              className="min-h-[52px] max-h-[200px] resize-none"
              rows={1}
            />
            <Button 
              type="submit" 
              size="icon" 
              className="h-[52px] w-[52px] shrink-0"
              disabled={isLoading || !input.trim() || !selectedProjectId}
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {selectedProject ? `Analisando: ${selectedProject.name}` : 'Selecione um projeto'} • Enter para enviar, Shift+Enter para nova linha
          </p>
        </form>
      </div>
    </div>
  );
}
