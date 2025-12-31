import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  BarChart3, 
  Eye, 
  Download, 
  Megaphone, 
  Image, 
  ArrowRight, 
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import v4LogoFull from '@/assets/v4-logo-full.png';

const steps = [
  {
    icon: Eye,
    title: 'Visualização de Métricas',
    description: 'Acompanhe em tempo real os resultados das suas campanhas de marketing digital.',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
  {
    icon: BarChart3,
    title: 'Dashboard Completo',
    description: 'Veja gráficos de performance, comparativos de períodos e tendências.',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
  },
  {
    icon: Megaphone,
    title: 'Campanhas e Conjuntos',
    description: 'Explore detalhes de cada campanha, conjunto de anúncios e anúncio individual.',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
  },
  {
    icon: Image,
    title: 'Galeria de Criativos',
    description: 'Visualize todos os criativos utilizados nas campanhas com suas métricas.',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
  },
  {
    icon: Download,
    title: 'Relatórios em PDF',
    description: 'Exporte relatórios personalizados com as métricas mais importantes.',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
];

// Info sobre sincronização de dados
const DATA_INFO = {
  title: '📊 Sobre os Dados',
  items: [
    'Os dados estão disponíveis desde o início de 2025',
    'A sincronização automática ocorre todo dia às 02h da manhã',
    'Você pode visualizar métricas em tempo real durante o dia',
  ],
};

export default function GuestOnboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Finish onboarding
      localStorage.setItem('guestOnboardingComplete', 'true');
      navigate('/dashboard');
    }
  };

  const handleSkip = () => {
    localStorage.setItem('guestOnboardingComplete', 'true');
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Background Pattern */}
      <div className="absolute inset-0 red-texture-bg opacity-20 pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 p-6 flex items-center justify-between">
        <img src={v4LogoFull} alt="V4 Company" className="h-10" />
        <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground">
          Pular
        </Button>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          {/* Welcome Message (First View) */}
          {currentStep === 0 && (
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm mb-6">
                <Sparkles className="w-4 h-4" />
                Bem-vindo ao V4 Dashboard
              </div>
              <h1 className="text-4xl font-bold mb-4">
                Olá! 👋
              </h1>
              <p className="text-xl text-muted-foreground max-w-md mx-auto">
                Vamos fazer um tour rápido pelo sistema para você aproveitar ao máximo.
              </p>
            </div>
          )}

          {/* Step Card */}
          <Card className="glass-card border-border/50 overflow-hidden">
            <CardContent className="p-0">
              <div className="p-8">
                {/* Progress */}
                <div className="flex items-center gap-2 mb-8">
                  {steps.map((_, index) => (
                    <div
                      key={index}
                      className={cn(
                        'h-1.5 flex-1 rounded-full transition-colors',
                        index <= currentStep ? 'bg-primary' : 'bg-muted'
                      )}
                    />
                  ))}
                </div>

                {/* Current Step */}
                <div className="text-center">
                  <div className={cn(
                    'w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6',
                    steps[currentStep].bgColor
                  )}>
                    {(() => {
                      const StepIcon = steps[currentStep].icon;
                      return <StepIcon className={cn('w-10 h-10', steps[currentStep].color)} />;
                    })()}
                  </div>

                  <h2 className="text-2xl font-bold mb-3">{steps[currentStep].title}</h2>
                  <p className="text-muted-foreground text-lg max-w-md mx-auto">
                    {steps[currentStep].description}
                  </p>
                </div>

                {/* Features List (on last step) */}
                {currentStep === steps.length - 1 && (
                  <div className="mt-8 space-y-4">
                    <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                      <p className="text-sm font-medium mb-3 text-center">O que você pode fazer:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {['Ver Dashboard', 'Ver Campanhas', 'Ver Criativos', 'Baixar PDFs'].map((item) => (
                          <div key={item} className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-metric-positive" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Data Sync Info */}
                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-sm font-medium mb-2">{DATA_INFO.title}</p>
                      <ul className="space-y-1">
                        {DATA_INFO.items.map((item, idx) => (
                          <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                            <span className="text-primary">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-6 bg-muted/30 border-t border-border/50 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Passo {currentStep + 1} de {steps.length}
                </p>
                <Button onClick={handleNext} className="gap-2">
                  {currentStep === steps.length - 1 ? (
                    <>
                      Começar
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Próximo
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
