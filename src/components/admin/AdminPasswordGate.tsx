import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useCargo } from '@/hooks/useCargo';
import { useAdminAccessRequests } from '@/hooks/useAdminAccessRequests';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Lock, Loader2, AlertCircle, Clock, Send } from 'lucide-react';
import { toast } from 'sonner';
import { AdminAccessRequestModal } from './AdminAccessRequestModal';

interface AdminPasswordGateProps {
  children: React.ReactNode;
}

export default function AdminPasswordGate({ children }: AdminPasswordGateProps) {
  const { isAdminAuthenticated, hasApprovedAccess, isLoading, verifyPassword } = useAdminAuth();
  const { isTech, needsAdminApproval, cargo } = useCargo();
  const [password, setPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!password.trim()) {
      setError('Digite a senha de administrador');
      return;
    }

    setIsVerifying(true);
    try {
      const isValid = await verifyPassword(password);
      if (isValid) {
        toast.success('Acesso autorizado');
      } else {
        setError('Senha incorreta');
        toast.error('Senha incorreta');
      }
    } catch {
      setError('Erro ao verificar senha');
    } finally {
      setIsVerifying(false);
      setPassword('');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // User is authenticated (either via password or approved access)
  if (isAdminAuthenticated) {
    return <>{children}</>;
  }

  // Get pending request info
  const { myPendingRequest, loading: requestsLoading } = useAdminAccessRequests();

  // Show access request option for investidor/coordenador who don't have approved access yet
  if (needsAdminApproval && !hasApprovedAccess) {
    const hasPendingRequest = !!myPendingRequest;

    return (
      <div className="flex items-center justify-center min-h-[60vh] p-8">
        <Card className="w-full max-w-md glass-card border-primary/20">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Acesso Restrito</CardTitle>
              <CardDescription className="mt-2">
                Seu cargo ({cargo}) requer aprovação para acessar esta área.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasPendingRequest ? (
              <>
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="font-medium">Solicitação pendente</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Aguardando aprovação do Tech. Você receberá uma notificação quando for aprovado.
                  </p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    <strong>Motivo:</strong> {myPendingRequest.reason}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <strong>Enviado em:</strong> {new Date(myPendingRequest.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>Solicite acesso ao Tech para entrar</span>
                  </div>
                </div>
                
                <Button 
                  className="w-full" 
                  onClick={() => setShowRequestModal(true)}
                  disabled={requestsLoading}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Solicitar Acesso
                </Button>
              </>
            )}
            
            <AdminAccessRequestModal
              open={showRequestModal}
              onOpenChange={setShowRequestModal}
              onRequestSent={() => {
                toast.success('Solicitação enviada! Aguarde aprovação.');
              }}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show password form for tech users
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-8">
      <Card className="w-full max-w-md glass-card border-primary/20">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl">Área Restrita</CardTitle>
            <CardDescription className="mt-2">
              Digite a senha de administrador para acessar esta área
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-password">Senha de Administrador</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10"
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isVerifying}>
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Acessar
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
