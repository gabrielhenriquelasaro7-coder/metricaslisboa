import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { 
  User, 
  Bell, 
  Shield, 
  Palette, 
  Loader2,
  Camera,
  Mail,
  Key,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface NotificationSettings {
  emailReports: boolean;
  emailAlerts: boolean;
  browserNotifications: boolean;
  weeklyDigest: boolean;
  roasAlerts: boolean;
  budgetAlerts: boolean;
}

export default function Settings() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [notifications, setNotifications] = useState<NotificationSettings>({
    emailReports: true,
    emailAlerts: true,
    browserNotifications: false,
    weeklyDigest: true,
    roasAlerts: true,
    budgetAlerts: true,
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        setProfile(data);
        setFullName(data.full_name || '');
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success('Perfil atualizado com sucesso!');
    } catch (error) {
      toast.error('Erro ao atualizar perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    toast.error('Funcionalidade em desenvolvimento');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center min-h-[60vh]">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 animate-fade-in max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold mb-2">Configurações</h1>
          <p className="text-muted-foreground">Gerencie sua conta e preferências</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="bg-secondary">
            <TabsTrigger value="profile" className="gap-2">
              <User className="w-4 h-4" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="w-4 h-4" />
              Notificações
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="w-4 h-4" />
              Segurança
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-2">
              <Palette className="w-4 h-4" />
              Aparência
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <div className="glass-card p-6 space-y-6">
              <h3 className="text-lg font-semibold">Informações do Perfil</h3>

              {/* Avatar */}
              <div className="flex items-center gap-6">
                <div className="relative">
                  <Avatar className="w-24 h-24">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback className="text-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
                      {fullName?.[0]?.toUpperCase() || user?.email?.[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 transition-colors">
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <p className="font-medium">{fullName || 'Sem nome'}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>

              {/* Form */}
              <div className="grid gap-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome completo</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      value={user?.email || ''}
                      disabled
                      className="pl-10 bg-muted"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O e-mail não pode ser alterado
                  </p>
                </div>

                <Button onClick={handleSaveProfile} disabled={saving} className="w-fit">
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar alterações'
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <div className="glass-card p-6 space-y-6">
              <h3 className="text-lg font-semibold">Preferências de Notificação</h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div>
                    <p className="font-medium">Relatórios por e-mail</p>
                    <p className="text-sm text-muted-foreground">
                      Receba relatórios diários de performance
                    </p>
                  </div>
                  <Switch
                    checked={notifications.emailReports}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, emailReports: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div>
                    <p className="font-medium">Alertas por e-mail</p>
                    <p className="text-sm text-muted-foreground">
                      Receba alertas importantes sobre suas campanhas
                    </p>
                  </div>
                  <Switch
                    checked={notifications.emailAlerts}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, emailAlerts: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div>
                    <p className="font-medium">Notificações do navegador</p>
                    <p className="text-sm text-muted-foreground">
                      Receba notificações em tempo real
                    </p>
                  </div>
                  <Switch
                    checked={notifications.browserNotifications}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, browserNotifications: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div>
                    <p className="font-medium">Resumo semanal</p>
                    <p className="text-sm text-muted-foreground">
                      Receba um resumo semanal do desempenho
                    </p>
                  </div>
                  <Switch
                    checked={notifications.weeklyDigest}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, weeklyDigest: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div>
                    <p className="font-medium">Alertas de ROAS</p>
                    <p className="text-sm text-muted-foreground">
                      Alerta quando o ROAS cair abaixo do esperado
                    </p>
                  </div>
                  <Switch
                    checked={notifications.roasAlerts}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, roasAlerts: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">Alertas de orçamento</p>
                    <p className="text-sm text-muted-foreground">
                      Alerta quando o orçamento estiver acabando
                    </p>
                  </div>
                  <Switch
                    checked={notifications.budgetAlerts}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, budgetAlerts: checked })
                    }
                  />
                </div>
              </div>

              <Button onClick={() => toast.success('Preferências salvas!')}>
                Salvar preferências
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <div className="glass-card p-6 space-y-6">
              <h3 className="text-lg font-semibold">Segurança da Conta</h3>

              <div className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label>Alterar senha</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="password" placeholder="Nova senha" className="pl-10" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Input type="password" placeholder="Confirmar nova senha" className="pl-10" />
                </div>

                <Button variant="outline">Atualizar senha</Button>
              </div>
            </div>

            <div className="glass-card p-6 space-y-6 border-destructive/50">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-destructive">Zona de perigo</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ações irreversíveis que afetam sua conta permanentemente.
                  </p>
                </div>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-2">
                    <Trash2 className="w-4 h-4" />
                    Excluir conta
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir conta permanentemente?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. Todos os seus dados, projetos e histórico
                      serão permanentemente excluídos.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Excluir minha conta
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-6">
            <div className="glass-card p-6 space-y-6">
              <h3 className="text-lg font-semibold">Aparência</h3>

              <div className="space-y-4">
                <div>
                  <Label className="mb-3 block">Tema</Label>
                  <div className="grid grid-cols-3 gap-4 max-w-md">
                    <button className="p-4 rounded-lg border-2 border-primary bg-card text-center">
                      <div className="w-full h-8 rounded bg-background mb-2" />
                      <span className="text-sm">Escuro</span>
                    </button>
                    <button className="p-4 rounded-lg border border-border bg-card text-center opacity-50 cursor-not-allowed">
                      <div className="w-full h-8 rounded bg-white mb-2" />
                      <span className="text-sm">Claro</span>
                    </button>
                    <button className="p-4 rounded-lg border border-border bg-card text-center opacity-50 cursor-not-allowed">
                      <div className="w-full h-8 rounded bg-gradient-to-r from-background to-white mb-2" />
                      <span className="text-sm">Sistema</span>
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Tema claro em breve!
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
