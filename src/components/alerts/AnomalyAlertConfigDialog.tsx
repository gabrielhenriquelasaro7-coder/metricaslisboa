import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  Bell, 
  AlertTriangle, 
  TrendingDown, 
  DollarSign, 
  Pause,
  MessageSquare,
  Loader2,
  Info
} from 'lucide-react';
import { useAnomalyAlertConfig, AnomalyAlertConfig } from '@/hooks/useAnomalyAlertConfig';
import { useWhatsAppInstances } from '@/hooks/useWhatsAppInstances';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AnomalyAlertConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
}

export function AnomalyAlertConfigDialog({
  open,
  onOpenChange,
  projectId,
}: AnomalyAlertConfigDialogProps) {
  const { config, loading, saving, saveConfig } = useAnomalyAlertConfig(projectId);
  const { instances } = useWhatsAppInstances(projectId);
  
  // Form state
  const [enabled, setEnabled] = useState(false);
  const [instanceId, setInstanceId] = useState<string>('');
  const [targetType, setTargetType] = useState<'phone' | 'group'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [ctrDropThreshold, setCtrDropThreshold] = useState(20);
  const [cplIncreaseThreshold, setCplIncreaseThreshold] = useState(30);
  const [campaignPausedAlert, setCampaignPausedAlert] = useState(true);
  const [adSetPausedAlert, setAdSetPausedAlert] = useState(true);
  const [adPausedAlert, setAdPausedAlert] = useState(false);
  const [budgetChangeAlert, setBudgetChangeAlert] = useState(true);

  // Load config into form when it changes
  useEffect(() => {
    if (config) {
      setEnabled(config.enabled);
      setInstanceId(config.instance_id || '');
      setTargetType(config.target_type as 'phone' | 'group');
      setPhoneNumber(config.phone_number || '');
      setCtrDropThreshold(config.ctr_drop_threshold || 20);
      setCplIncreaseThreshold(config.cpl_increase_threshold || 30);
      setCampaignPausedAlert(config.campaign_paused_alert);
      setAdSetPausedAlert(config.ad_set_paused_alert);
      setAdPausedAlert(config.ad_paused_alert);
      setBudgetChangeAlert(config.budget_change_alert);
    }
  }, [config]);

  const handleSave = async () => {
    if (enabled && !instanceId) {
      toast.error('Selecione uma instância WhatsApp');
      return;
    }
    
    if (enabled && targetType === 'phone' && !phoneNumber) {
      toast.error('Informe o número de telefone');
      return;
    }

    const success = await saveConfig({
      enabled,
      instance_id: instanceId || null,
      target_type: targetType,
      phone_number: targetType === 'phone' ? phoneNumber : null,
      ctr_drop_threshold: ctrDropThreshold,
      cpl_increase_threshold: cplIncreaseThreshold,
      campaign_paused_alert: campaignPausedAlert,
      ad_set_paused_alert: adSetPausedAlert,
      ad_paused_alert: adPausedAlert,
      budget_change_alert: budgetChangeAlert,
    });

    if (success) {
      toast.success('Configuração salva com sucesso!');
      onOpenChange(false);
    } else {
      toast.error('Erro ao salvar configuração');
    }
  };

  const connectedInstances = instances.filter(i => i.instance_status === 'connected');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Alertas de Anomalias
          </DialogTitle>
          <DialogDescription>
            Configure alertas automáticos via WhatsApp para detectar problemas nas campanhas
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Enable/Disable */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-full",
                  enabled ? "bg-metric-positive/20" : "bg-muted"
                )}>
                  <Bell className={cn(
                    "w-5 h-5",
                    enabled ? "text-metric-positive" : "text-muted-foreground"
                  )} />
                </div>
                <div>
                  <p className="font-medium">Alertas Ativados</p>
                  <p className="text-sm text-muted-foreground">
                    Receba notificações de anomalias
                  </p>
                </div>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            {enabled && (
              <>
                <Separator />

                {/* WhatsApp Instance */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Instância WhatsApp
                  </Label>
                  {connectedInstances.length === 0 ? (
                    <div className="p-3 bg-metric-warning/10 rounded-lg text-sm text-metric-warning flex items-start gap-2">
                      <Info className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>Nenhuma instância WhatsApp conectada. Conecte uma instância na página WhatsApp primeiro.</span>
                    </div>
                  ) : (
                    <Select value={instanceId} onValueChange={setInstanceId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma instância" />
                      </SelectTrigger>
                      <SelectContent>
                        {connectedInstances.map(instance => (
                          <SelectItem key={instance.id} value={instance.id}>
                            {instance.display_name} ({instance.phone_connected})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Phone Number */}
                <div className="space-y-3">
                  <Label>Número para Alertas</Label>
                  <Input
                    placeholder="5511999999999"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Formato: código do país + DDD + número (sem espaços)
                  </p>
                </div>

                <Separator />

                {/* Thresholds */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-metric-warning" />
                    Limites de Alerta
                  </h4>

                  {/* CTR Drop */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-metric-negative" />
                        Queda de CTR
                      </Label>
                      <Badge variant="secondary">{ctrDropThreshold}%</Badge>
                    </div>
                    <Slider
                      value={[ctrDropThreshold]}
                      onValueChange={([v]) => setCtrDropThreshold(v)}
                      min={5}
                      max={50}
                      step={5}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Alertar quando o CTR cair mais de {ctrDropThreshold}% em relação à média
                    </p>
                  </div>

                  {/* CPL Increase */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-metric-negative" />
                        Aumento de CPL
                      </Label>
                      <Badge variant="secondary">{cplIncreaseThreshold}%</Badge>
                    </div>
                    <Slider
                      value={[cplIncreaseThreshold]}
                      onValueChange={([v]) => setCplIncreaseThreshold(v)}
                      min={10}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Alertar quando o CPL aumentar mais de {cplIncreaseThreshold}% em relação à média
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Status Change Alerts */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Pause className="w-4 h-4 text-muted-foreground" />
                    Alertas de Mudança de Status
                  </h4>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Campanha Pausada</p>
                        <p className="text-xs text-muted-foreground">Alertar quando uma campanha for pausada</p>
                      </div>
                      <Switch checked={campaignPausedAlert} onCheckedChange={setCampaignPausedAlert} />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Conjunto Pausado</p>
                        <p className="text-xs text-muted-foreground">Alertar quando um conjunto for pausado</p>
                      </div>
                      <Switch checked={adSetPausedAlert} onCheckedChange={setAdSetPausedAlert} />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Anúncio Pausado</p>
                        <p className="text-xs text-muted-foreground">Alertar quando um anúncio for pausado</p>
                      </div>
                      <Switch checked={adPausedAlert} onCheckedChange={setAdPausedAlert} />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Mudança de Orçamento</p>
                        <p className="text-xs text-muted-foreground">Alertar quando o orçamento for alterado</p>
                      </div>
                      <Switch checked={budgetChangeAlert} onCheckedChange={setBudgetChangeAlert} />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
