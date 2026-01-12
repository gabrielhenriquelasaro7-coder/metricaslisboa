import { useState, useEffect } from 'react';
import { 
  Settings2, 
  Target, 
  Handshake, 
  CheckCircle2,
  Loader2,
  Info,
  ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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

interface StagesMappingConfigProps {
  connectionId: string;
  stages: Stage[];
  currentMqlStages?: string[];
  currentSqlStages?: string[];
  onSave?: () => void;
}

export function StagesMappingConfig({
  connectionId,
  stages,
  currentMqlStages = [],
  currentSqlStages = [],
  onSave
}: StagesMappingConfigProps) {
  const [open, setOpen] = useState(false);
  const [mqlStages, setMqlStages] = useState<string[]>(currentMqlStages);
  const [sqlStages, setSqlStages] = useState<string[]>(currentSqlStages);
  const [isSaving, setIsSaving] = useState(false);

  // Filter only open stages (type 0) for configuration
  const openStages = stages.filter(s => s.type === 0).sort((a, b) => a.sort - b.sort);

  useEffect(() => {
    setMqlStages(currentMqlStages);
    setSqlStages(currentSqlStages);
  }, [currentMqlStages, currentSqlStages]);

  const handleMqlToggle = (stageId: string) => {
    // If adding to MQL, remove from SQL
    if (!mqlStages.includes(stageId)) {
      setMqlStages(prev => [...prev, stageId]);
      setSqlStages(prev => prev.filter(id => id !== stageId));
    } else {
      setMqlStages(prev => prev.filter(id => id !== stageId));
    }
  };

  const handleSqlToggle = (stageId: string) => {
    // If adding to SQL, remove from MQL
    if (!sqlStages.includes(stageId)) {
      setSqlStages(prev => [...prev, stageId]);
      setMqlStages(prev => prev.filter(id => id !== stageId));
    } else {
      setSqlStages(prev => prev.filter(id => id !== stageId));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('crm_connections')
        .update({
          mql_stage_ids: mqlStages.length > 0 ? mqlStages : null,
          sql_stage_ids: sqlStages.length > 0 ? sqlStages : null,
        })
        .eq('id', connectionId);

      if (error) throw error;

      toast.success('Mapeamento de etapas salvo!');
      setOpen(false);
      onSave?.();
    } catch (error) {
      console.error('Error saving stage mapping:', error);
      toast.error('Erro ao salvar configuração');
    } finally {
      setIsSaving(false);
    }
  };

  const getStageColor = (stageId: string) => {
    if (mqlStages.includes(stageId)) return 'border-cyan-500 bg-cyan-500/10';
    if (sqlStages.includes(stageId)) return 'border-purple-500 bg-purple-500/10';
    return 'border-border';
  };

  const hasCustomMapping = currentMqlStages.length > 0 || currentSqlStages.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="w-4 h-4" />
          <span className="hidden sm:inline">Configurar MQL/SQL</span>
          <span className="sm:hidden">MQL/SQL</span>
          {hasCustomMapping && (
            <Badge variant="secondary" className="ml-1 text-[10px] px-1">
              Configurado
            </Badge>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            Mapeamento de Etapas
          </DialogTitle>
          <DialogDescription>
            Defina quais etapas do seu CRM correspondem a MQL e SQL
          </DialogDescription>
        </DialogHeader>

        {/* Info Card */}
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong className="text-cyan-500">MQL (Marketing Qualified Lead):</strong> Leads que demonstraram interesse mas ainda não estão prontos para comprar.
                </p>
                <p>
                  <strong className="text-purple-500">SQL (Sales Qualified Lead):</strong> Leads qualificados prontos para abordagem comercial.
                </p>
                <p className="text-xs">
                  Etapas não marcadas serão consideradas como "Leads" no funil.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stages List */}
        <div className="space-y-3">
          <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
            <span className="flex-1">Etapa</span>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-1 text-cyan-500">
                <Target className="w-3.5 h-3.5" />
                MQL
              </div>
              <div className="flex items-center gap-1 text-purple-500">
                <Handshake className="w-3.5 h-3.5" />
                SQL
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {openStages.map((stage, index) => (
              <div
                key={stage.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                  getStageColor(stage.id)
                )}
              >
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: stage.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{stage.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {stage.leads_count} leads
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`mql-${stage.id}`}
                            checked={mqlStages.includes(stage.id)}
                            onCheckedChange={() => handleMqlToggle(stage.id)}
                            className="border-cyan-500 data-[state=checked]:bg-cyan-500"
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Marcar como MQL</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`sql-${stage.id}`}
                            checked={sqlStages.includes(stage.id)}
                            onCheckedChange={() => handleSqlToggle(stage.id)}
                            className="border-purple-500 data-[state=checked]:bg-purple-500"
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Marcar como SQL</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Preview */}
        <Card className="bg-gradient-to-r from-primary/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Prévia do Funil</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Leads ({openStages.length - mqlStages.length - sqlStages.length})
              </Badge>
              <ArrowRight className="w-3 h-3 text-muted-foreground" />
              <Badge variant="outline" className="gap-1 border-cyan-500/50 text-cyan-600">
                <Target className="w-3 h-3" />
                MQL ({mqlStages.length})
              </Badge>
              <ArrowRight className="w-3 h-3 text-muted-foreground" />
              <Badge variant="outline" className="gap-1 border-purple-500/50 text-purple-600">
                <Handshake className="w-3 h-3" />
                SQL ({sqlStages.length})
              </Badge>
              <ArrowRight className="w-3 h-3 text-muted-foreground" />
              <Badge variant="outline" className="gap-1 border-green-500/50 text-green-600">
                <CheckCircle2 className="w-3 h-3" />
                Vendas
              </Badge>
            </div>
          </CardContent>
        </Card>

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
