import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Lightbulb, 
  Bug, 
  Sparkles, 
  Send, 
  CheckCircle2, 
  ArrowLeft,
  MessageSquare,
  Zap,
  Clock,
  ThumbsUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type SuggestionType = 'improvement' | 'bug' | 'feature';

interface SuggestionForm {
  type: SuggestionType;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
}

const typeConfig = {
  improvement: {
    icon: Lightbulb,
    label: 'Melhoria',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
  },
  bug: {
    icon: Bug,
    label: 'Bug / Correção',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
  },
  feature: {
    icon: Sparkles,
    label: 'Nova Funcionalidade',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/20',
  },
};

const priorityConfig = {
  low: { label: 'Baixa', color: 'bg-muted text-muted-foreground' },
  medium: { label: 'Média', color: 'bg-amber-500/20 text-amber-600 dark:text-amber-400' },
  high: { label: 'Alta', color: 'bg-red-500/20 text-red-600 dark:text-red-400' },
};

export default function Suggestions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState<SuggestionType>('improvement');
  
  const [form, setForm] = useState<SuggestionForm>({
    type: 'improvement',
    title: '',
    description: '',
    priority: 'medium',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // In a real app, this would save to a suggestions table
      // For now, we'll just show success
      await new Promise(resolve => setTimeout(resolve, 800));
      
      console.log('[Suggestions] Submitted:', {
        ...form,
        user_id: user?.id,
        user_email: user?.email,
        submitted_at: new Date().toISOString(),
      });
      
      setSubmitted(true);
      toast.success('Sugestão enviada com sucesso!');
      
      // Reset form after 2 seconds
      setTimeout(() => {
        setSubmitted(false);
        setForm({
          type: 'improvement',
          title: '',
          description: '',
          priority: 'medium',
        });
      }, 3000);
    } catch (error) {
      toast.error('Erro ao enviar sugestão');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTypeChange = (type: SuggestionType) => {
    setActiveTab(type);
    setForm(prev => ({ ...prev, type }));
  };

  return (
    <div className="min-h-screen bg-background red-texture-bg grid-background">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Header - Mobile Optimized */}
        <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-xl h-8 w-8 sm:h-10 sm:w-10"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Central de Sugestões
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              Ajude-nos a melhorar o MetaAds Manager
            </p>
          </div>
        </div>

        {/* Stats Cards - Mobile Optimized */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-8">
          {[
            { icon: MessageSquare, label: 'Recebidas', value: '0', color: 'text-blue-500' },
            { icon: Zap, label: 'Implementadas', value: '0', color: 'text-emerald-500' },
            { icon: Clock, label: 'Em Análise', value: '0', color: 'text-amber-500' },
            { icon: ThumbsUp, label: 'Aprovadas', value: '0', color: 'text-primary' },
          ].map((stat, index) => (
            <Card key={index} className="bg-card/50 backdrop-blur-sm border-border">
              <CardContent className="p-2.5 sm:p-4 flex items-center gap-2 sm:gap-3">
                <div className={`p-1.5 sm:p-2 rounded-lg bg-secondary ${stat.color}`}>
                  <stat.icon className="w-3 h-3 sm:w-4 sm:h-4" />
                </div>
                <div>
                  <p className="text-base sm:text-xl font-bold">{stat.value}</p>
                  <p className="text-[10px] sm:text-[10px] text-muted-foreground leading-tight truncate">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Form - Mobile Optimized */}
        <Card className="bg-card/80 backdrop-blur-sm border-border overflow-hidden">
          <CardHeader className="border-b border-border bg-secondary/30 p-3 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              Enviar Sugestão
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Sua opinião é muito importante para nós.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-3 sm:p-6">
            <AnimatePresence mode="wait">
              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex flex-col items-center justify-center py-8 sm:py-12 text-center"
                >
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3 sm:mb-4">
                    <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-500" />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold mb-2">Sugestão Enviada!</h3>
                  <p className="text-muted-foreground text-xs sm:text-sm max-w-sm">
                    Obrigado por contribuir! Vamos analisar sua sugestão e responderemos em breve.
                  </p>
                </motion.div>
              ) : (
                <motion.form
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleSubmit}
                  className="space-y-4 sm:space-y-6"
                >
                  {/* Type Selection - Mobile Optimized */}
                  <div>
                    <Label className="text-xs sm:text-sm font-medium mb-2 sm:mb-3 block">Tipo de Sugestão</Label>
                    <Tabs value={activeTab} onValueChange={(v) => handleTypeChange(v as SuggestionType)}>
                      <TabsList className="w-full grid grid-cols-3 h-auto p-1 bg-secondary/50">
                        {(Object.keys(typeConfig) as SuggestionType[]).map((type) => {
                          const config = typeConfig[type];
                          const Icon = config.icon;
                          return (
                            <TabsTrigger
                              key={type}
                              value={type}
                              className="flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-3 data-[state=active]:bg-card text-xs sm:text-sm"
                            >
                              <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${config.color}`} />
                              <span className="hidden xs:inline text-xs sm:text-sm">{config.label}</span>
                            </TabsTrigger>
                          );
                        })}
                      </TabsList>
                    </Tabs>
                  </div>

                  {/* Title - Mobile Optimized */}
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="title" className="text-xs sm:text-sm">Título</Label>
                    <Input
                      id="title"
                      placeholder={
                        form.type === 'bug' 
                          ? 'Ex: Loading infinito na página'
                          : form.type === 'feature'
                          ? 'Ex: Integração com TikTok'
                          : 'Ex: Melhorar gráficos'
                      }
                      value={form.title}
                      onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                      className="bg-secondary/50 border-border h-9 sm:h-10 text-sm"
                    />
                  </div>

                  {/* Description - Mobile Optimized */}
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="description" className="text-xs sm:text-sm">Descrição Detalhada</Label>
                    <Textarea
                      id="description"
                      placeholder={
                        form.type === 'bug'
                          ? 'Descreva o problema: O que acontece? Quando?'
                          : form.type === 'feature'
                          ? 'Descreva: O que faria? Como ajudaria?'
                          : 'O que poderia ser melhor?'
                      }
                      value={form.description}
                      onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                      className="bg-secondary/50 border-border min-h-[100px] sm:min-h-[120px] resize-none text-sm"
                    />
                  </div>

                  {/* Priority - Mobile Optimized */}
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Prioridade</Label>
                    <div className="flex gap-1.5 sm:gap-2">
                      {(Object.keys(priorityConfig) as Array<keyof typeof priorityConfig>).map((priority) => (
                        <button
                          key={priority}
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, priority }))}
                          className={`
                            flex-1 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all
                            ${form.priority === priority 
                              ? `${priorityConfig[priority].color} ring-2 ring-offset-2 ring-offset-background ring-primary/50` 
                              : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'}
                          `}
                        >
                          {priorityConfig[priority].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Submit - Mobile Optimized */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 sm:pt-4 border-t border-border">
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate order-2 sm:order-1">
                      Logado: {user?.email}
                    </p>
                    <Button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="gap-2 w-full sm:w-auto order-1 sm:order-2 h-9 sm:h-10"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Enviar
                        </>
                      )}
                    </Button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Tips - Mobile Optimized */}
        <div className="mt-4 sm:mt-8 grid sm:grid-cols-3 gap-2 sm:gap-4">
          {[
            {
              title: 'Seja Específico',
              description: 'Quanto mais detalhes, melhor.',
              icon: Lightbulb,
            },
            {
              title: 'Inclua Exemplos',
              description: 'Descreva cenários de uso.',
              icon: MessageSquare,
            },
            {
              title: 'Priorize',
              description: 'Alta prioridade = crítico.',
              icon: Zap,
            },
          ].map((tip, index) => (
            <Card key={index} className="bg-card/30 border-border">
              <CardContent className="p-3 sm:p-4 flex items-start gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                  <tip.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-medium text-xs sm:text-sm">{tip.title}</h4>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{tip.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
