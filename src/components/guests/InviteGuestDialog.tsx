import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  UserPlus, 
  Loader2, 
  Copy, 
  CheckCircle2,
} from 'lucide-react';

interface InviteGuestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedProjectId?: string;
  preselectedProjectName?: string;
  onSuccess?: () => void;
}

export function InviteGuestDialog({ 
  open, 
  onOpenChange, 
  preselectedProjectId,
  preselectedProjectName,
  onSuccess 
}: InviteGuestDialogProps) {
  const { user } = useAuth();
  const { projects } = useProjects();
  const [inviting, setInviting] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [invitedEmail, setInvitedEmail] = useState('');
  const [invitedProjectName, setInvitedProjectName] = useState('');
  
  // Form state
  const [guestEmail, setGuestEmail] = useState('');
  const [guestName, setGuestName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const activeProjects = projects.filter(p => !p.archived);

  // Set preselected project when dialog opens
  useEffect(() => {
    if (open && preselectedProjectId) {
      setSelectedProjectId(preselectedProjectId);
    }
  }, [open, preselectedProjectId]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open && !showPasswordDialog) {
      setGuestEmail('');
      setGuestName('');
      setSelectedProjectId(preselectedProjectId || '');
    }
  }, [open, showPasswordDialog, preselectedProjectId]);

  const handleInvite = async () => {
    if (!guestEmail || !guestName || !selectedProjectId) {
      toast.error('Preencha todos os campos');
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guestEmail)) {
      toast.error('E-mail inválido');
      return;
    }

    setInviting(true);
    try {
      const response = await supabase.functions.invoke('invite-guest', {
        body: {
          guest_email: guestEmail,
          guest_name: guestName,
          project_id: selectedProjectId,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const { temp_password, project_name, is_new_user } = response.data;
      
      setGeneratedPassword(temp_password);
      setIsNewUser(is_new_user);
      setInvitedEmail(guestEmail);
      setInvitedProjectName(project_name);
      
      // Close invite dialog and show password dialog
      onOpenChange(false);
      setShowPasswordDialog(true);
      
      // Reset form
      setGuestEmail('');
      setGuestName('');
      setSelectedProjectId(preselectedProjectId || '');
      
      onSuccess?.();
      
      toast.success('Convite criado com sucesso!');
    } catch (error: unknown) {
      console.error('Error inviting guest:', error);
      const message = error instanceof Error ? error.message : 'Erro ao criar convite';
      toast.error(message);
    } finally {
      setInviting(false);
    }
  };

  const handleCopyPassword = async () => {
    if (!generatedPassword) return;
    try {
      await navigator.clipboard.writeText(generatedPassword);
      toast.success('Senha copiada!');
    } catch (error) {
      toast.error('Erro ao copiar senha');
    }
  };

  const handleCopyCredentials = async () => {
    const credentials = `E-mail: ${invitedEmail}\n${generatedPassword ? `Senha: ${generatedPassword}\n` : ''}Projeto: ${invitedProjectName}`;
    try {
      await navigator.clipboard.writeText(credentials);
      toast.success('Credenciais copiadas!');
    } catch (error) {
      toast.error('Erro ao copiar credenciais');
    }
  };

  const handleClosePasswordDialog = () => {
    setShowPasswordDialog(false);
    setGeneratedPassword(null);
    setIsNewUser(false);
    setInvitedEmail('');
    setInvitedProjectName('');
  };

  return (
    <>
      {/* Invite Form Dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Convidar Cliente
            </DialogTitle>
            <DialogDescription>
              {preselectedProjectName 
                ? `Convide um cliente para visualizar o projeto "${preselectedProjectName}".`
                : 'Convide um cliente para visualizar as métricas de um projeto.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="guestName">Nome do Cliente</Label>
              <Input
                id="guestName"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Nome completo"
                className="bg-muted/30"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="guestEmail">E-mail</Label>
              <Input
                id="guestEmail"
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="bg-muted/30"
              />
            </div>
            
            {!preselectedProjectId && (
              <div className="space-y-2">
                <Label>Projeto</Label>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="bg-muted/30">
                    <SelectValue placeholder="Selecione um projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {preselectedProjectName && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-sm text-muted-foreground">Projeto selecionado:</p>
                <p className="font-medium text-foreground">{preselectedProjectName}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleInvite} disabled={inviting} className="gap-2">
              {inviting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Criar Convite
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={handleClosePasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-metric-positive" />
              {isNewUser ? 'Usuário Criado!' : 'Acesso Concedido!'}
            </DialogTitle>
            <DialogDescription>
              {isNewUser 
                ? 'Envie as credenciais abaixo para o cliente. Ele precisará alterar a senha no primeiro acesso.'
                : 'O usuário já existia e agora tem acesso ao projeto. Ele pode usar a senha atual para fazer login.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">E-mail:</span>
                <span className="font-mono">{invitedEmail}</span>
              </div>
              {isNewUser && generatedPassword && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Senha:</span>
                  <span className="font-mono font-bold text-primary">{generatedPassword}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Projeto:</span>
                <span className="font-medium">{invitedProjectName}</span>
              </div>
            </div>
            
            {isNewUser && (
              <div className="text-sm text-muted-foreground">
                <p>⚠️ Esta é a única vez que você verá a senha. Copie e envie para o cliente.</p>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {isNewUser && generatedPassword ? (
              <>
                <Button variant="outline" onClick={handleCopyPassword} className="gap-2">
                  <Copy className="w-4 h-4" />
                  Copiar Senha
                </Button>
                <Button onClick={handleCopyCredentials} className="gap-2">
                  <Copy className="w-4 h-4" />
                  Copiar Tudo
                </Button>
              </>
            ) : (
              <Button onClick={handleClosePasswordDialog} className="gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Entendido
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
