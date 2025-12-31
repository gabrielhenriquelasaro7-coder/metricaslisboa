import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, 
  Eye, 
  Download, 
  Megaphone, 
  Image, 
  ArrowRight, 
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Zap,
  Target,
  PieChart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import v4LogoFull from '@/assets/v4-logo-full.png';

const features = [
  {
    icon: Eye,
    title: 'Métricas em Tempo Real',
    description: 'Acompanhe os resultados das suas campanhas sempre atualizados.',
  },
  {
    icon: BarChart3,
    title: 'Dashboard Completo',
    description: 'Gráficos de performance e comparativos de períodos.',
  },
  {
    icon: Megaphone,
    title: 'Análise de Campanhas',
    description: 'Detalhes de cada campanha e conjunto de anúncios.',
  },
  {
    icon: Image,
    title: 'Galeria de Criativos',
    description: 'Visualize todos os criativos com suas métricas.',
  },
];

export default function GuestOnboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [guestName, setGuestName] = useState<string>('');
  const [projectName, setProjectName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showContent, setShowContent] = useState(false);

  // Fetch guest info
  useEffect(() => {
    const fetchGuestInfo = async () => {
      if (!user) {
        setLoading(false);
        setShowContent(true);
        return;
      }

      try {
        // Get guest invitation info
        const { data: invitation } = await supabase
          .from('guest_invitations')
          .select('guest_name, project_id')
          .eq('guest_user_id', user.id)
          .single();

        if (invitation) {
          setGuestName(invitation.guest_name);
          
          // Get project name
          if (invitation.project_id) {
            const { data: project } = await supabase
              .from('projects')
              .select('name')
              .eq('id', invitation.project_id)
              .single();
            
            if (project) {
              setProjectName(project.name);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching guest info:', error);
      } finally {
        setLoading(false);
        // Small delay for smooth transition
        setTimeout(() => setShowContent(true), 100);
      }
    };

    fetchGuestInfo();
  }, [user]);

  const handleStart = () => {
    localStorage.setItem('guestOnboardingComplete', 'true');
    localStorage.setItem('tour_pending', 'true'); // Flag to trigger tour on dashboard
    navigate('/dashboard');
  };

  // Get first name
  const firstName = guestName.split(' ')[0] || 'Cliente';

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="absolute inset-0 red-texture-bg opacity-20 pointer-events-none" />
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <img src={v4LogoFull} alt="V4 Company" className="h-12" />
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 red-texture-bg opacity-20 pointer-events-none" />
      
      {/* Decorative elements */}
      <div className="absolute top-20 right-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 p-6 flex items-center justify-center"
      >
        <img src={v4LogoFull} alt="V4 Company" className="h-10" />
      </motion.header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-6">
        <AnimatePresence>
          {showContent && (
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="w-full max-w-3xl"
            >
              {/* Welcome Message */}
              <div className="text-center mb-10">
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-primary/20 to-primary/10 text-primary text-sm font-medium mb-6 border border-primary/20"
                >
                  <Sparkles className="w-4 h-4" />
                  Seu dashboard está pronto
                </motion.div>
                
                <motion.h1 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="text-4xl md:text-5xl font-bold mb-4"
                >
                  Olá, <span className="gradient-text">{firstName}</span>!
                </motion.h1>
                
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className="text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed"
                >
                  Seja muito bem-vindo(a) ao seu painel exclusivo!
                </motion.p>
                
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45, duration: 0.5 }}
                  className="text-base text-muted-foreground max-w-xl mx-auto mt-3"
                >
                  Preparamos um dashboard completo para você acompanhar todas as métricas das suas campanhas de tráfego pago de forma simples e intuitiva.
                  {projectName && (
                    <span className="block mt-3 text-foreground font-medium">
                      Projeto: {projectName}
                    </span>
                  )}
                </motion.p>
              </div>

              {/* Features Card */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
              >
                <Card className="glass-card border-border/50 overflow-hidden backdrop-blur-xl">
                  <CardContent className="p-0">
                    {/* Features Grid */}
                    <div className="p-8">
                      <div className="flex items-center gap-2 mb-6">
                        <Zap className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-semibold">O que você pode fazer aqui</h2>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {features.map((feature, index) => (
                          <motion.div
                            key={feature.title}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.6 + index * 0.1, duration: 0.4 }}
                            className="flex items-start gap-4 p-4 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
                          >
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <feature.icon className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-medium mb-1">{feature.title}</h3>
                              <p className="text-sm text-muted-foreground">{feature.description}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Info Banner */}
                    <div className="px-8 pb-6">
                      <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <TrendingUp className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm mb-1">Dados sempre atualizados</p>
                            <p className="text-xs text-muted-foreground">
                              A sincronização automática ocorre diariamente às 02h da manhã, mantendo suas métricas sempre atualizadas.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* CTA Section */}
                    <div className="p-6 bg-gradient-to-r from-muted/50 to-muted/30 border-t border-border/50">
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <Target className="w-4 h-4 text-primary" />
                          <span>Preparado para explorar seus resultados?</span>
                        </div>
                        <Button 
                          onClick={handleStart} 
                          size="lg"
                          className="gap-2 px-8 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow"
                        >
                          Acessar Dashboard
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Footer note */}
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1, duration: 0.5 }}
                className="text-center text-xs text-muted-foreground mt-6"
              >
                Caso tenha dúvidas, entre em contato com seu gestor de tráfego
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
