import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Trash2, Bot, ArrowLeft, RefreshCw, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePresetKey, getDateRangeFromPreset } from '@/utils/dateUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ProjectBriefingDialog } from '@/components/ai/ProjectBriefingDialog';
import { Badge } from '@/components/ui/badge';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  cached?: boolean;
  isStreaming?: boolean;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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
  const [briefingDialogOpen, setBriefingDialogOpen] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };

    // Create placeholder for assistant message with streaming flag
    const assistantMessageId = `assistant-${Date.now()}`;
    
    setMessages(prev => [...prev, userMessage, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    }]);
    setInput('');
    setIsLoading(true);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-traffic-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          projectId: selectedProjectId,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          message: content,
          skipCache,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Streaming não suportado');
      }

      const decoder = new TextDecoder();
      let textBuffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        // Process line by line
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const deltaContent = parsed.choices?.[0]?.delta?.content;
            
            if (deltaContent) {
              fullContent += deltaContent;
              setMessages(prev => prev.map(msg => 
                msg.id === assistantMessageId 
                  ? { ...msg, content: fullContent }
                  : msg
              ));
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const deltaContent = parsed.choices?.[0]?.delta?.content;
            if (deltaContent) {
              fullContent += deltaContent;
              setMessages(prev => prev.map(msg => 
                msg.id === assistantMessageId 
                  ? { ...msg, content: fullContent }
                  : msg
              ));
            }
          } catch { /* ignore */ }
        }
      }

      // Mark streaming as complete
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, isStreaming: false }
          : msg
      ));

      if (!fullContent) {
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: '❌ Não foi possível gerar uma resposta. Tente novamente.', isStreaming: false }
            : msg
        ));
      }

    } catch (error) {
      console.error('AI Assistant error:', error);
      
      if ((error as Error).name === 'AbortError') {
        setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
        return;
      }

      toast.error('Erro ao processar sua solicitação');
      
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content: '❌ Desculpe, ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.', isStreaming: false }
          : msg
      ));
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
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
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold text-lg">Agente Lisboa</h1>
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
              onClick={() => setBriefingDialogOpen(true)}
              title="Configurar briefing do projeto"
              className="relative"
            >
              <Settings2 className="h-4 w-4" />
              {selectedProject && !(selectedProject as any).ai_briefing && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-metric-warning rounded-full" />
              )}
            </Button>
            
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
                  <Bot className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold mb-2">Agente Lisboa</h2>
                <p className="text-muted-foreground max-w-md mx-auto mb-4">
                  Analista de performance especializado em Meta Ads. 
                  Faça perguntas sobre suas campanhas e receba diagnósticos baseados em dados.
                </p>
                
                {/* Briefing status */}
                {selectedProject && (
                  <div className="mb-8">
                    {(selectedProject as any).ai_briefing ? (
                      <Badge variant="outline" className="bg-metric-positive/10 text-metric-positive border-metric-positive/30">
                        ✓ Briefing configurado
                      </Badge>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBriefingDialogOpen(true)}
                        className="text-metric-warning border-metric-warning/30 hover:bg-metric-warning/10"
                      >
                        ⚠️ Configure o briefing para análises mais precisas
                      </Button>
                    )}
                  </div>
                )}
                
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
                          {message.content ? formatContent(message.content) : null}
                          {message.isStreaming && message.content && (
                            <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse rounded-sm ml-1 align-middle" />
                          )}
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

                {messages.some(m => m.isStreaming && m.content === '') && (
                  <div className="flex justify-start">
                    <div className="bg-muted/50 border rounded-2xl px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Bot className="h-5 w-5 text-primary animate-pulse" />
                        <span className="text-sm text-muted-foreground">Agente Lisboa está digitando</span>
                        <span className="inline-block w-2 h-5 bg-primary/60 animate-pulse rounded-sm" />
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

      {/* Briefing Dialog */}
      {selectedProject && (
        <ProjectBriefingDialog
          open={briefingDialogOpen}
          onOpenChange={setBriefingDialogOpen}
          projectId={selectedProject.id}
          projectName={selectedProject.name}
          initialBriefing={(selectedProject as any).ai_briefing}
          onSaved={() => {
            // Refresh projects to get updated briefing
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
