import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, X, Clock, User, Loader2, ShieldAlert, Lightbulb, RefreshCw } from 'lucide-react';
import { useAdminAccessRequests } from '@/hooks/useAdminAccessRequests';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { InvestorSuggestionsManagement } from './InvestorSuggestionsManagement';

export function RequestsManagement() {
  const { requests, loading, approveRequest, rejectRequest, refetch } = useAdminAccessRequests();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      await approveRequest(id);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    setProcessingId(selectedRequest);
    try {
      await rejectRequest(selectedRequest, rejectReason);
      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectReason('');
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectDialog = (id: string) => {
    setSelectedRequest(id);
    setRejectDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="admin-access" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="admin-access" className="gap-2">
            <ShieldAlert className="w-4 h-4" />
            Acesso Admin
            {requests.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {requests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="gap-2">
            <Lightbulb className="w-4 h-4" />
            Sugestões
          </TabsTrigger>
        </TabsList>

        {/* Admin Access Requests */}
        <TabsContent value="admin-access" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-primary" />
                    Solicitações de Acesso ao Admin
                  </CardTitle>
                  <CardDescription>
                    Investidores, Coordenadores e Gerentes que pediram acesso à administração
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => refetch()}
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : requests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Check className="w-12 h-12 mx-auto mb-2 text-emerald-500" />
                  <p>Nenhuma solicitação pendente</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {requests.map((request) => (
                    <div
                      key={request.id}
                      className="p-4 border rounded-lg bg-card hover:bg-secondary/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">
                              {request.user_name || 'Usuário'}
                            </span>
                            {request.user_cargo && (
                              <Badge variant="outline" className="text-xs capitalize">
                                {request.user_cargo.replace(/_/g, ' ')}
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-xs">
                              Pendente
                            </Badge>
                          </div>
                          {request.project_name && (
                            <p className="text-sm text-primary font-medium mb-1">
                              📁 Projeto: {request.project_name}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground mb-2 bg-muted/50 p-2 rounded">
                            "{request.reason}"
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Solicitado {formatDistanceToNow(new Date(request.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                            onClick={() => handleApprove(request.id)}
                            disabled={processingId === request.id}
                          >
                            {processingId === request.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Check className="w-4 h-4" />
                                Aprovar
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-1"
                            onClick={() => openRejectDialog(request.id)}
                            disabled={processingId === request.id}
                          >
                            <X className="w-4 h-4" />
                            Rejeitar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Investor Suggestions */}
        <TabsContent value="suggestions" className="space-y-4">
          <InvestorSuggestionsManagement />
        </TabsContent>
      </Tabs>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeitar Solicitação</DialogTitle>
            <DialogDescription>
              Opcionalmente, informe o motivo da rejeição.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Motivo da rejeição (opcional)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setRejectDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={processingId !== null}
              >
                {processingId ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Rejeitar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
