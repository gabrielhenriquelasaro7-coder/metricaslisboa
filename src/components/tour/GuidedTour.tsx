import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

interface TourStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

// Desktop tour steps (full tour with sidebar)
const desktopTourSteps: TourStep[] = [
  {
    id: 'sidebar',
    title: 'Menu de Navegação',
    description: 'Aqui você navega entre Dashboard, Campanhas, Criativos e mais. Clique para explorar cada seção.',
    targetSelector: '[data-tour="sidebar-nav"]',
    position: 'right',
  },
  {
    id: 'project-selector',
    title: 'Seletor de Projeto',
    description: 'Visualize e troque entre os projetos que você tem acesso. As métricas mudam de acordo com o projeto selecionado.',
    targetSelector: '[data-tour="project-selector"]',
    position: 'right',
  },
  {
    id: 'date-picker',
    title: 'Período de Análise',
    description: 'Selecione o período que deseja analisar: hoje, últimos 7 dias, este mês ou datas personalizadas.',
    targetSelector: '[data-tour="date-picker"]',
    position: 'bottom',
  },
  {
    id: 'metrics',
    title: 'Métricas Principais',
    description: 'Cards com as métricas mais importantes: Gasto, Impressões, Cliques, CTR, CPM e CPC. Cada um mostra a evolução no período.',
    targetSelector: '[data-tour="metrics"]',
    position: 'bottom',
  },
  {
    id: 'charts',
    title: 'Gráficos de Performance',
    description: 'Acompanhe a evolução das métricas ao longo do tempo através de gráficos interativos.',
    targetSelector: '[data-tour="charts"]',
    position: 'top',
  },
  {
    id: 'pdf-export',
    title: 'Exportar Relatório PDF',
    description: 'Gere relatórios profissionais em PDF com todas as métricas e gráficos para compartilhar com sua equipe ou clientes.',
    targetSelector: '[data-tour="pdf-export"]',
    position: 'bottom',
  },
  {
    id: 'campaigns',
    title: 'Campanhas e Conjuntos',
    description: 'Clique em qualquer campanha para expandir e ver todos os conjuntos de anúncios. Navegue para ver métricas detalhadas de cada nível.',
    targetSelector: '[data-tour="campaigns"]',
    position: 'right',
  },
  {
    id: 'creatives',
    title: 'Galeria de Criativos',
    description: 'Veja todos os seus criativos (imagens e vídeos) com as métricas de performance de cada um. Ideal para identificar o que funciona melhor!',
    targetSelector: '[data-tour="creatives"]',
    position: 'right',
  },
];

// Mobile tour steps (simplified, no sidebar elements)
const mobileTourSteps: TourStep[] = [
  {
    id: 'mobile-menu',
    title: 'Menu de Navegação',
    description: 'Toque aqui para abrir o menu e acessar Dashboard, Campanhas, Criativos e mais opções.',
    targetSelector: '[data-tour="mobile-menu"]',
    position: 'bottom',
  },
  {
    id: 'date-picker',
    title: 'Período de Análise',
    description: 'Selecione o período que deseja analisar: hoje, últimos 7 dias, este mês ou datas personalizadas.',
    targetSelector: '[data-tour="date-picker"]',
    position: 'bottom',
  },
  {
    id: 'metrics',
    title: 'Métricas Principais',
    description: 'Cards com as métricas mais importantes: Gasto, Impressões, Cliques, CTR, CPM e CPC.',
    targetSelector: '[data-tour="metrics"]',
    position: 'bottom',
  },
  {
    id: 'charts',
    title: 'Gráficos de Performance',
    description: 'Acompanhe a evolução das métricas ao longo do tempo através de gráficos interativos.',
    targetSelector: '[data-tour="charts"]',
    position: 'top',
  },
  {
    id: 'pdf-export',
    title: 'Exportar Relatório PDF',
    description: 'Gere relatórios profissionais em PDF com todas as métricas e gráficos.',
    targetSelector: '[data-tour="pdf-export"]',
    position: 'bottom',
  },
];

interface SpotlightPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TooltipPosition {
  top: number;
  left: number;
}

interface GuidedTourProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function GuidedTour({ onComplete, onSkip }: GuidedTourProps) {
  const isMobile = useIsMobile();
  const tourSteps = isMobile ? mobileTourSteps : desktopTourSteps;
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [spotlight, setSpotlight] = useState<SpotlightPosition | null>(null);
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition>({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Block body scroll while tour is active
  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isVisible]);

  const step = tourSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === tourSteps.length - 1;

  // Calculate element position and update spotlight
  const updatePositions = useCallback(() => {
    const element = document.querySelector(step.targetSelector);
    if (!element) {
      console.log('[GuidedTour] Element not found:', step.targetSelector);
      // If element not found, use center fallback
      setSpotlight(null);
      setTooltipPos({
        top: window.innerHeight / 2 - 100,
        left: window.innerWidth / 2 - 175,
      });
      return;
    }

    const rect = element.getBoundingClientRect();
    const padding = 12;

    // Set spotlight position
    setSpotlight({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    });

    // Calculate tooltip position based on step.position
    const tooltipWidth = 350;
    const tooltipHeight = 200;
    const gap = 20;

    let top = 0;
    let left = 0;

    switch (step.position) {
      case 'right':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + gap;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - gap;
        break;
      case 'bottom':
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'top':
        top = rect.top - tooltipHeight - gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
    }

    // Keep tooltip in viewport
    top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16));
    left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));

    setTooltipPos({ top, left });
  }, [step]);

  // Update positions when step changes or window resizes
  useEffect(() => {
    // Wait a bit for elements to render
    const timer = setTimeout(updatePositions, 100);

    const handleResize = () => updatePositions();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [updatePositions, currentStep]);

  // Scroll element into view
  useEffect(() => {
    const element = document.querySelector(step.targetSelector);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Update positions after scroll
      setTimeout(updatePositions, 400);
    }
  }, [step.targetSelector, updatePositions]);

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

  // Keyboard navigation - only Escape explicitly skips
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default behavior to stop other components from responding
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        handlePrev();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleSkip();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleNext, handlePrev, handleSkip]);

  if (!isVisible) return null;

  return createPortal(
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Dark overlay with spotlight cutout - clicking outside does NOT close tour */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998]"
            style={{
              background: spotlight
                ? `radial-gradient(ellipse ${spotlight.width + 60}px ${spotlight.height + 60}px at ${spotlight.left + spotlight.width / 2}px ${spotlight.top + spotlight.height / 2}px, transparent 0%, rgba(0,0,0,0.85) 100%)`
                : 'rgba(0,0,0,0.85)',
              pointerEvents: 'all', // Block interactions with underlying elements
            }}
            onClick={(e) => {
              // Prevent clicks from propagating but do NOT skip tour
              e.stopPropagation();
              e.preventDefault();
            }}
          />

          {/* Spotlight border with PULSE animation */}
          {spotlight && (
            <motion.div
              key={`spotlight-${currentStep}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ 
                opacity: 1, 
                scale: 1,
                boxShadow: [
                  '0 0 0 4px hsl(var(--primary)), 0 0 20px 4px hsl(var(--primary) / 0.4)',
                  '0 0 0 6px hsl(var(--primary)), 0 0 40px 8px hsl(var(--primary) / 0.6)',
                  '0 0 0 4px hsl(var(--primary)), 0 0 20px 4px hsl(var(--primary) / 0.4)',
                ]
              }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ 
                duration: 0.3,
                boxShadow: {
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }
              }}
              className="fixed z-[9999] pointer-events-none rounded-xl"
              style={{
                top: spotlight.top,
                left: spotlight.left,
                width: spotlight.width,
                height: spotlight.height,
                border: '2px solid hsl(var(--primary))',
              }}
            />
          )}

          {/* Tooltip */}
          <motion.div
            ref={tooltipRef}
            key={`tooltip-${currentStep}`}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="fixed z-[10000] w-[350px]"
            style={{ top: tooltipPos.top, left: tooltipPos.left }}
          >
            <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
              {/* Progress */}
              <div className="h-1.5 bg-muted">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary to-primary/70"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentStep + 1) / tourSteps.length) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Header */}
              <div className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
                        Passo {currentStep + 1} de {tourSteps.length}
                      </p>
                      <h3 className="font-semibold">{step.title}</h3>
                    </div>
                  </div>
                  <button
                    onClick={handleSkip}
                    className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-4 pb-4">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={step.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className="text-sm text-muted-foreground leading-relaxed"
                  >
                    {step.description}
                  </motion.p>
                </AnimatePresence>
              </div>

              {/* Step Dots */}
              <div className="px-4 pb-3 flex justify-center gap-1.5">
                {tourSteps.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      index === currentStep
                        ? 'w-6 bg-primary'
                        : index < currentStep
                        ? 'w-1.5 bg-primary/50'
                        : 'w-1.5 bg-muted-foreground/30'
                    }`}
                  />
                ))}
              </div>

              {/* Footer */}
              <div className="px-4 py-3 bg-muted/30 border-t border-border flex items-center justify-between">
                <button
                  onClick={handleSkip}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Pular tour
                </button>

                <div className="flex items-center gap-2">
                  {!isFirstStep && (
                    <Button variant="ghost" size="sm" onClick={handlePrev} className="h-8 px-3 text-xs">
                      <ChevronLeft className="w-3 h-3 mr-1" />
                      Anterior
                    </Button>
                  )}
                  <Button size="sm" onClick={handleNext} className="h-8 px-4 text-xs gap-1">
                    {isLastStep ? 'Começar!' : 'Próximo'}
                    {!isLastStep && <ChevronRight className="w-3 h-3" />}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
