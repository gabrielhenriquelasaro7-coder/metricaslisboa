import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Key, Loader2, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { LoadingScreen } from '@/components/ui/loading-screen';
import v4LogoFull from '@/assets/v4-logo-full.png';

export default function ChangePassword() {
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const handleChangePassword = async () => {
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
      console.log('[ChangePassword] Starting password change for user:', user?.id);
      
      // Update password in Supabase Auth
      const { error: passwordError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (passwordError) {
        console.error('[ChangePassword] Password update error:', passwordError);
        throw passwordError;
      }
      
      console.log('[ChangePassword] Password updated successfully');

      // Mark password as changed in guest_invitations
      if (user) {
        console.log('[ChangePassword] Updating guest_invitations for user:', user.id);
        
        const { data, error: updateError } = await supabase
          .from('guest_invitations')
          .update({ 
            password_changed: true, 
            status: 'accepted', 
            accepted_at: new Date().toISOString() 
          })
          .eq('guest_user_id', user.id)
          .select();
        
        if (updateError) {
          console.error('[ChangePassword] Error updating invitation:', updateError);
          // Don't throw - we'll still redirect, but log the error
        } else {
          console.log('[ChangePassword] Guest invitation updated:', data);
        }
      }

      toast.success('Senha alterada com sucesso!');
      
      // Show redirecting state immediately
      setRedirecting(true);
      setLoading(false);
      
      // ALWAYS redirect to guest-onboarding after first password change
      // The onboarding page will handle showing welcome and then redirecting to dashboard
      setTimeout(() => {
        console.log('[ChangePassword] Redirecting to guest-onboarding (first login flow)');
        window.location.href = '/guest-onboarding';
      }, 800);
      
    } catch (error: unknown) {
      console.error('[ChangePassword] Error:', error);
      const message = error instanceof Error ? error.message : 'Erro ao alterar senha';
      toast.error(message);
      setLoading(false);
    }
  };

  // Show full-screen loading when redirecting
  if (redirecting) {
    return <LoadingScreen message="Preparando sua experiência..." />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 red-texture-bg opacity-20 pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <img src={v4LogoFull} alt="V4 Company" className="h-12" />
        </div>

        <Card className="glass-card border-border/50">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Alterar Senha</CardTitle>
            <CardDescription>
              Por segurança, você precisa criar uma nova senha antes de acessar o sistema.
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
                    className="pl-10 pr-10 bg-muted/30"
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
                    className="pl-10 bg-muted/30"
                  />
                </div>
              </div>
            </div>

            {/* Password Requirements */}
            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
              <p className="text-sm text-muted-foreground mb-2">Requisitos da senha:</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className={`w-4 h-4 ${newPassword.length >= 6 ? 'text-metric-positive' : 'text-muted-foreground'}`} />
                  <span className={newPassword.length >= 6 ? 'text-foreground' : 'text-muted-foreground'}>
                    Pelo menos 6 caracteres
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className={`w-4 h-4 ${newPassword && newPassword === confirmPassword ? 'text-metric-positive' : 'text-muted-foreground'}`} />
                  <span className={newPassword && newPassword === confirmPassword ? 'text-foreground' : 'text-muted-foreground'}>
                    As senhas coincidem
                  </span>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleChangePassword} 
              disabled={loading || newPassword.length < 6 || newPassword !== confirmPassword}
              className="w-full gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Alterando...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Alterar Senha e Continuar
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
