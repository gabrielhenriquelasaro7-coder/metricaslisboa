import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { z } from 'zod';
import v4LogoIcon from '@/assets/v4-logo-icon.png';

const emailSchema = z.string().email('E-mail inválido');
const passwordSchema = z.string().min(6, 'Mínimo de 6 caracteres');

// Floating Particle Component
function Particle({ delay, duration, size, x, y }: { delay: number; duration: number; size: number; x: number; y: number }) {
  return (
    <div
      className="absolute rounded-full bg-primary/30 animate-float"
      style={{
        width: size,
        height: size,
        left: `${x}%`,
        top: `${y}%`,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
        filter: 'blur(1px)',
      }}
    />
  );
}

// Pulsing Glow Ring
function GlowRing({ size, delay, opacity }: { size: number; delay: number; opacity: number }) {
  return (
    <div
      className="absolute rounded-full border border-primary/20 animate-pulse-slow"
      style={{
        width: size,
        height: size,
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        animationDelay: `${delay}s`,
        opacity,
      }}
    />
  );
}

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; fullName?: string }>({});
  const [particles, setParticles] = useState<Array<{ id: number; delay: number; duration: number; size: number; x: number; y: number }>>([]);

  const { signIn, signUp, resetPassword, user } = useAuth();
  const navigate = useNavigate();

  // Generate particles on mount
  useEffect(() => {
    const newParticles = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      delay: Math.random() * 5,
      duration: 4 + Math.random() * 4,
      size: 4 + Math.random() * 8,
      x: Math.random() * 100,
      y: Math.random() * 100,
    }));
    setParticles(newParticles);
  }, []);

  useEffect(() => {
    if (user) {
      navigate('/projects');
    }
  }, [user, navigate]);

  const validateForm = useCallback(() => {
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
  }, [email, password, fullName, isLogin, isResetPassword]);

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
          navigate('/projects');
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
          // First time signup - go to onboarding
          navigate('/onboarding');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background">
      {/* Animated Background Layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
      
      {/* Radial glow effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/15 rounded-full blur-[150px] animate-pulse-slow" />
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-red-600/10 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-red-500/10 rounded-full blur-[80px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map((p) => (
          <Particle key={p.id} {...p} />
        ))}
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(239,68,68,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(239,68,68,0.02)_1px,transparent_1px)] bg-[size:80px_80px] pointer-events-none" />

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo Section with Glow Effects */}
        <div className="flex flex-col items-center mb-12 animate-fade-in">
          <div className="relative">
            {/* Pulsing glow rings */}
            <GlowRing size={200} delay={0} opacity={0.3} />
            <GlowRing size={280} delay={0.5} opacity={0.2} />
            <GlowRing size={360} delay={1} opacity={0.1} />
            
            {/* Logo with glow */}
            <div className="relative z-10">
              <img 
                src={v4LogoIcon} 
                alt="V4 Company" 
                className="h-28 w-auto drop-shadow-2xl rounded-3xl animate-float"
              />
              <div className="absolute inset-0 bg-primary/40 rounded-3xl blur-2xl -z-10 animate-pulse-slow" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold mt-8 gradient-text">MetaAds Manager</h1>
          <p className="text-muted-foreground text-sm mt-1">by V4 Company</p>
        </div>

        {/* Form Card */}
        <div className="glass-card p-8 space-y-6 animate-scale-in backdrop-blur-xl border-primary/10" style={{ animationDelay: '0.2s' }}>
          {/* Header */}
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-1">
              {isResetPassword ? 'Recuperar senha' : isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isResetPassword 
                ? 'Digite seu e-mail para receber as instruções' 
                : isLogin 
                  ? 'Entre para acessar sua dashboard' 
                  : 'Comece a analisar seus anúncios'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && !isResetPassword && (
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm">Nome completo</Label>
                <div className="relative group">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Seu nome"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10 h-11 bg-background/50 border-border/50 focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                  />
                </div>
                {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm">E-mail</Label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 bg-background/50 border-border/50 focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                />
              </div>
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            {!isResetPassword && (
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm">Senha</Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-11 bg-background/50 border-border/50 focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>
            )}

            {isLogin && !isResetPassword && (
              <button
                type="button"
                onClick={() => setIsResetPassword(true)}
                className="text-sm text-primary hover:underline transition-all"
              >
                Esqueceu sua senha?
              </button>
            )}

            <Button 
              type="submit" 
              size="lg" 
              className="w-full h-11 bg-gradient-to-r from-primary via-red-600 to-red-700 hover:from-red-600 hover:via-red-700 hover:to-red-800 shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-primary/40 hover:scale-[1.02] group mt-2" 
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  {isResetPassword ? 'Enviar instruções' : isLogin ? 'Entrar' : 'Criar conta'}
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </form>

          {/* Toggle */}
          <p className="text-center text-sm text-muted-foreground">
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

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground/60 mt-8 animate-fade-in" style={{ animationDelay: '0.4s' }}>
          Plataforma de gestão de anúncios Meta Ads
        </p>
      </div>
    </div>
  );
}
