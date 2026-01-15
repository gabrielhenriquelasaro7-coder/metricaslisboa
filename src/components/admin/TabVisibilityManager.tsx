import { useState } from 'react';
import { useTabVisibilityManagement, TabKey, TAB_LABELS, HIDDEN_BY_DEFAULT_TABS } from '@/hooks/useTabVisibility';
import { useUserManagement } from '@/hooks/useUserManagement';
import { useCargo } from '@/hooks/useCargo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
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
  const { getHiddenTabs, getEnabledTabs, toggleTab, loading: visibilityLoading } = useTabVisibilityManagement();
  
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const selectedUser = users.find(u => u.user_id === selectedUserId);
  const hiddenTabs = selectedUserId ? getHiddenTabs(selectedUserId) : [];
  const enabledTabs = selectedUserId ? getEnabledTabs(selectedUserId) : [];

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
      
      // Determine the correct message based on tab type
      const isHiddenByDefault = HIDDEN_BY_DEFAULT_TABS.includes(tab);
      if (isHiddenByDefault) {
        const isNowEnabled = !enabledTabs.includes(tab);
        toast.success(`Aba "${TAB_LABELS[tab]}" ${isNowEnabled ? 'liberada' : 'oculta'}`);
      } else {
        const isNowHidden = !hiddenTabs.includes(tab);
        toast.success(`Aba "${TAB_LABELS[tab]}" ${isNowHidden ? 'oculta' : 'liberada'}`);
      }
    } catch (error) {
      toast.error('Erro ao atualizar visibilidade');
    } finally {
      setIsSaving(false);
    }
  };

  // Determine if a tab is currently visible
  const isTabVisible = (tab: TabKey): boolean => {
    if (HIDDEN_BY_DEFAULT_TABS.includes(tab)) {
      // Hidden by default - visible only if explicitly enabled
      return enabledTabs.includes(tab);
    }
    // Visible by default - hidden only if explicitly hidden
    return !hiddenTabs.includes(tab);
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
          Gerencie quais abas cada usuário pode ver
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
                      const visible = isTabVisible(tab);
                      const isHiddenByDefault = HIDDEN_BY_DEFAULT_TABS.includes(tab);
                      
                      return (
                        <div 
                          key={tab}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                            !visible ? 'bg-destructive/10 border-destructive/30' : 'bg-card border-border'
                          } ${isHiddenByDefault ? 'ring-1 ring-amber-500/30' : ''}`}
                        >
                          <Checkbox
                            id={`tab-${tab}`}
                            checked={visible}
                            disabled={isSaving}
                            onCheckedChange={() => handleToggleTab(tab)}
                          />
                          <Label 
                            htmlFor={`tab-${tab}`}
                            className={`flex items-center gap-2 cursor-pointer ${!visible ? 'line-through text-muted-foreground' : ''}`}
                          >
                            {!visible ? (
                              <EyeOff className="w-4 h-4 text-destructive" />
                            ) : (
                              <Eye className="w-4 h-4 text-metric-positive" />
                            )}
                            {TAB_LABELS[tab]}
                            {isHiddenByDefault && (
                              <ShieldCheck className="w-3 h-3 text-amber-500" />
                            )}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                  <p className="font-medium mb-1">💡 Como funciona:</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Marque as abas que deseja liberar para este usuário</li>
                    <li>Abas com <ShieldCheck className="w-3 h-3 inline text-amber-500" /> são <strong>ocultas por padrão</strong> e precisam ser liberadas manualmente</li>
                    <li>A aba <strong>Administração</strong> está oculta para todos até ser liberada</li>
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