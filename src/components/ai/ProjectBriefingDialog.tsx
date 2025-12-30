import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, FileText, Lightbulb } from 'lucide-react';

interface ProjectBriefingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  initialBriefing?: string | null;
  onSaved?: () => void;
}

const BRIEFING_TEMPLATE = `📍 MERCADO E LOCALIZAÇÃO
- País/região de atuação: 
- Idioma do público-alvo: 
- Moeda utilizada nos anúncios: 

🎯 OBJETIVO PRINCIPAL
- Objetivo das campanhas (leads, vendas, awareness): 
- Meta de custo por resultado (CPL/CPA): 
- Meta de ROAS (se e-commerce): 

📊 MÉTRICAS ESPERADAS
- CPM aceitável para este mercado: 
- CPC médio esperado: 
- Taxa de conversão esperada: 

💼 CONTEXTO DO NEGÓCIO
- Tipo de produto/serviço: 
- Ticket médio: 
- Sazonalidade importante: 

📝 OBSERVAÇÕES ADICIONAIS
- Outras informações relevantes para análise:`;

export function ProjectBriefingDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  initialBriefing,
  onSaved,
}: ProjectBriefingDialogProps) {
  const [briefing, setBriefing] = useState(initialBriefing || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBriefing(initialBriefing || '');
  }, [initialBriefing, open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({ ai_briefing: briefing || null })
        .eq('id', projectId);

      if (error) throw error;

      toast.success('Briefing salvo com sucesso!');
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving briefing:', error);
      toast.error('Erro ao salvar briefing');
    } finally {
      setSaving(false);
    }
  };

  const handleUseTemplate = () => {
    setBriefing(BRIEFING_TEMPLATE);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Briefing do Projeto
          </DialogTitle>
          <DialogDescription>
            Configure o contexto do projeto <strong>{projectName}</strong> para que o Agente Lisboa faça análises mais precisas e personalizadas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <Lightbulb className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Por que configurar o briefing?</p>
              <p>O Agente Lisboa usa essas informações para entender o contexto específico do seu projeto. Por exemplo, um CPM de $30 pode ser alto para o Brasil, mas normal para os Estados Unidos.</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="briefing">Briefing Estratégico</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleUseTemplate}
                className="text-xs"
              >
                Usar template
              </Button>
            </div>
            <Textarea
              id="briefing"
              value={briefing}
              onChange={(e) => setBriefing(e.target.value)}
              placeholder="Descreva o contexto do projeto: país de atuação, metas de performance, métricas esperadas, particularidades do negócio..."
              className="min-h-[300px] resize-none font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Quanto mais detalhado o briefing, mais precisas serão as análises do Agente Lisboa.
            </p>
          </div>
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Briefing'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
