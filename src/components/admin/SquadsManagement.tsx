import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Users, Plus, MoreVertical, Pencil, Trash2, UserPlus, Loader2 } from 'lucide-react';
import { useSquads, Squad, SquadMemberWithProfile } from '@/hooks/useSquads';
import { useCargo } from '@/hooks/useCargo';
import { cn } from '@/lib/utils';

const colorOptions = [
  { value: '#3B82F6', label: 'Azul' },
  { value: '#F97316', label: 'Laranja' },
  { value: '#EAB308', label: 'Amarelo' },
  { value: '#22C55E', label: 'Verde' },
  { value: '#EC4899', label: 'Rosa' },
  { value: '#8B5CF6', label: 'Roxo' },
  { value: '#EF4444', label: 'Vermelho' },
  { value: '#6B7280', label: 'Cinza' },
];

export function SquadsManagement() {
  const { squads, loading, createSquad, updateSquad, deleteSquad, getSquadMembers } = useSquads();
  const { canManageSquads } = useCargo();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSquad, setSelectedSquad] = useState<Squad | null>(null);
  const [squadMembers, setSquadMembers] = useState<Record<string, SquadMemberWithProfile[]>>({});
  const [loadingMembers, setLoadingMembers] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadSquadMembers = async (squadId: string) => {
    if (squadMembers[squadId]) return;
    
    setLoadingMembers(squadId);
    try {
      const members = await getSquadMembers(squadId);
      setSquadMembers(prev => ({ ...prev, [squadId]: members }));
    } finally {
      setLoadingMembers(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      await createSquad(formData.name.trim(), formData.description.trim(), formData.color);
      setCreateDialogOpen(false);
      setFormData({ name: '', description: '', color: '#3B82F6' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSquad || !formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      await updateSquad(selectedSquad.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        color: formData.color,
      });
      setEditDialogOpen(false);
      setSelectedSquad(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (squad: Squad) => {
    if (!confirm(`Tem certeza que deseja excluir a squad "${squad.name}"?`)) return;
    await deleteSquad(squad.id);
  };

  const openEditDialog = (squad: Squad) => {
    setSelectedSquad(squad);
    setFormData({
      name: squad.name,
      description: squad.description || '',
      color: squad.color,
    });
    setEditDialogOpen(true);
  };

  if (!canManageSquads) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Squads
            </CardTitle>
            <CardDescription>
              Gerencie as squads e seus membros
            </CardDescription>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Nova Squad
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Squad</DialogTitle>
                <DialogDescription>
                  Crie uma nova squad para agrupar projetos
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    placeholder="Ex: SHARK"
                    value={formData.name}
                    onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Input
                    id="description"
                    placeholder="Descrição da squad"
                    value={formData.description}
                    onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cor</Label>
                  <div className="flex flex-wrap gap-2">
                    {colorOptions.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        className={cn(
                          "w-8 h-8 rounded-full border-2 transition-all",
                          formData.color === color.value
                            ? "border-foreground scale-110"
                            : "border-transparent hover:scale-105"
                        )}
                        style={{ backgroundColor: color.value }}
                        onClick={() => setFormData(p => ({ ...p, color: color.value }))}
                        title={color.label}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreateDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting || !formData.name.trim()}>
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Criar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : squads.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Nenhuma squad criada</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {squads.map((squad) => (
              <div
                key={squad.id}
                className="p-4 border rounded-lg bg-card hover:bg-secondary/30 transition-colors"
                onMouseEnter={() => loadSquadMembers(squad.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: squad.color }}
                    />
                    <div>
                      <h4 className="font-medium">{squad.name}</h4>
                      {squad.description && (
                        <p className="text-sm text-muted-foreground">
                          {squad.description}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary" className="ml-2">
                      {loadingMembers === squad.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        `${squadMembers[squad.id]?.length || 0} membros`
                      )}
                    </Badge>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => openEditDialog(squad)}
                        className="gap-2"
                      >
                        <Pencil className="w-4 h-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(squad)}
                        className="gap-2 text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Squad</DialogTitle>
            <DialogDescription>
              Atualize as informações da squad
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome *</Label>
              <Input
                id="edit-name"
                placeholder="Ex: SHARK"
                value={formData.name}
                onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Descrição</Label>
              <Input
                id="edit-description"
                placeholder="Descrição da squad"
                value={formData.description}
                onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all",
                      formData.color === color.value
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setFormData(p => ({ ...p, color: color.value }))}
                    title={color.label}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || !formData.name.trim()}>
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
