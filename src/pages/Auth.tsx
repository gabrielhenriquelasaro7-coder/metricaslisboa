import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Sparkles, TrendingUp, Target, Zap } from 'lucide-react';
import { z } from 'zod';
import v4LogoFull from '@/assets/v4-logo-full.png';
import v4LogoIcon from '@/assets/v4-logo-icon.png';

const emailSchema = z.string().email('E-mail inválido');
const passwordSchema = z.string().min(6, 'Mínimo de 6 caracteres');

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; fullName?: string }>({});

  const { signIn, signUp, resetPassword, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string; fullName?: string } = {};

    try {
      emailSchema.parse(email);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.email = e.errors[0].message;
      }
    }

    if (!isResetPassword) {
      try {
        passwordSchema.parse(password);
      } catch (e) {
        if (e instanceof z.ZodError) {
          newErrors.password = e.errors[0].message;
        }
      }
    }

    if (!isLogin && !isResetPassword && !fullName.trim()) {
      newErrors.fullName = 'Nome é obrigatório';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      if (isResetPassword) {
        const { error } = await resetPassword(email);
        if (error) {
          toast.error('Erro ao enviar email de recuperação');
        } else {
          toast.success('Email de recuperação enviado!');
          setIsResetPassword(false);
        }
      } else if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('E-mail ou senha incorretos');
          } else {
            toast.error('Erro ao fazer login');
          }
        } else {
          toast.success('Login realizado com sucesso!');
          navigate('/dashboard');
        }
      } else {
        const { error } = await signUp(email, password, fullName);
        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('Este e-mail já está cadastrado');
          } else {
            toast.error('Erro ao criar conta');
          }
        } else {
          toast.success('Conta criada com sucesso!');
          navigate('/dashboard');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/10" />
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 animate-pulse-slow" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-primary/15 rounded-full blur-[100px] translate-x-1/3 translate-y-1/3 animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-red-500/10 rounded-full blur-[80px] -translate-x-1/2 -translate-y-1/2 animate-float" />
      </div>

      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 relative z-10">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="flex flex-col items-center gap-4 mb-10 animate-fade-in">
            <div className="relative">
              <img 
                src={v4LogoIcon} 
                alt="V4 Company" 
                className="h-20 w-auto drop-shadow-2xl logo-glow rounded-2xl"
              />
              <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-xl -z-10 animate-pulse-slow" />
            </div>
            <img 
              src={v4LogoFull} 
              alt="V4 Company" 
              className="h-8 w-auto opacity-90"
            />
          </div>

          {/* Form Card */}
          <div className="glass-card p-8 space-y-6 animate-scale-in red-gradient-card">
            {/* Header */}
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-2 gradient-text">
                {isResetPassword ? 'Recuperar senha' : isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}
              </h1>
              <p className="text-muted-foreground">
                {isResetPassword 
                  ? 'Digite seu e-mail para receber as instruções' 
                  : isLogin 
                    ? 'Entre para acessar sua dashboard' 
                    : 'Comece a analisar seus anúncios'}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && !isResetPassword && (
                <div className="space-y-2 animate-fade-in">
                  <Label htmlFor="fullName">Nome completo</Label>
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Seu nome"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10 h-12 bg-background/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                  {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12 bg-background/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>

              {!isResetPassword && (
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-12 bg-background/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>
              )}

              {isLogin && !isResetPassword && (
                <button
                  type="button"
                  onClick={() => setIsResetPassword(true)}
                  className="text-sm text-primary hover:underline transition-all hover:text-primary/80"
                >
                  Esqueceu sua senha?
                </button>
              )}

              <Button 
                type="submit" 
                size="lg" 
                className="w-full h-12 bg-gradient-to-r from-primary via-red-600 to-red-700 hover:from-red-600 hover:via-red-700 hover:to-red-800 shadow-xl shadow-primary/30 transition-all duration-300 hover:shadow-primary/50 hover:scale-[1.02] group" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <>
                    {isResetPassword ? 'Enviar instruções' : isLogin ? 'Entrar' : 'Criar conta'}
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>

            {/* Toggle */}
            <p className="text-center text-muted-foreground pt-2">
              {isResetPassword ? (
                <button
                  onClick={() => setIsResetPassword(false)}
                  className="text-primary hover:underline font-medium"
                >
                  Voltar ao login
                </button>
              ) : isLogin ? (
                <>
                  Não tem conta?{' '}
                  <button
                    onClick={() => setIsLogin(false)}
                    className="text-primary hover:underline font-medium"
                  >
                    Criar agora
                  </button>
                </>
              ) : (
                <>
                  Já tem conta?{' '}
                  <button
                    onClick={() => setIsLogin(true)}
                    className="text-primary hover:underline font-medium"
                  >
                    Fazer login
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Visual */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-12 relative overflow-hidden">
        {/* Animated grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(239,68,68,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(239,68,68,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
        
        {/* Floating elements */}
        <div className="absolute top-1/4 right-1/4 w-3 h-3 bg-primary rounded-full animate-float opacity-60" style={{ animationDelay: '0s' }} />
        <div className="absolute top-1/3 left-1/3 w-2 h-2 bg-red-400 rounded-full animate-float opacity-40" style={{ animationDelay: '0.5s' }} />
        <div className="absolute bottom-1/4 right-1/3 w-4 h-4 bg-primary/50 rounded-full animate-float opacity-50" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-1/3 left-1/4 w-2 h-2 bg-red-300 rounded-full animate-float opacity-30" style={{ animationDelay: '1.5s' }} />

        {/* Content */}
        <div className="relative z-10 text-center space-y-10 max-w-xl animate-fade-in">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/10 backdrop-blur-sm border border-primary/20 animate-float">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Plataforma de Performance</span>
          </div>
          
          {/* Title */}
          <div className="space-y-4">
            <h2 className="text-5xl font-bold leading-tight">
              Análise completa de{' '}
              <span className="gradient-text">Meta Ads</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-md mx-auto">
              Métricas em tempo real, insights acionáveis e relatórios personalizados para suas campanhas.
            </p>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-2 gap-4 stagger-fade-in">
            {[
              { label: 'ROAS Tracking', value: '+247%', icon: TrendingUp, color: 'text-emerald-400' },
              { label: 'Campanhas', value: '1,234', icon: Target, color: 'text-primary' },
              { label: 'Economia', value: 'R$ 89k', icon: Zap, color: 'text-amber-400' },
              { label: 'CTR Médio', value: '3.8%', icon: Sparkles, color: 'text-blue-400' },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="glass-card p-5 text-left hover-lift group cursor-default"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-xl bg-${item.color.replace('text-', '')}/10 flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${item.color}`} />
                    </div>
                  </div>
                  <p className="text-3xl font-bold gradient-text">{item.value}</p>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
