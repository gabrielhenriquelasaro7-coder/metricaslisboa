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


interface SyncLog {
  id: string;
  project_id: string;
  status: string;
  message: string | null;
  created_at: string;
}

type Theme = 'dark' | 'light';

export default function Settings() {
  const { user, signOut } = useAuth();
  const { projects } = useProjects();
  const { isGuest } = useUserRole();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [fullName, setFullName] = useState('');
  
  // Theme state
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme') as Theme;
    return (stored === 'light' || stored === 'dark') ? stored : 'dark';
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
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

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
    toast.success(`Tema ${newTheme === 'dark' ? 'escuro' : 'claro'} ativado`);
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
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 animate-fade-in max-w-4xl overflow-x-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/30 flex-shrink-0">
            <SettingsIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Configurações</h1>
            <p className="text-muted-foreground text-sm">Gerencie sua conta e preferências</p>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-4 sm:space-y-6">
          <TabsList className="bg-card border border-border p-1 flex flex-wrap h-auto gap-1 w-full overflow-x-auto scrollbar-hide">
            <TabsTrigger value="profile" className="gap-1 sm:gap-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-shrink-0 px-2 sm:px-3">
              <User className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Perfil</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-1 sm:gap-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-shrink-0 px-2 sm:px-3">
              <Shield className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Segurança</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-1 sm:gap-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-shrink-0 px-2 sm:px-3">
              <Palette className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Aparência</span>
            </TabsTrigger>
            <TabsTrigger value="sync-history" className="gap-1 sm:gap-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-shrink-0 px-2 sm:px-3">
              <History className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Histórico</span>
            </TabsTrigger>
            {!isGuest && (
              <TabsTrigger value="guests" className="gap-1 sm:gap-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-shrink-0 px-2 sm:px-3">
                <UserPlus className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Convidados</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4 sm:space-y-6">
            <Card className="glass-card border-border/50">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Informações do Perfil
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Atualize suas informações pessoais
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 space-y-4 sm:space-y-6">
                {/* Avatar Section */}
                <div className="flex items-center gap-4 sm:gap-6 p-3 sm:p-4 rounded-xl bg-muted/30 border border-border/50">
                  <div className="relative flex-shrink-0">
                    <Avatar className="w-16 h-16 sm:w-20 sm:h-20 ring-4 ring-primary/20">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback className="text-xl sm:text-2xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground font-bold">
                        {fullName?.[0]?.toUpperCase() || user?.email?.[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <label className="absolute bottom-0 right-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg cursor-pointer">
                      {uploadingAvatar ? (
                        <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                      ) : (
                        <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
                  <div className="min-w-0">
                    <p className="font-semibold text-base sm:text-lg truncate">{fullName || 'Sem nome'}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{user?.email}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Clique no ícone para alterar</p>
                  </div>
                </div>

                {/* Form */}
                <div className="grid gap-3 sm:gap-4 w-full max-w-md">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="fullName" className="text-xs sm:text-sm">Nome completo</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Seu nome"
                      className="bg-muted/30 h-10 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="email" className="text-xs sm:text-sm">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        value={user?.email || ''}
                        disabled
                        className="pl-9 sm:pl-10 bg-muted/50 text-muted-foreground h-10 text-sm"
                      />
                    </div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                      O e-mail não pode ser alterado
                    </p>
                  </div>

                  <Button onClick={handleSaveProfile} disabled={saving} className="w-full sm:w-fit gap-2 h-10 text-sm">
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Salvar
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>


          {/* Security Tab */}
          <TabsContent value="security" className="space-y-4 sm:space-y-6">
            <Card className="glass-card border-border/50">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Segurança
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Gerencie sua senha e segurança
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 space-y-3 sm:space-y-4 max-w-md">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-xs sm:text-sm">Nova senha</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
                    <Input type="password" placeholder="Nova senha" className="pl-9 sm:pl-10 bg-muted/30 h-10 text-sm" />
                  </div>
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-xs sm:text-sm">Confirmar senha</Label>
                  <Input type="password" placeholder="Confirmar nova senha" className="bg-muted/30 h-10 text-sm" />
                </div>

                <Button variant="outline" className="gap-2 h-10 text-sm w-full sm:w-auto">
                  <Key className="w-4 h-4" />
                  Atualizar senha
                </Button>
              </CardContent>
            </Card>

            <Card className="glass-card border-destructive/30 bg-destructive/5">
              <CardHeader className="p-4 sm:p-6">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-destructive/20 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
                  </div>
                  <div>
                    <CardTitle className="text-destructive text-base sm:text-lg">Zona de perigo</CardTitle>
                    <CardDescription className="mt-1 text-xs sm:text-sm">
                      Ações irreversíveis
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="gap-2 h-10 text-sm w-full sm:w-auto">
                      <Trash2 className="w-4 h-4" />
                      Excluir conta
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-base sm:text-lg">Excluir conta permanentemente?</AlertDialogTitle>
                      <AlertDialogDescription className="text-xs sm:text-sm">
                        Esta ação não pode ser desfeita. Todos os seus dados serão excluídos.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                      <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAccount}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto"
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-4 sm:space-y-6">
            <Card className="glass-card border-border/50">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Palette className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Aparência
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Escolha o tema do sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                {/* Theme Selection */}
                <div>
                  <Label className="mb-3 sm:mb-4 block text-sm">Tema</Label>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-sm">
                    <button 
                      onClick={() => handleThemeChange('dark')}
                      className={cn(
                        "group p-3 sm:p-4 rounded-xl border-2 bg-card text-center transition-all hover:shadow-lg touch-target",
                        theme === 'dark' 
                          ? "border-primary hover:shadow-primary/20" 
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="w-full h-10 sm:h-12 rounded-lg bg-zinc-900 border border-zinc-700 mb-2 sm:mb-3 flex items-center justify-center">
                        <Moon className="w-5 h-5 sm:w-6 sm:h-6 text-zinc-400" />
                      </div>
                      <span className="text-sm font-medium">Escuro</span>
                    </button>
                    <button 
                      onClick={() => handleThemeChange('light')}
                      className={cn(
                        "p-3 sm:p-4 rounded-xl border-2 bg-card text-center transition-all hover:shadow-lg touch-target",
                        theme === 'light' 
                          ? "border-primary hover:shadow-primary/20" 
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="w-full h-10 sm:h-12 rounded-lg bg-white border border-gray-200 mb-2 sm:mb-3 flex items-center justify-center">
                        <Sun className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
                      </div>
                      <span className="text-sm font-medium">Claro</span>
                    </button>
                  </div>
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
