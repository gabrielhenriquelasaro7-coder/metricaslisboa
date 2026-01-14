import { useState } from 'react';
import { useUserManagement, ManagedUser, CSVUserData } from '@/hooks/useUserManagement';
import { useSquads } from '@/hooks/useSquads';
import { useCargo, UserCargo } from '@/hooks/useCargo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Users, Plus, Upload, Pencil, Trash2, Shield, Building2 } from 'lucide-react';
import { toast } from 'sonner';

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

export function UserManagement() {
  const { users, loading, createUser, updateUserCargo, updateUserSquad, deleteUser, importUsersFromCSV } = useUserManagement();
  const { squads } = useSquads();
  const { isTech, isGerente } = useCargo();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    phone: '',
    cargo: 'membro' as UserCargo,
    squad_id: '',
  });

  const canManage = isTech || isGerente;

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

  if (loading) {
    return (
      <Card className="glass-card">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

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
              Gerencie usuários, cargos e squads
            </CardDescription>
          </div>
          
          {canManage && (
            <div className="flex gap-2">
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
                          {squads.map(squad => (
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
                users.map(user => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name || '-'}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {canManage ? (
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
                      {isGerente ? (
                        <Select 
                          value={user.squad_id || ''} 
                          onValueChange={(v) => updateUserSquad(user.user_id, v || null)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Sem squad" />
                          </SelectTrigger>
                          <SelectContent>
                            {squads.map(squad => (
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
                      <TableCell className="text-right">
                        {isGerente && (
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
                      </TableCell>
                    )}
                  </TableRow>
                ))
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
    </Card>
  );
}
