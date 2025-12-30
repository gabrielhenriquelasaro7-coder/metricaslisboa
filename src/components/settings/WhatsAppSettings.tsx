import { useState, useEffect } from 'react';
import { useWhatsAppSubscription } from '@/hooks/useWhatsAppSubscription';
import { useProjects } from '@/hooks/useProjects';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  MessageSquare, 
  Loader2, 
  Save, 
  Send, 
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
];

const TIME_OPTIONS = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
];

function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  
  if (digits.length <= 2) {
    return `(${digits}`;
  }
  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export default function WhatsAppSettings() {
  const { 
    subscription, 
    messageLogs, 
    loading, 
    saving, 
    sendingTest,
    saveSubscription, 
    deleteSubscription,
    sendTestReport 
  } = useWhatsAppSubscription();
  
  const { projects } = useProjects();
  const activeProjects = projects.filter(p => !p.archived);

  // Form state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [weeklyReportEnabled, setWeeklyReportEnabled] = useState(true);
  const [reportDayOfWeek, setReportDayOfWeek] = useState(1);
  const [reportTime, setReportTime] = useState('08:00');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form from subscription
  useEffect(() => {
    if (subscription) {
      setPhoneNumber(formatPhoneNumber(subscription.phone_number));
      setWeeklyReportEnabled(subscription.weekly_report_enabled);
      setReportDayOfWeek(subscription.report_day_of_week);
      setReportTime(subscription.report_time?.slice(0, 5) || '08:00');
      setSelectedProjects(subscription.projects_to_report || []);
    }
  }, [subscription]);

  // Track changes
  useEffect(() => {
    if (!subscription) {
      setHasChanges(phoneNumber.length > 0);
      return;
    }

    const phoneChanged = phoneNumber.replace(/\D/g, '') !== subscription.phone_number.replace(/\D/g, '');
    const enabledChanged = weeklyReportEnabled !== subscription.weekly_report_enabled;
    const dayChanged = reportDayOfWeek !== subscription.report_day_of_week;
    const timeChanged = reportTime !== subscription.report_time?.slice(0, 5);
    const projectsChanged = JSON.stringify(selectedProjects.sort()) !== 
      JSON.stringify((subscription.projects_to_report || []).sort());

    setHasChanges(phoneChanged || enabledChanged || dayChanged || timeChanged || projectsChanged);
  }, [subscription, phoneNumber, weeklyReportEnabled, reportDayOfWeek, reportTime, selectedProjects]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  const handleProjectToggle = (projectId: string) => {
    setSelectedProjects(prev => 
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const handleSave = () => {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return;
    }

    saveSubscription({
      phone_number: cleanPhone,
      weekly_report_enabled: weeklyReportEnabled,
      report_day_of_week: reportDayOfWeek,
      report_time: reportTime,
      projects_to_report: selectedProjects,
    });
  };

  const getStatusBadge = (status: string) => {
    if (status === 'sent') {
      return (
        <Badge variant="outline" className="bg-metric-positive/10 text-metric-positive border-metric-positive/20">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Enviado
        </Badge>
      );
    }
    if (status === 'failed') {
      return (
        <Badge variant="outline" className="bg-metric-negative/10 text-metric-negative border-metric-negative/20">
          <XCircle className="w-3 h-3 mr-1" />
          Falhou
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-muted text-muted-foreground">
        <Clock className="w-3 h-3 mr-1" />
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Configuration Card */}
      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-green-500" />
            Relatório Semanal via WhatsApp
          </CardTitle>
          <CardDescription>
            Receba um resumo semanal do desempenho das suas campanhas diretamente no WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Phone Number */}
          <div className="space-y-2">
            <Label htmlFor="phone">Número do WhatsApp</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(11) 99999-9999"
              value={phoneNumber}
              onChange={handlePhoneChange}
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              Digite seu número com DDD
            </p>
          </div>

          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
            <div className="space-y-0.5">
              <Label htmlFor="weekly-report">Relatório semanal ativado</Label>
              <p className="text-sm text-muted-foreground">
                Receba um resumo toda semana no horário configurado
              </p>
            </div>
            <Switch
              id="weekly-report"
              checked={weeklyReportEnabled}
              onCheckedChange={setWeeklyReportEnabled}
            />
          </div>

          {/* Schedule */}
          {weeklyReportEnabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Dia da semana</Label>
                <Select
                  value={reportDayOfWeek.toString()}
                  onValueChange={(v) => setReportDayOfWeek(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map(day => (
                      <SelectItem key={day.value} value={day.value.toString()}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Horário</Label>
                <Select
                  value={reportTime}
                  onValueChange={setReportTime}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map(time => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Project Selection */}
          <div className="space-y-3">
            <Label>Projetos para incluir no relatório</Label>
            <p className="text-sm text-muted-foreground">
              Deixe vazio para incluir todos os projetos
            </p>
            <div className="grid gap-2 max-h-48 overflow-y-auto p-1">
              {activeProjects.map(project => (
                <div
                  key={project.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border border-border/50 cursor-pointer transition-colors",
                    selectedProjects.includes(project.id)
                      ? "bg-primary/10 border-primary/30"
                      : "bg-muted/30 hover:bg-muted/50"
                  )}
                  onClick={() => handleProjectToggle(project.id)}
                >
                  <Checkbox
                    checked={selectedProjects.includes(project.id)}
                    onCheckedChange={() => handleProjectToggle(project.id)}
                  />
                  <span className="font-medium">{project.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-border/50">
            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges || phoneNumber.replace(/\D/g, '').length < 10}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar
            </Button>

            <Button
              variant="outline"
              onClick={sendTestReport}
              disabled={sendingTest || !subscription}
            >
              {sendingTest ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Enviar Teste
            </Button>

            {subscription && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remover
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover configuração?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso irá desativar o envio de relatórios semanais para seu WhatsApp.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={deleteSubscription}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Message History */}
      {subscription && messageLogs.length > 0 && (
        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="w-5 h-5 text-primary" />
              Histórico de Mensagens
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {messageLogs.map(log => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize">
                        {log.message_type === 'weekly_report' ? 'Relatório Semanal' : 'Teste'}
                      </span>
                      {getStatusBadge(log.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                    {log.error_message && (
                      <p className="text-sm text-destructive">{log.error_message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="glass-card border-border/50 bg-muted/20">
        <CardContent className="pt-6">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>📊 <strong>O que o relatório inclui:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Investimento total da semana</li>
              <li>Número de leads gerados</li>
              <li>CPL (Custo por Lead) com comparativo</li>
              <li>Impressões e cliques</li>
              <li>CTR e ROAS</li>
            </ul>
            <p className="pt-2">
              💡 <strong>Dica:</strong> Configure para receber na segunda-feira para ter o resumo da semana anterior.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
