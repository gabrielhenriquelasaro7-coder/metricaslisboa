import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  ArrowRight, 
  BarChart3, 
  Target, 
  TrendingUp, 
  Zap, 
  CheckCircle2,
  Sparkles,
  Users,
  FileText
} from 'lucide-react';
import v4LogoIcon from '@/assets/v4-logo-icon.png';

const features = [
  {
    icon: BarChart3,
    title: 'Dashboard Completo',
    description: 'Visualize todas as métricas importantes das suas campanhas em um só lugar.',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    icon: Target,
    title: 'Análise de Campanhas',
    description: 'Acompanhe o desempenho de cada campanha, conjunto de anúncios e anúncio.',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
  },
  {
    icon: TrendingUp,
    title: 'Métricas de Resultado',
    description: 'ROAS, CPA, conversões e receita - tudo calculado automaticamente.',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400/10',
  },
  {
    icon: Users,
    title: 'Dados Demográficos',
    description: 'Entenda seu público por idade, gênero, dispositivo e plataforma.',
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
  },
  {
    icon: FileText,
    title: 'Relatórios em PDF',
    description: 'Gere relatórios profissionais personalizados para seus clientes.',
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
  },
  {
    icon: Zap,
    title: 'Sincronização Automática',
    description: 'Dados atualizados automaticamente a cada 6 horas.',
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);

  const handleComplete = () => {
    localStorage.setItem('onboardingCompleted', 'true');
    navigate('/projects');
  };

  const handleNext = () => {
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
      {/* Background effects - subtle glow, not pulsing */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[150px]" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-red-600/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-red-500/5 rounded-full blur-[80px]" />
      </div>

      {/* Floating particles - softer */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-primary/10 pointer-events-none"
          style={{
            width: 3 + Math.random() * 5,
            height: 3 + Math.random() * 5,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `float ${6 + Math.random() * 4}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 5}s`,
            filter: 'blur(1px)',
          }}
        />
      ))}

      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(239,68,68,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(239,68,68,0.015)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-4xl px-6 py-12">
        {/* Step 0: Welcome */}
        {currentStep === 0 && (
          <div className="text-center animate-fade-in flex flex-col items-center">
            {/* Logo centered above */}
            <div className="relative mb-8">
              <img 
                src={v4LogoIcon} 
                alt="V4 Company" 
                className="h-20 w-auto drop-shadow-xl rounded-2xl"
              />
              {/* Soft glow behind logo - no animation */}
              <div className="absolute inset-0 bg-primary/15 rounded-2xl blur-xl -z-10 scale-150" />
            </div>

            {/* Welcome badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Bem-vindo ao MetaAds Manager</span>
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Olá! <span className="gradient-text">Vamos começar</span>
            </h1>
            
            {/* Description */}
            <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10">
              Sua plataforma completa para gestão e análise de campanhas Meta Ads. 
              Veja um resumo do que você pode fazer.
            </p>

            {/* Button */}
            <Button 
              onClick={handleNext}
              size="lg"
              className="bg-gradient-to-r from-primary via-red-600 to-red-700 hover:from-red-600 hover:via-red-700 hover:to-red-800 shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all duration-300 hover:scale-105 px-8 group"
            >
              Conhecer recursos
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        )}

        {/* Step 1: Features */}
        {currentStep === 1 && (
          <div className="animate-fade-in">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold mb-3">
                <span className="gradient-text">Recursos principais</span>
              </h2>
              <p className="text-muted-foreground">
                Tudo o que você precisa para gerenciar suas campanhas
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10 stagger-fade-in">
              {features.map((feature, i) => {
                const Icon = feature.icon;
                return (
                  <div 
                    key={i}
                    className="glass-card p-5 hover-lift cursor-default group"
                  >
                    <div className={`w-12 h-12 rounded-xl ${feature.bgColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <Icon className={`w-6 h-6 ${feature.color}`} />
                    </div>
                    <h3 className="font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-center gap-4">
              <Button 
                variant="outline" 
                onClick={() => setCurrentStep(0)}
                className="px-6"
              >
                Voltar
              </Button>
              <Button 
                onClick={handleNext}
                className="bg-gradient-to-r from-primary via-red-600 to-red-700 hover:from-red-600 hover:via-red-700 hover:to-red-800 shadow-lg shadow-primary/30 px-8 group"
              >
                Próximo
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Ready */}
        {currentStep === 2 && (
          <div className="text-center animate-fade-in">
            <div className="relative inline-block mb-8">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-emerald-500/20 flex items-center justify-center mx-auto animate-float">
                <CheckCircle2 className="w-12 h-12 text-emerald-400" />
              </div>
              <div className="absolute inset-0 bg-emerald-400/20 rounded-full blur-2xl -z-10 animate-pulse-slow" />
            </div>

            <h2 className="text-4xl font-bold mb-4">
              <span className="gradient-text">Tudo pronto!</span>
            </h2>
            
            <p className="text-lg text-muted-foreground max-w-lg mx-auto mb-8">
              Agora você pode criar seu primeiro projeto e conectar sua conta de anúncios do Meta.
            </p>

            <div className="glass-card p-6 max-w-md mx-auto mb-10 text-left">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Próximos passos:
              </h3>
              <ul className="space-y-3">
                {[
                  'Crie um novo projeto',
                  'Adicione seu Ad Account ID do Meta',
                  'Aguarde a sincronização inicial',
                  'Explore suas métricas!'
                ].map((step, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-center gap-4">
              <Button 
                variant="outline" 
                onClick={() => setCurrentStep(1)}
                className="px-6"
              >
                Voltar
              </Button>
              <Button 
                onClick={handleComplete}
                size="lg"
                className="bg-gradient-to-r from-primary via-red-600 to-red-700 hover:from-red-600 hover:via-red-700 hover:to-red-800 shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all duration-300 hover:scale-105 px-8 group"
              >
                Criar meu primeiro projeto
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        )}

        {/* Step indicators */}
        <div className="flex justify-center gap-2 mt-12">
          {[0, 1, 2].map((step) => (
            <button
              key={step}
              onClick={() => setCurrentStep(step)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                step === currentStep 
                  ? 'bg-primary w-8' 
                  : step < currentStep 
                    ? 'bg-primary/50' 
                    : 'bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
