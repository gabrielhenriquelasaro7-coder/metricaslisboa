import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface UseAIAssistantProps {
  projectId: string | null;
  startDate: string;
  endDate: string;
}

export const useAIAssistant = ({ projectId, startDate, endDate }: UseAIAssistantProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const sendMessage = useCallback(async (content: string, analysisType?: string) => {
    if (!projectId) {
      toast.error('Nenhum projeto selecionado');
      return;
    }

    if (!content.trim()) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-traffic-assistant', {
        body: {
          projectId,
          startDate,
          endDate,
          message: content,
          analysisType,
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
      };

      setMessages(prev => [...prev, assistantMessage]);
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
  }, [projectId, startDate, endDate]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const toggleOpen = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  return {
    messages,
    isLoading,
    isOpen,
    setIsOpen,
    sendMessage,
    clearMessages,
    toggleOpen,
  };
};
