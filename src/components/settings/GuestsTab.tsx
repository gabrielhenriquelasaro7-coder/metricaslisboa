import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  UserPlus, 
  Loader2, 
  Copy, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Trash2,
  Mail,
  Eye,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GuestInvitation {
  id: string;
  guest_email: string;
  guest_name: string;
  project_id: string;
  status: string;
  password_changed: boolean;
  created_at: string;
  expires_at: string;
  temp_password?: string;
}

interface ProjectInfo {
  id: string;
  name: string;
}

export function GuestsTab() {
  const { user } = useAuth();
  const { projects } = useProjects();
  const [invitations, setInvitations] = useState<GuestInvitation[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchInvitations = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('guest_invitations')
        .select('*')
        .eq('invited_by', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (error) {
      console.error('Error fetching invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, [user]);

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
      const { data: { session } } = await supabase.auth.getSession();
      
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
      setShowPasswordDialog(true);
      
      // Reset form
      setGuestEmail('');
      setGuestName('');
      setSelectedProjectId('');
      
      // Refresh list
      fetchInvitations();
      
      toast.success('Convite enviado com sucesso!');
    } catch (error: unknown) {
      console.error('Error inviting guest:', error);
      const message = error instanceof Error ? error.message : 'Erro ao enviar convite';
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

  const handleRevokeAccess = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('guest_invitations')
        .update({ status: 'revoked' })
        .eq('id', invitationId);

      if (error) throw error;
      
      toast.success('Acesso revogado');
      fetchInvitations();
    } catch (error) {
      toast.error('Erro ao revogar acesso');
    }
  };

  const getStatusBadge = (invitation: GuestInvitation) => {
    if (invitation.status === 'revoked') {
      return (
        <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-muted">
          <XCircle className="w-3 h-3 mr-1" />
          Revogado
        </Badge>
      );
    }
    if (invitation.password_changed) {
      return (
        <Badge variant="outline" className="bg-metric-positive/10 text-metric-positive border-metric-positive/20">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Ativo
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-metric-warning/10 text-metric-warning border-metric-warning/20">
        <Clock className="w-3 h-3 mr-1" />
        Pendente
      </Badge>
    );
  };

  const getProjectName = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    return project?.name || 'Projeto não encontrado';
  };

  return (
    <div className="space-y-6">
      {/* Invite Form */}
      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Convidar Cliente
          </CardTitle>
          <CardDescription>
            Convide um cliente para visualizar as métricas do projeto. Eles terão acesso apenas para visualização.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
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
          </div>

          <Button onClick={handleInvite} disabled={inviting} className="gap-2">
            {inviting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Enviar Convite
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Invitations List */}
      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Clientes Convidados
          </CardTitle>
          <CardDescription>
            Gerencie os acessos dos clientes aos seus projetos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum cliente convidado ainda</p>
              <p className="text-sm">Convide seu primeiro cliente acima</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Cliente</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{invitation.guest_name}</p>
                          <p className="text-sm text-muted-foreground">{invitation.guest_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getProjectName(invitation.project_id)}</TableCell>
                      <TableCell>{getStatusBadge(invitation)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(invitation.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        {invitation.status !== 'revoked' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevokeAccess(invitation.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
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
              <Button onClick={() => setShowPasswordDialog(false)} className="gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Entendido
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
