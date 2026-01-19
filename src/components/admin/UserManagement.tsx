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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Users, Plus, Upload, Trash2, Shield, Building2, Eye, EyeOff, FolderOpen, Settings2, X, Check, KeyRound, UserPlus, Search, Filter, Mail, Phone, Calendar, User, UserMinus, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  const [activatingUserId, setActivatingUserId] = useState<string | null>(null);
  const [deactivatingUserId, setDeactivatingUserId] = useState<string | null>(null);
  const [configUserId, setConfigUserId] = useState<string | null>(null);
  const [userProjectAccess, setUserProjectAccess] = useState<Record<string, string[]>>({});
  const [isSavingVisibility, setIsSavingVisibility] = useState(false);
  const [localHiddenTabs, setLocalHiddenTabs] = useState<TabKey[]>([]);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCargo, setFilterCargo] = useState<UserCargo | 'all'>('all');
  const [filterSquad, setFilterSquad] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'pending'>('all');
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  
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
  const profileUser = users.find(u => u.user_id === profileUserId);

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

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
  // Also updates investidor_id and squad_id on project when user is an investidor
  const handleToggleProjectAccess = async (userId: string, projectId: string, checked: boolean) => {
    const currentAccess = userProjectAccess[userId] || [];
    
    // Find the user to check their cargo
    const targetUser = users.find(u => u.user_id === userId);
    const isInvestidor = targetUser?.cargo === 'investidor';

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

        // If user is investidor, also remove from project_investidores table
        if (isInvestidor) {
          await supabase
            .from('project_investidores')
            .delete()
            .eq('project_id', projectId)
            .eq('investidor_id', userId);
        }

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

        // If user is investidor, also add to project_investidores table
        if (isInvestidor && userId) {
          // Get the user's squad
          const { data: squadMembership } = await supabase
            .from('squad_members')
            .select('squad_id')
            .eq('user_id', userId)
            .maybeSingle();

          // Add to project_investidores (upsert to avoid duplicates)
          await supabase
            .from('project_investidores')
            .upsert({ 
              project_id: projectId,
              investidor_id: userId
            }, { onConflict: 'project_id,investidor_id' });

          // Update project's squad_id if not set
          await supabase
            .from('projects')
            .update({ 
              squad_id: squadMembership?.squad_id || null
            })
            .eq('id', projectId)
            .is('squad_id', null);
        }

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

    setIsCreating(true);
    try {
      const result = await createUser({
        email: formData.email,
        full_name: formData.full_name || undefined,
        phone: formData.phone || undefined,
        cargo: formData.cargo,
        squad_id: formData.squad_id || undefined,
      });
      
      if (result.success && result.password) {
        setCreatedPassword(result.password);
        toast.success('Usuário criado com sucesso!');
        // Keep dialog open to show password
      } else {
        // Error already handled in hook
      }
    } catch (error) {
      // Error already handled in hook
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateDialogChange = (open: boolean) => {
    if (open) {
      setIsCreateOpen(true);
    } else {
      setIsCreateOpen(false);
      setCreatedPassword(null);
      setFormData({ email: '', full_name: '', phone: '', cargo: 'membro', squad_id: '' });
    }
  };

  const closeCreateDialog = () => {
    setIsCreateOpen(false);
    setCreatedPassword(null);
    setFormData({ email: '', full_name: '', phone: '', cargo: 'membro', squad_id: '' });
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

  // Create auth accounts for users in user_management (only those without user_id)
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
        if (results.already_exists?.length > 0) {
          messages.push(`${results.already_exists.length} já existiam`);
        }
        if (results.failed?.length > 0) {
          messages.push(`${results.failed.length} falhas`);
        }
        
        if (messages.length > 0) {
          toast.success(`Concluído: ${messages.join(', ')}. Senha padrão: 12345678`);
        } else {
          toast.info('Nenhum usuário novo para ativar (todos já têm conta)');
        }
      }
    } catch (error) {
      console.error('Error creating auth users:', error);
      toast.error('Erro ao criar contas de autenticação');
    } finally {
      setIsCreatingAuthUsers(false);
    }
  };

  // Activate a single user account
  const handleActivateSingleUser = async (email: string) => {
    setActivatingUserId(email);
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
        body: { email },
      });

      if (response.error) {
        throw response.error;
      }

      const results = response.data?.results;
      if (results?.created?.length > 0) {
        toast.success(`Conta ativada para ${email}. Senha: 12345678`);
      } else if (results?.already_exists?.length > 0) {
        toast.info(`${email} já possui conta ativa`);
      } else if (results?.failed?.length > 0) {
        toast.error(`Erro ao ativar ${email}: ${results.failed[0]?.error}`);
      } else {
        toast.info('Nenhuma ação necessária');
      }
    } catch (error) {
      console.error('Error activating user:', error);
      toast.error('Erro ao ativar conta');
    } finally {
      setActivatingUserId(null);
    }
  };

  // Deactivate a single user account
  const handleDeactivateUser = async (userId: string, email: string) => {
    if (!confirm(`Tem certeza que deseja inativar a conta de ${email}? O usuário não poderá acessar o sistema e será removido de todas as funções.`)) {
      return;
    }
    
    setDeactivatingUserId(userId);
    try {
      // Clear the user_id, cargo and squad in user_management to mark as inactive
      const { error } = await supabase
        .from('user_management')
        .update({ 
          user_id: null,
          cargo: 'membro', // Reset to basic role
          squad_id: null   // Remove from squad
        })
        .eq('user_id', userId);

      if (error) throw error;

      // Remove from squad_members table
      await supabase
        .from('squad_members')
        .delete()
        .eq('user_id', userId);

      // Update user_roles to reset cargo and mark password as not changed
      await supabase
        .from('user_roles')
        .update({ 
          password_changed: false,
          cargo: 'membro' // Reset to basic role
        })
        .eq('user_id', userId);

      // Update profiles to reset cargo (set to null as membro is not in enum)
      await supabase
        .from('profiles')
        .update({ cargo: null })
        .eq('user_id', userId);

      toast.success(`Conta de ${email} inativada com sucesso. Cargo e squad removidos.`);
      
      // Refresh users list
      window.location.reload();
    } catch (error) {
      console.error('Error deactivating user:', error);
      toast.error('Erro ao inativar conta');
    } finally {
      setDeactivatingUserId(null);
    }
  };

  // Check if user needs activation (no user_id means never activated)
  const needsActivation = (user: ManagedUser) => !user.user_id;

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

  // Filter users based on search and filters
  const filteredUsers = users.filter(user => {
    // Search filter
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      user.email.toLowerCase().includes(searchLower) ||
      (user.full_name?.toLowerCase().includes(searchLower)) ||
      (user.phone?.toLowerCase().includes(searchLower));
    
    // Cargo filter
    const matchesCargo = filterCargo === 'all' || user.cargo === filterCargo;
    
    // Squad filter
    const matchesSquad = filterSquad === 'all' || user.squad_id === filterSquad;
    
    // Status filter
    const isActive = !!user.user_id;
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && isActive) ||
      (filterStatus === 'pending' && !isActive);
    
    return matchesSearch && matchesCargo && matchesSquad && matchesStatus;
  });

  const hasActiveFilters = searchQuery || filterCargo !== 'all' || filterSquad !== 'all' || filterStatus !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setFilterCargo('all');
    setFilterSquad('all');
    setFilterStatus('all');
  };

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
              {/* Only show bulk activate if there are pending users */}
              {users.filter(u => !u.user_id).length > 0 && (
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
                  Ativar Todos ({users.filter(u => !u.user_id).length})
                </Button>
              )}

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

              <Dialog open={isCreateOpen} onOpenChange={handleCreateDialogChange}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Novo Usuário
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {createdPassword ? 'Usuário Criado com Sucesso!' : 'Criar Novo Usuário'}
                    </DialogTitle>
                    <DialogDescription>
                      {createdPassword 
                        ? 'Copie a senha temporária abaixo e envie para o usuário'
                        : 'Adicione um novo usuário ao sistema'
                      }
                    </DialogDescription>
                  </DialogHeader>
                  
                  {createdPassword ? (
                    <div className="space-y-4 py-4">
                      <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg space-y-4">
                        <div className="flex items-center gap-2 text-primary">
                          <Check className="w-5 h-5" />
                          <span className="font-semibold">Usuário criado com sucesso!</span>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Email:</span>
                            <span className="font-medium">{formData.email}</span>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                              <KeyRound className="w-4 h-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Senha temporária:</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 p-3 bg-card border rounded-md font-mono text-lg tracking-wider text-center">
                                {createdPassword}
                              </div>
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => {
                                  navigator.clipboard.writeText(createdPassword);
                                  toast.success('Senha copiada!');
                                }}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-sm text-muted-foreground text-center">
                        ⚠️ O usuário deverá trocar a senha no primeiro acesso.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Email *</Label>
                        <Input 
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="email@exemplo.com"
                          disabled={isCreating}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Nome Completo</Label>
                        <Input 
                          value={formData.full_name}
                          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                          placeholder="Nome completo"
                          disabled={isCreating}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Telefone</Label>
                        <Input 
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="(00) 00000-0000"
                          disabled={isCreating}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cargo</Label>
                        <Select 
                          value={formData.cargo} 
                          onValueChange={(v) => setFormData({ ...formData, cargo: v as UserCargo })}
                          disabled={isCreating}
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
                          disabled={isCreating}
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
                  )}
                  
                  <DialogFooter>
                    {createdPassword ? (
                      <Button onClick={closeCreateDialog}>
                        Fechar
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" onClick={closeCreateDialog} disabled={isCreating}>
                          Cancelar
                        </Button>
                        <Button onClick={handleCreateUser} disabled={isCreating}>
                          {isCreating ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Criando...
                            </>
                          ) : (
                            'Criar Usuário'
                          )}
                        </Button>
                      </>
                    )}
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            {/* Cargo Filter */}
            <Select value={filterCargo} onValueChange={(v) => setFilterCargo(v as UserCargo | 'all')}>
              <SelectTrigger className="w-[140px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Cargo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Cargos</SelectItem>
                <SelectItem value="tech">Tech</SelectItem>
                <SelectItem value="gerente">Gerente</SelectItem>
                <SelectItem value="coordenador">Coordenador</SelectItem>
                <SelectItem value="investidor">Investidor</SelectItem>
                <SelectItem value="membro">Membro</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Squad Filter */}
            <Select value={filterSquad} onValueChange={setFilterSquad}>
              <SelectTrigger className="w-[140px]">
                <Building2 className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Squad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Squads</SelectItem>
                {squads.filter(s => s.name !== 'S/SQUAD').map(squad => (
                  <SelectItem key={squad.id} value={squad.id}>
                    {squad.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Status Filter */}
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as 'all' | 'active' | 'pending')}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                <X className="w-4 h-4" />
                Limpar
              </Button>
            )}
          </div>
        </div>
        
        {/* Results count */}
        {hasActiveFilters && (
          <div className="text-sm text-muted-foreground">
            {filteredUsers.length} de {users.length} usuários
          </div>
        )}
        <div className="rounded-xl border overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[280px] font-semibold">Usuário</TableHead>
                  <TableHead className="w-[200px] font-semibold">Contato</TableHead>
                  <TableHead className="w-[100px] font-semibold">Status</TableHead>
                  <TableHead className="w-[140px] font-semibold">Cargo</TableHead>
                  <TableHead className="w-[140px] font-semibold">Squad</TableHead>
                  {canManage && <TableHead className="w-[180px] text-right font-semibold">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 6 : 5} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="w-8 h-8 opacity-50" />
                        <span>{hasActiveFilters ? 'Nenhum usuário encontrado com os filtros aplicados' : 'Nenhum usuário encontrado'}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map(user => {
                    const isMaster = isMasterUser(user.email);
                    const userNeedsActivation = needsActivation(user);
                    const isActivating = activatingUserId === user.email;
                    const isDeactivating = deactivatingUserId === user.user_id;
                    return (
                    <TableRow key={user.id} className={`${isMaster ? 'bg-primary/5' : userNeedsActivation ? 'bg-yellow-500/5' : ''} hover:bg-muted/30 transition-colors`}>
                      <TableCell 
                        className="font-medium cursor-pointer hover:text-primary transition-colors py-4"
                        onClick={() => user.user_id && setProfileUserId(user.user_id)}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10 border-2 border-background shadow-sm">
                            {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.full_name || user.email} />}
                            <AvatarFallback className={`text-sm font-medium ${CARGO_COLORS[user.cargo]} text-white`}>
                              {getInitials(user.full_name, user.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold hover:underline">{user.full_name || 'Sem nome'}</span>
                              {isMaster && (
                                <Badge variant="outline" className="border-primary text-primary text-xs">
                                  Master
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm">{user.email}</span>
                          {user.phone && (
                            <span className="text-xs text-muted-foreground">{user.phone}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        {userNeedsActivation ? (
                          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
                            Pendente
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                            <Check className="w-3 h-3 mr-1" />
                            Ativo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-4">
                        {canEditUser(user.email) ? (
                          <Select 
                            value={user.cargo} 
                            onValueChange={(v) => updateUserCargo(user.user_id, v as UserCargo)}
                          >
                            <SelectTrigger className="w-[130px]">
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
                      <TableCell className="py-4">
                        {canEditUser(user.email) ? (
                          <Select 
                            value={user.squad_id || ''} 
                            onValueChange={(v) => updateUserSquad(user.user_id, v || null)}
                          >
                            <SelectTrigger className="w-[130px]">
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
                        <TableCell className="text-right py-4">
                          <div className="flex items-center justify-end gap-1">
                            {/* Activate button - only for users without account */}
                            {userNeedsActivation && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-xs h-8 bg-green-500/10 border-green-500/30 text-green-600 hover:bg-green-500/20"
                                onClick={() => handleActivateSingleUser(user.email)}
                                disabled={isActivating}
                                title="Ativar conta deste usuário"
                              >
                                {isActivating ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <UserPlus className="w-3.5 h-3.5" />
                                )}
                                Ativar
                              </Button>
                            )}
                            {/* Deactivate button - only for active users */}
                            {!userNeedsActivation && canEditUser(user.email) && !isMaster && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-xs h-8 bg-orange-500/10 border-orange-500/30 text-orange-600 hover:bg-orange-500/20"
                                onClick={() => handleDeactivateUser(user.user_id, user.email)}
                                disabled={isDeactivating}
                                title="Inativar conta deste usuário"
                              >
                                {isDeactivating ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <UserMinus className="w-3.5 h-3.5" />
                                )}
                                Inativar
                              </Button>
                            )}
                            {isTech && canEditUser(user.email) && !userNeedsActivation && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
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
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  if (confirm('Tem certeza que deseja excluir este usuário permanentemente?')) {
                                    deleteUser(user.user_id, user.id);
                                  }
                                }}
                                title="Excluir usuário"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                            {isMaster && !isCurrentUserMaster && (
                              <span className="text-xs text-muted-foreground italic px-2">
                                Protegido
                              </span>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
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

      {/* User Profile Sheet */}
      <Sheet open={!!profileUserId} onOpenChange={(open) => !open && setProfileUserId(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Perfil do Usuário
            </SheetTitle>
            <SheetDescription>
              Informações detalhadas do usuário
            </SheetDescription>
          </SheetHeader>

          {profileUser && (
            <div className="mt-6 space-y-6">
              {/* Avatar and Name */}
              <div className="flex flex-col items-center text-center">
                <Avatar className="w-20 h-20 mb-4">
                  {profileUser.avatar_url && <AvatarImage src={profileUser.avatar_url} alt={profileUser.full_name || profileUser.email} />}
                  <AvatarFallback className={`text-2xl ${CARGO_COLORS[profileUser.cargo]} text-white`}>
                    {getInitials(profileUser.full_name, profileUser.email)}
                  </AvatarFallback>
                </Avatar>
                <h3 className="text-xl font-semibold">{profileUser.full_name || 'Sem nome'}</h3>
                <Badge className={`mt-2 ${CARGO_COLORS[profileUser.cargo]}`}>
                  {CARGO_LABELS[profileUser.cargo]}
                </Badge>
                {isMasterUser(profileUser.email) && (
                  <Badge variant="outline" className="mt-2 border-primary text-primary">
                    Master
                  </Badge>
                )}
              </div>

              {/* Status */}
              <div className="flex justify-center">
                {needsActivation(profileUser) ? (
                  <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
                    Pendente de Ativação
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                    <Check className="w-3 h-3 mr-1" />
                    Conta Ativa
                  </Badge>
                )}
              </div>

              {/* Contact Info */}
              <div className="space-y-4 border-t pt-6">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Contato</h4>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Mail className="w-5 h-5 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="font-medium truncate">{profileUser.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Phone className="w-5 h-5 text-primary" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Telefone</p>
                      <p className="font-medium">{profileUser.phone || 'Não informado'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Squad Info */}
              <div className="space-y-4 border-t pt-6">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Organização</h4>
                
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Building2 className="w-5 h-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Squad</p>
                    <p className="font-medium">{profileUser.squad_name || 'Sem squad'}</p>
                  </div>
                </div>
              </div>

              {/* Timestamps */}
              <div className="space-y-4 border-t pt-6">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Datas</h4>
                
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Calendar className="w-5 h-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Criado em</p>
                    <p className="font-medium">
                      {profileUser.created_at 
                        ? new Date(profileUser.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric'
                          })
                        : 'Data não disponível'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              {canManage && canEditUser(profileUser.email) && (
                <div className="border-t pt-6 space-y-2">
                  {needsActivation(profileUser) && (
                    <Button 
                      className="w-full gap-2"
                      onClick={() => {
                        handleActivateSingleUser(profileUser.email);
                        setProfileUserId(null);
                      }}
                    >
                      <UserPlus className="w-4 h-4" />
                      Ativar Conta
                    </Button>
                  )}
                  {isTech && !needsActivation(profileUser) && (
                    <Button 
                      variant="outline" 
                      className="w-full gap-2"
                      onClick={() => {
                        openConfigDialog(profileUser.user_id);
                        setProfileUserId(null);
                      }}
                    >
                      <Settings2 className="w-4 h-4" />
                      Configurar Acessos
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </Card>
  );
}
