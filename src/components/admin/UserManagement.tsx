import { useState, useCallback, useEffect } from 'react';
import { useUserManagement, ManagedUser, CSVUserData } from '@/hooks/useUserManagement';
import { useSquads } from '@/hooks/useSquads';
import { useCargo, UserCargo } from '@/hooks/useCargo';
import { useProjects } from '@/hooks/useProjects';
import { useTabVisibilityManagement, TabKey, TAB_LABELS } from '@/hooks/useTabVisibility';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Users, Plus, Upload, Trash2, Shield, Building2, Eye, EyeOff, FolderOpen, Settings2, X, Check, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const CARGO_COLORS: Record<UserCargo, string> = {
  tech: 'bg-blue-500',
  gerente: 'bg-red-500',
  coordenador: 'bg-yellow-500',
  investidor: 'bg-green-500',
  membro: 'bg-gray-500',
};

const CARGO_LABELS: Record<UserCargo, string> = {
  tech: 'Tech',
  gerente: 'Gerente',
  coordenador: 'Coordenador',
  investidor: 'Investidor',
  membro: 'Membro',
};

const ALL_TABS: TabKey[] = [
  'dashboard',
  'campaigns',
  'creatives',
  'ai-assistant',
  'predictive',
  'suggestions',
  'whatsapp',
  'financial',
  'settings',
  'admin',
];

interface UserProjectAccess {
  project_id: string;
  project_name: string;
}

// Master email that cannot be modified
const MASTER_EMAIL = 'gabrielhenriquelasaro7@gmail.com';

export function UserManagement() {
  const { users, loading, createUser, updateUserCargo, updateUserSquad, deleteUser, importUsersFromCSV } = useUserManagement();
  const { squads } = useSquads();
  const { projects } = useProjects();
  const { isTech, isGerente } = useCargo();
  const { getHiddenTabs, setHiddenTabs, toggleTab, loading: visibilityLoading, fetchAllVisibilities } = useTabVisibilityManagement();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isCreatingAuthUsers, setIsCreatingAuthUsers] = useState(false);
  const [configUserId, setConfigUserId] = useState<string | null>(null);
  const [userProjectAccess, setUserProjectAccess] = useState<Record<string, string[]>>({});
  const [isSavingVisibility, setIsSavingVisibility] = useState(false);
  const [localHiddenTabs, setLocalHiddenTabs] = useState<TabKey[]>([]);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    phone: '',
    cargo: 'membro' as UserCargo,
    squad_id: '',
  });

  const canManage = isTech || isGerente;
  
  // Check if a user is the master user (cannot be modified by others)
  const isMasterUser = (email: string) => email === MASTER_EMAIL;
  
  // Check if current user is the master (can edit themselves)
  const isCurrentUserMaster = currentUserEmail === MASTER_EMAIL;
  
  // Can edit this user? Master can only be edited by themselves
  const canEditUser = (userEmail: string) => {
    if (isMasterUser(userEmail)) {
      return isCurrentUserMaster; // Only master can edit master
    }
    return canManage; // Others can be edited by managers
  };
  
  const configUser = users.find(u => u.user_id === configUserId);

  // Get current user email
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setCurrentUserEmail(user.email);
      }
    };
    getCurrentUser();
  }, []);

  // Atualizar localHiddenTabs quando abre o dialog
  useEffect(() => {
    if (configUserId) {
      const tabs = getHiddenTabs(configUserId);
      setLocalHiddenTabs(tabs);
    }
  }, [configUserId, getHiddenTabs]);

  // Fetch user project access
  const fetchUserProjects = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('guest_project_access')
        .select('project_id')
        .eq('user_id', userId);

      if (error) throw error;
      
      setUserProjectAccess(prev => ({
        ...prev,
        [userId]: (data || []).map(d => d.project_id),
      }));
    } catch (error) {
      console.error('Error fetching user projects:', error);
    }
  }, []);

  // Handle user project access toggle (agora em batch)
  const handleToggleProjectAccess = async (userId: string, projectId: string, checked: boolean) => {
    const currentAccess = userProjectAccess[userId] || [];

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      if (!checked && currentAccess.includes(projectId)) {
        // Remove access
        const { error } = await supabase
          .from('guest_project_access')
          .delete()
          .eq('user_id', userId)
          .eq('project_id', projectId);

        if (error) throw error;

        setUserProjectAccess(prev => ({
          ...prev,
          [userId]: currentAccess.filter(id => id !== projectId),
        }));
      } else if (checked && !currentAccess.includes(projectId)) {
        // Add access
        const { error } = await supabase
          .from('guest_project_access')
          .insert({
            user_id: userId,
            project_id: projectId,
            granted_by: user.id,
          });

        if (error) throw error;

        setUserProjectAccess(prev => ({
          ...prev,
          [userId]: [...currentAccess, projectId],
        }));
      }
      toast.success(checked ? 'Acesso concedido' : 'Acesso removido');
    } catch (error) {
      console.error('Error toggling project access:', error);
      toast.error('Erro ao atualizar acesso');
    }
  };

  // Handle tab visibility toggle - atualiza localmente primeiro, depois salva
  const handleToggleTab = async (tab: TabKey) => {
    if (!configUserId) return;
    
    const isCurrentlyHidden = localHiddenTabs.includes(tab);
    const newHiddenTabs = isCurrentlyHidden 
      ? localHiddenTabs.filter(t => t !== tab)
      : [...localHiddenTabs, tab];
    
    // Atualiza UI imediatamente
    setLocalHiddenTabs(newHiddenTabs);
    
    setIsSavingVisibility(true);
    try {
      await setHiddenTabs(configUserId, newHiddenTabs);
      toast.success(`Aba "${TAB_LABELS[tab]}" ${isCurrentlyHidden ? 'liberada' : 'oculta'}`);
    } catch (error) {
      // Reverte se der erro
      setLocalHiddenTabs(localHiddenTabs);
      toast.error('Erro ao atualizar visibilidade');
    } finally {
      setIsSavingVisibility(false);
    }
  };

  const handleCreateUser = async () => {
    if (!formData.email) {
      toast.error('Email é obrigatório');
      return;
    }

    try {
      await createUser({
        email: formData.email,
        full_name: formData.full_name || undefined,
        phone: formData.phone || undefined,
        cargo: formData.cargo,
        squad_id: formData.squad_id || undefined,
      });
      setIsCreateOpen(false);
      setFormData({ email: '', full_name: '', phone: '', cargo: 'membro', squad_id: '' });
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const text = await file.text();
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const csvUsers: CSVUserData[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split(',').map(v => v.trim());
        const user: CSVUserData = {
          name: values[headers.indexOf('nome')] || '',
          phone: values[headers.indexOf('telefone')] || '',
          email: values[headers.indexOf('email')] || '',
          squad: values[headers.indexOf('squad')] || '',
          cargo: values[headers.indexOf('cargo')] || '',
        };
        
        if (user.email) {
          csvUsers.push(user);
        }
      }

      if (csvUsers.length === 0) {
        toast.error('Nenhum usuário válido encontrado no CSV');
        return;
      }

      const result = await importUsersFromCSV(csvUsers);
      toast.success(`Importação concluída: ${result.success} sucesso, ${result.failed} falhas`);
      setIsImportOpen(false);
    } catch (error) {
      console.error('Error importing CSV:', error);
      toast.error('Erro ao importar CSV');
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  const openConfigDialog = async (userId: string) => {
    setConfigUserId(userId);
    await fetchUserProjects(userId);
    // Refetch visibilities to ensure we have the latest
    await fetchAllVisibilities();
  };

  const closeConfigDialog = () => {
    setConfigUserId(null);
    setLocalHiddenTabs([]);
  };

  // Create auth accounts for users in user_management
  const handleCreateAuthUsers = async () => {
    setIsCreatingAuthUsers(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Você precisa estar autenticado');
        return;
      }

      const response = await supabase.functions.invoke('create-auth-users', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw response.error;
      }

      const results = response.data?.results;
      if (results) {
        const messages = [];
        if (results.created?.length > 0) {
          messages.push(`${results.created.length} contas criadas`);
        }
        if (results.password_reset?.length > 0) {
          messages.push(`${results.password_reset.length} senhas resetadas`);
        }
        if (results.failed?.length > 0) {
          messages.push(`${results.failed.length} falhas`);
        }
        
        if (messages.length > 0) {
          toast.success(`Concluído: ${messages.join(', ')}. Senha padrão: 12345678`);
        } else {
          toast.info('Nenhum usuário para processar');
        }
      }
    } catch (error) {
      console.error('Error creating auth users:', error);
      toast.error('Erro ao criar contas de autenticação');
    } finally {
      setIsCreatingAuthUsers(false);
    }
  };

  if (loading) {
    return (
      <Card className="glass-card">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const configUserProjects = configUserId ? (userProjectAccess[configUserId] || []) : [];
  const activeProjects = projects.filter(p => !p.archived);

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Gestão de Usuários
            </CardTitle>
            <CardDescription>
              Gerencie usuários, cargos, squads, projetos e visibilidade de abas
            </CardDescription>
          </div>
          
          {canManage && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={handleCreateAuthUsers}
                disabled={isCreatingAuthUsers}
              >
                {isCreatingAuthUsers ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <KeyRound className="w-4 h-4" />
                )}
                Ativar Contas
              </Button>

              <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Upload className="w-4 h-4" />
                    Importar CSV
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Importar Usuários do CSV</DialogTitle>
                    <DialogDescription>
                      Faça upload de um arquivo CSV com as colunas: Nome, Telefone, Email, Squad, Cargo
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Input 
                      type="file" 
                      accept=".csv" 
                      onChange={handleImportCSV}
                      disabled={isImporting}
                    />
                    {isImporting && (
                      <div className="flex items-center gap-2 mt-4">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Importando...</span>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Novo Usuário
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Novo Usuário</DialogTitle>
                    <DialogDescription>
                      Adicione um novo usuário ao sistema
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Email *</Label>
                      <Input 
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nome Completo</Label>
                      <Input 
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        placeholder="Nome completo"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Telefone</Label>
                      <Input 
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cargo</Label>
                      <Select 
                        value={formData.cargo} 
                        onValueChange={(v) => setFormData({ ...formData, cargo: v as UserCargo })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tech">Tech</SelectItem>
                          <SelectItem value="gerente">Gerente</SelectItem>
                          <SelectItem value="coordenador">Coordenador</SelectItem>
                          <SelectItem value="investidor">Investidor</SelectItem>
                          <SelectItem value="membro">Membro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Squad</Label>
                      <Select 
                        value={formData.squad_id} 
                        onValueChange={(v) => setFormData({ ...formData, squad_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma squad" />
                        </SelectTrigger>
                        <SelectContent>
                          {squads.filter(s => s.name !== 'S/SQUAD').map(squad => (
                            <SelectItem key={squad.id} value={squad.id}>
                              {squad.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateUser}>
                      Criar Usuário
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Squad</TableHead>
                {canManage && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 5 : 4} className="text-center py-8 text-muted-foreground">
                    Nenhum usuário encontrado
                  </TableCell>
                </TableRow>
              ) : (
                users.map(user => {
                  const isMaster = isMasterUser(user.email);
                  return (
                  <TableRow key={user.id} className={isMaster ? 'bg-primary/5' : ''}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {user.full_name || '-'}
                        {isMaster && (
                          <Badge variant="outline" className="border-primary text-primary text-xs">
                            Master
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {canEditUser(user.email) ? (
                        <Select 
                          value={user.cargo} 
                          onValueChange={(v) => updateUserCargo(user.user_id, v as UserCargo)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tech">Tech</SelectItem>
                            <SelectItem value="gerente">Gerente</SelectItem>
                            <SelectItem value="coordenador">Coordenador</SelectItem>
                            <SelectItem value="investidor">Investidor</SelectItem>
                            <SelectItem value="membro">Membro</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={CARGO_COLORS[user.cargo]}>
                          {CARGO_LABELS[user.cargo]}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {canEditUser(user.email) ? (
                        <Select 
                          value={user.squad_id || ''} 
                          onValueChange={(v) => updateUserSquad(user.user_id, v || null)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Sem squad" />
                          </SelectTrigger>
                          <SelectContent>
                            {squads.filter(s => s.name !== 'S/SQUAD').map(squad => (
                              <SelectItem key={squad.id} value={squad.id}>
                                {squad.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          <Building2 className="w-3 h-3" />
                          {user.squad_name || 'Sem squad'}
                        </Badge>
                      )}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right space-x-1">
                        {isTech && canEditUser(user.email) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openConfigDialog(user.user_id)}
                            title="Configurar visibilidade e projetos"
                          >
                            <Settings2 className="w-4 h-4" />
                          </Button>
                        )}
                        {(isGerente || isTech) && !isMaster && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm('Tem certeza que deseja excluir este usuário?')) {
                                deleteUser(user.user_id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                        {isMaster && !isCurrentUserMaster && (
                          <span className="text-xs text-muted-foreground italic">
                            Protegido
                          </span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
          {(['tech', 'gerente', 'coordenador', 'investidor', 'membro'] as UserCargo[]).map(cargo => {
            const count = users.filter(u => u.cargo === cargo).length;
            return (
              <div key={cargo} className="bg-muted/50 rounded-lg p-3 text-center">
                <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${CARGO_COLORS[cargo]} mb-2`}>
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">{CARGO_LABELS[cargo]}</p>
              </div>
            );
          })}
        </div>
      </CardContent>

      {/* Config Dialog for visibility and projects */}
      <Dialog open={!!configUserId} onOpenChange={(open) => !open && closeConfigDialog()}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              Configurar Usuário
            </DialogTitle>
            <DialogDescription>
              {configUser ? `${configUser.full_name || configUser.email} - ${CARGO_LABELS[configUser.cargo]}` : ''}
            </DialogDescription>
          </DialogHeader>

          {configUser && (
            <div className="space-y-6 py-4">
              {/* Tab Visibility Section */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" />
                  Visibilidade de Abas
                </h4>
                <p className="text-sm text-muted-foreground">
                  Marque as abas que devem ficar <strong>visíveis</strong> para este usuário
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {ALL_TABS.map(tab => {
                    const isHidden = localHiddenTabs.includes(tab);
                    const isVisible = !isHidden;
                    return (
                      <div 
                        key={tab}
                        className={`flex items-center gap-2 p-2 rounded-lg border transition-colors cursor-pointer ${
                          isVisible 
                            ? 'bg-metric-positive/10 border-metric-positive/30' 
                            : 'bg-destructive/10 border-destructive/30'
                        }`}
                        onClick={() => !isSavingVisibility && !visibilityLoading && handleToggleTab(tab)}
                      >
                        <Checkbox
                          id={`tab-${tab}`}
                          checked={isVisible}
                          disabled={isSavingVisibility || visibilityLoading}
                          onCheckedChange={() => handleToggleTab(tab)}
                        />
                        <Label 
                          htmlFor={`tab-${tab}`}
                          className={`flex items-center gap-1.5 cursor-pointer text-sm flex-1 ${!isVisible ? 'line-through text-muted-foreground' : ''}`}
                        >
                          {isVisible ? (
                            <Eye className="w-3 h-3 text-metric-positive" />
                          ) : (
                            <EyeOff className="w-3 h-3 text-destructive" />
                          )}
                          {TAB_LABELS[tab]}
                        </Label>
                      </div>
                    );
                  })}
                </div>
                {isSavingVisibility && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </div>
                )}
              </div>

              {/* Project Access Section - Dropdown */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-primary" />
                  Acesso a Projetos
                </h4>
                <p className="text-sm text-muted-foreground">
                  Selecione os projetos que este usuário pode acessar
                </p>
                
                {/* Dropdown Multi-Select para Projetos */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span className="flex items-center gap-2">
                        <FolderOpen className="w-4 h-4" />
                        {configUserProjects.length === 0 
                          ? 'Selecionar projetos...' 
                          : `${configUserProjects.length} projeto${configUserProjects.length > 1 ? 's' : ''} selecionado${configUserProjects.length > 1 ? 's' : ''}`
                        }
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-80 max-h-64 overflow-y-auto">
                    {activeProjects.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        Nenhum projeto disponível
                      </div>
                    ) : (
                      activeProjects.map(project => {
                        const hasAccess = configUserProjects.includes(project.id);
                        return (
                          <DropdownMenuCheckboxItem
                            key={project.id}
                            checked={hasAccess}
                            onCheckedChange={(checked) => 
                              handleToggleProjectAccess(configUserId!, project.id, checked)
                            }
                          >
                            <div className="flex items-center gap-2">
                              <FolderOpen className={`w-4 h-4 ${hasAccess ? 'text-metric-positive' : 'text-muted-foreground'}`} />
                              <span>{project.name}</span>
                            </div>
                          </DropdownMenuCheckboxItem>
                        );
                      })
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Mostrar projetos selecionados como badges */}
                {configUserProjects.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {configUserProjects.map(projectId => {
                      const project = activeProjects.find(p => p.id === projectId);
                      if (!project) return null;
                      return (
                        <Badge 
                          key={projectId} 
                          variant="secondary"
                          className="flex items-center gap-1 pl-2"
                        >
                          <Check className="w-3 h-3 text-metric-positive" />
                          {project.name}
                          <button
                            onClick={() => handleToggleProjectAccess(configUserId!, projectId, false)}
                            className="ml-1 hover:bg-destructive/20 rounded p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                <p className="font-medium mb-1">💡 Informações:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Tech e Gerente veem todos os projetos automaticamente</li>
                  <li>Coordenadores veem projetos da sua squad</li>
                  <li>Investidores precisam de acesso explícito aos projetos</li>
                  <li>As abas <strong>desmarcadas</strong> não aparecem no menu lateral</li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeConfigDialog}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
