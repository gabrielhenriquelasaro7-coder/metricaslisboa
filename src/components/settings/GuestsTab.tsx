import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  UserPlus, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Trash2,
  Users
} from 'lucide-react';
import { InviteGuestDialog } from '@/components/guests/InviteGuestDialog';

interface GuestInvitation {
  id: string;
  guest_email: string;
  guest_name: string;
  project_id: string;
  status: string;
  password_changed: boolean;
  created_at: string;
  expires_at: string;
}

interface GuestsTabProps {
  projectId?: string;
}

export function GuestsTab({ projectId }: GuestsTabProps) {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<GuestInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  const fetchInvitations = async () => {
    if (!user || !projectId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('guest_invitations')
        .select('*')
        .eq('invited_by', user.id)
        .eq('project_id', projectId)
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
  }, [user, projectId]);

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



  return (
    <div className="space-y-6">
      {/* Invite Button Card */}
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
        <CardContent>
          <Button onClick={() => setInviteDialogOpen(true)} className="gap-2">
            <UserPlus className="w-4 h-4" />
            Novo Convite
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
            Clientes com acesso a este projeto
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
              <p>Nenhum cliente convidado para este projeto</p>
              <p className="text-sm">Clique em "Novo Convite" para convidar seu primeiro cliente</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Cliente</TableHead>
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

      {/* Invite Guest Dialog */}
      <InviteGuestDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onSuccess={fetchInvitations}
      />
    </div>
  );
}
