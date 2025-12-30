import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Trash2, Sparkles, TrendingUp, AlertTriangle, Lightbulb, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIAssistantChatProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (message: string, analysisType?: string) => void;
  onClearMessages: () => void;
  onClose: () => void;
  projectName?: string;
  periodLabel?: string;
}

const quickActions = [
  {
    label: 'Análise Geral',
    icon: TrendingUp,
    message: 'Faça uma análise geral da performance das campanhas no período selecionado. Identifique pontos fortes e oportunidades de melhoria.',
    type: 'general'
  },
  {
    label: 'Diagnóstico',
    icon: AlertTriangle,
    message: 'Diagnostique possíveis problemas nas campanhas. Identifique campanhas com baixo desempenho, anomalias e alertas importantes.',
    type: 'diagnostic'
  },
  {
    label: 'Otimizações',
    icon: Lightbulb,
    message: 'Sugira otimizações práticas para melhorar a performance. Foque em ações que podem ser implementadas imediatamente.',
    type: 'optimization'
  },
  {
    label: 'Criativos',
    icon: Image,
    message: 'Analise a performance dos criativos e anúncios. Identifique padrões de sucesso e recomende melhorias.',
    type: 'creatives'
  },
];

export const AIAssistantChat: React.FC<AIAssistantChatProps> = ({
  messages,
  isLoading,
  onSendMessage,
  onClearMessages,
  onClose,
  projectName,
  periodLabel,
}) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleQuickAction = (action: typeof quickActions[0]) => {
    if (!isLoading) {
      onSendMessage(action.message, action.type);
    }
  };

  const formatContent = (content: string) => {
    // Simple markdown-like formatting
    return content
      .split('\n')
      .map((line, i) => {
        // Headers
        if (line.startsWith('### ')) {
          return <h4 key={i} className="font-semibold text-sm mt-3 mb-1">{line.substring(4)}</h4>;
        }
        if (line.startsWith('## ')) {
          return <h3 key={i} className="font-bold text-base mt-4 mb-2">{line.substring(3)}</h3>;
        }
        if (line.startsWith('# ')) {
          return <h2 key={i} className="font-bold text-lg mt-4 mb-2">{line.substring(2)}</h2>;
        }
        // List items
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return <li key={i} className="ml-4 list-disc">{formatInlineStyles(line.substring(2))}</li>;
        }
        if (/^\d+\.\s/.test(line)) {
          return <li key={i} className="ml-4 list-decimal">{formatInlineStyles(line.replace(/^\d+\.\s/, ''))}</li>;
        }
        // Empty lines
        if (line.trim() === '') {
          return <br key={i} />;
        }
        // Regular paragraphs
        return <p key={i} className="mb-1">{formatInlineStyles(line)}</p>;
      });
  };

  const formatInlineStyles = (text: string) => {
    // Bold: **text** or __text__
    const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('__') && part.endsWith('__')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="flex flex-col h-full bg-background border-l">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">AI Traffic Manager</h3>
            <p className="text-xs text-muted-foreground">
              {projectName && periodLabel ? `${projectName} • ${periodLabel}` : 'Assistente de Análise'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClearMessages}
            className="h-8 w-8"
            title="Limpar conversa"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      {messages.length === 0 && (
        <div className="p-4 border-b">
          <p className="text-sm text-muted-foreground mb-3">Ações rápidas:</p>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((action) => (
              <Button
                key={action.type}
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction(action)}
                disabled={isLoading}
                className="justify-start gap-2 h-auto py-2 px-3"
              >
                <action.icon className="h-4 w-4 shrink-0" />
                <span className="text-xs">{action.label}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-sm">
                Olá! Sou seu assistente de análise de tráfego.
              </p>
              <p className="text-xs mt-1">
                Use as ações rápidas acima ou faça uma pergunta.
              </p>
            </div>
          )}

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
                  'max-w-[85%] rounded-lg px-4 py-3 text-sm',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                {message.role === 'assistant' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {formatContent(message.content)}
                  </div>
                ) : (
                  message.content
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="animate-pulse flex gap-1">
                    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <span className="text-sm text-muted-foreground">Analisando...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua pergunta..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};
