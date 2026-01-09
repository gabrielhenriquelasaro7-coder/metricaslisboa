import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Target, Save, Trash2, TrendingUp, DollarSign, Users, Percent } from 'lucide-react';
import { useAccountGoals } from '@/hooks/useAccountGoals';

interface AccountGoalsConfigProps {
  projectId: string;
  businessModel: string;
  onGoalsSaved: () => void;
}

export function AccountGoalsConfig({ projectId, businessModel, onGoalsSaved }: AccountGoalsConfigProps) {
  const { goal, saveGoal, deleteGoal, loading } = useAccountGoals(projectId);
  const [open, setOpen] = useState(false);
  
  const [targetLeadsMonthly, setTargetLeadsMonthly] = useState<string>('');
  const [targetCpl, setTargetCpl] = useState<string>('');
  const [targetRoas, setTargetRoas] = useState<string>('');
  const [targetCtr, setTargetCtr] = useState<string>('');
  const [targetCpc, setTargetCpc] = useState<string>('');
  const [targetSpendDaily, setTargetSpendDaily] = useState<string>('');
  const [targetSpendMonthly, setTargetSpendMonthly] = useState<string>('');

  // CPL: inside_sales, custom, pdv
  // ROAS: ecommerce, custom
  const showCPL = businessModel === 'inside_sales' || businessModel === 'custom' || businessModel === 'pdv';
  const showROAS = businessModel === 'ecommerce' || businessModel === 'custom';

  useEffect(() => {
    if (goal) {
      setTargetLeadsMonthly(goal.target_leads_monthly?.toString() || '');
      setTargetCpl(goal.target_cpl?.toString() || '');
      setTargetRoas(goal.target_roas?.toString() || '');
      setTargetCtr(goal.target_ctr?.toString() || '');
      setTargetCpc(goal.target_cpc?.toString() || '');
      setTargetSpendDaily(goal.target_spend_daily?.toString() || '');
      setTargetSpendMonthly(goal.target_spend_monthly?.toString() || '');
    }
  }, [goal]);

  const handleSave = async () => {
    await saveGoal({
      target_leads_monthly: targetLeadsMonthly ? parseInt(targetLeadsMonthly) : null,
      target_cpl: targetCpl ? parseFloat(targetCpl) : null,
      target_roas: targetRoas ? parseFloat(targetRoas) : null,
      target_ctr: targetCtr ? parseFloat(targetCtr) : null,
      target_cpc: targetCpc ? parseFloat(targetCpc) : null,
      target_spend_daily: targetSpendDaily ? parseFloat(targetSpendDaily) : null,
      target_spend_monthly: targetSpendMonthly ? parseFloat(targetSpendMonthly) : null,
    });
    setOpen(false);
    onGoalsSaved();
  };

  const handleDelete = async () => {
    await deleteGoal();
    setTargetLeadsMonthly('');
    setTargetCpl('');
    setTargetRoas('');
    setTargetCtr('');
    setTargetCpc('');
    setTargetSpendDaily('');
    setTargetSpendMonthly('');
    setOpen(false);
    onGoalsSaved();
  };

  const hasGoals = goal && (
    goal.target_leads_monthly || 
    goal.target_cpl || 
    goal.target_roas || 
    goal.target_ctr ||
    goal.target_cpc ||
    goal.target_spend_daily ||
    goal.target_spend_monthly
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Target className="w-4 h-4" />
          {hasGoals ? 'Editar Metas' : 'Configurar Metas'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Metas Gerais da Conta
          </DialogTitle>
          <DialogDescription>
            Defina metas globais para toda a conta. Essas metas serão usadas para avaliar a performance geral.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          {/* Results Goals */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Users className="w-4 h-4" />
                Metas de Resultados
              </div>
              
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="leads-monthly">Leads/Mês</Label>
                  <Input
                    id="leads-monthly"
                    type="number"
                    step="1"
                    placeholder="Ex: 500"
                    value={targetLeadsMonthly}
                    onChange={(e) => setTargetLeadsMonthly(e.target.value)}
                  />
                </div>
                
                {showCPL && (
                  <div className="space-y-2">
                    <Label htmlFor="cpl">CPL Máximo (R$)</Label>
                    <Input
                      id="cpl"
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
                    <Label htmlFor="roas">ROAS Mínimo (x)</Label>
                    <Input
                      id="roas"
                      type="number"
                      step="0.1"
                      placeholder="Ex: 3.0"
                      value={targetRoas}
                      onChange={(e) => setTargetRoas(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Efficiency Goals */}
          <Card className="bg-muted/50">
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Percent className="w-4 h-4" />
                Metas de Eficiência
              </div>
              
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ctr">CTR Mínimo (%)</Label>
                  <Input
                    id="ctr"
                    type="number"
                    step="0.01"
                    placeholder="Ex: 1.5"
                    value={targetCtr}
                    onChange={(e) => setTargetCtr(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cpc">CPC Máximo (R$)</Label>
                  <Input
                    id="cpc"
                    type="number"
                    step="0.01"
                    placeholder="Ex: 2.50"
                    value={targetCpc}
                    onChange={(e) => setTargetCpc(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Budget Goals */}
          <Card className="bg-muted/50">
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <DollarSign className="w-4 h-4" />
                Metas de Investimento
              </div>
              
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="spend-daily">Gasto/Dia (R$)</Label>
                  <Input
                    id="spend-daily"
                    type="number"
                    step="0.01"
                    placeholder="Ex: 500.00"
                    value={targetSpendDaily}
                    onChange={(e) => setTargetSpendDaily(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="spend-monthly">Gasto/Mês (R$)</Label>
                  <Input
                    id="spend-monthly"
                    type="number"
                    step="0.01"
                    placeholder="Ex: 15000.00"
                    value={targetSpendMonthly}
                    onChange={(e) => setTargetSpendMonthly(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={loading} className="flex-1 gap-2">
              <Save className="w-4 h-4" />
              Salvar Metas
            </Button>
            {hasGoals && (
              <Button 
                variant="outline" 
                onClick={handleDelete}
                disabled={loading}
                className="text-destructive hover:text-destructive gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Remover
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
