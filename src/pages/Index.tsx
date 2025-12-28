import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  ArrowRight, 
  CheckCircle, 
  TrendingUp, 
  Target, 
  Zap,
  ShoppingCart,
  Users,
  Store
} from 'lucide-react';

const features = [
  {
    icon: TrendingUp,
    title: 'ROAS em tempo real',
    description: 'Acompanhe o retorno do seu investimento com precisão e tome decisões baseadas em dados.',
  },
  {
    icon: Target,
    title: 'Análise hierárquica',
    description: 'Visualize métricas de conta, campanha, conjunto e anúncio em uma interface intuitiva.',
  },
  {
    icon: Zap,
    title: 'Sincronização automática',
    description: 'Dados atualizados automaticamente via webhook com a API do Meta Ads.',
  },
];

const businessModels = [
  {
    icon: ShoppingCart,
    title: 'E-commerce',
    metrics: ['ROAS', 'Valor de conversão', 'Ticket médio', 'CPA'],
  },
  {
    icon: Users,
    title: 'Inside Sales',
    metrics: ['CPL', 'Taxa de conversão', 'Leads', 'Eventos personalizados'],
  },
  {
    icon: Store,
    title: 'PDV',
    metrics: ['Alcance local', 'Frequência', 'Engajamento', 'Check-ins'],
  },
];

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">MetaMetrics</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost">Entrar</Button>
            </Link>
            <Link to="/auth">
              <Button variant="gradient">Começar grátis</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-hero-pattern opacity-30" />
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-accent/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
        
        <div className="container mx-auto relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card/60 backdrop-blur-sm border border-border/50 mb-8 animate-fade-in">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-sm text-muted-foreground">Plataforma enterprise para análise de Meta Ads</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-6 animate-fade-in-up">
              Análise profunda de{' '}
              <span className="gradient-text">Meta Ads</span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              Métricas completas, insights acionáveis e relatórios personalizados para maximizar o retorno das suas campanhas.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <Link to="/auth">
                <Button variant="gradient" size="xl">
                  Começar agora
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Button variant="outline" size="xl">
                Ver demonstração
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-20 max-w-4xl mx-auto">
            {[
              { value: '+500', label: 'Contas gerenciadas' },
              { value: 'R$ 10M+', label: 'Em gastos analisados' },
              { value: '99.9%', label: 'Uptime garantido' },
              { value: '< 5min', label: 'Sincronização' },
            ].map((stat, i) => (
              <div 
                key={stat.label} 
                className="glass-card p-6 text-center animate-fade-in"
                style={{ animationDelay: `${0.3 + i * 0.1}s` }}
              >
                <p className="text-3xl font-bold gradient-text">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Tudo que você precisa</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Uma plataforma completa para análise e otimização das suas campanhas de Meta Ads.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <div 
                key={feature.title} 
                className="glass-card-hover p-8 animate-fade-in-up"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <feature.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Business Models Section */}
      <section className="py-20 px-6 bg-secondary/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Para cada modelo de negócio</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Métricas específicas e personalizadas de acordo com o seu tipo de negócio.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {businessModels.map((model, i) => (
              <div 
                key={model.title} 
                className="glass-card p-8 animate-fade-in-up"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-6">
                  <model.icon className="w-7 h-7 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-4">{model.title}</h3>
                <ul className="space-y-3">
                  {model.metrics.map((metric) => (
                    <li key={metric} className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-success" />
                      {metric}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
        <div className="container mx-auto relative z-10">
          <div className="glass-card p-12 md:p-16 text-center max-w-4xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Pronto para escalar seus resultados?
            </h2>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Comece gratuitamente e veja como a análise profunda pode transformar suas campanhas.
            </p>
            <Link to="/auth">
              <Button variant="gradient" size="xl">
                Criar conta gratuita
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">MetaMetrics</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2024 MetaMetrics. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
