import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Key, Loader2, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let resolved = false;
    let cancelled = false;

    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const clearUrlSecrets = () => {
      const url = new URL(window.location.href);
      url.hash = '';
      url.searchParams.delete('code');
      url.searchParams.delete('type');
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
    };

    const markValid = () => {
      if (cancelled || resolved) return;
      resolved = true;
      clearUrlSecrets();
      setIsValidSession(true);
      setChecking(false);
    };

    const markInvalid = (message = 'Link de recuperação inválido ou expirado') => {
      if (cancelled || resolved) return;
      resolved = true;
      toast.error(message);
      setIsValidSession(false);
      setChecking(false);
    };

    const waitForSession = async () => {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) return session;
        await wait(250);
      }
      return null;
    };

    // Check if user arrived via a recovery link
    const checkSession = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const searchParams = new URLSearchParams(window.location.search);
      const errorMessage = hashParams.get('error_description') || searchParams.get('error_description');
      const code = searchParams.get('code');
      const type = hashParams.get('type') || searchParams.get('type');
      const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');

      if (hashParams.get('error') || searchParams.get('error')) {
        console.error('[ResetPassword] Recovery link returned error:', errorMessage);
        markInvalid(errorMessage || 'Link de recuperação inválido ou expirado');
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
          markValid();
          return;
        }

        console.error('[ResetPassword] Error exchanging recovery code:', error);
      }

      if (type === 'recovery' && accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!error) {
          markValid();
          return;
        }

        console.error('[ResetPassword] Error setting session:', error);
      }

      const session = await waitForSession();
      if (session) {
        markValid();
        return;
      }

      markInvalid();
    };

    // Listen for PASSWORD_RECOVERY/SIGNED_IN because providers can finish URL recovery async
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && currentSession) {
        markValid();
      }
    });

    checkSession();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error('[ResetPassword] Error:', error);
        toast.error(error.message || 'Erro ao redefinir senha');
        return;
      }

      toast.success('Senha redefinida com sucesso! Faça login com sua nova senha.');
      
      // Sign out to force fresh login with new password
      await supabase.auth.signOut();
      navigate('/auth');
    } catch (error: unknown) {
      console.error('[ResetPassword] Error:', error);
      const message = error instanceof Error ? error.message : 'Erro ao redefinir senha';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isValidSession) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Link Expirado</CardTitle>
            <CardDescription>
              O link de recuperação é inválido ou expirou. Solicite um novo link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/auth')} className="w-full">
              Voltar para Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-border/50">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Redefinir Senha</CardTitle>
            <CardDescription>
              Digite sua nova senha abaixo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova Senha</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Digite novamente"
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
              <p className="text-sm text-muted-foreground mb-2">Requisitos:</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className={`w-4 h-4 ${newPassword.length >= 6 ? 'text-green-500' : 'text-muted-foreground'}`} />
                  <span className={newPassword.length >= 6 ? 'text-foreground' : 'text-muted-foreground'}>
                    Pelo menos 6 caracteres
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className={`w-4 h-4 ${newPassword && newPassword === confirmPassword ? 'text-green-500' : 'text-muted-foreground'}`} />
                  <span className={newPassword && newPassword === confirmPassword ? 'text-foreground' : 'text-muted-foreground'}>
                    As senhas coincidem
                  </span>
                </div>
              </div>
            </div>

            <Button
              onClick={handleResetPassword}
              disabled={loading || newPassword.length < 6 || newPassword !== confirmPassword}
              className="w-full gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Redefinindo...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Redefinir Senha
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
