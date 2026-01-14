import { useState, useEffect } from 'react';
import { useTabVisibilityManagement, TabKey, TAB_LABELS } from '@/hooks/useTabVisibility';
import { useUserManagement, ManagedUser } from '@/hooks/useUserManagement';
import { useCargo } from '@/hooks/useCargo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Eye, EyeOff, Lock } from 'lucide-react';
import { toast } from 'sonner';

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

export function TabVisibilityManager() {
  const { isTech } = useCargo();
  const { users, loading: usersLoading } = useUserManagement();
  const { getHiddenTabs, toggleTab, loading: visibilityLoading } = useTabVisibilityManagement();
  
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const selectedUser = users.find(u => u.user_id === selectedUserId);
  const hiddenTabs = selectedUserId ? getHiddenTabs(selectedUserId) : [];

  if (!isTech) {
    return (
      <Card className="glass-card">
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Lock className="w-12 h-12 mb-4 opacity-50" />
          <p>Apenas Tech pode gerenciar visibilidade de abas</p>
        </CardContent>
      </Card>
    );
  }

  const handleToggleTab = async (tab: TabKey) => {
    if (!selectedUserId) return;
    
    setIsSaving(true);
    try {
      await toggleTab(selectedUserId, tab);
      toast.success(`Aba "${TAB_LABELS[tab]}" ${hiddenTabs.includes(tab) ? 'liberada' : 'oculta'}`);
    } catch (error) {
      toast.error('Erro ao atualizar visibilidade');
    } finally {
      setIsSaving(false);
    }
  };

  const loading = usersLoading || visibilityLoading;

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-primary" />
          Visibilidade de Abas
        </CardTitle>
        <CardDescription>
          Oculte abas específicas para usuários individuais
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* User selector */}
            <div className="space-y-2">
              <Label>Selecione o Usuário</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um usuário" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(user => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.full_name || user.email} ({user.cargo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedUser && (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">
                    Configurando: <span className="text-primary">{selectedUser.full_name || selectedUser.email}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cargo: {selectedUser.cargo} | Squad: {selectedUser.squad_name || 'Sem squad'}
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium">Abas visíveis:</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {ALL_TABS.map(tab => {
                      const isHidden = hiddenTabs.includes(tab);
                      return (
                        <div 
                          key={tab}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                            isHidden ? 'bg-destructive/10 border-destructive/30' : 'bg-card border-border'
                          }`}
                        >
                          <Checkbox
                            id={`tab-${tab}`}
                            checked={!isHidden}
                            disabled={isSaving}
                            onCheckedChange={() => handleToggleTab(tab)}
                          />
                          <Label 
                            htmlFor={`tab-${tab}`}
                            className={`flex items-center gap-2 cursor-pointer ${isHidden ? 'line-through text-muted-foreground' : ''}`}
                          >
                            {isHidden ? (
                              <EyeOff className="w-4 h-4 text-destructive" />
                            ) : (
                              <Eye className="w-4 h-4 text-metric-positive" />
                            )}
                            {TAB_LABELS[tab]}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                  <p className="font-medium mb-1">💡 Como funciona:</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Desmarque as abas que deseja ocultar para este usuário</li>
                    <li>As abas ocultas não aparecerão no menu lateral</li>
                    <li>Esta configuração é por usuário individual</li>
                  </ul>
                </div>
              </div>
            )}

            {!selectedUser && (
              <div className="text-center py-8 text-muted-foreground">
                <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Selecione um usuário para configurar visibilidade</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
