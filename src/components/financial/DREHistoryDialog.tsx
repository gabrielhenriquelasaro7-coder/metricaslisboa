import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  History, 
  Download, 
  FileText, 
  Edit, 
  Lock, 
  Unlock, 
  Save,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Target,
  BarChart3,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DREHistoryEntry, DREHistoryInput, useDREHistory } from '@/hooks/useDREHistory';

interface DREHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatPercent = (value: number) => {
  return `${value.toFixed(2)}%`;
};

export function DREHistoryDialog({ open, onOpenChange, projectId }: DREHistoryDialogProps) {
  const { 
    history, 
    isLoading, 
    createOrUpdateDRE, 
    closeDRE, 
    reopenDRE,
    getMonthLabel 
  } = useDREHistory(projectId);
  
  const [selectedDRE, setSelectedDRE] = useState<DREHistoryEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<DREHistoryInput>({});

  const statusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Aberto</Badge>;
      case 'closed':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">Fechado</Badge>;
      case 'locked':
        return <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/20">Bloqueado</Badge>;
      default:
        return null;
    }
  };

  const handleEdit = (dre: DREHistoryEntry) => {
    setSelectedDRE(dre);
    setEditData({
      gross_revenue: dre.gross_revenue,
      deductions: dre.deductions,
      ad_spend_meta: dre.ad_spend_meta,
      ad_spend_google: dre.ad_spend_google,
      ad_spend_other: dre.ad_spend_other,
      total_leads: dre.total_leads,
      total_mql: dre.total_mql,
      total_sql: dre.total_sql,
      total_sales: dre.total_sales,
      operational_expenses: dre.operational_expenses,
      notes: dre.notes || '',
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!selectedDRE) return;
    
    // Recalculate derived fields
    const grossRevenue = editData.gross_revenue || 0;
    const deductions = editData.deductions || 0;
    const netRevenue = grossRevenue - deductions;
    const totalAdSpend = (editData.ad_spend_meta || 0) + (editData.ad_spend_google || 0) + (editData.ad_spend_other || 0);
    const totalLeads = editData.total_leads || 0;
    const totalSales = editData.total_sales || 0;
    
    await createOrUpdateDRE(selectedDRE.year, selectedDRE.month, {
      ...editData,
      net_revenue: netRevenue,
      total_ad_spend: totalAdSpend,
      cpl: totalLeads > 0 ? totalAdSpend / totalLeads : 0,
      cac: totalSales > 0 ? totalAdSpend / totalSales : 0,
      average_ticket: totalSales > 0 ? grossRevenue / totalSales : 0,
      conversion_rate: totalLeads > 0 ? (totalSales / totalLeads) * 100 : 0,
      roas: totalAdSpend > 0 ? grossRevenue / totalAdSpend : 0,
      contribution_margin: netRevenue - totalAdSpend,
      ebitda: netRevenue - totalAdSpend - (editData.operational_expenses || 0),
    });
    
    setIsEditing(false);
    setSelectedDRE(null);
  };

  const exportCSV = (dre: DREHistoryEntry) => {
    const headers = [
      'Período', 'Status', 'Receita Bruta', 'Deduções', 'Receita Líquida',
      'Investimento Meta', 'Investimento Google', 'Outros Investimentos', 'Total Investido',
      'Leads', 'MQL', 'SQL', 'Vendas',
      'CPL', 'CAC', 'Ticket Médio', 'Taxa Conversão', 'ROAS',
      'Margem Contribuição', 'Despesas Operacionais', 'EBITDA'
    ];
    
    const values = [
      getMonthLabel(dre.year, dre.month),
      dre.status,
      dre.gross_revenue,
      dre.deductions,
      dre.net_revenue,
      dre.ad_spend_meta,
      dre.ad_spend_google,
      dre.ad_spend_other,
      dre.total_ad_spend,
      dre.total_leads,
      dre.total_mql,
      dre.total_sql,
      dre.total_sales,
      dre.cpl,
      dre.cac,
      dre.average_ticket,
      dre.conversion_rate,
      dre.roas,
      dre.contribution_margin,
      dre.operational_expenses,
      dre.ebitda,
    ];

    const csv = [headers.join(';'), values.join(';')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DRE_${dre.year}_${String(dre.month).padStart(2, '0')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const DREDetailView = ({ dre }: { dre: DREHistoryEntry }) => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => setSelectedDRE(null)} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCSV(dre)} className="gap-2">
            <Download className="h-4 w-4" />
            CSV
          </Button>
          {dre.status === 'open' ? (
            <>
              <Button variant="outline" size="sm" onClick={() => handleEdit(dre)} className="gap-2">
                <Edit className="h-4 w-4" />
                Editar
              </Button>
              <Button variant="outline" size="sm" onClick={() => closeDRE(dre.id)} className="gap-2">
                <Lock className="h-4 w-4" />
                Fechar Mês
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => reopenDRE(dre.id)} className="gap-2">
              <Unlock className="h-4 w-4" />
              Reabrir
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <DollarSign className="h-4 w-4" />
              Receita Bruta
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(dre.gross_revenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <TrendingDown className="h-4 w-4" />
              Investimento Total
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(dre.total_ad_spend)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Users className="h-4 w-4" />
              Vendas
            </div>
            <p className="text-2xl font-bold mt-1">{dre.total_sales}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <TrendingUp className="h-4 w-4" />
              EBITDA
            </div>
            <p className={`text-2xl font-bold mt-1 ${dre.ebitda >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatCurrency(dre.ebitda)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">DRE Completa - {getMonthLabel(dre.year, dre.month)}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow className="font-semibold bg-muted/50">
                <TableCell>RECEITA BRUTA</TableCell>
                <TableCell className="text-right">{formatCurrency(dre.gross_revenue)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-6">(-) Deduções</TableCell>
                <TableCell className="text-right text-red-500">-{formatCurrency(dre.deductions)}</TableCell>
              </TableRow>
              <TableRow className="font-semibold">
                <TableCell>= RECEITA LÍQUIDA</TableCell>
                <TableCell className="text-right">{formatCurrency(dre.net_revenue)}</TableCell>
              </TableRow>
              <TableRow className="bg-muted/30">
                <TableCell colSpan={2} className="font-semibold">CUSTOS DE AQUISIÇÃO</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-6">Meta Ads</TableCell>
                <TableCell className="text-right text-red-500">-{formatCurrency(dre.ad_spend_meta)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-6">Google Ads</TableCell>
                <TableCell className="text-right text-red-500">-{formatCurrency(dre.ad_spend_google)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-6">Outros</TableCell>
                <TableCell className="text-right text-red-500">-{formatCurrency(dre.ad_spend_other)}</TableCell>
              </TableRow>
              <TableRow className="font-semibold">
                <TableCell>(-) TOTAL CAC</TableCell>
                <TableCell className="text-right text-red-500">-{formatCurrency(dre.total_ad_spend)}</TableCell>
              </TableRow>
              <TableRow className="font-semibold bg-muted/50">
                <TableCell>= MARGEM DE CONTRIBUIÇÃO</TableCell>
                <TableCell className={`text-right ${dre.contribution_margin >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatCurrency(dre.contribution_margin)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>(-) Despesas Operacionais</TableCell>
                <TableCell className="text-right text-red-500">-{formatCurrency(dre.operational_expenses)}</TableCell>
              </TableRow>
              <TableRow className="font-bold bg-muted">
                <TableCell>= EBITDA</TableCell>
                <TableCell className={`text-right ${dre.ebitda >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatCurrency(dre.ebitda)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Métricas do Período
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Leads</p>
              <p className="text-lg font-semibold">{dre.total_leads}</p>
            </div>
            <div>
              <p className="text-muted-foreground">MQL</p>
              <p className="text-lg font-semibold">{dre.total_mql}</p>
            </div>
            <div>
              <p className="text-muted-foreground">SQL</p>
              <p className="text-lg font-semibold">{dre.total_sql}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Vendas</p>
              <p className="text-lg font-semibold">{dre.total_sales}</p>
            </div>
            <div>
              <p className="text-muted-foreground">CPL</p>
              <p className="text-lg font-semibold">{formatCurrency(dre.cpl)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">CAC</p>
              <p className="text-lg font-semibold">{formatCurrency(dre.cac)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Ticket Médio</p>
              <p className="text-lg font-semibold">{formatCurrency(dre.average_ticket)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Taxa Conversão</p>
              <p className="text-lg font-semibold">{formatPercent(dre.conversion_rate)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">ROAS</p>
              <p className="text-lg font-semibold">{dre.roas.toFixed(2)}x</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {dre.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{dre.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const EditForm = () => {
    if (!selectedDRE) return null;
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => { setIsEditing(false); setSelectedDRE(null); }} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Cancelar
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            Salvar
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Receita</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Receita Bruta</Label>
                <Input
                  type="number"
                  value={editData.gross_revenue || ''}
                  onChange={(e) => setEditData({ ...editData, gross_revenue: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Deduções</Label>
                <Input
                  type="number"
                  value={editData.deductions || ''}
                  onChange={(e) => setEditData({ ...editData, deductions: Number(e.target.value) })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Investimento em Ads</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Meta Ads</Label>
                <Input
                  type="number"
                  value={editData.ad_spend_meta || ''}
                  onChange={(e) => setEditData({ ...editData, ad_spend_meta: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Google Ads</Label>
                <Input
                  type="number"
                  value={editData.ad_spend_google || ''}
                  onChange={(e) => setEditData({ ...editData, ad_spend_google: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Outros</Label>
                <Input
                  type="number"
                  value={editData.ad_spend_other || ''}
                  onChange={(e) => setEditData({ ...editData, ad_spend_other: Number(e.target.value) })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Funil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Leads</Label>
                  <Input
                    type="number"
                    value={editData.total_leads || ''}
                    onChange={(e) => setEditData({ ...editData, total_leads: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>MQL</Label>
                  <Input
                    type="number"
                    value={editData.total_mql || ''}
                    onChange={(e) => setEditData({ ...editData, total_mql: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>SQL</Label>
                  <Input
                    type="number"
                    value={editData.total_sql || ''}
                    onChange={(e) => setEditData({ ...editData, total_sql: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Vendas</Label>
                  <Input
                    type="number"
                    value={editData.total_sales || ''}
                    onChange={(e) => setEditData({ ...editData, total_sales: Number(e.target.value) })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Despesas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Despesas Operacionais</Label>
                <Input
                  type="number"
                  value={editData.operational_expenses || ''}
                  onChange={(e) => setEditData({ ...editData, operational_expenses: Number(e.target.value) })}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={editData.notes || ''}
              onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
              placeholder="Adicione observações sobre este período..."
              rows={4}
            />
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de DRE
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[70vh] pr-4">
          {isEditing && selectedDRE ? (
            <EditForm />
          ) : selectedDRE ? (
            <DREDetailView dre={selectedDRE} />
          ) : (
            <div className="space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum histórico de DRE encontrado</p>
                  <p className="text-sm mt-2">Os registros serão criados automaticamente a cada mês</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">Investimento</TableHead>
                      <TableHead className="text-right">EBITDA</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((dre) => (
                      <TableRow 
                        key={dre.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedDRE(dre)}
                      >
                        <TableCell className="font-medium capitalize">
                          {getMonthLabel(dre.year, dre.month)}
                        </TableCell>
                        <TableCell>{statusBadge(dre.status)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(dre.gross_revenue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(dre.total_ad_spend)}</TableCell>
                        <TableCell className={`text-right font-medium ${dre.ebitda >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {formatCurrency(dre.ebitda)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              exportCSV(dre);
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
