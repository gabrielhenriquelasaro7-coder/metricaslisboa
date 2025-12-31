import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Sparkles, LayoutDashboard, Megaphone, Image, Calendar, BarChart3, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  targetSelector?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Bem-vindo ao seu Dashboard!',
    description: 'Este é o seu painel de controle onde você acompanha todas as métricas das suas campanhas. Vamos fazer um tour rápido para você conhecer as principais funcionalidades.',
    icon: Sparkles,
    position: 'center',
  },
  {
    id: 'sidebar',
    title: 'Menu de Navegação',
    description: 'Aqui você encontra o menu principal. Navegue entre Dashboard, Campanhas, Conjuntos de Anúncios e Criativos para ver detalhes específicos de cada área.',
    icon: LayoutDashboard,
    position: 'right',
    targetSelector: '[data-tour="sidebar"]',
  },
  {
    id: 'date-picker',
    title: 'Seletor de Período',
    description: 'Escolha o período que deseja analisar. Você pode ver os dados de hoje, últimos 7 dias, este mês ou selecionar datas personalizadas.',
    icon: Calendar,
    position: 'bottom',
    targetSelector: '[data-tour="date-picker"]',
  },
  {
    id: 'metrics',
    title: 'Métricas Principais',
    description: 'Estes cards mostram as métricas mais importantes: Gasto Total, Impressões, Cliques, CTR, CPM e CPC. Cada card inclui um mini gráfico de evolução.',
    icon: Target,
    position: 'top',
    targetSelector: '[data-tour="metrics"]',
  },
  {
    id: 'charts',
    title: 'Gráficos de Performance',
    description: 'Visualize a evolução das suas métricas ao longo do tempo. Você pode personalizar quais métricas deseja ver em cada gráfico.',
    icon: BarChart3,
    position: 'top',
    targetSelector: '[data-tour="charts"]',
  },
  {
    id: 'campaigns',
    title: 'Suas Campanhas',
    description: 'No menu lateral você pode ver a lista de todas as suas campanhas. Clique em qualquer uma para ver os detalhes e conjuntos de anúncios.',
    icon: Megaphone,
    position: 'right',
    targetSelector: '[data-tour="campaigns"]',
  },
  {
    id: 'creatives',
    title: 'Galeria de Criativos',
    description: 'Acesse a galeria de criativos para ver todas as imagens e vídeos das suas campanhas com suas respectivas métricas de performance.',
    icon: Image,
    position: 'right',
    targetSelector: '[data-tour="creatives"]',
  },
];

interface GuidedTourProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function GuidedTour({ onComplete, onSkip }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const step = tourSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === tourSteps.length - 1;
  const progress = ((currentStep + 1) / tourSteps.length) * 100;

  const handleNext = useCallback(() => {
    if (isLastStep) {
      setIsVisible(false);
      setTimeout(onComplete, 300);
    } else {
      setCurrentStep(prev => prev + 1);
    }
  }, [isLastStep, onComplete]);

  const handlePrev = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  }, [isFirstStep]);

  const handleSkip = useCallback(() => {
    setIsVisible(false);
    setTimeout(onSkip, 300);
  }, [onSkip]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'Escape') {
        handleSkip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, handleSkip]);

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm"
            onClick={handleSkip}
          />

          {/* Tour Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed z-[101] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg mx-4"
          >
            <div className="glass-card border-border/50 overflow-hidden shadow-2xl">
              {/* Progress Bar */}
              <div className="h-1 bg-muted">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary to-primary/70"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Header */}
              <div className="p-6 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                      <step.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Passo {currentStep + 1} de {tourSteps.length}
                      </p>
                      <h3 className="text-lg font-semibold">{step.title}</h3>
                    </div>
                  </div>
                  <button
                    onClick={handleSkip}
                    className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 pb-6">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={step.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="text-muted-foreground leading-relaxed"
                  >
                    {step.description}
                  </motion.p>
                </AnimatePresence>
              </div>

              {/* Step Indicators */}
              <div className="px-6 pb-4">
                <div className="flex items-center justify-center gap-2">
                  {tourSteps.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentStep(index)}
                      className={cn(
                        'w-2 h-2 rounded-full transition-all',
                        index === currentStep
                          ? 'bg-primary w-6'
                          : index < currentStep
                          ? 'bg-primary/50'
                          : 'bg-muted-foreground/30'
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-muted/30 border-t border-border/50 flex items-center justify-between">
                <button
                  onClick={handleSkip}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Pular tour
                </button>

                <div className="flex items-center gap-2">
                  {!isFirstStep && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePrev}
                      className="gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Anterior
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleNext}
                    className="gap-1 min-w-[100px]"
                  >
                    {isLastStep ? (
                      'Começar!'
                    ) : (
                      <>
                        Próximo
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
