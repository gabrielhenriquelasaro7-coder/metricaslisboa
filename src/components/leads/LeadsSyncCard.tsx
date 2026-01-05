import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Users, RefreshCw, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';
import { useRealLeads, useLeadsComparison, useSyncLeads, useLeadgenForms } from '@/hooks/useRealLeads';
import { format, subDays, startOfMonth } from 'date-fns';

interface LeadsSyncCardProps {
  projectId: string;
  facebookPageId?: string | null;
  dateRange?: { from: Date; to: Date };
}

export function LeadsSyncCard({ projectId, facebookPageId, dateRange }: LeadsSyncCardProps) {
  const [pageId, setPageId] = useState(facebookPageId || '');
  const [syncSince, setSyncSince] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  
  const { leads, count: realLeadsCount, isLoading: isLoadingLeads } = useRealLeads(projectId, dateRange);
  const { forms, isLoading: isLoadingForms } = useLeadgenForms(projectId);
  const { syncLeads, isSyncing } = useSyncLeads(projectId);
  const comparison = useLeadsComparison(projectId, dateRange);

  const handleSync = () => {
    if (!pageId) return;
    
    syncLeads({
      pageId,
      since: syncSince,
      until: format(new Date(), 'yyyy-MM-dd'),
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Leads Reais</CardTitle>
          </div>
          {comparison.hasDivergence && (
            <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-600">
              <AlertTriangle className="h-3 w-3" />
              Divergência detectada
            </Badge>
          )}
        </div>
        <CardDescription>
          Leads sincronizados diretamente dos formulários do Meta
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Comparison Section */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Leads Reais</span>
            </div>
            <p className="text-2xl font-bold">{realLeadsCount}</p>
            <p className="text-xs text-muted-foreground">da API /leads</p>
          </div>
          
          <div className="p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Insights API</span>
            </div>
            <p className="text-2xl font-bold">{comparison.insightsConversions}</p>
            <p className="text-xs text-muted-foreground">action_types</p>
          </div>
        </div>

        {/* Divergence Alert */}
        {comparison.hasDivergence && (
          <div className={`p-3 rounded-lg flex items-center gap-3 ${
            comparison.difference > 0 
              ? 'bg-green-500/10 border border-green-500/20' 
              : 'bg-red-500/10 border border-red-500/20'
          }`}>
            {comparison.difference > 0 ? (
              <TrendingUp className="h-5 w-5 text-green-500" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-500" />
            )}
            <div>
              <p className="text-sm font-medium">
                Diferença: {comparison.difference > 0 ? '+' : ''}{comparison.difference} leads ({comparison.percentageDiff}%)
              </p>
              <p className="text-xs text-muted-foreground">
                {comparison.difference > 0 
                  ? 'Mais leads reais do que reportado nos Insights'
                  : 'Menos leads reais do que reportado nos Insights'}
              </p>
            </div>
          </div>
        )}

        {/* Forms Found */}
        {forms.length > 0 && (
          <div>
            <Label className="text-sm text-muted-foreground">Formulários encontrados</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {forms.map(form => (
                <Badge key={form.id} variant="secondary" className="text-xs">
                  {form.name || form.id} ({form.leads_count})
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Sync Controls */}
        <div className="space-y-4 pt-4 border-t">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pageId">Facebook Page ID</Label>
              <Input
                id="pageId"
                placeholder="Ex: 123456789"
                value={pageId}
                onChange={(e) => setPageId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="syncSince">Sincronizar desde</Label>
              <Input
                id="syncSince"
                type="date"
                value={syncSince}
                onChange={(e) => setSyncSince(e.target.value)}
              />
            </div>
          </div>

          <Button 
            onClick={handleSync} 
            disabled={!pageId || isSyncing}
            className="w-full"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Sincronizando leads...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sincronizar Leads
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Requer permissões: leads_retrieval, pages_read_engagement
          </p>
        </div>

        {/* Recent Leads Preview */}
        {leads.length > 0 && (
          <div className="pt-4 border-t">
            <Label className="text-sm text-muted-foreground mb-2 block">Últimos leads</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {leads.slice(0, 5).map(lead => (
                <div key={lead.id} className="p-2 rounded bg-muted/50 text-sm">
                  <div className="flex justify-between items-start">
                    <span className="font-medium">{lead.lead_name || 'Sem nome'}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(lead.created_time), 'dd/MM HH:mm')}
                    </span>
                  </div>
                  {lead.lead_email && (
                    <p className="text-xs text-muted-foreground">{lead.lead_email}</p>
                  )}
                  {lead.ad_name && (
                    <p className="text-xs text-muted-foreground truncate">Ad: {lead.ad_name}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
