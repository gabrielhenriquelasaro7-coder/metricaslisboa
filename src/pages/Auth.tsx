import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { z } from 'zod';
import v4LogoIcon from '@/assets/v4-logo-icon-small.png';

const emailSchema = z.string().email('E-mail inválido');
const passwordSchema = z.string().min(6, 'Mínimo de 6 caracteres');

// Floating Particle Component - subtle
function Particle({ delay, duration, size, x, y }: { delay: number; duration: number; size: number; x: number; y: number }) {
  return (
    <div
      className="absolute rounded-full bg-white/8 animate-float"
      style={{
        width: size,
        height: size,
        left: `${x}%`,
        top: `${y}%`,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
        filter: 'blur(0.5px)',
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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Gradient Background - stronger red */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#2a0a0a] to-[#5c1010]" />
      
      {/* Secondary gradient overlay for depth - stronger */}
      <div className="absolute inset-0 bg-gradient-to-tl from-red-800/40 via-transparent to-transparent" />

      {/* Floating Particles - subtle */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map((p) => (
          <Particle key={p.id} {...p} />
        ))}
      </div>

      {/* Subtle vignette effect */}
      <div className="absolute inset-0 bg-radial-gradient pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%)' }} />

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo Section - Clean with animation */}
        <div className="flex flex-col items-center mb-8 animate-fade-in">
          <img 
            src={v4LogoIcon} 
            alt="V4 Company" 
            className="h-14 w-auto rounded-xl animate-float"
            style={{ filter: 'drop-shadow(0 0 20px rgba(255, 0, 0, 0.6)) saturate(2.5) brightness(1.3) contrast(1.1)' }}
          />
          <h1 className="text-2xl font-bold mt-6 text-foreground">
            {isResetPassword ? 'Recuperar Senha' : isLogin ? 'Login' : 'Criar Conta'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Entre com suas credenciais V4 Company</p>
        </div>

        {/* Form Card - Clean dark style */}
        <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border/30 p-8 space-y-6 animate-scale-in" style={{ animationDelay: '0.1s' }}>

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
