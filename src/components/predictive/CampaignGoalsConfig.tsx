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
  const [targetCtr, setTargetCtr] = useState<string>('');
  const [maxCpc, setMaxCpc] = useState<string>('');
  const [targetLeads, setTargetLeads] = useState<string>('');

  // ROAS: ecommerce e custom
  // CPL: inside_sales, custom e pdv
  const showCPL = businessModel === 'inside_sales' || businessModel === 'custom' || businessModel === 'pdv';
  const showROAS = businessModel === 'ecommerce' || businessModel === 'custom';

  const handleEdit = (campaign: Campaign) => {
    const existing = getGoalForCampaign(campaign.campaignId);
    setEditingCampaign(campaign.campaignId);
    setTargetCpl(existing?.target_cpl?.toString() || '');
    setTargetRoas(existing?.target_roas?.toString() || '');
    setTargetCtr(existing?.target_ctr?.toString() || '');
    setMaxCpc(existing?.max_cpc?.toString() || '');
    setTargetLeads(existing?.target_leads?.toString() || '');
  };

  const handleSave = async (campaign: Campaign) => {
    const cpl = targetCpl ? parseFloat(targetCpl) : null;
    const roas = targetRoas ? parseFloat(targetRoas) : null;
    const ctr = targetCtr ? parseFloat(targetCtr) : null;
    const cpc = maxCpc ? parseFloat(maxCpc) : null;
    const leads = targetLeads ? parseInt(targetLeads) : null;
    
    await saveGoal(campaign.campaignId, campaign.campaignName, cpl, roas, ctr, cpc, leads);
    setEditingCampaign(null);
    resetForm();
    onGoalsSaved();
  };

  const resetForm = () => {
    setTargetCpl('');
    setTargetRoas('');
    setTargetCtr('');
    setMaxCpc('');
    setTargetLeads('');
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

  const getMetricSummary = (goal: CampaignGoalData | undefined) => {
    const parts: string[] = [];
    if (showCPL && goal?.target_cpl) parts.push(`CPL: ${formatCurrency(goal.target_cpl)}`);
    if (showROAS && goal?.target_roas) parts.push(`ROAS: ${goal.target_roas}x`);
    if (goal?.target_ctr) parts.push(`CTR: ${goal.target_ctr}%`);
    if (goal?.max_cpc) parts.push(`CPC máx: ${formatCurrency(goal.max_cpc)}`);
    if (goal?.target_leads) parts.push(`Leads: ${goal.target_leads}`);
    return parts;
  };

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
            Defina metas de performance para cada campanha. 
            {showCPL && ' CPL (Custo por Lead)'}
            {showCPL && showROAS && ','}
            {showROAS && ' ROAS (Retorno sobre Investimento)'}
            , CTR, CPC máximo e leads alvo.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          {sortedCampaigns.map((campaign) => {
            const existingGoal = getGoalForCampaign(campaign.campaignId);
            const isEditing = editingCampaign === campaign.campaignId;
            const metricSummary = getMetricSummary(existingGoal);
            
            return (
              <div key={campaign.campaignId} className="p-4 rounded-lg border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium truncate max-w-[350px]">{campaign.campaignName}</p>
                    <p className="text-sm text-muted-foreground">
                      Investimento: {formatCurrency(campaign.spend)}
                    </p>
                  </div>
                  {existingGoal && !isEditing && metricSummary.length > 0 && (
                    <Badge variant="secondary">Meta definida</Badge>
                  )}
                </div>
                
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 grid-cols-2">
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
                      <div className="space-y-2">
                        <Label htmlFor={`ctr-${campaign.campaignId}`}>CTR Alvo (%)</Label>
                        <Input
                          id={`ctr-${campaign.campaignId}`}
                          type="number"
                          step="0.01"
                          placeholder="Ex: 1.5"
                          value={targetCtr}
                          onChange={(e) => setTargetCtr(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`cpc-${campaign.campaignId}`}>CPC Máximo (R$)</Label>
                        <Input
                          id={`cpc-${campaign.campaignId}`}
                          type="number"
                          step="0.01"
                          placeholder="Ex: 2.50"
                          value={maxCpc}
                          onChange={(e) => setMaxCpc(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor={`leads-${campaign.campaignId}`}>Leads Alvo (mensal)</Label>
                        <Input
                          id={`leads-${campaign.campaignId}`}
                          type="number"
                          step="1"
                          placeholder="Ex: 100"
                          value={targetLeads}
                          onChange={(e) => setTargetLeads(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSave(campaign)} className="gap-1">
                        <Save className="w-3 h-3" />
                        Salvar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setEditingCampaign(null);
                        resetForm();
                      }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      {metricSummary.length > 0 ? (
                        metricSummary.map((metric, i) => (
                          <span key={i}>{metric}</span>
                        ))
                      ) : (
                        <span className="text-muted-foreground/50">Nenhuma meta definida</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(campaign)}>
                        {existingGoal ? 'Editar' : 'Definir'}
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