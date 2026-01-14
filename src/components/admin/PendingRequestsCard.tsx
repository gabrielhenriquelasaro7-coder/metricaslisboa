import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, X, Clock, User, Loader2 } from 'lucide-react';
import { useAdminAccessRequests } from '@/hooks/useAdminAccessRequests';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function PendingRequestsCard() {
  const { requests, loading, approveRequest, rejectRequest } = useAdminAccessRequests();
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Solicitações Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Solicitações Pendentes
          </CardTitle>
          <CardDescription>
            Solicitações de acesso ao Admin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Check className="w-12 h-12 mx-auto mb-2 text-emerald-500" />
            <p>Nenhuma solicitação pendente</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Solicitações Pendentes
            <Badge variant="secondary" className="ml-2">
              {requests.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            Aprovar ou rejeitar acesso ao Admin
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="p-4 border rounded-lg bg-card hover:bg-secondary/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium truncate">
                      {request.user_name || 'Usuário'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {request.reason}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(request.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    onClick={() => handleApprove(request.id)}
                    disabled={processingId === request.id}
                  >
                    {processingId === request.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => openRejectDialog(request.id)}
                    disabled={processingId === request.id}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

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
    </>
  );
}
