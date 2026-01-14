import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useProjects } from '@/hooks/useProjects';
import { useCargo } from '@/hooks/useCargo';
import { toast } from 'sonner';
import { UserPlus, Trash2, Shield, Eye, EyeOff, Copy, RefreshCw, Loader2, Users, FolderOpen } from 'lucide-react';

interface GuestInvitation {
  id: string;
  guest_email: string;
  guest_name: string;
  temp_password: string;
  status: string;
  password_changed: boolean;
  project_id: string;
  project_name?: string;
  created_at: string;
  accepted_at: string | null;
  guest_user_id: string | null;
}

interface GuestAccess {
  id: string;
  user_id: string;
  project_id: string;
  project_name?: string;
  granted_by: string;
  created_at: string;
}

// Generate random password for each guest
const generateRandomPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

export function GuestsManagement() {
  const { projects } = useProjects();
  const { isTech, isGerente } = useCargo();
  const [invitations, setInvitations] = useState<GuestInvitation[]>([]);
  const [guestAccess, setGuestAccess] = useState<GuestAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    guest_name: '',
    guest_email: '',
    project_ids: [] as string[],
  });

  const canManage = isTech || isGerente;

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch guest invitations
      const { data: invitationsData, error: invError } = await supabase
        .from('guest_invitations')
        .select('*')
        .order('created_at', { ascending: false });

      if (invError) throw invError;

      // Enrich with project names
      const enrichedInvitations = (invitationsData || []).map(inv => ({
        ...inv,
        project_name: projects.find(p => p.id === inv.project_id)?.name || 'Projeto desconhecido',
      }));

      setInvitations(enrichedInvitations);

      // Fetch guest project access
      const { data: accessData, error: accessError } = await supabase
        .from('guest_project_access')
        .select('*')
        .order('created_at', { ascending: false });

      if (accessError) throw accessError;

      const enrichedAccess = (accessData || []).map(acc => ({
        ...acc,
        project_name: projects.find(p => p.id === acc.project_id)?.name || 'Projeto desconhecido',
      }));

      setGuestAccess(enrichedAccess);
    } catch (error) {
      console.error('Error fetching guests:', error);
      toast.error('Erro ao carregar convidados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projects.length > 0) {
      fetchData();
    }
  }, [projects]);

  const handleCreateInvitation = async () => {
    if (!formData.guest_name || !formData.guest_email || formData.project_ids.length === 0) {
      toast.error('Preencha todos os campos');
      return;
    }

    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Check if email already exists
      const { data: existingUser } = await supabase
        .from('guest_invitations')
        .select('id')
        .eq('guest_email', formData.guest_email)
        .single();

      if (existingUser) {
        toast.error('Este email já foi convidado');
        return;
      }

      // Generate unique password for this guest
      const tempPassword = generateRandomPassword();

      // Create invitations for each project
      for (const projectId of formData.project_ids) {
        const { error } = await supabase
          .from('guest_invitations')
          .insert({
            guest_name: formData.guest_name,
            guest_email: formData.guest_email,
            temp_password: tempPassword,
            project_id: projectId,
            invited_by: user.id,
            status: 'pending',
            password_changed: false,
          });

        if (error) throw error;
      }

      toast.success(`Convite criado! Senha: ${tempPassword}`);
      setFormData({ guest_name: '', guest_email: '', project_ids: [] });
      setIsDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error creating invitation:', error);
      toast.error('Erro ao criar convite');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('guest_invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;
      toast.success('Convite removido');
      fetchData();
    } catch (error) {
      console.error('Error deleting invitation:', error);
      toast.error('Erro ao remover convite');
    }
  };

  const handleRemoveAccess = async (accessId: string) => {
    try {
      const { error } = await supabase
        .from('guest_project_access')
        .delete()
        .eq('id', accessId);

      if (error) throw error;
      toast.success('Acesso removido');
      fetchData();
    } catch (error) {
      console.error('Error removing access:', error);
      toast.error('Erro ao remover acesso');
    }
  };

  const copyPassword = (password: string) => {
    navigator.clipboard.writeText(password);
    toast.success('Senha copiada!');
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getStatusBadge = (status: string, passwordChanged: boolean) => {
    if (passwordChanged) {
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Ativo</Badge>;
    }
    if (status === 'accepted') {
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Aguardando trocar senha</Badge>;
    }
    return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Pendente</Badge>;
  };

  if (loading) {
    return (
      <Card className="glass-card border-primary/20">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // Group invitations by email
  const groupedByEmail = invitations.reduce((acc, inv) => {
    if (!acc[inv.guest_email]) {
      acc[inv.guest_email] = {
        name: inv.guest_name,
        email: inv.guest_email,
        password: inv.temp_password,
        passwordChanged: inv.password_changed,
        status: inv.status,
        projects: [],
        invitations: [],
      };
    }
    acc[inv.guest_email].projects.push(inv.project_name || '');
    acc[inv.guest_email].invitations.push(inv);
    return acc;
  }, {} as Record<string, { name: string; email: string; password: string; passwordChanged: boolean; status: string; projects: string[]; invitations: GuestInvitation[] }>);

  return (
    <div className="space-y-6">
      <Card className="glass-card border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Gerenciamento de Convidados
            </CardTitle>
            <CardDescription>
              Gerencie acessos de clientes e parceiros aos projetos
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            {canManage && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <UserPlus className="w-4 h-4" />
                    Novo Convidado
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Convidar Novo Usuário</DialogTitle>
                    <DialogDescription>
                      O usuário receberá acesso com senha padrão e precisará alterá-la no primeiro login.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Nome</Label>
                      <Input
                        placeholder="Nome do convidado"
                        value={formData.guest_name}
                        onChange={e => setFormData(prev => ({ ...prev, guest_name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        placeholder="email@exemplo.com"
                        value={formData.guest_email}
                        onChange={e => setFormData(prev => ({ ...prev, guest_email: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Projetos com Acesso</Label>
                      <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                        {projects.filter(p => !p.archived).map(project => (
                          <div key={project.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={project.id}
                              checked={formData.project_ids.includes(project.id)}
                              onCheckedChange={(checked) => {
                                setFormData(prev => ({
                                  ...prev,
                                  project_ids: checked
                                    ? [...prev.project_ids, project.id]
                                    : prev.project_ids.filter(id => id !== project.id)
                                }));
                              }}
                            />
                            <label htmlFor={project.id} className="text-sm cursor-pointer">
                              {project.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 text-sm">
                        <Shield className="w-4 h-4 text-primary" />
                        <span>Uma senha única e aleatória será gerada automaticamente para o convidado</span>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateInvitation} disabled={isCreating}>
                      {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Convite'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {Object.keys(groupedByEmail).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum convidado encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Projetos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Senha</TableHead>
                  {canManage && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.values(groupedByEmail).map((guest) => (
                  <TableRow key={guest.email}>
                    <TableCell className="font-medium">{guest.name}</TableCell>
                    <TableCell>{guest.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {guest.projects.slice(0, 3).map((proj, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            <FolderOpen className="w-3 h-3 mr-1" />
                            {proj}
                          </Badge>
                        ))}
                        {guest.projects.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{guest.projects.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(guest.status, guest.passwordChanged)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                          {showPasswords[guest.email] ? guest.password : '••••••••'}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => togglePasswordVisibility(guest.email)}
                        >
                          {showPasswords[guest.email] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyPassword(guest.password)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            guest.invitations.forEach(inv => handleDeleteInvitation(inv.id));
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Access Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card border-primary/20">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{Object.keys(groupedByEmail).length}</div>
              <div className="text-sm text-muted-foreground">Total de Convidados</div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-primary/20">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400">
                {Object.values(groupedByEmail).filter(g => g.passwordChanged).length}
              </div>
              <div className="text-sm text-muted-foreground">Ativos</div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-primary/20">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-400">
                {Object.values(groupedByEmail).filter(g => !g.passwordChanged).length}
              </div>
              <div className="text-sm text-muted-foreground">Pendentes</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
