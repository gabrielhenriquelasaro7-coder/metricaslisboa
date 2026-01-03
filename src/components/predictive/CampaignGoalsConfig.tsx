import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Settings2, Save, Trash2 } from 'lucide-react';
import { useCampaignGoals, CampaignGoalData } from '@/hooks/useCampaignGoals';

interface Campaign {
  campaignId: string;
  campaignName: string;
  spend: number;
}

interface CampaignGoalsConfigProps {
  projectId: string;
  campaigns: Campaign[];
  businessModel: string;
  onGoalsSaved: () => void;
}

export function CampaignGoalsConfig({ projectId, campaigns, businessModel, onGoalsSaved }: CampaignGoalsConfigProps) {
  const { goals, saveGoal, deleteGoal, getGoalForCampaign } = useCampaignGoals(projectId);
  const [open, setOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<string | null>(null);
  const [targetCpl, setTargetCpl] = useState<string>('');
  const [targetRoas, setTargetRoas] = useState<string>('');

  // Inside Sales e Custom usam CPL/Leads
  // E-commerce e PDV usam ROAS/Receita
  const showCPL = businessModel === 'inside_sales' || businessModel === 'custom';
  const showROAS = businessModel === 'ecommerce' || businessModel === 'pdv';

  const handleEdit = (campaign: Campaign) => {
    const existing = getGoalForCampaign(campaign.campaignId);
    setEditingCampaign(campaign.campaignId);
    setTargetCpl(existing?.target_cpl?.toString() || '');
    setTargetRoas(existing?.target_roas?.toString() || '');
  };

  const handleSave = async (campaign: Campaign) => {
    const cpl = targetCpl ? parseFloat(targetCpl) : null;
    const roas = targetRoas ? parseFloat(targetRoas) : null;
    
    await saveGoal(campaign.campaignId, campaign.campaignName, cpl, roas);
    setEditingCampaign(null);
    setTargetCpl('');
    setTargetRoas('');
    onGoalsSaved();
  };

  const handleDelete = async (campaignId: string) => {
    await deleteGoal(campaignId);
    onGoalsSaved();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const sortedCampaigns = [...campaigns].sort((a, b) => b.spend - a.spend);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="w-4 h-4" />
          Configurar Metas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Metas Personalizadas por Campanha</DialogTitle>
          <DialogDescription>
            Defina metas de {showCPL ? 'CPL (Custo por Lead)' : 'ROAS (Retorno sobre Investimento)'} para cada campanha.
            Campanhas sem meta usarão os valores padrão.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          {sortedCampaigns.map((campaign) => {
            const existingGoal = getGoalForCampaign(campaign.campaignId);
            const isEditing = editingCampaign === campaign.campaignId;
            
            return (
              <div key={campaign.campaignId} className="p-4 rounded-lg border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium truncate max-w-[350px]">{campaign.campaignName}</p>
                    <p className="text-sm text-muted-foreground">
                      Investimento: {formatCurrency(campaign.spend)}
                    </p>
                  </div>
                  {existingGoal && !isEditing && (
                    <Badge variant="secondary">Meta definida</Badge>
                  )}
                </div>
                
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid gap-4 grid-cols-1">
                      {showCPL && (
                        <div className="space-y-2">
                          <Label htmlFor={`cpl-${campaign.campaignId}`}>Meta CPL (R$)</Label>
                          <Input
                            id={`cpl-${campaign.campaignId}`}
                            type="number"
                            step="0.01"
                            placeholder="Ex: 30.00"
                            value={targetCpl}
                            onChange={(e) => setTargetCpl(e.target.value)}
                          />
                        </div>
                      )}
                      {showROAS && (
                        <div className="space-y-2">
                          <Label htmlFor={`roas-${campaign.campaignId}`}>Meta ROAS (x)</Label>
                          <Input
                            id={`roas-${campaign.campaignId}`}
                            type="number"
                            step="0.1"
                            placeholder="Ex: 3.0"
                            value={targetRoas}
                            onChange={(e) => setTargetRoas(e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSave(campaign)} className="gap-1">
                        <Save className="w-3 h-3" />
                        Salvar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingCampaign(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      {showCPL && (
                        <span>
                          CPL: {existingGoal?.target_cpl 
                            ? formatCurrency(existingGoal.target_cpl) 
                            : <span className="text-muted-foreground/50">Padrão (R$ 30)</span>
                          }
                        </span>
                      )}
                      {showROAS && (
                        <span>
                          ROAS: {existingGoal?.target_roas 
                            ? `${existingGoal.target_roas}x` 
                            : <span className="text-muted-foreground/50">Padrão (3x)</span>
                          }
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(campaign)}>
                        Editar
                      </Button>
                      {existingGoal && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(campaign.campaignId)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          
          {sortedCampaigns.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma campanha encontrada com dados nos últimos 30 dias.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
