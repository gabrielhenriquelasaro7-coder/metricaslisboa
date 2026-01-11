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
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-xl"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Central de Sugestões
            </h1>
            <p className="text-muted-foreground text-sm">
              Ajude-nos a melhorar o MetaAds Manager
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: MessageSquare, label: 'Sugestões Recebidas', value: '0', color: 'text-blue-500' },
            { icon: Zap, label: 'Implementadas', value: '0', color: 'text-emerald-500' },
            { icon: Clock, label: 'Em Análise', value: '0', color: 'text-amber-500' },
            { icon: ThumbsUp, label: 'Aprovadas', value: '0', color: 'text-primary' },
          ].map((stat, index) => (
            <Card key={index} className="bg-card/50 backdrop-blur-sm border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-secondary ${stat.color}`}>
                  <stat.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Form */}
        <Card className="bg-card/80 backdrop-blur-sm border-border overflow-hidden">
          <CardHeader className="border-b border-border bg-secondary/30">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Enviar Sugestão
            </CardTitle>
            <CardDescription>
              Sua opinião é muito importante para nós. Descreva sua ideia ou reporte um problema.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-6">
            <AnimatePresence mode="wait">
              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex flex-col items-center justify-center py-12 text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Sugestão Enviada!</h3>
                  <p className="text-muted-foreground text-sm max-w-sm">
                    Obrigado por contribuir! Vamos analisar sua sugestão e responderemos em breve.
                  </p>
                </motion.div>
              ) : (
                <motion.form
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleSubmit}
                  className="space-y-6"
                >
                  {/* Type Selection */}
                  <div>
                    <Label className="text-sm font-medium mb-3 block">Tipo de Sugestão</Label>
                    <Tabs value={activeTab} onValueChange={(v) => handleTypeChange(v as SuggestionType)}>
                      <TabsList className="w-full grid grid-cols-3 h-auto p-1 bg-secondary/50">
                        {(Object.keys(typeConfig) as SuggestionType[]).map((type) => {
                          const config = typeConfig[type];
                          const Icon = config.icon;
                          return (
                            <TabsTrigger
                              key={type}
                              value={type}
                              className="flex items-center gap-2 py-3 data-[state=active]:bg-card"
                            >
                              <Icon className={`w-4 h-4 ${config.color}`} />
                              <span className="hidden sm:inline text-sm">{config.label}</span>
                            </TabsTrigger>
                          );
                        })}
                      </TabsList>
                    </Tabs>
                  </div>

                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor="title">Título</Label>
                    <Input
                      id="title"
                      placeholder={
                        form.type === 'bug' 
                          ? 'Ex: Loading infinito na página de projetos'
                          : form.type === 'feature'
                          ? 'Ex: Adicionar integração com TikTok Ads'
                          : 'Ex: Melhorar visualização dos gráficos'
                      }
                      value={form.title}
                      onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                      className="bg-secondary/50 border-border"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição Detalhada</Label>
                    <Textarea
                      id="description"
                      placeholder={
                        form.type === 'bug'
                          ? 'Descreva o problema: O que acontece? Quando acontece? Passos para reproduzir...'
                          : form.type === 'feature'
                          ? 'Descreva a funcionalidade: O que ela faria? Como ajudaria no seu dia a dia?'
                          : 'Descreva a melhoria: O que poderia ser melhor? Como você imagina?'
                      }
                      value={form.description}
                      onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                      className="bg-secondary/50 border-border min-h-[120px] resize-none"
                    />
                  </div>

                  {/* Priority */}
                  <div className="space-y-2">
                    <Label>Prioridade</Label>
                    <div className="flex gap-2">
                      {(Object.keys(priorityConfig) as Array<keyof typeof priorityConfig>).map((priority) => (
                        <button
                          key={priority}
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, priority }))}
                          className={`
                            px-4 py-2 rounded-lg text-sm font-medium transition-all
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

                  {/* Submit */}
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      Logado como: {user?.email}
                    </p>
                    <Button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Enviar Sugestão
                        </>
                      )}
                    </Button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Tips */}
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          {[
            {
              title: 'Seja Específico',
              description: 'Quanto mais detalhes, melhor conseguimos entender e implementar.',
              icon: Lightbulb,
            },
            {
              title: 'Inclua Exemplos',
              description: 'Se possível, descreva cenários de uso ou anexe prints.',
              icon: MessageSquare,
            },
            {
              title: 'Priorize',
              description: 'Marque como alta prioridade apenas problemas críticos.',
              icon: Zap,
            },
          ].map((tip, index) => (
            <Card key={index} className="bg-card/30 border-border">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <tip.icon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-medium text-sm">{tip.title}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{tip.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
