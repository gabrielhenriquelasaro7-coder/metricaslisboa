import { useState, useEffect } from 'react';
import { 
  Settings2, 
  Users, 
  Phone, 
  Calendar, 
  FileText, 
  CheckCircle2,
  Loader2,
  Info,
  GripVertical,
  Plus,
  Trash2,
  Target,
  Handshake,
  MessageCircle,
  Mail,
  Video,
  DollarSign
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Stage {
  id: string;
  name: string;
  color: string;
  sort: number;
  type: number;
  leads_count: number;
}

export interface FunnelCard {
  id: string;
  label: string;
  stage_ids: string[];
  icon: string;
  enabled: boolean;
  color: string;
}

interface FunnelCardsConfigProps {
  connectionId: string;
  stages: Stage[];
  currentConfig?: FunnelCard[];
  totalDeals?: number; // Total real de deals no CRM
  onSave?: () => void;
}

const ICON_OPTIONS = [
  { value: 'Users', label: 'Usuários', icon: Users },
  { value: 'Phone', label: 'Telefone', icon: Phone },
  { value: 'Calendar', label: 'Calendário', icon: Calendar },
  { value: 'FileText', label: 'Documento', icon: FileText },
  { value: 'CheckCircle2', label: 'Check', icon: CheckCircle2 },
  { value: 'Target', label: 'Alvo', icon: Target },
  { value: 'Handshake', label: 'Negócio', icon: Handshake },
  { value: 'MessageCircle', label: 'Mensagem', icon: MessageCircle },
  { value: 'Mail', label: 'Email', icon: Mail },
  { value: 'Video', label: 'Vídeo', icon: Video },
  { value: 'DollarSign', label: 'Dinheiro', icon: DollarSign },
];

const COLOR_OPTIONS = [
  { value: 'blue', label: 'Azul', class: 'bg-blue-500' },
  { value: 'cyan', label: 'Ciano', class: 'bg-cyan-500' },
  { value: 'purple', label: 'Roxo', class: 'bg-purple-500' },
  { value: 'green', label: 'Verde', class: 'bg-green-500' },
  { value: 'yellow', label: 'Amarelo', class: 'bg-yellow-500' },
  { value: 'orange', label: 'Laranja', class: 'bg-orange-500' },
  { value: 'pink', label: 'Rosa', class: 'bg-pink-500' },
];

const DEFAULT_CARDS: FunnelCard[] = [
  { id: 'leads', label: 'Leads Recebidos', stage_ids: [], icon: 'Users', enabled: true, color: 'blue' },
  { id: 'contacted', label: 'Leads Contatados', stage_ids: [], icon: 'Phone', enabled: true, color: 'cyan' },
  { id: 'meeting', label: 'Reunião Agendada', stage_ids: [], icon: 'Calendar', enabled: true, color: 'purple' },
  { id: 'proposal', label: 'Proposta Enviada', stage_ids: [], icon: 'FileText', enabled: true, color: 'orange' },
  { id: 'sales', label: 'Vendas', stage_ids: [], icon: 'CheckCircle2', enabled: true, color: 'green' },
];

export function getIconComponent(iconName: string) {
  const iconMap: Record<string, React.ElementType> = {
    Users, Phone, Calendar, FileText, CheckCircle2, Target, Handshake, MessageCircle, Mail, Video, DollarSign
  };
  return iconMap[iconName] || Users;
}

export function getColorClasses(color: string) {
  const colorMap: Record<string, { text: string; bg: string; bgLight: string }> = {
    blue: { text: 'text-blue-500', bg: 'bg-blue-500', bgLight: 'bg-blue-500/20' },
    cyan: { text: 'text-cyan-500', bg: 'bg-cyan-500', bgLight: 'bg-cyan-500/20' },
    purple: { text: 'text-purple-500', bg: 'bg-purple-500', bgLight: 'bg-purple-500/20' },
    green: { text: 'text-green-500', bg: 'bg-green-500', bgLight: 'bg-green-500/20' },
    yellow: { text: 'text-yellow-500', bg: 'bg-yellow-500', bgLight: 'bg-yellow-500/20' },
    orange: { text: 'text-orange-500', bg: 'bg-orange-500', bgLight: 'bg-orange-500/20' },
    pink: { text: 'text-pink-500', bg: 'bg-pink-500', bgLight: 'bg-pink-500/20' },
  };
  return colorMap[color] || colorMap.blue;
}

export function FunnelCardsConfig({
  connectionId,
  stages,
  currentConfig,
  totalDeals,
  onSave
}: FunnelCardsConfigProps) {
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState<FunnelCard[]>(currentConfig?.length ? currentConfig : DEFAULT_CARDS);
  const [isSaving, setIsSaving] = useState(false);
  const [editingCard, setEditingCard] = useState<string | null>(null);

  // Filter only open stages (type 0) for configuration
  const openStages = stages.filter(s => s.type === 0).sort((a, b) => a.sort - b.sort);

  useEffect(() => {
    if (currentConfig?.length) {
      setCards(currentConfig);
    }
  }, [currentConfig]);

  const handleToggleEnabled = (cardId: string) => {
    setCards(prev => prev.map(card => 
      card.id === cardId ? { ...card, enabled: !card.enabled } : card
    ));
  };

  const handleUpdateCard = (cardId: string, updates: Partial<FunnelCard>) => {
    setCards(prev => prev.map(card => 
      card.id === cardId ? { ...card, ...updates } : card
    ));
  };

  const handleToggleStage = (cardId: string, stageId: string) => {
    setCards(prev => prev.map(card => {
      if (card.id !== cardId) return card;
      
      const hasStage = card.stage_ids.includes(stageId);
      return {
        ...card,
        stage_ids: hasStage 
          ? card.stage_ids.filter(id => id !== stageId)
          : [...card.stage_ids, stageId]
      };
    }));
  };

  const handleAddCard = () => {
    const newId = `custom_${Date.now()}`;
    setCards(prev => [...prev, {
      id: newId,
      label: 'Nova Etapa',
      stage_ids: [],
      icon: 'Target',
      enabled: true,
      color: 'blue'
    }]);
    setEditingCard(newId);
  };

  const handleRemoveCard = (cardId: string) => {
    // Don't allow removing leads and sales
    if (cardId === 'leads' || cardId === 'sales') {
      toast.error('Esta etapa não pode ser removida');
      return;
    }
    setCards(prev => prev.filter(card => card.id !== cardId));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Convert cards to JSON-compatible format
      const configJson = JSON.parse(JSON.stringify(cards));
      
      const { error } = await supabase
        .from('crm_connections')
        .update({
          funnel_cards_config: configJson
        })
        .eq('id', connectionId);

      if (error) throw error;

      toast.success('Configuração do funil salva!');
      setOpen(false);
      onSave?.();
    } catch (error) {
      console.error('Error saving funnel config:', error);
      toast.error('Erro ao salvar configuração');
    } finally {
      setIsSaving(false);
    }
  };

  const getStagesForCard = (cardId: string) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return [];
    return openStages.filter(s => card.stage_ids.includes(s.id));
  };

  const getTotalLeadsForCard = (card: FunnelCard) => {
    if (card.id === 'leads') {
      // For leads card, use totalDeals from CRM stats (real total)
      // Fallback to sum of all stages if totalDeals not available
      return totalDeals ?? stages.reduce((sum, s) => sum + (s.leads_count || 0), 0);
    }
    if (card.id === 'sales') {
      // For sales, count won deals (type 1)
      return stages.filter(s => s.type === 1).reduce((sum, s) => sum + (s.leads_count || 0), 0);
    }
    // For other cards, count leads in selected stages
    return openStages
      .filter(s => card.stage_ids.includes(s.id))
      .reduce((sum, s) => sum + (s.leads_count || 0), 0);
  };

  const hasConfig = currentConfig && currentConfig.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="w-4 h-4" />
          <span className="hidden sm:inline">Configurar Cards</span>
          <span className="sm:hidden">Cards</span>
          {hasConfig && (
            <Badge variant="secondary" className="ml-1 text-[10px] px-1">
              Personalizado
            </Badge>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            Configurar Cards do Funil
          </DialogTitle>
          <DialogDescription>
            Personalize quais etapas aparecem no seu funil de vendas
          </DialogDescription>
        </DialogHeader>

        {/* Info Card */}
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p>
                  Configure quais cards aparecem no funil. Você pode habilitar/desabilitar etapas,
                  renomear, trocar ícones e associar às fases do seu CRM.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cards List */}
        <div className="space-y-3">
          {cards.map((card, index) => {
            const IconComponent = getIconComponent(card.icon);
            const colorClasses = getColorClasses(card.color);
            const isEditing = editingCard === card.id;
            const isFixed = card.id === 'leads' || card.id === 'sales';

            return (
              <Card 
                key={card.id} 
                className={cn(
                  'transition-all',
                  !card.enabled && 'opacity-50',
                  isEditing && 'ring-2 ring-primary'
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Drag Handle & Enable Toggle */}
                    <div className="flex flex-col items-center gap-2 pt-1">
                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                      <Switch
                        checked={card.enabled}
                        onCheckedChange={() => handleToggleEnabled(card.id)}
                        disabled={isFixed}
                        className="scale-75"
                      />
                    </div>

                    {/* Card Preview */}
                    <div className={cn('p-2 rounded-lg', colorClasses.bgLight)}>
                      <IconComponent className={cn('w-5 h-5', colorClasses.text)} />
                    </div>

                    {/* Card Content */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center justify-between">
                        {isEditing ? (
                          <Input
                            value={card.label}
                            onChange={(e) => handleUpdateCard(card.id, { label: e.target.value })}
                            className="h-8 w-48"
                            autoFocus
                            onBlur={() => setEditingCard(null)}
                            onKeyDown={(e) => e.key === 'Enter' && setEditingCard(null)}
                          />
                        ) : (
                          <button
                            onClick={() => !isFixed && setEditingCard(card.id)}
                            className="font-medium text-left hover:text-primary transition-colors"
                          >
                            {card.label}
                          </button>
                        )}
                        
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {getTotalLeadsForCard(card)} leads
                          </Badge>
                          {!isFixed && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveCard(card.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Icon & Color Selection */}
                      {!isFixed && (
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground">Ícone:</Label>
                            <Select
                              value={card.icon}
                              onValueChange={(value) => handleUpdateCard(card.id, { icon: value })}
                            >
                              <SelectTrigger className="h-8 w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ICON_OPTIONS.map(opt => {
                                  const OptIcon = opt.icon;
                                  return (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      <div className="flex items-center gap-2">
                                        <OptIcon className="w-4 h-4" />
                                        {opt.label}
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground">Cor:</Label>
                            <div className="flex gap-1">
                              {COLOR_OPTIONS.map(opt => (
                                <button
                                  key={opt.value}
                                  onClick={() => handleUpdateCard(card.id, { color: opt.value })}
                                  className={cn(
                                    'w-6 h-6 rounded-full transition-all',
                                    opt.class,
                                    card.color === opt.value && 'ring-2 ring-offset-2 ring-foreground'
                                  )}
                                  title={opt.label}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Stage Mapping */}
                      {!isFixed && openStages.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">
                            Etapas do CRM associadas:
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {openStages.map(stage => (
                              <button
                                key={stage.id}
                                onClick={() => handleToggleStage(card.id, stage.id)}
                                className={cn(
                                  'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border transition-all',
                                  card.stage_ids.includes(stage.id)
                                    ? 'bg-primary/10 border-primary text-primary'
                                    : 'bg-muted/50 border-border hover:border-primary/50'
                                )}
                              >
                                <div 
                                  className="w-2 h-2 rounded-full" 
                                  style={{ backgroundColor: stage.color }}
                                />
                                {stage.name}
                                {card.stage_ids.includes(stage.id) && (
                                  <CheckCircle2 className="w-3 h-3" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {isFixed && (
                        <p className="text-xs text-muted-foreground italic">
                          {card.id === 'leads' 
                            ? 'Total de leads (calculado automaticamente)' 
                            : 'Vendas fechadas (deals ganhos no CRM)'}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Add New Card */}
        <Button
          variant="outline"
          className="w-full gap-2 border-dashed"
          onClick={handleAddCard}
        >
          <Plus className="w-4 h-4" />
          Adicionar Etapa
        </Button>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Salvar Configuração
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}