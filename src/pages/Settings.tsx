import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
  AlertTriangle,
  Settings as SettingsIcon,
  Save,
  History,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Filter,
  Clock,
  Sun,
  Moon,
  Monitor,
  UserPlus
} from 'lucide-react';
import { GuestsTab } from '@/components/settings/GuestsTab';
import { useUserRole } from '@/hooks/useUserRole';
import { SettingsSkeleton } from '@/components/skeletons';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

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

interface SyncLog {
  id: string;
  project_id: string;
  status: string;
  message: string | null;
  created_at: string;
}

type Theme = 'dark' | 'light' | 'system';

type PrimaryColor = 'red' | 'blue' | 'green' | 'purple' | 'orange' | 'custom';

const COLOR_PRESETS: Record<Exclude<PrimaryColor, 'custom'>, { name: string; hue: number; saturation: number }> = {
  red: { name: 'Vermelho', hue: 0, saturation: 85 },
  blue: { name: 'Azul', hue: 220, saturation: 85 },
  green: { name: 'Verde', hue: 142, saturation: 71 },
  purple: { name: 'Roxo', hue: 270, saturation: 75 },
  orange: { name: 'Laranja', hue: 25, saturation: 90 },
};

// Convert hex to HSL
const hexToHsl = (hex: string): { h: number; s: number; l: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 85, l: 50 };
  
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

// Convert HSL to hex
const hslToHex = (h: number, s: number, l: number): string => {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

export default function Settings() {
  const { user, signOut } = useAuth();
  const { projects } = useProjects();
  const { isGuest } = useUserRole();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [fullName, setFullName] = useState('');
  const [notifications, setNotifications] = useState<NotificationSettings>({
    emailReports: true,
    emailAlerts: true,
    browserNotifications: false,
    weeklyDigest: true,
    roasAlerts: true,
    budgetAlerts: true,
  });
  
  // Theme state
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme') as Theme;
    return stored || 'dark';
  });

  // Primary color state
  const [primaryColor, setPrimaryColor] = useState<PrimaryColor>(() => {
    const stored = localStorage.getItem('primaryColor') as PrimaryColor;
    return stored || 'red';
  });

  // Custom color state (hex)
  const [customColor, setCustomColor] = useState<string>(() => {
    const stored = localStorage.getItem('customColor');
    return stored || '#ef4444';
  });

  // Sync logs state
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const selectedProjectId = localStorage.getItem('selectedProjectId');
  const selectedProject = projects.find(p => p.id === selectedProjectId);

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

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
    
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Apply primary color
  useEffect(() => {
    const root = document.documentElement;
    let hue: number;
    let saturation: number;
    
    if (primaryColor === 'custom') {
      const hsl = hexToHsl(customColor);
      hue = hsl.h;
      saturation = hsl.s;
      localStorage.setItem('customColor', customColor);
    } else {
      const colorPreset = COLOR_PRESETS[primaryColor];
      hue = colorPreset.hue;
      saturation = colorPreset.saturation;
    }
    
    root.style.setProperty('--primary', `${hue} ${saturation}% 50%`);
    root.style.setProperty('--ring', `${hue} ${saturation}% 50%`);
    root.style.setProperty('--sidebar-primary', `${hue} ${saturation}% 50%`);
    root.style.setProperty('--sidebar-ring', `${hue} ${saturation}% 50%`);
    root.style.setProperty('--accent', `${hue} 70% 60%`);
    root.style.setProperty('--chart-1', `${hue} ${saturation}% 50%`);
    root.style.setProperty('--chart-2', `${hue} 70% 65%`);
    root.style.setProperty('--metric-neutral', `${hue} ${saturation}% 50%`);
    
    localStorage.setItem('primaryColor', primaryColor);
  }, [primaryColor, customColor]);

  // Fetch sync logs
  const fetchLogs = async () => {
    if (!selectedProjectId) {
      setLogsLoading(false);
      return;
    }
    
    setLogsLoading(true);
    try {
      let query = supabase
        .from('sync_logs')
        .select('*')
        .eq('project_id', selectedProjectId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching sync logs:', error);
        return;
      }

      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching sync logs:', error);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedProjectId, statusFilter]);

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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `user-avatars/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('project-avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('project-avatars')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Update local state
      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
      toast.success('Foto atualizada com sucesso!');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Erro ao fazer upload da foto');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleDeleteAccount = async () => {
    toast.error('Funcionalidade em desenvolvimento');
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    toast.success(`Tema ${newTheme === 'dark' ? 'escuro' : newTheme === 'light' ? 'claro' : 'do sistema'} ativado`);
  };

  const handleColorChange = (color: PrimaryColor) => {
    setPrimaryColor(color);
    if (color !== 'custom') {
      toast.success(`Cor ${COLOR_PRESETS[color].name} ativada`);
    }
  };

  const handleCustomColorChange = (hex: string) => {
    setCustomColor(hex);
    setPrimaryColor('custom');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-metric-positive" />;
      case 'partial':
        return <AlertCircle className="w-4 h-4 text-metric-warning" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-metric-negative" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      success: 'bg-metric-positive/10 text-metric-positive border-metric-positive/20',
      partial: 'bg-metric-warning/10 text-metric-warning border-metric-warning/20',
      error: 'bg-metric-negative/10 text-metric-negative border-metric-negative/20',
      running: 'bg-primary/10 text-primary border-primary/20',
    };

    const labels: Record<string, string> = {
      success: 'Sucesso',
      partial: 'Parcial',
      error: 'Erro',
      running: 'Em execução',
    };

    return (
      <Badge variant="outline" className={cn('font-medium', variants[status] || '')}>
        {labels[status] || status}
      </Badge>
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8 max-w-4xl">
          <SettingsSkeleton />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 animate-fade-in max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/30">
            <SettingsIcon className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Configurações</h1>
            <p className="text-muted-foreground">Gerencie sua conta e preferências</p>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="bg-card border border-border p-1 flex-wrap h-auto gap-1">
            <TabsTrigger value="profile" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <User className="w-4 h-4" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Bell className="w-4 h-4" />
              Notificações
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Shield className="w-4 h-4" />
              Segurança
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Palette className="w-4 h-4" />
              Aparência
            </TabsTrigger>
            <TabsTrigger value="sync-history" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <History className="w-4 h-4" />
              Histórico Sync
            </TabsTrigger>
            {!isGuest && (
              <TabsTrigger value="guests" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <UserPlus className="w-4 h-4" />
                Convidados
              </TabsTrigger>
            )}
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Informações do Perfil
                </CardTitle>
                <CardDescription>
                  Atualize suas informações pessoais
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar Section */}
                <div className="flex items-center gap-6 p-4 rounded-xl bg-muted/30 border border-border/50">
                  <div className="relative">
                    <Avatar className="w-20 h-20 ring-4 ring-primary/20">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback className="text-2xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground font-bold">
                        {fullName?.[0]?.toUpperCase() || user?.email?.[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg cursor-pointer">
                      {uploadingAvatar ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Camera className="w-4 h-4" />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                        disabled={uploadingAvatar}
                      />
                    </label>
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{fullName || 'Sem nome'}</p>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">Clique no ícone para alterar a foto</p>
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
                      className="bg-muted/30"
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
                        className="pl-10 bg-muted/50 text-muted-foreground"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      O e-mail não pode ser alterado
                    </p>
                  </div>

                  <Button onClick={handleSaveProfile} disabled={saving} className="w-fit gap-2">
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Salvar alterações
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-primary" />
                  Preferências de Notificação
                </CardTitle>
                <CardDescription>
                  Configure como você deseja receber notificações
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {[
                  { key: 'emailReports', title: 'Relatórios por e-mail', desc: 'Receba relatórios diários de performance' },
                  { key: 'emailAlerts', title: 'Alertas por e-mail', desc: 'Receba alertas importantes sobre suas campanhas' },
                  { key: 'browserNotifications', title: 'Notificações do navegador', desc: 'Receba notificações em tempo real' },
                  { key: 'weeklyDigest', title: 'Resumo semanal', desc: 'Receba um resumo semanal do desempenho' },
                  { key: 'roasAlerts', title: 'Alertas de ROAS', desc: 'Alerta quando o ROAS cair abaixo do esperado' },
                  { key: 'budgetAlerts', title: 'Alertas de orçamento', desc: 'Alerta quando o orçamento estiver acabando' },
                ].map((item, index) => (
                  <div 
                    key={item.key} 
                    className={`flex items-center justify-between py-4 ${index < 5 ? 'border-b border-border/50' : ''}`}
                  >
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch
                      checked={notifications[item.key as keyof NotificationSettings]}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, [item.key]: checked })
                      }
                    />
                  </div>
                ))}

                <div className="pt-4">
                  <Button onClick={() => toast.success('Preferências salvas!')} className="gap-2">
                    <Save className="w-4 h-4" />
                    Salvar preferências
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Segurança da Conta
                </CardTitle>
                <CardDescription>
                  Gerencie sua senha e segurança
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label>Nova senha</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="password" placeholder="Nova senha" className="pl-10 bg-muted/30" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Confirmar nova senha</Label>
                  <Input type="password" placeholder="Confirmar nova senha" className="bg-muted/30" />
                </div>

                <Button variant="outline" className="gap-2">
                  <Key className="w-4 h-4" />
                  Atualizar senha
                </Button>
              </CardContent>
            </Card>

            <Card className="glass-card border-destructive/30 bg-destructive/5">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <CardTitle className="text-destructive">Zona de perigo</CardTitle>
                    <CardDescription className="mt-1">
                      Ações irreversíveis que afetam sua conta permanentemente
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-6">
            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5 text-primary" />
                  Aparência
                </CardTitle>
                <CardDescription>
                  Personalize a aparência do sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Theme Selection */}
                <div>
                  <Label className="mb-4 block">Tema</Label>
                  <div className="grid grid-cols-3 gap-4 max-w-md">
                    <button 
                      onClick={() => handleThemeChange('dark')}
                      className={cn(
                        "group p-4 rounded-xl border-2 bg-card text-center transition-all hover:shadow-lg",
                        theme === 'dark' 
                          ? "border-primary hover:shadow-primary/20" 
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="w-full h-10 rounded-lg bg-zinc-900 border border-zinc-700 mb-3 flex items-center justify-center">
                        <Moon className="w-4 h-4 text-zinc-400" />
                      </div>
                      <span className="text-sm font-medium">Escuro</span>
                    </button>
                    <button 
                      onClick={() => handleThemeChange('light')}
                      className={cn(
                        "p-4 rounded-xl border-2 bg-card text-center transition-all hover:shadow-lg",
                        theme === 'light' 
                          ? "border-primary hover:shadow-primary/20" 
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="w-full h-10 rounded-lg bg-white border border-gray-200 mb-3 flex items-center justify-center">
                        <Sun className="w-4 h-4 text-amber-500" />
                      </div>
                      <span className="text-sm font-medium">Claro</span>
                    </button>
                    <button 
                      onClick={() => handleThemeChange('system')}
                      className={cn(
                        "p-4 rounded-xl border-2 bg-card text-center transition-all hover:shadow-lg",
                        theme === 'system' 
                          ? "border-primary hover:shadow-primary/20" 
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="w-full h-10 rounded-lg bg-gradient-to-r from-zinc-900 to-white border border-border mb-3 flex items-center justify-center">
                        <Monitor className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-medium">Sistema</span>
                    </button>
                  </div>
                </div>

                {/* Primary Color Selection */}
                <div>
                  <Label className="mb-4 block">Cor Primária</Label>
                  <div className="grid grid-cols-6 gap-3 max-w-lg">
                    {(Object.keys(COLOR_PRESETS) as Array<Exclude<PrimaryColor, 'custom'>>).map((color) => {
                      const preset = COLOR_PRESETS[color];
                      const bgColor = `hsl(${preset.hue}, ${preset.saturation}%, 50%)`;
                      return (
                        <button
                          key={color}
                          onClick={() => handleColorChange(color)}
                          className={cn(
                            "p-3 rounded-xl border-2 bg-card text-center transition-all hover:shadow-lg",
                            primaryColor === color
                              ? "border-foreground shadow-lg"
                              : "border-border hover:border-foreground/50"
                          )}
                        >
                          <div 
                            className="w-full h-10 rounded-lg mb-2"
                            style={{ backgroundColor: bgColor }}
                          />
                          <span className="text-xs font-medium">{preset.name}</span>
                        </button>
                      );
                    })}
                    
                    {/* Custom Color Picker */}
                    <button
                      onClick={() => handleColorChange('custom')}
                      className={cn(
                        "p-3 rounded-xl border-2 bg-card text-center transition-all hover:shadow-lg relative",
                        primaryColor === 'custom'
                          ? "border-foreground shadow-lg"
                          : "border-border hover:border-foreground/50"
                      )}
                    >
                      <div 
                        className="w-full h-10 rounded-lg mb-2 relative overflow-hidden"
                        style={{ 
                          background: primaryColor === 'custom' 
                            ? customColor 
                            : 'conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red)' 
                        }}
                      >
                        <input
                          type="color"
                          value={customColor}
                          onChange={(e) => handleCustomColorChange(e.target.value)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          title="Escolher cor personalizada"
                        />
                      </div>
                      <span className="text-xs font-medium">Custom</span>
                    </button>
                  </div>
                  
                  {primaryColor === 'custom' && (
                    <div className="mt-4 flex items-center gap-3 max-w-md">
                      <Label className="text-sm">Cor selecionada:</Label>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-8 h-8 rounded-lg border border-border"
                          style={{ backgroundColor: customColor }}
                        />
                        <Input
                          type="text"
                          value={customColor}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                              setCustomColor(value);
                              if (value.length === 7) {
                                setPrimaryColor('custom');
                              }
                            }
                          }}
                          className="w-28 font-mono text-sm bg-muted/30"
                          placeholder="#ef4444"
                        />
                      </div>
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground mt-3">
                    A cor primária será aplicada em todo o sistema
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sync History Tab */}
          <TabsContent value="sync-history" className="space-y-6">
            <Card className="glass-card border-border/50">
              <CardHeader>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <History className="w-5 h-5 text-primary" />
                      Histórico de Sincronização
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {selectedProject ? `Projeto: ${selectedProject.name}` : 'Selecione um projeto'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[160px]">
                        <Filter className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="Filtrar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="success">Sucesso</SelectItem>
                        <SelectItem value="partial">Parcial</SelectItem>
                        <SelectItem value="error">Erro</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={fetchLogs} disabled={logsLoading}>
                      <RefreshCw className={cn("w-4 h-4", logsLoading && "animate-spin")} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : logs.length === 0 ? (
                  <div className="py-12 text-center">
                    <History className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhum registro encontrado</h3>
                    <p className="text-muted-foreground text-sm">
                      Os logs de sincronização aparecerão aqui após as sincronizações.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {logs.map((log) => (
                      <div 
                        key={log.id} 
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        {getStatusIcon(log.status)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{formatDate(log.created_at)}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {log.message || 'Sem detalhes'}
                          </p>
                        </div>
                        {getStatusBadge(log.status)}
                      </div>
                    ))}
                  </div>
                )}

                {/* Summary */}
                {!logsLoading && logs.length > 0 && (
                  <div className="grid grid-cols-4 gap-3 mt-6 pt-6 border-t border-border/50">
                    <div className="text-center">
                      <p className="text-xl font-bold">{logs.length}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-metric-positive">
                        {logs.filter(l => l.status === 'success').length}
                      </p>
                      <p className="text-xs text-muted-foreground">Sucesso</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-metric-warning">
                        {logs.filter(l => l.status === 'partial').length}
                      </p>
                      <p className="text-xs text-muted-foreground">Parcial</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-metric-negative">
                        {logs.filter(l => l.status === 'error').length}
                      </p>
                      <p className="text-xs text-muted-foreground">Erros</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Guests Tab */}
          {!isGuest && selectedProjectId && (
            <TabsContent value="guests">
              <GuestsTab projectId={selectedProjectId} projectName={selectedProject?.name} />
            </TabsContent>
          )}

        </Tabs>
      </div>
    </DashboardLayout>
  );
}
